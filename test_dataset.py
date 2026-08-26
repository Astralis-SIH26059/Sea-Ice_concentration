import xarray as xr
from pyproj import Transformer

ds = xr.open_dataset(
    "data/sic_pss25_20170101-20171231_v06r00.nc"
)

value = ds["cdr_seaice_conc"].sel(
    time="2017-12-01",
    x=-2487500,
    y=1637500
).item()

print("Exact API cell SIC:", value)


for y in range(-2, 3):
    row = []

    for x in range(-2, 3):
        value = ds["cdr_seaice_conc"].sel(
            time="2017-12-01",
            x=-2487500 + x * 25000,
            y=1637500 + y * 25000
        ).item()

        row.append(value)

    print(row)
