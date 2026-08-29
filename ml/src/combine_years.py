from pathlib import Path
import xarray as xr


# ============================================================
# 1. DATA FOLDER
# ============================================================

data_folder = Path("data/raw")


# ============================================================
# 2. FIND ALL NOAA FILES
# ============================================================

files = sorted(data_folder.glob("*.nc"))


# ============================================================
# 3. PRINT FILE INFORMATION
# ============================================================

print()
print("============================================================")
print("COMBINING NOAA SEA-ICE DATA")
print("============================================================")

print()
print("Number of files:", len(files))

for file in files:
    print("  ", file.name)


# ============================================================
# 4. OPEN ALL FILES AS ONE VIRTUAL DATASET
# ============================================================

print()
print("Opening datasets...")
print("This may take a little time.")


ds = xr.open_mfdataset(
    files,
    combine="by_coords",
    chunks={"time": 30},
    parallel=False
)


print()
print("Datasets opened successfully!")


# ============================================================
# 5. PRINT DATASET INFORMATION
# ============================================================

print()
print("============================================================")
print("COMBINED DATASET INFORMATION")
print("============================================================")


print()
print("Dimensions:")
print(ds.dims)


print()
print("Coordinates:")
print(ds.coords)


print()
print("Variables:")
print(list(ds.data_vars))


# ============================================================
# 6. SEA-ICE VARIABLE
# ============================================================

sic = ds["cdr_seaice_conc"]


print()
print("============================================================")
print("SEA-ICE VARIABLE")
print("============================================================")


print()
print("Variable:", sic.name)

print("Shape:", sic.shape)

print("Dimensions:", sic.dims)

print("Data type:", sic.dtype)


# ============================================================
# 7. TIME INFORMATION
# ============================================================

print()
print("============================================================")
print("TIME INFORMATION")
print("============================================================")


print()
print("First date:")

print(ds.time.values[0])


print()
print("Last date:")

print(ds.time.values[-1])


print()
print("Total number of days:")

print(ds.sizes["time"])


# ============================================================
# 8. SPATIAL INFORMATION
# ============================================================

print()
print("============================================================")
print("SPATIAL INFORMATION")
print("============================================================")


print()
print("Y coordinates:", ds.sizes["y"])

print("X coordinates:", ds.sizes["x"])


# ============================================================
# 9. CHUNK INFORMATION
# ============================================================

print()
print("============================================================")
print("CHUNK INFORMATION")
print("============================================================")


print()
print("Chunks:")

print(sic.chunks)


# ============================================================
# 10. FINISH
# ============================================================

print()
print("============================================================")
print("COMBINATION CHECK COMPLETE")
print("============================================================")

print()
print("IMPORTANT:")
print("The original .nc files were NOT modified.")
print("The combined dataset is currently virtual/lazy.")
print("The full data has NOT been loaded into RAM.")

print()
print("Ready for ML preprocessing.")