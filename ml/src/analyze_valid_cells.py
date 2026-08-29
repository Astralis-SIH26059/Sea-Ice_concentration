import xarray as xr
import numpy as np
import matplotlib.pyplot as plt
file_path = "data/raw/sic_pss25_20150101-20151231_v06r00.nc"
print("Opening NetCDF file...")
ds = xr.open_dataset(file_path)
print("File opened successfully!")
sic = ds["cdr_seaice_conc"]
print("\nCalculating valid observations...")
valid_days = sic.notnull().sum(dim="time")
print("\n========== VALID DAY STATISTICS ==========")
print("Minimum valid days:", valid_days.min().values)
print("Maximum valid days:", valid_days.max().values)
print("Mean valid days:", valid_days.mean().values)
print("\n========== CELL COUNTS ==========")
print("Cells valid for 365 days:", int((valid_days == 365).sum().values))
print("Cells valid for at least 350 days:", int((valid_days >= 350).sum().values))
print("Cells valid for at least 300 days:", int((valid_days >= 300).sum().values))
print("Cells valid for at least 250 days:", int((valid_days >= 250).sum().values))
print("Cells valid for at least 200 days:", int((valid_days >= 200).sum().values))
print("Cells valid for at least 100 days:", int((valid_days >= 100).sum().values))
print("Cells valid for at least 1 day:", int((valid_days >= 1).sum().values))
x = ds.x.values
y = ds.y.values
plt.figure(figsize=(10, 10))
plt.pcolormesh(x, y, valid_days.values, shading="auto")
colorbar = plt.colorbar()
colorbar.set_label("Number of Valid Days")
plt.title("2015 Sea-Ice Data Availability")
plt.xlabel("Polar Stereographic X (meters)")
plt.ylabel("Polar Stereographic Y (meters)")
plt.axis("equal")
plt.grid(True)
output_file = "seaice_valid_days_2015.png"
plt.savefig(output_file, dpi=200, bbox_inches="tight")
plt.show()
print("\n====================================")
print("ANALYSIS COMPLETE")
print("Saved:", output_file)
print("======================================")