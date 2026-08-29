import os
import pandas as pd
import numpy as np
import joblib

from xgboost import XGBRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score


# ============================================================
# CONFIGURATION
# ============================================================

DATA_FILE = "data/processed/ml_training_data.csv"
MODEL_DIR = "models"

MODEL_FILE = os.path.join(MODEL_DIR, "seaice_xgboost_model.json")

RANDOM_STATE = 42

# Maximum number of training rows we will use
MAX_TRAIN_ROWS = 1_000_000


# ============================================================
# START
# ============================================================

print("=" * 60)
print("ANTARCTIC SEA-ICE ML MODEL TRAINING")
print("=" * 60)

print("\nLoading ML dataset...")
print("File:", DATA_FILE)

df = pd.read_csv(DATA_FILE)

print("\nDataset loaded successfully!")

print("Total rows:", len(df))
print("Total columns:", len(df.columns))


# ============================================================
# DATE CONVERSION
# ============================================================

print("\nConverting dates...")

df["date"] = pd.to_datetime(df["date"])

print("Date conversion complete.")

print("First date:", df["date"].min())
print("Last date:", df["date"].max())


# ============================================================
# FEATURES
# ============================================================

FEATURES = [
    "location_id",
    "y_index",
    "x_index",
    "x",
    "y",
    "sic_lag_1",
    "sic_lag_2",
    "sic_lag_3",
    "sic_lag_7",
    "sic_lag_14",
    "sic_lag_30",
    "day_of_year",
    "month"
]

TARGET = "target_sic"


print("\nFeatures being used:")

for feature in FEATURES:
    print(" -", feature)

print("\nTarget:")
print(" -", TARGET)


# ============================================================
# CHECK DATA
# ============================================================

print("\nChecking for missing values...")

missing = df[FEATURES + [TARGET]].isna().sum()

print(missing)

if missing.sum() > 0:
    print("\nERROR: Missing values detected!")
    print("Stop here and fix the dataset.")
    raise SystemExit

print("\nNo missing values detected. Good!")


# ============================================================
# TIME-BASED SPLIT
# ============================================================

print("\n" + "=" * 60)
print("TIME-BASED DATA SPLIT")
print("=" * 60)

print("\nTraining period : 2015 - 2023")
print("Validation      : 2024")
print("Testing         : 2025")


train_df = df[df["date"].dt.year <= 2023].copy()

val_df = df[df["date"].dt.year == 2024].copy()

test_df = df[df["date"].dt.year == 2025].copy()


print("\nRows before sampling:")

print("Training   :", len(train_df))
print("Validation :", len(val_df))
print("Testing    :", len(test_df))


# ============================================================
# SAMPLE TRAINING DATA
# ============================================================

print("\n" + "=" * 60)
print("PREPARING TRAINING DATA")
print("=" * 60)

if len(train_df) > MAX_TRAIN_ROWS:

    print(
        f"\nTraining dataset is large."
        f"\nRandomly selecting {MAX_TRAIN_ROWS:,} training examples..."
    )

    train_df = train_df.sample(
        n=MAX_TRAIN_ROWS,
        random_state=RANDOM_STATE
    )

else:

    print("\nUsing all training examples.")


print("Training rows used:", len(train_df))


# ============================================================
# CREATE X AND Y
# ============================================================

print("\nCreating feature matrices...")

X_train = train_df[FEATURES]
y_train = train_df[TARGET]

X_val = val_df[FEATURES]
y_val = val_df[TARGET]

X_test = test_df[FEATURES]
y_test = test_df[TARGET]


print("\nShapes:")

print("X_train:", X_train.shape)
print("y_train:", y_train.shape)

print("X_val:", X_val.shape)
print("y_val:", y_val.shape)

print("X_test:", X_test.shape)
print("y_test:", y_test.shape)


# ============================================================
# CREATE MODEL
# ============================================================

print("\n" + "=" * 60)
print("CREATING XGBOOST MODEL")
print("=" * 60)

model = XGBRegressor(
    n_estimators=300,
    max_depth=8,
    learning_rate=0.08,
    subsample=0.8,
    colsample_bytree=0.8,
    objective="reg:squarederror",
    eval_metric="mae",
    tree_method="hist",
    n_jobs=-1,
    random_state=RANDOM_STATE
)


# ============================================================
# TRAIN
# ============================================================

print("\nStarting model training...")

print("This may take some time.")

model.fit(
    X_train,
    y_train,
    eval_set=[(X_val, y_val)],
    verbose=True
)

print("\nMODEL TRAINING COMPLETE!")


# ============================================================
# VALIDATION
# ============================================================

print("\n" + "=" * 60)
print("VALIDATION")
print("=" * 60)

val_predictions = model.predict(X_val)

val_predictions = np.clip(
    val_predictions,
    0.0,
    1.0
)

val_mae = mean_absolute_error(
    y_val,
    val_predictions
)

val_rmse = np.sqrt(
    mean_squared_error(
        y_val,
        val_predictions
    )
)

val_r2 = r2_score(
    y_val,
    val_predictions
)


print("\nValidation results:")

print("MAE  :", val_mae)
print("RMSE :", val_rmse)
print("R2   :", val_r2)


# ============================================================
# FINAL TEST
# ============================================================

print("\n" + "=" * 60)
print("FINAL TEST - 2025")
print("=" * 60)

test_predictions = model.predict(X_test)

test_predictions = np.clip(
    test_predictions,
    0.0,
    1.0
)

test_mae = mean_absolute_error(
    y_test,
    test_predictions
)

test_rmse = np.sqrt(
    mean_squared_error(
        y_test,
        test_predictions
    )
)

test_r2 = r2_score(
    y_test,
    test_predictions
)


print("\nFINAL TEST RESULTS:")

print("MAE  :", test_mae)
print("RMSE :", test_rmse)
print("R2   :", test_r2)


# ============================================================
# SAMPLE PREDICTIONS
# ============================================================

print("\n" + "=" * 60)
print("SAMPLE PREDICTIONS")
print("=" * 60)

comparison = pd.DataFrame({
    "Actual_SIC": y_test.iloc[:20].values,
    "Predicted_SIC": test_predictions[:20]
})

print(comparison)


# ============================================================
# SAVE MODEL
# ============================================================

print("\n" + "=" * 60)
print("SAVING MODEL")
print("=" * 60)

os.makedirs(
    MODEL_DIR,
    exist_ok=True
)

model.save_model(MODEL_FILE)

print("\nModel saved successfully!")

print("Saved to:")
print(MODEL_FILE)


# ============================================================
# SAVE METADATA
# ============================================================

metadata = {
    "features": FEATURES,
    "target": TARGET,
    "training_rows": len(train_df),
    "validation_rows": len(val_df),
    "test_rows": len(test_df),
    "validation_mae": float(val_mae),
    "validation_rmse": float(val_rmse),
    "validation_r2": float(val_r2),
    "test_mae": float(test_mae),
    "test_rmse": float(test_rmse),
    "test_r2": float(test_r2)
}

metadata_file = os.path.join(
    MODEL_DIR,
    "model_metadata.joblib"
)

joblib.dump(
    metadata,
    metadata_file
)

print("Metadata saved to:")
print(metadata_file)


# ============================================================
# COMPLETE
# ============================================================

print("\n" + "=" * 60)
print("ML MODEL PIPELINE COMPLETE")
print("=" * 60)

print("\nYour model is now ready for prediction.")