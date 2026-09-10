import os
from pathlib import Path
import numpy as np
import pandas as pd
import joblib
import xgboost as xgb
from pyproj import Transformer

# ============================================================
# MODEL PATHS & INITIALIZATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
MODELS_DIR = BASE_DIR / "models"

if not (MODELS_DIR / "iceberg_wind_xgb_dx.json").exists():
    alt_docker = Path("/backend/models")
    if (alt_docker / "iceberg_wind_xgb_dx.json").exists():
        MODELS_DIR = alt_docker
    else:
        alt_root = BASE_DIR.parent / "backend" / "models"
        if (alt_root / "iceberg_wind_xgb_dx.json").exists():
            MODELS_DIR = alt_root

DX_MODEL_PATH = MODELS_DIR / "iceberg_wind_xgb_dx.json"
DY_MODEL_PATH = MODELS_DIR / "iceberg_wind_xgb_dy.json"
METADATA_PATH = MODELS_DIR / "iceberg_wind_xgb_metadata.joblib"

# Coordinate transformers:
# EPSG:4326 = Latitude / Longitude (Geographic)
# EPSG:3412 = Antarctic Polar Stereographic (Projected meters)
TO_PROJECTED = Transformer.from_crs("EPSG:4326", "EPSG:3412", always_xy=True)
TO_GEOGRAPHIC = Transformer.from_crs("EPSG:3412", "EPSG:4326", always_xy=True)

DX_MODEL = None
DY_MODEL = None
METADATA = None
FEATURES = None


def get_models():
    """Lazy-load and cache XGBoost models and metadata."""
    global DX_MODEL, DY_MODEL, METADATA, FEATURES

    if DX_MODEL is None or DY_MODEL is None or METADATA is None:
        if not DX_MODEL_PATH.exists() or not DY_MODEL_PATH.exists() or not METADATA_PATH.exists():
            raise FileNotFoundError(
                f"Iceberg models not found in {MODELS_DIR}. "
                "Ensure iceberg_wind_xgb_dx.json, iceberg_wind_xgb_dy.json, "
                "and iceberg_wind_xgb_metadata.joblib are present."
            )

        DX_MODEL = xgb.XGBRegressor()
        DX_MODEL.load_model(str(DX_MODEL_PATH))

        DY_MODEL = xgb.XGBRegressor()
        DY_MODEL.load_model(str(DY_MODEL_PATH))

        METADATA = joblib.load(str(METADATA_PATH))
        FEATURES = METADATA["features"]

    return DX_MODEL, DY_MODEL, FEATURES


def models_available() -> bool:
    """Check whether all model files exist."""
    return DX_MODEL_PATH.exists() and DY_MODEL_PATH.exists() and METADATA_PATH.exists()


# ============================================================
# COORDINATE FUNCTIONS
# ============================================================

def project_point(lat: float, lon: float) -> tuple[float, float]:
    """Convert latitude/longitude to Antarctic Polar Stereographic (EPSG:3412)."""
    x, y = TO_PROJECTED.transform(lon, lat)
    return float(x), float(y)


def geographic_point(x: float, y: float) -> tuple[float, float]:
    """Convert EPSG:3412 projected coordinates back to latitude/longitude."""
    lon, lat = TO_GEOGRAPHIC.transform(x, y)
    return float(lat), float(lon)


def movement_direction(dx: float, dy: float) -> float:
    """
    Iceberg movement direction in mathematical polar degrees.
    0° = East, 90° = North, 180° = West, 270° = South
    """
    direction = np.degrees(np.arctan2(dy, dx))
    return float(direction % 360)


def calculate_wind_direction(u10: float, v10: float) -> float:
    """
    Meteorological wind direction (direction wind blows from).
    0° = from North, 90° = from East, 180° = from South, 270° = from West
    """
    direction = np.degrees(np.arctan2(-u10, -v10))
    return float(direction % 360)


