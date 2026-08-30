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
