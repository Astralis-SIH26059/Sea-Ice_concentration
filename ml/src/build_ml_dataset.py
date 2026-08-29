from pathlib import Path

import numpy as np
import pandas as pd
import xarray as xr


# ============================================================
# SETTINGS
# ============================================================

DATA_FOLDER = Path("data/raw")

LOCATION_FILE = Path(
    "data/processed/selected_locations.csv"
)

OUTPUT_FOLDER = Path(
    "data/processed"
)

OUTPUT_FOLDER.mkdir(
    parents=True,
    exist_ok=True
)


# ============================================================
# ML SETTINGS
# ============================================================

# Historical days used as input features
LAGS = [1, 2, 3, 7, 14, 30]

# Number of locations
MAX_LOCATIONS = 2000


# ============================================================
# FIND NETCDF FILES
# ============================================================

print()
print("============================================================")
print("BUILDING ML TRAINING DATASET")
print("============================================================")

print()

files = sorted(
    DATA_FOLDER.glob("*.nc")
)

print("Number of NetCDF files:", len(files))


if len(files) == 0:

    raise FileNotFoundError(
        "No .nc files found inside data/raw/"
    )


# ============================================================
# LOAD SELECTED LOCATIONS
# ============================================================

print()
print("Loading selected locations...")

locations = pd.read_csv(
    LOCATION_FILE
)


print(
    "Locations loaded:",
    len(locations)
)


# Make sure we don't accidentally use more
# than the intended number.

locations = locations.head(
    MAX_LOCATIONS
).copy()


print(
    "Locations being used:",
    len(locations)
)


# ============================================================
# OPEN DATASET
# ============================================================

print()
print("Opening NOAA datasets...")

ds = xr.open_mfdataset(
    files,
    combine="by_coords",
    chunks={"time": 30},
    parallel=False
)


print("Dataset opened successfully!")


# ============================================================
# GET SEA-ICE CONCENTRATION
# ============================================================

sic = ds["cdr_seaice_conc"]


print()
print("Sea-ice variable:")
print(sic)


# ============================================================
# PREPARE LOCATION INDICES
# ============================================================

y_indices = locations["y_index"].astype(
    int
).values

x_indices = locations["x_index"].astype(
    int
).values


# ============================================================
# EXTRACT DATA FOR SELECTED LOCATIONS
# ============================================================

print()
print("Extracting sea-ice history...")
print("This may take some time.")


# We select only our 2000 locations.
#
# This avoids processing the entire
# 332 x 316 grid for every ML operation.

selected_sic = sic.isel(
    y=xr.DataArray(y_indices, dims="location"),
    x=xr.DataArray(x_indices, dims="location")
)


print()
print("Selected data shape:")
print(selected_sic.shape)


# ============================================================
# LOAD SELECTED DATA INTO MEMORY
# ============================================================

print()
print("Loading selected locations into memory...")

selected_data = selected_sic.compute()


print("Selected data loaded!")


# ============================================================
# CONVERT TO NUMPY
# ============================================================

values = selected_data.values


print()
print("NumPy shape:")
print(values.shape)


# Expected:

# (time, location)


# ============================================================
# GET DATES
# ============================================================

dates = pd.to_datetime(
    ds.time.values
)


print()
print("First date:", dates[0])

print("Last date:", dates[-1])

print("Total dates:", len(dates))


# ============================================================
# BUILD TRAINING EXAMPLES
# ============================================================

print()
print("Creating ML examples...")


max_lag = max(LAGS)

number_of_days = len(dates)


rows = []


# ------------------------------------------------------------
# LOOP THROUGH TIME
# ------------------------------------------------------------

for t in range(
    max_lag,
    number_of_days - 1
):

    # --------------------------------------------------------
    # TARGET
    # --------------------------------------------------------

    target_values = values[
        t + 1,
        :
    ]


    # --------------------------------------------------------
    # CURRENT LOCATION FEATURES
    # --------------------------------------------------------

    for location_index in range(
        len(locations)
    ):

        # ----------------------------------------------------
        # TARGET VALUE
        # ----------------------------------------------------

        target = target_values[
            location_index
        ]


        # ----------------------------------------------------
        # SKIP IF TARGET IS MISSING
        # ----------------------------------------------------

        if not np.isfinite(target):

            continue


        # ----------------------------------------------------
        # CREATE FEATURE DICTIONARY
        # ----------------------------------------------------

        row = {

            "date": dates[t],

            "location_id": location_index,

            "y_index": y_indices[
                location_index
            ],

            "x_index": x_indices[
                location_index
            ],

            "x": locations.iloc[
                location_index
            ]["x"],

            "y": locations.iloc[
                location_index
            ]["y"],

            "target_sic": float(target)

        }


        # ----------------------------------------------------
        # ADD HISTORICAL SIC FEATURES
        # ----------------------------------------------------

        valid_history = True


        for lag in LAGS:

            historical_value = values[
                t - lag,
                location_index
            ]


            # If any historical value is missing,
            # don't use this training example.

            if not np.isfinite(
                historical_value
            ):

                valid_history = False

                break


            row[
                f"sic_lag_{lag}"
            ] = float(
                historical_value
            )


        # ----------------------------------------------------
        # SKIP INCOMPLETE EXAMPLES
        # ----------------------------------------------------

        if not valid_history:

            continue


        # ----------------------------------------------------
        # TIME FEATURES
        # ----------------------------------------------------

        date = dates[t]


        row[
            "day_of_year"
        ] = date.dayofyear


        row[
            "month"
        ] = date.month


        # ----------------------------------------------------
        # ADD ROW
        # ----------------------------------------------------

        rows.append(
            row
        )


    # --------------------------------------------------------
    # PROGRESS
    # --------------------------------------------------------

    if (
        t % 100
        == 0
    ):

        print(
            f"Processed {t} / {number_of_days} days"
        )


# ============================================================
# CONVERT TO DATAFRAME
# ============================================================

print()
print("Converting examples to DataFrame...")


ml_df = pd.DataFrame(
    rows
)


# ============================================================
# DISPLAY DATASET INFORMATION
# ============================================================

print()
print("============================================================")
print("ML DATASET INFORMATION")
print("============================================================")


print()

print(
    "Number of training examples:",
    len(ml_df)
)


print()

print(
    "Number of features:",
    len(
        ml_df.columns
    )
)


print()

print(
    "Columns:"
)

for column in ml_df.columns:

    print(
        "  ",
        column
    )


# ============================================================
# CHECK MISSING VALUES
# ============================================================

print()
print("Missing values per column:")

print(
    ml_df.isna().sum()
)


# ============================================================
# CHECK TARGET RANGE
# ============================================================

print()
print("Target SIC statistics:")

print(
    ml_df["target_sic"].describe()
)


# ============================================================
# SAVE DATASET
# ============================================================

output_file = (
    OUTPUT_FOLDER
    / "ml_training_data.csv"
)


print()
print("Saving ML dataset...")

ml_df.to_csv(
    output_file,
    index=False
)


# ============================================================
# FINISH
# ============================================================

print()
print("============================================================")
print("ML DATASET CREATION COMPLETE")
print("============================================================")

print()

print(
    "Saved to:"
)

print(
    output_file
)

print()

print(
    "Training examples:",
    len(ml_df)
)

print()

print(
    "Ready for model training."
)