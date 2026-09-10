import { useState, useEffect } from 'react';
import { AntarcticMap, type TrajectoryPoint } from '../Map';
import { fetchIcebergPrediction, type IcebergPredictionResponse } from '../api';
import {
  Anchor,
  Compass,
  Wind,
  Navigation,
  Activity,
  Calendar,
  Layers,
  Sparkles,
  RotateCcw,
  ArrowUpRight
} from 'lucide-react';
import '../index.css';

interface PresetIceberg {
  name: string;
  region: string;
  current: { latitude: number; longitude: number };
  previous_1: { latitude: number; longitude: number };
  previous_2: { latitude: number; longitude: number };
  previous_3: { latitude: number; longitude: number };
  previous_4: { latitude: number; longitude: number };
  size: number;
  mask: number;
  date: string;
  u10: number;
  v10: number;
}

const PRESETS: PresetIceberg[] = [
  {
    name: 'A-68 Drift',
    region: 'Weddell Sea',
    current: { latitude: -75.858, longitude: -40.736 },
    previous_1: { latitude: -75.860, longitude: -40.696 },
    previous_2: { latitude: -75.861, longitude: -40.651 },
    previous_3: { latitude: -75.863, longitude: -40.604 },
    previous_4: { latitude: -75.864, longitude: -40.570 },
    size: 120.0,
    mask: 1,
    date: '2022-01-01',
    u10: -0.51,
    v10: 5.42,
  },
  {
    name: 'B-15 Calving',
    region: 'Ross Sea',
    current: { latitude: -77.420, longitude: 175.200 },
    previous_1: { latitude: -77.405, longitude: 175.120 },
    previous_2: { latitude: -77.388, longitude: 175.050 },
    previous_3: { latitude: -77.370, longitude: 174.960 },
    previous_4: { latitude: -77.350, longitude: 174.880 },
    size: 250.0,
    mask: 1,
    date: '2022-02-15',
    u10: -2.30,
    v10: 4.10,
  },
  {
    name: 'D-28 Tracking',
    region: 'Amery Ice Shelf',
    current: { latitude: -67.850, longitude: 73.120 },
    previous_1: { latitude: -67.880, longitude: 73.050 },
    previous_2: { latitude: -67.910, longitude: 72.980 },
    previous_3: { latitude: -67.940, longitude: 72.900 },
    previous_4: { latitude: -67.970, longitude: 72.820 },
    size: 85.0,
    mask: 1,
    date: '2022-03-10',
    u10: 1.80,
    v10: -3.50,
  },
];

