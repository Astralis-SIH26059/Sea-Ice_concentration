export interface SeaIceData {
  concentration: number; // Percentage 0-100
  date: string;
  lat: number;
  lon: number;
}

const API_BASE_URL = 'http://localhost:8000';

export const fetchSeaIceData = async (lat: number, lon: number, date: string): Promise<SeaIceData> => {
  const response = await fetch(`${API_BASE_URL}/api/ice/concentration?latitude=${lat}&longitude=${lon}&date=${date}`);
  
  if (!response.ok) {
    throw new Error('Failed to fetch data from API');
  }
  
  const data = await response.json();
  
  return {
    concentration: data.sea_ice_concentration,
    date: data.data_date, // or requested_date
    lat: data.latitude,
    lon: data.longitude,
  };
};