# ============================================================
# MAIN ICEBERG PREDICTION FUNCTION
# ============================================================

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
    """
    Predict the next 24-hour iceberg position.

    Required position history:
      - Current position
      - Previous 1
      - Previous 2
      - Previous 3
      - Previous 4
    """
    dx_model, dy_model, features = get_models()

    # 1. Project all positions
    x, y = project_point(current_lat, current_lon)
    x1, y1 = project_point(previous_1_lat, previous_1_lon)
    x2, y2 = project_point(previous_2_lat, previous_2_lon)
    x3, y3 = project_point(previous_3_lat, previous_3_lon)
    x4, y4 = project_point(previous_4_lat, previous_4_lon)

    # 2. Current movement
    dx = x - x1
    dy = y - y1

    # 3. Lagged movements
    dx_lag_1 = x1 - x2
    dy_lag_1 = y1 - y2
    dx_lag_2 = x2 - x3
    dy_lag_2 = y2 - y3
    dx_lag_3 = x3 - x4
    dy_lag_3 = y3 - y4

    # 4. Current speed (meters per day)
    speed_m_per_day = np.sqrt(dx ** 2 + dy ** 2)

    # 5. Current movement direction
    move_dir = movement_direction(dx, dy)

    # 6. Date features
    dt = pd.to_datetime(datetime_value)
    day_of_year = int(dt.dayofyear)
    month = int(dt.month)

    # 7. Wind features
    u10 = float(u10)
    v10 = float(v10)
    wind_speed = np.sqrt(u10 ** 2 + v10 ** 2)
    wind_dir = calculate_wind_direction(u10, v10)

    # 8. Create model input
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

    # 9. Predict next movement displacement
    predicted_dx = float(dx_model.predict(input_data)[0])
    predicted_dy = float(dy_model.predict(input_data)[0])

    # 10. Calculate next projected and geographic positions
    predicted_x = x + predicted_dx
    predicted_y = y + predicted_dy
    predicted_lat, predicted_lon = geographic_point(predicted_x, predicted_y)

    # 11. Movement distance
    predicted_dist_m = float(np.sqrt(predicted_dx ** 2 + predicted_dy ** 2))

    return {
        "current_lat": float(current_lat),
        "current_lon": float(current_lon),
        "predicted_dx_m": predicted_dx,
        "predicted_dy_m": predicted_dy,
        "predicted_dx_km": predicted_dx / 1000.0,
        "predicted_dy_km": predicted_dy / 1000.0,
        "predicted_movement_km": predicted_dist_m / 1000.0,
        "predicted_movement_m": predicted_dist_m,
        "predicted_lat": round(float(predicted_lat), 5),
        "predicted_lon": round(float(predicted_lon), 5),
        "drift_direction_deg": movement_direction(predicted_dx, predicted_dy),
        "wind_speed_mps": round(float(wind_speed), 2),
        "wind_direction_deg": round(float(wind_dir), 1),
    }


def predict_iceberg_trajectory(
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
    steps: int = 1,
) -> dict:
    """
    Predict multi-step iceberg trajectory forecasting (1 to 5 steps).
    Rolls predictions iteratively forward.
    """
    history = [
        (previous_4_lat, previous_4_lon),
        (previous_3_lat, previous_3_lon),
        (previous_2_lat, previous_2_lon),
        (previous_1_lat, previous_1_lon),
        (current_lat, current_lon),
    ]

    current_date = pd.to_datetime(datetime_value)
    steps_list = []
    base_result = None

    for s in range(1, steps + 1):
        step_dt_str = (current_date + pd.Timedelta(days=s - 1)).strftime("%Y-%m-%d")
        step_res = predict_iceberg(
            current_lat=history[-1][0],
            current_lon=history[-1][1],
            previous_1_lat=history[-2][0],
            previous_1_lon=history[-2][1],
            previous_2_lat=history[-3][0],
            previous_2_lon=history[-3][1],
            previous_3_lat=history[-4][0],
            previous_3_lon=history[-4][1],
            previous_4_lat=history[-5][0],
            previous_4_lon=history[-5][1],
            size=size,
            mask=mask,
            datetime_value=step_dt_str,
            u10=u10,
            v10=v10,
        )

        if s == 1:
            base_result = step_res

        history.append((step_res["predicted_lat"], step_res["predicted_lon"]))
        steps_list.append({
            "step": s,
            "date": (current_date + pd.Timedelta(days=s)).strftime("%Y-%m-%d"),
            "lat": step_res["predicted_lat"],
            "lon": step_res["predicted_lon"],
            "predicted_dx_km": step_res["predicted_dx_km"],
            "predicted_dy_km": step_res["predicted_dy_km"],
            "movement_km": step_res["predicted_movement_km"],
        })

    result = dict(base_result)
    result["forecast_steps"] = steps
    result["trajectory"] = steps_list
    return result


if __name__ == "__main__":
    test_result = predict_iceberg(
        current_lat=-75.858,
        current_lon=-40.736,
        previous_1_lat=-75.860,
        previous_1_lon=-40.696,
        previous_2_lat=-75.861,
        previous_2_lon=-40.651,
        previous_3_lat=-75.863,
        previous_3_lon=-40.604,
        previous_4_lat=-75.864,
        previous_4_lon=-40.570,
        size=100.0,
        mask=1,
        datetime_value="2022-01-01",
        u10=-0.514881,
        v10=5.418915,
    )
    print("Test Prediction Output:")
    for k, v in test_result.items():
        print(f"  {k}: {v}")
