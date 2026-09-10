import datetime as dt
from datetime import timedelta
from pathlib import Path
import numpy as np
import xarray as xr
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pyproj import Transformer
import xgboost as xgb
import joblib
import pandas as pd
import heapq
import math

try:
    from iceberg_predict import (
        predict_iceberg,
        predict_iceberg_trajectory,
        models_available as iceberg_models_available,
    )
except ImportError:
    from backend.iceberg_predict import (
        predict_iceberg,
        predict_iceberg_trajectory,
        models_available as iceberg_models_available,
    )

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_FILE = BASE_DIR / "data" / "raw" / "sic_pss25_20170101-20171231_v06r00.nc"
MODEL_PATH = BASE_DIR / "backend" / "models" / "seaice_xgboost_model.json"

xgb_model = xgb.XGBRegressor()
if MODEL_PATH.exists():
    xgb_model.load_model(str(MODEL_PATH))

app = FastAPI(title="Polaris - Antarctic Decision Support Backend", version="2.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

TO_POLAR = Transformer.from_crs("EPSG:4326", "EPSG:3412", always_xy=True)
ds = None

class ConcentrationRequest(BaseModel):
    date: dt.date
    latitude: float = Field(..., ge=-90, le=0)
    longitude: float = Field(..., ge=-180, le=180)

class PredictionRequest(ConcentrationRequest):
    forecast_days: int = Field(default=1, ge=1, le=7)

class IcebergPosition(BaseModel):
    latitude: float = Field(..., ge=-90, le=0, description="Latitude in Antarctic region")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude")

class IcebergPredictionRequest(BaseModel):
    current: IcebergPosition
    previous_1: IcebergPosition
    previous_2: IcebergPosition
    previous_3: IcebergPosition
    previous_4: IcebergPosition
    size: float = Field(default=100.0, ge=0.1, description="Iceberg surface size")
    mask: float = Field(default=1.0, description="Iceberg mask category/flag")
    date: dt.date = Field(default_factory=dt.date.today)
    u10: float = Field(default=0.0, description="ERA5 10m U-wind component (m/s)")
    v10: float = Field(default=0.0, description="ERA5 10m V-wind component (m/s)")
    forecast_steps: int = Field(default=3, ge=1, le=5, description="Trajectory forecast days (1-5)")

class PathPredictionRequest(BaseModel):
    start_lat: float = Field(..., ge=-90, le=0)
    start_lon: float = Field(..., ge=-180, le=180)
    end_lat: float = Field(..., ge=-90, le=0)
    end_lon: float = Field(..., ge=-180, le=180)
    date: dt.date = Field(default_factory=dt.date.today)

def get_dataset():
    global ds
    if ds is None:
        if not DATA_FILE.exists():
            raise HTTPException(status_code=500, detail=f"Dataset not found: {DATA_FILE}")
        ds = xr.open_dataset(DATA_FILE)
    return ds

def nearest_valid_sic(dataset, requested_date, x, y, search_radius=5):
    try:
        day = dataset["cdr_seaice_conc"].sel(time=str(requested_date))
    except Exception:
        try:
            day = dataset["cdr_seaice_conc"].sel(time=str(requested_date), method="nearest")
        except Exception as exc:
            raise HTTPException(status_code=404, detail=f"No usable date: {exc}")

    xv = dataset["x"].values
    yv = dataset["y"].values
    xi = int(np.abs(xv - x).argmin())
    yi = int(np.abs(yv - y).argmin())

    xs, xe = max(0, xi-search_radius), min(len(xv), xi+search_radius+1)
    ys, ye = max(0, yi-search_radius), min(len(yv), yi+search_radius+1)
    values = day.isel(x=slice(xs, xe), y=slice(ys, ye)).values
    valid = np.argwhere(np.isfinite(values))

    if len(valid) == 0:
        return None

    best = None
    for ly, lx in valid:
        ax = float(xv[xs + int(lx)])
        ay = float(yv[ys + int(ly)])
        dist = (ax-x)**2 + (ay-y)**2
        if best is None or dist < best[0]:
            best = (dist, xs+int(lx), ys+int(ly), ax, ay)

    _, bxi, byi, ax, ay = best
    raw = float(day.isel(x=bxi, y=byi).values)
    return {
        "sea_ice_concentration": round(max(0, min(100, raw * 100)), 2),
        "grid_x": ax,
        "grid_y": ay,
    }

def lookup_concentration(requested_date, latitude, longitude):
    dataset = get_dataset()
    x, y = TO_POLAR.transform(longitude, latitude)
    result = nearest_valid_sic(dataset, requested_date, x, y)
    if result is None:
        raise HTTPException(status_code=404, detail="No valid SIC value near this location.")
    selected = dataset["time"].sel(time=str(requested_date), method="nearest").values
    data_date = str(selected)[:10]
    if data_date != str(requested_date):
        raise HTTPException(status_code=404, detail="Exact date not found in dataset. Fallback to prediction required.")
        
    return {
        "requested_date": str(requested_date),
        "data_date": data_date,
        "latitude": latitude,
        "longitude": longitude,
        "projected_x": round(float(x), 2),
        "projected_y": round(float(y), 2),
        **result,
    }

@app.get("/")
async def root():
    return {"message": "Antarctic Sea-Ice API is running", "dataset": DATA_FILE.name, "docs": "/docs"}

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "dataset_available": DATA_FILE.exists(),
        "dataset": DATA_FILE.name,
        "sic_model_available": MODEL_PATH.exists(),
        "iceberg_models_available": iceberg_models_available(),
    }