export function IcebergSection() {
  const [selectedPreset, setSelectedPreset] = useState<number>(0);
  const [date, setDate] = useState<string>(PRESETS[0].date);
  const [size, setSize] = useState<number>(PRESETS[0].size);
  const [mask] = useState<number>(PRESETS[0].mask);
  const [u10, setU10] = useState<number>(PRESETS[0].u10);
  const [v10, setV10] = useState<number>(PRESETS[0].v10);
  const [forecastSteps, setForecastSteps] = useState<number>(3);

  // Positions
  const [currentLat, setCurrentLat] = useState<number>(PRESETS[0].current.latitude);
  const [currentLon, setCurrentLon] = useState<number>(PRESETS[0].current.longitude);
  const [p1Lat, setP1Lat] = useState<number>(PRESETS[0].previous_1.latitude);
  const [p1Lon, setP1Lon] = useState<number>(PRESETS[0].previous_1.longitude);
  const [p2Lat, setP2Lat] = useState<number>(PRESETS[0].previous_2.latitude);
  const [p2Lon, setP2Lon] = useState<number>(PRESETS[0].previous_2.longitude);
  const [p3Lat, setP3Lat] = useState<number>(PRESETS[0].previous_3.latitude);
  const [p3Lon, setP3Lon] = useState<number>(PRESETS[0].previous_3.longitude);
  const [p4Lat, setP4Lat] = useState<number>(PRESETS[0].previous_4.latitude);
  const [p4Lon, setP4Lon] = useState<number>(PRESETS[0].previous_4.longitude);

  const [prediction, setPrediction] = useState<IcebergPredictionResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Computed wind metrics
  const windSpeed = Math.sqrt(u10 * u10 + v10 * v10).toFixed(2);
  const windDirDeg = (((Math.atan2(-u10, -v10) * 180) / Math.PI + 360) % 360).toFixed(1);

  const applyPreset = (idx: number) => {
    const p = PRESETS[idx];
    setSelectedPreset(idx);
    setDate(p.date);
    setSize(p.size);
    setU10(p.u10);
    setV10(p.v10);
    setCurrentLat(p.current.latitude);
    setCurrentLon(p.current.longitude);
    setP1Lat(p.previous_1.latitude);
    setP1Lon(p.previous_1.longitude);
    setP2Lat(p.previous_2.latitude);
    setP2Lon(p.previous_2.longitude);
    setP3Lat(p.previous_3.latitude);
    setP3Lon(p.previous_3.longitude);
    setP4Lat(p.previous_4.latitude);
    setP4Lon(p.previous_4.longitude);
  };

  const runPrediction = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchIcebergPrediction({
        current: { latitude: currentLat, longitude: currentLon },
        previous_1: { latitude: p1Lat, longitude: p1Lon },
        previous_2: { latitude: p2Lat, longitude: p2Lon },
        previous_3: { latitude: p3Lat, longitude: p3Lon },
        previous_4: { latitude: p4Lat, longitude: p4Lon },
        size,
        mask,
        date,
        u10,
        v10,
        forecast_steps: forecastSteps,
      });
      setPrediction(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to predict iceberg trajectory');
    } finally {
      setLoading(false);
    }
  };

  // Run on first load with default preset
  useEffect(() => {
    runPrediction();
  }, [selectedPreset, forecastSteps]);

  // Construct trajectory points for map
  const trajectoryPoints: TrajectoryPoint[] = [
    { lat: p4Lat, lon: p4Lon, label: 'T-4', type: 'history' },
    { lat: p3Lat, lon: p3Lon, label: 'T-3', type: 'history' },
    { lat: p2Lat, lon: p2Lon, label: 'T-2', type: 'history' },
    { lat: p1Lat, lon: p1Lon, label: 'T-1', type: 'history' },
    { lat: currentLat, lon: currentLon, label: 'Current', type: 'current' },
  ];

  if (prediction?.trajectory && prediction.trajectory.length > 0) {
    prediction.trajectory.forEach((step) => {
      trajectoryPoints.push({
        lat: step.lat,
        lon: step.lon,
        label: `+${step.step}d (${step.movement_km.toFixed(1)}km)`,
        type: 'predicted',
      });
    });
  } else if (prediction) {
    trajectoryPoints.push({
      lat: prediction.predicted_lat,
      lon: prediction.predicted_lon,
      label: `+24h (${prediction.predicted_movement_km.toFixed(1)}km)`,
      type: 'predicted',
    });
  }

  return (
    <div className="app-container">
      {/* Control Panel */}
      <div className="control-panel iceberg-panel">
        <div className="panel-header">
          <Anchor size={28} color="#38bdf8" />
          <div>
            <h1>Iceberg Trajectory</h1>
            <p className="panel-subtitle">Physics-informed XGBoost Drift Forecaster</p>
          </div>
        </div>

        {/* Preset Selector */}
        <div className="input-group">
          <label>
            <Sparkles size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
            Antarctic Iceberg Presets
          </label>
          <div className="preset-buttons-row">
            {PRESETS.map((p, idx) => (
              <button
                key={p.name}
                type="button"
                className={`preset-btn ${selectedPreset === idx ? 'active' : ''}`}
                onClick={() => applyPreset(idx)}
              >
                <div className="preset-name">{p.name}</div>
                <div className="preset-region">{p.region}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Current Coordinates */}
        <div className="input-group">
          <div className="coord-header-row">
            <label>
              <Navigation size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
              Current Iceberg Position
            </label>
            <span className="coord-formatted-badge">
              {Math.abs(currentLat).toFixed(2)}° S, {Math.abs(currentLon).toFixed(2)}° {currentLon >= 0 ? 'E' : 'W'}
            </span>
          </div>
          <div className="coord-inputs">
            <div className="coord-input-box">
              <label htmlFor="ib-current-lat" className="coord-label">Latitude (°S)</label>
              <input
                id="ib-current-lat"
                type="number"
                step="any"
                className="coord-input"
                value={currentLat}
                onChange={(e) => setCurrentLat(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="coord-input-box">
              <label htmlFor="ib-current-lon" className="coord-label">Longitude (°E/°W)</label>
              <input
                id="ib-current-lon"
                type="number"
                step="any"
                className="coord-input"
                value={currentLon}
                onChange={(e) => setCurrentLon(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>

        {/* ERA5 Environmental Winds */}
        <div className="input-group">
          <div className="coord-header-row">
            <label>
              <Wind size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
              ERA5 Wind Forcing (10m)
            </label>
            <span className="coord-formatted-badge">
              {windSpeed} m/s @ {windDirDeg}°
            </span>
          </div>
          <div className="coord-inputs">
            <div className="coord-input-box">
              <label htmlFor="ib-u10" className="coord-label">u10 Zonal (m/s)</label>
              <input
                id="ib-u10"
                type="number"
                step="any"
                className="coord-input"
                value={u10}
                onChange={(e) => setU10(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="coord-input-box">
              <label htmlFor="ib-v10" className="coord-label">v10 Meridional (m/s)</label>
              <input
                id="ib-v10"
                type="number"
                step="any"
                className="coord-input"
                value={v10}
                onChange={(e) => setV10(parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>

        {/* Parameters: Size & Forecast Steps */}
        <div className="coord-inputs">
          <div className="coord-input-box">
            <label htmlFor="ib-size" className="coord-label">
              <Layers size={12} style={{ display: 'inline', marginRight: '3px' }} />
              Size (km²)
            </label>
            <input
              id="ib-size"
              type="number"
              step="any"
              className="coord-input"
              value={size}
              onChange={(e) => setSize(parseFloat(e.target.value) || 10)}
            />
          </div>
          <div className="coord-input-box">
            <label htmlFor="ib-steps" className="coord-label">
              <Calendar size={12} style={{ display: 'inline', marginRight: '3px' }} />
              Forecast Horizon
            </label>
            <select
              id="ib-steps"
              className="coord-input"
              value={forecastSteps}
              onChange={(e) => setForecastSteps(parseInt(e.target.value, 10))}
            >
              <option value={1}>1 Day (24h)</option>
              <option value={3}>3 Days (72h)</option>
              <option value={5}>5 Days (120h)</option>
            </select>
          </div>
        </div>

        {/* Run Prediction Button */}
        <button
          type="button"
          className="iceberg-submit-btn"
          onClick={runPrediction}
          disabled={loading}
        >
          {loading ? (
            <RotateCcw className="loading-spinner" size={18} />
          ) : (
            <ArrowUpRight size={18} />
          )}
          <span>{loading ? 'Computing Trajectory...' : 'Run Trajectory Model'}</span>
        </button>

        {error && <div className="iceberg-error-badge">{error}</div>}

        {/* Results Card */}
        {prediction && (
          <div className="iceberg-results-summary">
            <div className="result-title">
              <Activity size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
              24-Hour Predicted Displacement
            </div>

            <div className="metrics-grid">
              <div className="metric-box">
                <span className="metric-label">Predicted Coord</span>
                <span className="metric-value">
                  {Math.abs(prediction.predicted_lat).toFixed(3)}° S, {Math.abs(prediction.predicted_lon).toFixed(3)}°{' '}
                  {prediction.predicted_lon >= 0 ? 'E' : 'W'}
                </span>
              </div>

              <div className="metric-box">
                <span className="metric-label">Total Drift (24h)</span>
                <span className="metric-value highlight">
                  {prediction.predicted_movement_km.toFixed(2)} km
                </span>
              </div>

              <div className="metric-box">
                <span className="metric-label">ΔX / ΔY Displacement</span>
                <span className="metric-value">
                  {prediction.predicted_dx_km >= 0 ? '+' : ''}{prediction.predicted_dx_km.toFixed(2)} /{' '}
                  {prediction.predicted_dy_km >= 0 ? '+' : ''}{prediction.predicted_dy_km.toFixed(2)} km
                </span>
              </div>

              <div className="metric-box">
                <span className="metric-label">Drift Heading</span>
                <span className="metric-value">
                  <Compass size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                  {prediction.drift_direction_deg.toFixed(1)}°
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Map Stage */}
      <div className="map-stage" style={{ flexDirection: 'column', gap: '1.5rem' }}>
        <div className="square-map-wrapper">
          <AntarcticMap
            selectedLat={currentLat}
            selectedLon={currentLon}
            selectedDate={date}
            trajectoryPoints={trajectoryPoints}
          />

          {/* Map Legend Overlay */}
          <div className="trajectory-map-legend">
            <div className="legend-item">
              <span className="legend-dot history-dot"></span>
              <span>History (T-4 → T-1)</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot current-dot"></span>
              <span>Current Position</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot predicted-dot"></span>
              <span>Predicted Drift</span>
            </div>
          </div>
        </div>

        {/* Multi-step Forecast Timeline */}
        {prediction?.trajectory && prediction.trajectory.length > 1 && (
          <div className="forecast-panel iceberg-timeline-panel">
            <div className="result-title" style={{ fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.75rem' }}>
              <Navigation size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle', color: '#38bdf8' }} />
              Multi-Day Trajectory Projection
            </div>
            <div className="forecast-cards">
              {prediction.trajectory.map((step) => (
                <div key={step.step} className="forecast-card iceberg-step-card">
                  <div className="forecast-date">Day +{step.step}</div>
                  <div className="forecast-value" style={{ fontSize: '1.25rem' }}>
                    +{step.movement_km.toFixed(1)} km
                  </div>
                  <div className="iceberg-step-coord">
                    {Math.abs(step.lat).toFixed(3)}° S, {Math.abs(step.lon).toFixed(3)}° {step.lon >= 0 ? 'E' : 'W'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
