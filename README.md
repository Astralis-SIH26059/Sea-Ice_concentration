# Antarctic Sea-Ice Backend - Real NetCDF

Copy the uploaded file into `data/`:
`sic_pss25_20170101-20171231_v06r00.nc`

Install:
`pip install -r requirements.txt`

Run:
`uvicorn app.main:app --reload`

Open:
`http://127.0.0.1:8000/docs`

Test:
`GET /api/ice/concentration`
date = 2017-12-01
latitude = -63.10
longitude = -56.40

The backend converts EPSG:4326 latitude/longitude to EPSG:3412, finds a nearby valid grid cell, and converts dataset SIC from 0-1 to 0-100%.

The dataset covers 2017 only. The prediction endpoint intentionally remains disabled until the ML teammate provides the trained model and exact feature preprocessing.
