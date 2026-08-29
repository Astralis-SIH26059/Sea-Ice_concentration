from pathlib import Path
import xarray as xr
import numpy as np
import pandas as pd


# ============================================================
# SETTINGS
# ============================================================

DATA_FOLDER = Path("data/raw")

NUMBER_OF_LOCATIONS = 2000

OUTPUT_FOLDER = Path("data/processed")

OUTPUT_FOLDER.mkdir(parents=True, exist_ok=True)


# ============================================================
# FIND FILES
# ============================================================

files = sorted(DATA_FOLDER.glob("*.nc"))

print()
print("============================================================")
print("ANTARCTIC SEA-ICE LOCATION SELECTION")
print("============================================================")

print()
print("Files found:", len(files))


for file in files:
    print(file.name)


# ============================================================
# OPEN DATASET
# ============================================================

print()
print("Opening dataset...")

ds = xr.open_mfdataset(
    files,
    combine="by_coords",
    chunks={"time": 30},
    parallel=False
)

print("Dataset opened successfully!")


# ============================================================
# GET SEA-ICE VARIABLE
# ============================================================

sic = ds["cdr_seaice_conc"]


# ============================================================
# TAKE FIRST DAY
# ============================================================

print()
print("Reading first day...")

first_day = sic.isel(time=0).compute()


print()
print("First day loaded.")


# ============================================================
# FIND VALID CELLS
# ============================================================

data = first_day.values

valid_mask = np.isfinite(data)


valid_y, valid_x = np.where(valid_mask)


print()
print("============================================================")
print("VALID CELL INFORMATION")
print("============================================================")

print()
print("Total grid cells:", data.size)

print("Valid cells:", len(valid_y))


# ============================================================
# GET COORDINATES
# ============================================================

y_coords = ds["y"].values
x_coords = ds["x"].values


# ============================================================
# CREATE LOCATION TABLE
# ============================================================

locations = []

for y_index, x_index in zip(valid_y, valid_x):

    sic_value = data[y_index, x_index]

    locations.append(
        {
            "y_index": int(y_index),
            "x_index": int(x_index),
            "x": float(x_coords[x_index]),
            "y": float(y_coords[y_index]),
            "sic": float(sic_value)
        }
    )


locations_df = pd.DataFrame(locations)


# ============================================================
# REMOVE EXTREME / INVALID SIC VALUES
# ============================================================

locations_df = locations_df[
    (locations_df["sic"] >= 0.0)
    &
    (locations_df["sic"] <= 1.0)
].copy()


print()
print("Valid SIC cells after filtering:", len(locations_df))


# ============================================================
# STRATIFIED SAMPLING
# ============================================================

print()
print("Selecting representative locations...")


# Divide SIC into 10 groups
locations_df["sic_bin"] = pd.cut(
    locations_df["sic"],
    bins=10,
    labels=False,
    include_lowest=True
)


# Number of samples per group
samples_per_bin = NUMBER_OF_LOCATIONS // 10


selected_parts = []


for bin_number in range(10):

    bin_data = locations_df[
        locations_df["sic_bin"] == bin_number
    ]

    if len(bin_data) == 0:
        continue

    number_to_select = min(
        samples_per_bin,
        len(bin_data)
    )

    sampled = bin_data.sample(
        n=number_to_select,
        random_state=42
    )

    selected_parts.append(sampled)


selected_locations = pd.concat(
    selected_parts,
    ignore_index=True
)


# ============================================================
# IF WE HAVE LESS THAN 2000
# ============================================================

if len(selected_locations) < NUMBER_OF_LOCATIONS:

    remaining = locations_df[
        ~locations_df.index.isin(selected_locations.index)
    ]

    additional_needed = (
        NUMBER_OF_LOCATIONS
        - len(selected_locations)
    )

    additional = remaining.sample(
        n=min(additional_needed, len(remaining)),
        random_state=42
    )

    selected_locations = pd.concat(
        [
            selected_locations,
            additional
        ],
        ignore_index=True
    )


# ============================================================
# KEEP ONLY REQUIRED COLUMNS
# ============================================================

selected_locations = selected_locations[
    [
        "y_index",
        "x_index",
        "x",
        "y",
        "sic"
    ]
]


# ============================================================
# SAVE
# ============================================================

output_file = OUTPUT_FOLDER / "selected_locations.csv"

selected_locations.to_csv(
    output_file,
    index=False
)


# ============================================================
# RESULTS
# ============================================================

print()
print("============================================================")
print("LOCATION SELECTION COMPLETE")
print("============================================================")

print()
print("Selected locations:", len(selected_locations))

print()
print("Saved file:")

print(output_file)

print()
print("First 10 locations:")

print(selected_locations.head(10))

print()
print("============================================================")
print("NEXT STEP: BUILD ML FEATURES")
print("============================================================")