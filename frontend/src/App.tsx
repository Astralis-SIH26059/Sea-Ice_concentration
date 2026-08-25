import { useState, useEffect } from 'react';
import { AntarcticMap } from './Map';
import { fetchSeaIceData, type SeaIceData } from './api';
import { MapPin, Calendar, Activity, Snowflake } from 'lucide-react';
import './index.css';

function App() {
  const [date, setDate] = useState<string>('2023-12-01');
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [iceData, setIceData] = useState<SeaIceData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (lat !== null && lon !== null && date) {
      const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
          const data = await fetchSeaIceData(lat, lon, date);
          setIceData(data);
        } catch (err) {
          setError('Failed to fetch sea-ice data');
          setIceData(null);
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }
  }, [lat, lon, date]);

  const handleLocationSelect = (newLat: number, newLon: number) => {
    // Only accept coordinates in the southern hemisphere, specifically near Antarctica
    if (newLat > -50) {
      alert("Please select a location in the Antarctic region.");
      return;
    }
    setLat(newLat);
    setLon(newLon);
  };

  return (
    <div className="app-container">
      <div className="control-panel">
        <div className="panel-header">
          <Snowflake size={28} color="#38bdf8" />
          <h1>Antarctic Sea-Ice</h1>
        </div>

        <div className="input-group">
          <label htmlFor="date-picker">
            <Calendar size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
            Select Date
          </label>
          <input
            id="date-picker"
            type="date"
            className="date-input"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
          />
        </div>

        <div className="input-group">
          <label>
            <MapPin size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
            Coordinates
          </label>
          {lat !== null && lon !== null ? (
            <div className="coord-display">
              <div className="coord-box">
                <div className="coord-value">{Math.abs(lat).toFixed(2)}° {lat >= 0 ? 'N' : 'S'}</div>
                <div className="coord-label">Latitude</div>
              </div>
              <div className="coord-box">
                <div className="coord-value">{Math.abs(lon).toFixed(2)}° {lon >= 0 ? 'E' : 'W'}</div>
                <div className="coord-label">Longitude</div>
              </div>
            </div>
          ) : (
            <p className="instruction-text">Click anywhere on the map to select a location.</p>
          )}
        </div>

        <div className="result-card">
          <div className="result-title">
            <Activity size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
            Sea-Ice Concentration
          </div>
          {loading ? (
            <div className="result-value">
              <Snowflake className="loading-spinner" size={32} color="#38bdf8" />
            </div>
          ) : error ? (
            <div style={{ color: 'var(--danger-color)', fontSize: '0.875rem' }}>{error}</div>
          ) : iceData ? (
            <div className="result-value">
              {iceData.concentration}%
            </div>
          ) : (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Select a location to view data.
            </div>
          )}
        </div>
      </div>

      <div className="map-stage">
        <div className="square-map-wrapper">
          <AntarcticMap
            onLocationSelect={handleLocationSelect}
            selectedLat={lat}
            selectedLon={lon}
            selectedDate={date}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
