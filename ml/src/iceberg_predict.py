import os
from pathlib import Path
import numpy as np
import pandas as pd
import joblib
import xgboost as xgb
from pyproj import Transformer

# Support both ml/models and backend/models
BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"
if not (MODELS_DIR / "iceberg_wind_xgb_dx.json").exists():
    MODELS_DIR = BASE_DIR.parent / "backend" / "models"

DX_MODEL_PATH = MODELS_DIR / "iceberg_wind_xgb_dx.json"
DY_MODEL_PATH = MODELS_DIR / "iceberg_wind_xgb_dy.json"
METADATA_PATH = MODELS_DIR / "iceberg_wind_xgb_metadata.joblib"

TO_PROJECTED = Transformer.from_crs("EPSG:4326", "EPSG:3412", always_xy=True)
TO_GEOGRAPHIC = Transformer.from_crs("EPSG:3412", "EPSG:4326", always_xy=True)


def project_point(lat: float, lon: float) -> tuple[float, float]:
    x, y = TO_PROJECTED.transform(lon, lat)
    return float(x), float(y)


def geographic_point(x: float, y: float) -> tuple[float, float]:
    lon, lat = TO_GEOGRAPHIC.transform(x, y)
    return float(lat), float(lon)


def movement_direction(dx: float, dy: float) -> float:
    direction = np.degrees(np.arctan2(dy, dx))
    return float(direction % 360)


def calculate_wind_direction(u10: float, v10: float) -> float:
    direction = np.degrees(np.arctan2(-u10, -v10))
    return float(direction % 360)


def predict_iceberg(
    current_lat: float,
    current_lon: float,
    previous_1_lat: float,
    previous_1_lon: float,
    previous_2_lat: float,
    previous_2_lon: float,
    previous_3_lat: float,
    previous_3_lon: float,
    previous_4_lat: float,
    previous_4_lon: float,
    size: float = 100.0,
    mask: float = 1.0,
    datetime_value: str = "2022-01-01",
    u10: float = 0.0,
    v10: float = 0.0,
) -> dict:
    dx_model = xgb.XGBRegressor()
    dx_model.load_model(str(DX_MODEL_PATH))

    dy_model = xgb.XGBRegressor()
    dy_model.load_model(str(DY_MODEL_PATH))

    metadata = joblib.load(str(METADATA_PATH))
    features = metadata["features"]

    x, y = project_point(current_lat, current_lon)
    x1, y1 = project_point(previous_1_lat, previous_1_lon)
    x2, y2 = project_point(previous_2_lat, previous_2_lon)
    x3, y3 = project_point(previous_3_lat, previous_3_lon)
    x4, y4 = project_point(previous_4_lat, previous_4_lon)

    dx = x - x1
    dy = y - y1

    dx_lag_1 = x1 - x2
    dy_lag_1 = y1 - y2
    dx_lag_2 = x2 - x3
    dy_lag_2 = y2 - y3
    dx_lag_3 = x3 - x4
    dy_lag_3 = y3 - y4

    speed_m_per_day = np.sqrt(dx ** 2 + dy ** 2)
    move_dir = movement_direction(dx, dy)

    dt = pd.to_datetime(datetime_value)
    day_of_year = int(dt.dayofyear)
    month = int(dt.month)

    u10 = float(u10)
    v10 = float(v10)
    wind_speed = np.sqrt(u10 ** 2 + v10 ** 2)
    wind_dir = calculate_wind_direction(u10, v10)

    input_data = pd.DataFrame(
        [[
            x,
            y,
            x1,
            y1,
            x2,
            y2,
            x3,
            y3,
            dx,
            dy,
            dx_lag_1,
            dy_lag_1,
            dx_lag_2,
            dy_lag_2,
            dx_lag_3,
            dy_lag_3,
            speed_m_per_day,
            move_dir,
            float(size),
            float(mask),
            day_of_year,
            month,
            u10,
            v10,
            wind_speed,
            wind_dir,
        ]],
        columns=features,
    )

    predicted_dx = float(dx_model.predict(input_data)[0])
    predicted_dy = float(dy_model.predict(input_data)[0])

    predicted_x = x + predicted_dx
    predicted_y = y + predicted_dy
    predicted_lat, predicted_lon = geographic_point(predicted_x, predicted_y)

    predicted_dist_m = float(np.sqrt(predicted_dx ** 2 + predicted_dy ** 2))

    return {
        "current_lat": float(current_lat),
        "current_lon": float(current_lon),
        "predicted_dx_m": predicted_dx,
        "predicted_dy_m": predicted_dy,
        "predicted_dx_km": predicted_dx / 1000.0,
        "predicted_dy_km": predicted_dy / 1000.0,
        "predicted_movement_km": predicted_dist_m / 1000.0,
        "predicted_lat": round(float(predicted_lat), 5),
        "predicted_lon": round(float(predicted_lon), 5),
        "wind_speed_mps": round(float(wind_speed), 2),
        "wind_direction_deg": round(float(wind_dir), 1),
    }
