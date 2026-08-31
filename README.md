# Polaris - Antarctic Decision Support Platform

Polaris is an AI/ML-enabled decision support platform capable of forecasting Antarctic sea-ice concentration, predicting iceberg trajectories, and identifying safe and fuel-efficient navigation routes for research vessels using satellite, oceanographic, and meteorological datasets.

## Project Architecture

The system is containerized via Docker and orchestrated using Docker Compose. It is split into two primary services:

1. **Frontend (`/frontend`)**: A React + Vite web application showcasing a high-end, glassmorphic UI. It features a custom Polar Stereographic (EPSG:3031) Leaflet map overlaying NASA EOSDIS GIBS satellite imagery.
2. **Backend (`/backend`)**: A high-performance Python FastAPI service. It handles geographical coordinate transformations, reads historical `.nc` NetCDF datasets using Xarray, and serves an XGBoost machine learning model to predict 3-day Sea-Ice Concentration forecasts.

## Getting Started

### Prerequisites
- Docker and Docker Compose installed.
- Download the NOAA/NSIDC Climate Data Record `sic_pss25_20170101-20171231_v06r00.nc` and place it in `data/raw/`.

### Running the Application

1. From the root directory, build and start the containers:
   ```bash
   docker-compose up --build
   ```
2. Open the application in your browser:
   - Frontend (Polaris UI): `http://localhost:5173`
   - Backend API Docs (Swagger): `http://localhost:8000/docs`

## Core Features
- **Sea-Ice Concentration (SIC)**: Provides historical SIC querying and real-time ML-driven forecasting using XGBoost.
- **Iceberg Trajectory** *(Coming Soon)*: Advanced tracking and movement prediction of icebergs in the Southern Ocean.
- **Path Prediction** *(Coming Soon)*: AI-driven route optimization for safe polar navigation.
