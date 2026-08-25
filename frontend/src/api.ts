export interface SeaIceData {
  concentration: number; // Percentage 0-100
  date: string;
  lat: number;
  lon: number;
}

export const fetchSeaIceData = async (lat: number, lon: number, date: string): Promise<SeaIceData> => {
  return new Promise((resolve) => {
    // Simulate network latency
    setTimeout(() => {
      resolve({
        concentration: Math.floor(Math.random() * 101),
        date,
        lat,
        lon,
      });
    }, 1200); // 1.2 seconds delay
  });
};
