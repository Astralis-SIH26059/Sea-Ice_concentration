export interface SeaIceData {
  concentration: number; // Percentage 0-100
  date: string;
  lat: number;
  lon: number;
}

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export const fetchSeaIceData = async (lat: number, lon: number, date: string): Promise<SeaIceData> => {
  try {
    let response = await fetch(`${BACKEND_URL}/api/ice/concentration?latitude=${lat}&longitude=${lon}&date=${date}`);
    
    // If real data for the exact date isn't found, use the ML prediction endpoint
    if (response.status === 404) {
      console.log("Real data not found for date, falling back to ML prediction...");
      response = await fetch(`${BACKEND_URL}/api/ice/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, latitude: lat, longitude: lon })
      });
    }

    if (!response.ok) {
      throw new Error("Failed to fetch sea ice data or prediction");
    }

    const data = await response.json();
    
    return {
      // Handle both real data response and prediction response formats
      concentration: data.prediction_sea_ice_concentration ?? data.sea_ice_concentration,
      date: data.requested_date,
      lat: data.latitude,
      lon: data.longitude,
    };
  } catch (error) {
    console.error("Error fetching sea ice data:", error);
    // Fallback in case of failure so the app doesn't crash immediately
    return {
      concentration: 0,
      date,
      lat,
      lon,
    };
  }
};

export const fetchForecastData = async (lat: number, lon: number, startDate: string): Promise<SeaIceData[]> => {
  const baseDate = new Date(startDate);
  
  const promises = [1, 2, 3].map(async (i) => {
    const forecastDate = new Date(baseDate);
    forecastDate.setDate(forecastDate.getDate() + i);
    const dateStr = forecastDate.toISOString().split('T')[0];
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/ice/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr, latitude: lat, longitude: lon, forecast_days: i })
      });
      
      if (response.ok) {
        const data = await response.json();
        return {
          concentration: data.prediction_sea_ice_concentration,
          date: data.requested_date,
          lat: data.latitude,
          lon: data.longitude,
        };
      }
    } catch (e) {
      console.error("Error fetching forecast for", dateStr, e);
    }
    return {
      concentration: 0,
      date: dateStr,
      lat,
      lon
    };
  });
  
  return Promise.all(promises);
};

export interface IcebergPoint {
  latitude: number;
  longitude: number;
}

export interface IcebergPredictionRequest {
  current: IcebergPoint;
  previous_1: IcebergPoint;
  previous_2: IcebergPoint;
  previous_3: IcebergPoint;
  previous_4: IcebergPoint;
  size?: number;
  mask?: number;
  date?: string;
  u10: number;
  v10: number;
  forecast_steps?: number;
}

export interface IcebergTrajectoryStep {
  step: number;
  date: string;
  lat: number;
  lon: number;
  predicted_dx_km: number;
  predicted_dy_km: number;
  movement_km: number;
}

export interface IcebergPredictionResponse {
  current_lat: number;
  current_lon: number;
  predicted_dx_m: number;
  predicted_dy_m: number;
  predicted_dx_km: number;
  predicted_dy_km: number;
  predicted_movement_km: number;
  predicted_movement_m: number;
  predicted_lat: number;
  predicted_lon: number;
  drift_direction_deg: number;
  wind_speed_mps: number;
  wind_direction_deg: number;
  forecast_steps?: number;
  trajectory?: IcebergTrajectoryStep[];
}

export const fetchIcebergPrediction = async (
  req: IcebergPredictionRequest
): Promise<IcebergPredictionResponse> => {
  const response = await fetch(`${BACKEND_URL}/api/iceberg/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      current: req.current,
      previous_1: req.previous_1,
      previous_2: req.previous_2,
      previous_3: req.previous_3,
      previous_4: req.previous_4,
      size: req.size ?? 100.0,
      mask: req.mask ?? 1.0,
      date: req.date ?? new Date().toISOString().split('T')[0],
      u10: req.u10,
      v10: req.v10,
      forecast_steps: req.forecast_steps ?? 1,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Server returned ${response.status}`);
  }

  return response.json();
};
