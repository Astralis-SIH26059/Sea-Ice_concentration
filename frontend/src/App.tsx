import { useState, useEffect } from 'react';
import { AntarcticMap } from './Map';
import { fetchSeaIceData, type SeaIceData } from './api';
import { MapPin, Calendar, Activity, Snowflake } from 'lucide-react';
import './index.css';

function App() {
  const [date, setDate] = useState<string>('2023-12-01');
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);
  const [latInput, setLatInput] = useState<string>('');
  const [lonInput, setLonInput] = useState<string>('');
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
        } catch (_err) {
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
    const formattedLat = parseFloat(newLat.toFixed(4));
    const formattedLon = parseFloat(newLon.toFixed(4));
    setLat(formattedLat);
    setLon(formattedLon);
    setLatInput(formattedLat.toString());
    setLonInput(formattedLon.toString());
  };

  const handleLatChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLatInput(e.target.value);
  };

  const handleLonChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLonInput(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (latInput.trim() === '' || lonInput.trim() === '') {
        return;
      }
      const parsedLat = parseFloat(latInput);
      const parsedLon = parseFloat(lonInput);
      
      if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90) {
        alert("Please enter a valid latitude between -90 and 90.");
        return;
      }
      if (parsedLat > -50) {
        alert("Please select a location in the Antarctic region (latitude <= -50).");
        return;
      }
      if (isNaN(parsedLon) || parsedLon < -180 || parsedLon > 180) {
        alert("Please enter a valid longitude between -180 and 180.");
        return;
      }
      
      setLat(parsedLat);
      setLon(parsedLon);
    }
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
          <div className="coord-header-row">
            <label>
              <MapPin size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
              Coordinates
            </label>
            {lat !== null && lon !== null && (
              <span className="coord-formatted-badge">
                {Math.abs(lat).toFixed(2)}° {lat >= 0 ? 'N' : 'S'}, {Math.abs(lon).toFixed(2)}° {lon >= 0 ? 'E' : 'W'}
              </span>
            )}
          </div>
          <div className="coord-inputs">
            <div className="coord-input-box">
              <label htmlFor="lat-input" className="coord-label">Latitude (°S / °N)</label>
              <input
                id="lat-input"
                type="number"
                step="any"
                className="coord-input"
                placeholder="e.g. -75.25"
                value={latInput}
                onChange={handleLatChange}
                onKeyDown={handleKeyDown}
              />
            </div>
            <div className="coord-input-box">
              <label htmlFor="lon-input" className="coord-label">Longitude (°E / °W)</label>
              <input
                id="lon-input"
                type="number"
                step="any"
                className="coord-input"
                placeholder="e.g. 120.50"
                value={lonInput}
                onChange={handleLonChange}
                onKeyDown={handleKeyDown}
              />
            </div>
          </div>
          {lat === null || lon === null ? (
            <p className="instruction-text">Click on map or enter coordinates above.</p>
          ) : null}
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