@app.get("/api/ice/concentration")
async def get_concentration(
    date: dt.date = Query(..., description="YYYY-MM-DD"),
    latitude: float = Query(..., ge=-90, le=0),
    longitude: float = Query(..., ge=-180, le=180),
):
    return lookup_concentration(date, latitude, longitude)

@app.post("/api/ice/concentration")
async def post_concentration(request: ConcentrationRequest):
    return lookup_concentration(request.date, request.latitude, request.longitude)



@app.post("/api/ice/predict")
async def predict(request: PredictionRequest):
    dataset = get_dataset()
    x, y = TO_POLAR.transform(request.longitude, request.latitude)
    
    # 1. Get base location mapping
    base_result = nearest_valid_sic(dataset, request.date, x, y)
    if not base_result:
        raise HTTPException(status_code=404, detail="No valid SIC value near this location.")
        
    ax, ay = base_result["grid_x"], base_result["grid_y"]
    xv = dataset["x"].values
    yv = dataset["y"].values
    x_index = int(np.abs(xv - ax).argmin())
    y_index = int(np.abs(yv - ay).argmin())
    
    # 2. Get lags
    lags = [1, 2, 3, 7, 14, 30]
    lag_values = {}
    for lag in lags:
        lag_date = request.date - timedelta(days=lag)
        try:
            day_data = dataset["cdr_seaice_conc"].sel(time=str(lag_date), method="nearest")
            raw_sic = float(day_data.isel(x=x_index, y=y_index).values)
            lag_values[f"sic_lag_{lag}"] = raw_sic
        except Exception:
            lag_values[f"sic_lag_{lag}"] = 0.0 # fallback
            
    # 3. Create prediction dataframe
    day_of_year = request.date.timetuple().tm_yday
    month = request.date.month
    
    input_data = pd.DataFrame([{
        "location_id": 0, # Placeholder
        "y_index": y_index,
        "x_index": x_index,
        "x": ax,
        "y": ay,
        "sic_lag_1": lag_values["sic_lag_1"],
        "sic_lag_2": lag_values["sic_lag_2"],
        "sic_lag_3": lag_values["sic_lag_3"],
        "sic_lag_7": lag_values["sic_lag_7"],
        "sic_lag_14": lag_values["sic_lag_14"],
        "sic_lag_30": lag_values["sic_lag_30"],
        "day_of_year": day_of_year,
        "month": month
    }])
    
    # 4. Predict
    try:
        prediction = xgb_model.predict(input_data)[0]
        prediction_pct = round(float(max(0.0, min(1.0, prediction))) * 100, 2)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")
        
    return {
        "requested_date": str(request.date),
        "latitude": request.latitude,
        "longitude": request.longitude,
        "prediction_sea_ice_concentration": prediction_pct,
        "forecast_days": request.forecast_days
    }


