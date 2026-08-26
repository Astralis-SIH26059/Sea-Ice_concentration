from datetime import date
from pathlib import Path
import numpy as np
import xarray as xr
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from pyproj import Transformer

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_FILE = BASE_DIR / "data" / "sic_pss25_20170101-20171231_v06r00.nc"

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
    return {
        "requested_date": str(requested_date),
        "data_date": str(selected)[:10],
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

@app.get("/api/ice/historical")
def historical(date: date = Query(..., description="YYYY-MM-DD")):
    dataset = get_dataset()
    try:
        day = dataset["cdr_seaice_conc"].sel(time=str(date))
    except Exception:
        raise HTTPException(status_code=404, detail="Date not present; this file covers 2017 only.")

    values = day.values
    xv, yv = dataset["x"].values, dataset["y"].values
    yy, xx = np.where(np.isfinite(values))
    max_points = 20000
    data = [
        {"x": float(xv[xi]), "y": float(yv[yi]),
         "sea_ice_concentration": round(float(values[yi, xi])*100, 2)}
        for yi, xi in zip(yy[:max_points], xx[:max_points])
    ]
    return {"date": str(date), "total_valid_grid_cells": int(len(yy)),
            "returned_grid_cells": len(data), "data": data}

@app.post("/api/ice/predict")
def predict(request: PredictionRequest):
    raise HTTPException(
        status_code=501,
        detail="Prediction is not connected yet. We need the ML model's exact features and preprocessing."
    )

@app.get("/api/ice/region")
def region(
    latitude: float = Query(..., ge=-90, le=0),
    longitude: float = Query(..., ge=-180, le=180),
    date: date = Query(..., description="YYYY-MM-DD"),
):
    c = lookup_concentration(date, latitude, longitude)
    return {
        "location": {"latitude": latitude, "longitude": longitude},
        "current_sic": c["sea_ice_concentration"],
        "data_date": c["data_date"],
        "predictions": [],
        "trend": "not_available",
    }
