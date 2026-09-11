import { useState, useEffect, useRef } from 'react';
import { Route, Navigation, RotateCcw, Activity, MapPin, Sparkles, ChevronDown } from 'lucide-react';
import { AntarcticMap } from '../Map';
import { fetchPathPrediction, type PathNode, type PathPredictionSummary } from '../api';
import { PathJourneySummary } from './PathJourneySummary';
import '../index.css';

interface RoutePreset {
  name: string;
  region: string;
  start: { lat: number; lon: number };
  end: { lat: number; lon: number };
}

const ROUTE_PRESETS: RoutePreset[] = [
  {
    name: 'Drake Passage to Weddell Sea',
    region: 'South Atlantic Sector',
    start: { lat: -58.0, lon: -60.0 },
    end: { lat: -64.0, lon: -45.0 },
  },
  {
    name: 'Ross Sea Northern Approach',
    region: 'Pacific Sector',
    start: { lat: -65.0, lon: 175.0 },
    end: { lat: -70.0, lon: -170.0 },
  },
  {
    name: 'Bellingshausen Sea Transit',
    region: 'West Antarctica',
    start: { lat: -66.0, lon: -90.0 },
    end: { lat: -68.0, lon: -100.0 },
  },
];

export function PathPredictionSection() {
  // Coordinate input strings to allow free typing (including '-', '.', etc.)
  const [startLatStr, setStartLatStr] = useState<string>('');
  const [startLonStr, setStartLonStr] = useState<string>('');
  const [endLatStr, setEndLatStr] = useState<string>('');
  const [endLonStr, setEndLonStr] = useState<string>('');

  const [startPoint, setStartPoint] = useState<PathNode | null>(null);
  const [endPoint, setEndPoint] = useState<PathNode | null>(null);
  const [pathPoints, setPathPoints] = useState<PathNode[]>([]);
  const [distance, setDistance] = useState<number | null>(null);
  const [summary, setSummary] = useState<PathPredictionSummary | null>(null);
  const [selectedPresetName, setSelectedPresetName] = useState<string | null>(null);
  const [focusPathTrigger, setFocusPathTrigger] = useState<number>(0);
  const [resetViewTrigger, setResetViewTrigger] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active target for map clicks: 'start' or 'end'
  const [mapTarget, setMapTarget] = useState<'start' | 'end'>('start');

  // Keep ref for map clicks
  const stateRef = useRef({ startPoint, endPoint, mapTarget });
  useEffect(() => {
    stateRef.current = { startPoint, endPoint, mapTarget };
  }, [startPoint, endPoint, mapTarget]);

  // Handle map clicks
  const handleMapClick = (lat: number, lon: number) => {
    const target = stateRef.current.mapTarget;
    const roundedLat = parseFloat(lat.toFixed(3));
    const roundedLon = parseFloat(lon.toFixed(3));

    if (target === 'start') {
      setStartLatStr(roundedLat.toString());
      setStartLonStr(roundedLon.toString());
      setStartPoint({ lat: roundedLat, lon: roundedLon });
      setMapTarget('end');
    } else {
      setEndLatStr(roundedLat.toString());
      setEndLonStr(roundedLon.toString());
      setEndPoint({ lat: roundedLat, lon: roundedLon });
      setMapTarget('start');
    }
    setPathPoints([]);
    setDistance(null);
    setSummary(null);
    setSelectedPresetName(null);
    setError(null);
  };

  // Sync Start Point when user types
  const handleStartLatChange = (val: string) => {
    setStartLatStr(val);
    const num = parseFloat(val);
    const lonNum = parseFloat(startLonStr);
    if (!isNaN(num) && num <= 0 && num >= -90 && !isNaN(lonNum) && lonNum >= -180 && lonNum <= 180) {
      setStartPoint({ lat: num, lon: lonNum });
    } else if (val === '' || isNaN(num)) {
      setStartPoint(null);
    }
  };

  const handleStartLonChange = (val: string) => {
    setStartLonStr(val);
    const latNum = parseFloat(startLatStr);
    const num = parseFloat(val);
    if (!isNaN(latNum) && latNum <= 0 && latNum >= -90 && !isNaN(num) && num >= -180 && num <= 180) {
      setStartPoint({ lat: latNum, lon: num });
    } else if (val === '' || isNaN(num)) {
      setStartPoint(null);
    }
  };

  // Sync End Point when user types
  const handleEndLatChange = (val: string) => {
    setEndLatStr(val);
    const num = parseFloat(val);
    const lonNum = parseFloat(endLonStr);
    if (!isNaN(num) && num <= 0 && num >= -90 && !isNaN(lonNum) && lonNum >= -180 && lonNum <= 180) {
      setEndPoint({ lat: num, lon: lonNum });
    } else if (val === '' || isNaN(num)) {
      setEndPoint(null);
    }
  };

  const handleEndLonChange = (val: string) => {
    setEndLonStr(val);
    const latNum = parseFloat(endLatStr);
    const num = parseFloat(val);
    if (!isNaN(latNum) && latNum <= 0 && latNum >= -90 && !isNaN(num) && num >= -180 && num <= 180) {
      setEndPoint({ lat: latNum, lon: num });
    } else if (val === '' || isNaN(num)) {
      setEndPoint(null);
    }
  };

  // Apply a preset route
  const applyPreset = (preset: RoutePreset) => {
    setSelectedPresetName(preset.name);
    setStartLatStr(preset.start.lat.toString());
    setStartLonStr(preset.start.lon.toString());
    setStartPoint(preset.start);

    setEndLatStr(preset.end.lat.toString());
    setEndLonStr(preset.end.lon.toString());
    setEndPoint(preset.end);

    setPathPoints([]);
    setDistance(null);
    setSummary(null);
    setError(null);
  };

  // Calculate route
  const calculateRoute = async () => {
    const sLat = parseFloat(startLatStr);
    const sLon = parseFloat(startLonStr);
    const eLat = parseFloat(endLatStr);
    const eLon = parseFloat(endLonStr);

    if (isNaN(sLat) || isNaN(sLon)) {
      setError("Please enter valid numerical coordinates for Start Point.");
      return;
    }
    if (isNaN(eLat) || isNaN(eLon)) {
      setError("Please enter valid numerical coordinates for End Point.");
      return;
    }
    if (sLat > 0 || sLat < -90 || eLat > 0 || eLat < -90) {
      setError("Latitude must be between -90° (South Pole) and 0° (Equator).");
      return;
    }
    if (sLon < -180 || sLon > 180 || eLon < -180 || eLon > 180) {
      setError("Longitude must be between -180° and 180°.");
      return;
    }

    setStartPoint({ lat: sLat, lon: sLon });
    setEndPoint({ lat: eLat, lon: eLon });

    setLoading(true);
    setError(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const res = await fetchPathPrediction(sLat, sLon, eLat, eLon, today);
      if (res.status === 'success' && res.path) {
        setPathPoints(res.path);
        setDistance(res.total_distance_km ?? null);
        setSummary(res.summary ?? null);
        setFocusPathTrigger((prev) => prev + 1);
      } else {
        setError(res.detail || "Failed to find a viable path.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to calculate path.");
    } finally {
      setLoading(false);
    }
  };

  const clearSelection = () => {
    setStartLatStr('');
    setStartLonStr('');
    setEndLatStr('');
    setEndLonStr('');
    setStartPoint(null);
    setEndPoint(null);
    setPathPoints([]);
    setDistance(null);
    setSummary(null);
    setSelectedPresetName(null);
    setError(null);
    setMapTarget('start');
    setResetViewTrigger((prev) => prev + 1);
  };

  // Build markers for map rendering
  const mapPathPoints = [];
  if (startPoint) mapPathPoints.push(startPoint);
  if (pathPoints.length > 0) {
    mapPathPoints.push(...pathPoints.slice(1, -1)); // Middle points
  }
  if (endPoint) mapPathPoints.push(endPoint);

  return (
    <div className="path-page-container">
      <div className="app-container path-app-container">
        {/* Control Panel */}
        <div className="control-panel">
          <div className="panel-header">
            <Route size={28} color="#38bdf8" />
            <div>
              <h1>Path Prediction</h1>
              <p className="panel-subtitle">A* Maritime Routing via Sea-Ice Avoidance</p>
            </div>
          </div>

          {/* Start Point Input Group */}
          <div className="input-group">
            <div className="point-header">
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={14} color="#10b981" />
                1. Start Coordinates (Departure)
              </label>
              <span className="point-badge start">
                {startPoint ? 'Set' : mapTarget === 'start' ? 'Click Map' : 'Required'}
              </span>
            </div>
            <div className="coord-input-row">
              <div className="coord-input-field">
                <span className="coord-sublabel">Latitude (°S)</span>
                <input
                  type="number"
                  step="0.1"
                  min="-90"
                  max="0"
                  placeholder="-60.00"
                  value={startLatStr}
                  onChange={(e) => handleStartLatChange(e.target.value)}
                  className="coord-input start-input"
                />
              </div>
              <div className="coord-input-field">
                <span className="coord-sublabel">Longitude (°E/W)</span>
                <input
                  type="number"
                  step="0.1"
                  min="-180"
                  max="180"
                  placeholder="-50.00"
                  value={startLonStr}
                  onChange={(e) => handleStartLonChange(e.target.value)}
                  className="coord-input start-input"
                />
              </div>
            </div>
          </div>

          {/* End Point Input Group */}
          <div className="input-group">
            <div className="point-header">
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={14} color="#ef4444" />
                2. End Coordinates (Destination)
              </label>
              <span className="point-badge end">
                {endPoint ? 'Set' : mapTarget === 'end' ? 'Click Map' : 'Required'}
              </span>
            </div>
            <div className="coord-input-row">
              <div className="coord-input-field">
                <span className="coord-sublabel">Latitude (°S)</span>
                <input
                  type="number"
                  step="0.1"
                  min="-90"
                  max="0"
                  placeholder="-64.00"
                  value={endLatStr}
                  onChange={(e) => handleEndLatChange(e.target.value)}
                  className="coord-input end-input"
                />
              </div>
              <div className="coord-input-field">
                <span className="coord-sublabel">Longitude (°E/W)</span>
                <input
                  type="number"
                  step="0.1"
                  min="-180"
                  max="180"
                  placeholder="-45.00"
                  value={endLonStr}
                  onChange={(e) => handleEndLonChange(e.target.value)}
                  className="coord-input end-input"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button 
              className="action-btn primary" 
              onClick={calculateRoute} 
              disabled={(!startPoint && (!startLatStr || !startLonStr)) || (!endPoint && (!endLatStr || !endLonStr)) || loading}
              style={{ flex: 1 }}
            >
              {loading ? <RotateCcw className="loading-spinner" size={16} /> : <Navigation size={16} />}
              Compute Route
            </button>
            
            <button 
              className="action-btn secondary" 
              onClick={clearSelection}
              disabled={!startLatStr && !endLatStr && !loading}
              style={{ padding: '0 15px' }}
            >
              Clear
            </button>
          </div>

          {/* Quick Navigational Presets */}
          <div className="input-group" style={{ marginTop: '5px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={13} color="#38bdf8" />
              Quick Sea Route Presets
            </label>
            <div className="route-presets">
              {ROUTE_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  className="route-preset-btn"
                  onClick={() => applyPreset(preset)}
                >
                  <div>
                    <strong style={{ color: '#f1f5f9' }}>{preset.name}</strong>
                    <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>{preset.region}</div>
                  </div>
                  <span style={{ fontSize: '0.68rem', color: '#38bdf8' }}>Select →</span>
                </button>
              ))}
            </div>
          </div>

          {error && <div className="iceberg-error-badge" style={{ marginTop: '10px' }}>{error}</div>}

          {distance !== null && (
            <div className="iceberg-results-summary" style={{ marginTop: '10px' }}>
              <div className="result-title">
                <Activity size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                Routing Results
              </div>
              <div className="metrics-grid">
                <div className="metric-box">
                  <span className="metric-label">Total Distance</span>
                  <span className="metric-value highlight">{distance.toFixed(1)} km</span>
                </div>
                <div className="metric-box">
                  <span className="metric-label">Avg Sea Ice</span>
                  <span
                    className="metric-value"
                    style={{
                      color:
                        (summary?.avg_ice_concentration ?? 0) < 15
                          ? '#10b981'
                          : (summary?.avg_ice_concentration ?? 0) < 40
                          ? '#f59e0b'
                          : '#ef4444',
                    }}
                  >
                    {(summary?.avg_ice_concentration ?? 0).toFixed(1)}%
                  </span>
                </div>
                <div className="metric-box">
                  <span className="metric-label">Waypoints</span>
                  <span className="metric-value">{pathPoints.length}</span>
                </div>
                <div className="metric-box">
                  <span className="metric-label">Status</span>
                  <span className="metric-value" style={{ color: '#10b981' }}>Clear Route</span>
                </div>
              </div>

              <button
                type="button"
                className="scroll-to-summary-btn"
                onClick={() => {
                  document.getElementById('journey-summary')?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <span>View Detailed Journey Summary</span>
                <ChevronDown size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Map Stage */}
        <div className="map-stage">
          <div className="square-map-wrapper">
            <AntarcticMap
              onLocationSelect={handleMapClick}
              selectedLat={startPoint?.lat ?? -90}
              selectedLon={startPoint?.lon ?? 0}
              pathPoints={pathPoints.length > 0 ? pathPoints : mapPathPoints}
              focusPathTrigger={focusPathTrigger}
              resetViewTrigger={resetViewTrigger}
            />
            
            <div className="trajectory-map-legend">
              <div className="legend-item">
                <span className="legend-dot" style={{ background: '#10b981' }}></span>
                <span>Start ({startPoint ? `${startPoint.lat.toFixed(1)}°, ${startPoint.lon.toFixed(1)}°` : 'None'})</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ background: '#ef4444' }}></span>
                <span>End ({endPoint ? `${endPoint.lat.toFixed(1)}°, ${endPoint.lon.toFixed(1)}°` : 'None'})</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Journey Summary at the bottom */}
      {pathPoints.length > 0 && (
        <div className="path-bottom-summary-section">
          <PathJourneySummary
            summary={summary}
            pathPoints={pathPoints}
            startPoint={startPoint}
            endPoint={endPoint}
            presetName={selectedPresetName}
          />
        </div>
      )}
    </div>
  );
}
