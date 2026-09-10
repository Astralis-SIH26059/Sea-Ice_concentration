import { useState, useEffect } from 'react';
import { AntarcticMap, type TrajectoryPoint } from '../Map';
import { fetchIcebergPrediction, type IcebergPredictionResponse } from '../api';
import {
  Anchor,
  Compass,
  Navigation,
  Activity,
  Sparkles,
  RotateCcw
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
  {
    name: 'A-23A Megaberg',
    region: 'Weddell Sea',
    current: { latitude: -61.200, longitude: -42.800 },
    previous_1: { latitude: -61.250, longitude: -42.750 },
    previous_2: { latitude: -61.300, longitude: -42.700 },
    previous_3: { latitude: -61.350, longitude: -42.650 },
    previous_4: { latitude: -61.400, longitude: -42.600 },
    size: 3900.0,
    mask: 1,
    date: '2023-11-20',
    u10: -1.20,
    v10: 6.50,
  },
  {
    name: 'A-76A',
    region: 'Drake Passage',
    current: { latitude: -59.500, longitude: -54.100 },
    previous_1: { latitude: -59.550, longitude: -54.000 },
    previous_2: { latitude: -59.600, longitude: -53.900 },
    previous_3: { latitude: -59.650, longitude: -53.800 },
    previous_4: { latitude: -59.700, longitude: -53.700 },
    size: 3200.0,
    mask: 1,
    date: '2022-10-31',
    u10: 5.10,
    v10: 2.30,
  },
  {
    name: 'C-19',
    region: 'Ross Sea',
    current: { latitude: -76.800, longitude: 168.500 },
    previous_1: { latitude: -76.820, longitude: 168.600 },
    previous_2: { latitude: -76.840, longitude: 168.700 },
    previous_3: { latitude: -76.860, longitude: 168.800 },
    previous_4: { latitude: -76.880, longitude: 168.900 },
    size: 5500.0,
    mask: 1,
    date: '2002-05-15',
    u10: -3.50,
    v10: -1.20,
  },
  {
    name: 'B-9B',
    region: 'Commonwealth Bay',
    current: { latitude: -66.800, longitude: 142.500 },
    previous_1: { latitude: -66.820, longitude: 142.400 },
    previous_2: { latitude: -66.840, longitude: 142.300 },
    previous_3: { latitude: -66.860, longitude: 142.200 },
    previous_4: { latitude: -66.880, longitude: 142.100 },
    size: 2900.0,
    mask: 1,
    date: '2010-02-28',
    u10: -4.10,
    v10: -5.50,
  },
  {
    name: 'B-31',
    region: 'Pine Island Bay',
    current: { latitude: -74.100, longitude: -107.500 },
    previous_1: { latitude: -74.150, longitude: -107.400 },
    previous_2: { latitude: -74.200, longitude: -107.300 },
    previous_3: { latitude: -74.250, longitude: -107.200 },
    previous_4: { latitude: -74.300, longitude: -107.100 },
    size: 660.0,
    mask: 1,
    date: '2013-11-10',
    u10: 2.40,
    v10: 3.10,
  },
  {
    name: 'C-38',
    region: 'Conger Ice Shelf',
    current: { latitude: -65.500, longitude: 104.200 },
    previous_1: { latitude: -65.520, longitude: 104.300 },
    previous_2: { latitude: -65.540, longitude: 104.400 },
    previous_3: { latitude: -65.560, longitude: 104.500 },
    previous_4: { latitude: -65.580, longitude: 104.600 },
    size: 1200.0,
    mask: 1,
    date: '2022-03-15',
    u10: 4.80,
    v10: 1.50,
  },
  {
    name: 'A-38B',
    region: 'South Georgia',
    current: { latitude: -54.500, longitude: -36.500 },
    previous_1: { latitude: -54.600, longitude: -36.600 },
    previous_2: { latitude: -54.700, longitude: -36.700 },
    previous_3: { latitude: -54.800, longitude: -36.800 },
    previous_4: { latitude: -54.900, longitude: -36.900 },
    size: 2200.0,
    mask: 1,
    date: '2004-04-10',
    u10: 6.20,
    v10: 4.80,
  }
];

export function IcebergSection() {
  const [selectedPreset, setSelectedPreset] = useState<number>(0);
  const [prediction, setPrediction] = useState<IcebergPredictionResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const activeIceberg = PRESETS[selectedPreset];
  const todayDate = new Date().toISOString().split('T')[0];

  const runPrediction = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchIcebergPrediction({
        current: activeIceberg.current,
        previous_1: activeIceberg.previous_1,
        previous_2: activeIceberg.previous_2,
        previous_3: activeIceberg.previous_3,
        previous_4: activeIceberg.previous_4,
        size: activeIceberg.size,
        mask: activeIceberg.mask,
        date: todayDate,
        u10: activeIceberg.u10,
        v10: activeIceberg.v10,
        forecast_steps: 3,
      });
      setPrediction(res);
    } catch (err: any) {
      setError(err?.message || 'Failed to predict iceberg trajectory');
    } finally {
      setLoading(false);
    }
  };

  // Run on first load and when preset changes
  useEffect(() => {
    runPrediction();
  }, [selectedPreset]);

  // Construct trajectory points for map
  const trajectoryPoints: TrajectoryPoint[] = [
    { lat: activeIceberg.previous_4.latitude, lon: activeIceberg.previous_4.longitude, label: 'T-4', type: 'history' },
    { lat: activeIceberg.previous_3.latitude, lon: activeIceberg.previous_3.longitude, label: 'T-3', type: 'history' },
    { lat: activeIceberg.previous_2.latitude, lon: activeIceberg.previous_2.longitude, label: 'T-2', type: 'history' },
    { lat: activeIceberg.previous_1.latitude, lon: activeIceberg.previous_1.longitude, label: 'T-1', type: 'history' },
    { lat: activeIceberg.current.latitude, lon: activeIceberg.current.longitude, label: 'Current', type: 'current' },
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
                onClick={() => setSelectedPreset(idx)}
              >
                <div className="preset-name">{p.name}</div>
                <div className="preset-region">{p.region}</div>
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 0', color: 'var(--text-secondary)' }}>
            <RotateCcw className="loading-spinner" size={16} />
            <span>Computing Trajectory...</span>
          </div>
        )}

        {error && <div className="iceberg-error-badge">{error}</div>}

        {/* Results Card */}
        {prediction && !loading && (
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
            selectedLat={activeIceberg.current.latitude}
            selectedLon={activeIceberg.current.longitude}
            selectedDate={todayDate}
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
              3-Day Trajectory Projection
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