@app.post("/api/iceberg/predict")
async def predict_iceberg_endpoint(request: IcebergPredictionRequest):
    if not iceberg_models_available():
        raise HTTPException(
            status_code=503,
            detail="Iceberg models (iceberg_wind_xgb_dx.json, iceberg_wind_xgb_dy.json) are not available on server.",
        )

    try:
        if request.forecast_steps > 1:
            result = predict_iceberg_trajectory(
                current_lat=request.current.latitude,
                current_lon=request.current.longitude,
                previous_1_lat=request.previous_1.latitude,
                previous_1_lon=request.previous_1.longitude,
                previous_2_lat=request.previous_2.latitude,
                previous_2_lon=request.previous_2.longitude,
                previous_3_lat=request.previous_3.latitude,
                previous_3_lon=request.previous_3.longitude,
                previous_4_lat=request.previous_4.latitude,
                previous_4_lon=request.previous_4.longitude,
                size=request.size,
                mask=request.mask,
                datetime_value=str(request.date),
                u10=request.u10,
                v10=request.v10,
                steps=request.forecast_steps,
            )
        else:
            res = predict_iceberg(
                current_lat=request.current.latitude,
                current_lon=request.current.longitude,
                previous_1_lat=request.previous_1.latitude,
                previous_1_lon=request.previous_1.longitude,
                previous_2_lat=request.previous_2.latitude,
                previous_2_lon=request.previous_2.longitude,
                previous_3_lat=request.previous_3.latitude,
                previous_3_lon=request.previous_3.longitude,
                previous_4_lat=request.previous_4.latitude,
                previous_4_lon=request.previous_4.longitude,
                size=request.size,
                mask=request.mask,
                datetime_value=str(request.date),
                u10=request.u10,
                v10=request.v10,
            )
            result = dict(res)
            result["forecast_steps"] = 1
            result["trajectory"] = [
                {
                    "step": 1,
                    "date": str(request.date + timedelta(days=1)),
                    "lat": res["predicted_lat"],
                    "lon": res["predicted_lon"],
                    "predicted_dx_km": res["predicted_dx_km"],
                    "predicted_dy_km": res["predicted_dy_km"],
                    "movement_km": res["predicted_movement_km"],
                }
            ]

        return result
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Iceberg trajectory prediction failed: {str(exc)}",
        )

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

