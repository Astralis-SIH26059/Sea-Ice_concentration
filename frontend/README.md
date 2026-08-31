# Polaris - Frontend

This is the frontend client for **Polaris**, an AI/ML-enabled decision support platform for Antarctic navigation and Sea-Ice Concentration (SIC) forecasting.

## Technology Stack

- **Framework**: React 19 + TypeScript
- **Build Tool**: Vite
- **Styling**: Vanilla CSS featuring a premium dark, glassmorphic UI.
- **Mapping**: Leaflet & React-Leaflet
- **Projections**: Proj4js & Proj4Leaflet for EPSG:3031 (Antarctic Polar Stereographic)
- **Icons**: Lucide React

## Map Details

The core mapping component visualizes the Antarctic region using custom coordinate reference systems. 
Instead of the standard Web Mercator, it employs the EPSG:3031 Polar Stereographic projection to accurately render polar geometry.
It stacks high-resolution base maps (bathymetry/terrain) with dynamic, true-color satellite imagery pulled in real-time from NASA EOSDIS GIBS.

## UI Architecture

The frontend is divided into multiple sections managed by a central router:
- **Landing Page**: Entry point displaying the core Polaris mission.
- **SIC Forecast**: The Sea-Ice Concentration tool allowing coordinate-based queries and visual map selection.
- **Icebergs / Path Prediction**: Upcoming tools integrated seamlessly into the navigation.

## Running Locally

To run the frontend independently of Docker:

```bash
npm install
npm run dev
```

Ensure the backend server is running and accessible (defaults to `http://localhost:8000`). This can be configured via the `VITE_BACKEND_URL` environment variable.
