import xgboost as xgb
import joblib
import pandas as pd
MODEL_PATH = "models/seaice_xgboost_model.json"
METADATA_PATH = "models/model_metadata.joblib"
model = xgb.XGBRegressor()
model.load_model(MODEL_PATH)
metadata = joblib.load(METADATA_PATH)
def predict_sic(location_id, y_index, x_index, x, y, sic_lag_1, sic_lag_2, sic_lag_3, sic_lag_7, sic_lag_14, sic_lag_30, day_of_year,month):
    input_data = pd.DataFrame([{
        "location_id": location_id,
        "y_index": y_index,
        "x_index": x_index,
        "x": x,
        "y": y,
        "sic_lag_1": sic_lag_1,
        "sic_lag_2": sic_lag_2,
        "sic_lag_3": sic_lag_3,
        "sic_lag_7": sic_lag_7,
        "sic_lag_14": sic_lag_14,
        "sic_lag_30": sic_lag_30,
        "day_of_year": day_of_year,
        "month": month
    }])
    prediction = model.predict(input_data)[0]
    prediction = max(0.0, min(1.0, float(prediction)))
    return prediction