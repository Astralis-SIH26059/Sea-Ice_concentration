from pathlib import Path
import xarray as xr
import numpy as np


# ============================================================
# 1. DATA FOLDER
# ============================================================

data_folder = Path("data/raw")

files = sorted(data_folder.glob("*.nc"))


# ============================================================
# 2. EXPECTED VARIABLE
# ============================================================

expected_variable = "cdr_seaice_conc"


# ============================================================
# 3. START
# ============================================================

print()
print("============================================================")
print("VERIFYING ALL NOAA SEA-ICE FILES")
print("============================================================")


# ============================================================
# 4. BASIC FILE COUNT
# ============================================================

print()
print("Number of files:", len(files))

if len(files) != 11:

    print()
    print("WARNING: Expected 11 yearly files.")

else:

    print("File count looks correct.")


# ============================================================
# 5. STORE REFERENCE INFORMATION
# ============================================================

reference_x = None
reference_y = None
reference_shape = None
reference_dtype = None


# ============================================================
# 6. CHECK EACH FILE
# ============================================================

for number, file in enumerate(files, start=1):

    print()
    print("------------------------------------------------------------")
    print(f"FILE {number}/11")
    print(file.name)
    print("------------------------------------------------------------")

    try:

        # ------------------------------------------------------
        # OPEN FILE
        # ------------------------------------------------------

        ds = xr.open_dataset(file)

        print("Opened successfully: YES")


        # ------------------------------------------------------
        # VARIABLES
        # ------------------------------------------------------

        print()
        print("Checking SIC variable...")

        if expected_variable in ds.data_vars:

            print("cdr_seaice_conc: FOUND")

        else:

            print("cdr_seaice_conc: NOT FOUND")

            print("Available variables:")

            for variable in ds.data_vars:

                print("   ", variable)

            ds.close()

            continue


        sic = ds[expected_variable]


        # ------------------------------------------------------
        # DIMENSIONS
        # ------------------------------------------------------

        print()
        print("Dimensions:")
        print(sic.dims)


        print()
        print("Shape:")
        print(sic.shape)


        # ------------------------------------------------------
        # TIME
        # ------------------------------------------------------

        print()
        print("Time information:")

        print("Number of time steps:", sic.sizes["time"])

        print("First date:", ds.time.values[0])

        print("Last date:", ds.time.values[-1])


        # ------------------------------------------------------
        # GRID
        # ------------------------------------------------------

        print()
        print("Grid:")

        print("Number of Y coordinates:", len(ds.y))

        print("Number of X coordinates:", len(ds.x))


        # ------------------------------------------------------
        # DATA TYPE
        # ------------------------------------------------------

        print()
        print("Data type:")

        print(sic.dtype)


        # ------------------------------------------------------
        # GRID CONSISTENCY
        # ------------------------------------------------------

        if reference_x is None:

            reference_x = ds.x.values.copy()

            reference_y = ds.y.values.copy()

            reference_shape = sic.shape[1:]

            reference_dtype = sic.dtype

            print()
            print("This file is being used as the reference grid.")


        else:

            same_x = np.array_equal(
                reference_x,
                ds.x.values
            )

            same_y = np.array_equal(
                reference_y,
                ds.y.values
            )

            same_shape = (
                reference_shape == sic.shape[1:]
            )

            same_dtype = (
                reference_dtype == sic.dtype
            )

            print()
            print("Grid comparison with first file:")

            print("X coordinates identical:", same_x)

            print("Y coordinates identical:", same_y)

            print("Spatial shape identical:", same_shape)

            print("Data type identical:", same_dtype)


        # ------------------------------------------------------
        # CLOSE
        # ------------------------------------------------------

        ds.close()

        print()
        print("File check completed successfully.")


    except Exception as error:

        print()
        print("ERROR while reading file:")
        print(error)


# ============================================================
# 7. FINISH
# ============================================================

print()
print("============================================================")
print("VERIFICATION COMPLETE")
print("============================================================")