@app.post("/api/path/predict")
async def predict_path(request: PathPredictionRequest):
    dataset = get_dataset()
    
    # 0.2 deg lat, ~0.5 deg lon is roughly 20x15 km grid near the poles
    LAT_STEP = 0.2
    LON_STEP = 0.5
    
    start = (round(request.start_lat / LAT_STEP) * LAT_STEP, round(request.start_lon / LON_STEP) * LON_STEP)
    end = (round(request.end_lat / LAT_STEP) * LAT_STEP, round(request.end_lon / LON_STEP) * LON_STEP)
    
    # Pre-fetch day slice and grid coordinates once for high performance
    try:
        day = dataset["cdr_seaice_conc"].sel(time=str(request.date), method="nearest")
    except Exception:
        day = dataset["cdr_seaice_conc"].isel(time=-1)
    xv = dataset["x"].values
    yv = dataset["y"].values
    
    # Cache SIC lookups
    sic_cache = {}
    def get_sic(lat, lon):
        key = (round(lat, 3), round(lon, 3))
        if key in sic_cache:
            return sic_cache[key]
        try:
            x, y = TO_POLAR.transform(lon, lat)
            xi = int(np.abs(xv - x).argmin())
            yi = int(np.abs(yv - y).argmin())
            
            raw_val = float(day.isel(x=xi, y=yi).values)
            
            # NSIDC CDR: 0.0-1.0 is valid sea ice conc. NaN or > 1.0 (e.g. 2.54 land, 2.53 coast) is land/impassable
            if np.isnan(raw_val) or raw_val > 1.0:
                sic_cache[key] = 100.0
                return 100.0
                
            val = max(0.0, min(100.0, raw_val * 100.0))
            sic_cache[key] = val
            return val
        except Exception:
            sic_cache[key] = 100.0
            return 100.0

    if get_sic(start[0], start[1]) > 80.0:
        return {
            "status": "failed",
            "detail": "Start location is on land or impenetrable ice (Antarctica landmass). Please select points in navigable ocean.",
            "nodes_expanded": 0
        }
        
    if get_sic(end[0], end[1]) > 80.0:
        return {
            "status": "failed",
            "detail": "Destination location is on land or impenetrable ice (Antarctica landmass). Please select points in navigable ocean.",
            "nodes_expanded": 0
        }

    if start == end:
        return {"path": [{"lat": start[0], "lon": start[1]}], "total_distance_km": 0.0, "status": "success"}

    # Limit search space to prevent infinite loops / memory exhaustion
    max_nodes = 5000
    
    open_set = []
    heapq.heappush(open_set, (0.0, start))
    
    came_from = {}
    g_score = {start: 0.0}
    
    nodes_expanded = 0

    while open_set and nodes_expanded < max_nodes:
        current_f, current = heapq.heappop(open_set)
        nodes_expanded += 1
        
        if haversine(current[0], current[1], end[0], end[1]) < (LAT_STEP * 111):
            # Close enough to end
            path = [{"lat": end[0], "lon": end[1]}]
            curr = current
            total_dist = haversine(current[0], current[1], end[0], end[1])
            while curr in came_from:
                prev = came_from[curr]
                total_dist += haversine(curr[0], curr[1], prev[0], prev[1])
                path.append({"lat": curr[0], "lon": curr[1]})
                curr = prev
            path.append({"lat": start[0], "lon": start[1]})
            path.reverse()
            
            return {
                "status": "success",
                "path": path,
                "total_distance_km": round(total_dist, 2),
                "nodes_expanded": nodes_expanded
            }
            
        # Generate neighbors (8 directions)
        neighbors = [
            (current[0] + LAT_STEP, current[1]),
            (current[0] - LAT_STEP, current[1]),
            (current[0], current[1] + LON_STEP),
            (current[0], current[1] - LON_STEP),
            (current[0] + LAT_STEP, current[1] + LON_STEP),
            (current[0] - LAT_STEP, current[1] + LON_STEP),
            (current[0] + LAT_STEP, current[1] - LON_STEP),
            (current[0] - LAT_STEP, current[1] - LON_STEP),
        ]
        
        for neighbor in neighbors:
            # Check bounds roughly (Antarctica / Southern Ocean)
            if neighbor[0] > 0 or neighbor[0] < -90:
                continue
                
            dist = haversine(current[0], current[1], neighbor[0], neighbor[1])
            sic = get_sic(neighbor[0], neighbor[1])
            
            # Impassable if ice concentration > 80% or land
            if sic > 80.0:
                continue
                
            # Penalty scales with SIC: 0% -> 1x cost, 80% -> 5x cost
            penalty = 1.0 + (sic / 20.0)
            tentative_g_score = g_score[current] + (dist * penalty)
            
            if neighbor not in g_score or tentative_g_score < g_score[neighbor]:
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g_score
                f_score = tentative_g_score + haversine(neighbor[0], neighbor[1], end[0], end[1])
                heapq.heappush(open_set, (f_score, neighbor))
                
    return {
        "status": "failed",
        "detail": "Path not found within search limit or route is completely blocked by sea ice.",
        "nodes_expanded": nodes_expanded
    }
