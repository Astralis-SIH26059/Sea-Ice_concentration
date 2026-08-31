# Polaris - Backend

The backend engine for **Polaris** provides the data processing and machine learning inference required for Sea-Ice Concentration (SIC) forecasting.

## Technology Stack

- **Framework**: FastAPI (Python)
- **Data Processing**: Xarray, NetCDF4, Pandas, NumPy
- **Machine Learning**: XGBoost, Scikit-Learn, Joblib
- **Geospatial Processing**: PyProj

## Architecture Overview

The backend exposes a REST API via FastAPI. It performs several critical functions:
1. **Coordinate Projection**: Transforms requested geographical coordinates (EPSG:4326) into Antarctic Polar Stereographic (EPSG:3412) coordinates.
2. **Dataset querying**: Uses Xarray to lazy-load and query massive `.nc` files (like the NOAA CDR Sea-Ice dataset) to extract historical ice concentration values around the projected coordinates.
3. **Asynchronous Execution**: To prevent concurrent execution crashes with the underlying NetCDF4 C library, all dataset access is safely routed on the main asyncio event loop via `async def` endpoints.
4. **ML Inference**: Processes feature lagging (extracting SIC values for the past 1, 2, 3, 7, 14, and 30 days) and feeds it into a pre-trained XGBoost regressor model to predict future sea-ice concentrations for up to 7 forecast days.

## Endpoints

- `GET /`: Health check and running status.
- `GET /health`: Detailed dataset availability check.
- `GET /api/ice/concentration`: Look up historical SIC data for a specific latitude, longitude, and date.
- `POST /api/ice/predict`: Run the ML pipeline to forecast SIC for future dates.

## Running Locally

1. Create a virtual environment and install dependencies:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows use `.venv\Scripts\activate`
   pip install -r requirements.txt
   ```
2. Start the Uvicorn ASGI server:
   ```bash
   uvicorn main:app --host 0.0.0.0 --port 8000 --reload
   ```
