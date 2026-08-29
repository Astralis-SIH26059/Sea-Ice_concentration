from datetime import date
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
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_FILE = BASE_DIR / "data" / "raw" / "sic_pss25_20170101-20171231_v06r00.nc"
MODEL_PATH = BASE_DIR / "backend" / "models" / "seaice_xgboost_model.json"

xgb_model = xgb.XGBRegressor()
if MODEL_PATH.exists():
    xgb_model.load_model(str(MODEL_PATH))

app = FastAPI(title="Antarctic Sea-Ice Backend", version="2.0.0")

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
    date: date
    latitude: float = Field(..., ge=-90, le=0)
    longitude: float = Field(..., ge=-180, le=180)

class PredictionRequest(ConcentrationRequest):
    forecast_days: int = Field(default=1, ge=1, le=7)

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
def root():
    return {"message": "Antarctic Sea-Ice API is running", "dataset": DATA_FILE.name, "docs": "/docs"}

@app.get("/health")
def health():
    return {"status": "ok", "dataset_available": DATA_FILE.exists(), "dataset": DATA_FILE.name}

@app.get("/api/ice/concentration")
def get_concentration(
    date: date = Query(..., description="YYYY-MM-DD"),
    latitude: float = Query(..., ge=-90, le=0),
    longitude: float = Query(..., ge=-180, le=180),
):
    return lookup_concentration(date, latitude, longitude)

@app.post("/api/ice/concentration")
def post_concentration(request: ConcentrationRequest):
    return lookup_concentration(request.date, request.latitude, request.longitude)



@app.post("/api/ice/predict")
def predict(request: PredictionRequest):
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


