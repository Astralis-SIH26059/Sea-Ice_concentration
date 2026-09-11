import React, { useState, useMemo } from 'react';
import { type IcebergPredictionResponse } from '../api';
import {
  Anchor,
  Compass,
  Wind,
  Layers,
  AlertTriangle,
  Download,
  Copy,
  Check,
  Activity,
  MapPin,
  ShieldAlert,
  Navigation,
  FileSpreadsheet,
} from 'lucide-react';

interface PresetIcebergData {
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

interface IcebergSummaryProps {
  iceberg: PresetIcebergData;
  prediction: IcebergPredictionResponse | null;
  date: string;
}

// Haversine distance helper (km)
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export const IcebergSummary: React.FC<IcebergSummaryProps> = ({ iceberg, prediction, date }) => {
  const [copied, setCopied] = useState(false);

  // Coordinate formatter
  const formatCoord = (lat: number, lon: number) => {
    const latDir = lat < 0 ? 'S' : 'N';
    const lonDir = lon < 0 ? 'W' : 'E';
    return `${Math.abs(lat).toFixed(3)}° ${latDir}, ${Math.abs(lon).toFixed(3)}° ${lonDir}`;
  };

  // Heading cardinal helper
  const getCardinal = (deg: number = 0) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(((deg % 360) / 45)) % 8;
    return directions[index];
  };

  // Computed summary metrics
  const summaryMetrics = useMemo(() => {
    const windSpeedMps = prediction?.wind_speed_mps ?? Math.hypot(iceberg.u10, iceberg.v10);
    const windSpeedKts = windSpeedMps * 1.94384;
    const driftDeg = prediction?.drift_direction_deg ?? 0;
    const drift24hKm = prediction?.predicted_movement_km ?? 0;
    const drift24hNm = drift24hKm / 1.852;

    let total3dKm = drift24hKm;
    if (prediction?.trajectory && prediction.trajectory.length > 0) {
      total3dKm = prediction.trajectory.reduce((acc, step) => acc + step.movement_km, 0);
    }
    const total3dNm = total3dKm / 1.852;

    // Hazard risk assessment
    let hazardLevel: 'Moderate' | 'High' | 'Severe' = 'Moderate';
    let hazardLabel = 'Regional Shipping Caution';
    if (iceberg.size > 2000 || total3dKm > 30) {
      hazardLevel = 'Severe';
      hazardLabel = 'Major Navigational Hazard (Megaberg Zone)';
    } else if (iceberg.size > 500 || total3dKm > 15) {
      hazardLevel = 'High';
      hazardLabel = 'High Shipping Hazard (Calving Watch)';
    }

    return {
      windSpeedMps,
      windSpeedKts,
      driftDeg,
      drift24hKm,
      drift24hNm,
      total3dKm,
      total3dNm,
      hazardLevel,
      hazardLabel,
    };
  }, [iceberg, prediction]);

  // Build complete chronological timeline table rows (T-4 to T+3)
  const timelineRows = useMemo(() => {
    const rows = [];

    // History: T-4 to T-1
    const hPoints = [
      { step: 'T-4 (4d ago)', lat: iceberg.previous_4.latitude, lon: iceberg.previous_4.longitude, type: 'history' },
      { step: 'T-3 (3d ago)', lat: iceberg.previous_3.latitude, lon: iceberg.previous_3.longitude, type: 'history' },
      { step: 'T-2 (2d ago)', lat: iceberg.previous_2.latitude, lon: iceberg.previous_2.longitude, type: 'history' },
      { step: 'T-1 (Yesterday)', lat: iceberg.previous_1.latitude, lon: iceberg.previous_1.longitude, type: 'history' },
      { step: 'Current (T-0)', lat: iceberg.current.latitude, lon: iceberg.current.longitude, type: 'current' },
    ];

    let cumDist = 0;
    for (let i = 0; i < hPoints.length; i++) {
      const p = hPoints[i];
      let leg = 0;
      if (i > 0) {
        leg = haversineKm(hPoints[i - 1].lat, hPoints[i - 1].lon, p.lat, p.lon);
        cumDist += leg;
      }
      rows.push({
        step: p.step,
        lat: p.lat,
        lon: p.lon,
        movementKm: leg,
        movementNm: leg / 1.852,
        cumKm: cumDist,
        type: p.type,
        status: p.type === 'current' ? 'Verified Current Position' : 'Historical Satellite Observation',
      });
    }

    // Predictions: Day +1 to +3
    if (prediction?.trajectory && prediction.trajectory.length > 0) {
      prediction.trajectory.forEach((step) => {
        cumDist += step.movement_km;
        rows.push({
          step: `Forecast Day +${step.step} (+${step.step * 24}h)`,
          lat: step.lat,
          lon: step.lon,
          movementKm: step.movement_km,
          movementNm: step.movement_km / 1.852,
          cumKm: cumDist,
          type: 'predicted',
          status: 'XGBoost ML Trajectory Forecast',
        });
      });
    } else if (prediction) {
      cumDist += prediction.predicted_movement_km;
      rows.push({
        step: 'Forecast Day +1 (+24h)',
        lat: prediction.predicted_lat,
        lon: prediction.predicted_lon,
        movementKm: prediction.predicted_movement_km,
        movementNm: prediction.predicted_movement_km / 1.852,
        cumKm: cumDist,
        type: 'predicted',
        status: 'XGBoost ML Trajectory Forecast',
      });
    }

    return rows;
  }, [iceberg, prediction]);

  // Export CSV
  const handleCopyCsv = () => {
    const headers = ['Time_Step', 'Latitude', 'Longitude', 'Movement_km', 'Movement_NM', 'Cumulative_km', 'Source_Type'];
    const lines = timelineRows.map((r) => [
      r.step,
      r.lat.toFixed(4),
      r.lon.toFixed(4),
      r.movementKm.toFixed(2),
      r.movementNm.toFixed(2),
      r.cumKm.toFixed(2),
      r.status,
    ]);
    const csv = [headers.join(','), ...lines.map((l) => l.join(','))].join('\n');
    navigator.clipboard.writeText(csv);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Export GPX
  const handleDownloadGpx = () => {
    const today = new Date().toISOString();
    const gpxPoints = timelineRows
      .map(
        (r) => `      <trkpt lat="${r.lat}" lon="${r.lon}">
        <name>${r.step}</name>
        <desc>${r.status} - Leg: ${r.movementKm.toFixed(1)} km</desc>
      </trkpt>`
      )
      .join('\n');

    const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Polaris Iceberg Tracking Console" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${iceberg.name} Trajectory Track</name>
    <time>${today}</time>
  </metadata>
  <trk>
    <name>${iceberg.name} Drift Projection</name>
    <desc>Region: ${iceberg.region} | Size: ${iceberg.size} km2 | 24h Movement: ${summaryMetrics.drift24hKm.toFixed(1)} km</desc>
    <trkseg>
${gpxPoints}
    </trkseg>
  </trk>
</gpx>`;

    const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${iceberg.name.toLowerCase().replace(/\s+/g, '_')}_trajectory_${date}.gpx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <section id="iceberg-summary" className="journey-summary-wrapper iceberg-summary-wrapper">
      {/* Header */}
      <div className="journey-summary-header">
        <div className="journey-header-left">
          <div className="journey-title-row">
            <div className="journey-icon-box" style={{ background: 'rgba(56, 189, 248, 0.15)', borderColor: 'rgba(56, 189, 248, 0.4)' }}>
              <Anchor size={22} color="#38bdf8" />
            </div>
            <div>
              <h2 className="journey-title">{iceberg.name} — Drift & Trajectory Summary</h2>
              <div className="journey-coords-subtitle">
                <span>
                  <MapPin size={12} color="#38bdf8" /> Sector: <strong>{iceberg.region}</strong>
                </span>
                <span className="route-arrow">•</span>
                <span>
                  Coordinates: <strong>{formatCoord(iceberg.current.latitude, iceberg.current.longitude)}</strong>
                </span>
                <span className="route-arrow">•</span>
                <span>
                  Dimensions: <strong>{iceberg.size.toFixed(0)} km² Surface Area</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="journey-header-actions">
          <div
            className={`risk-advisory-badge risk-${summaryMetrics.hazardLevel.toLowerCase()}`}
            title={summaryMetrics.hazardLabel}
          >
            {summaryMetrics.hazardLevel === 'Severe' ? (
              <ShieldAlert size={16} />
            ) : (
              <AlertTriangle size={16} />
            )}
            <span>{summaryMetrics.hazardLabel}</span>
          </div>

          <div className="export-btn-group">
            <button
              type="button"
              className="summary-export-btn"
              onClick={handleCopyCsv}
              title="Copy complete trajectory log as CSV"
            >
              {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              <span>{copied ? 'Copied CSV' : 'Copy CSV'}</span>
            </button>

            <button
              type="button"
              className="summary-export-btn highlight"
              onClick={handleDownloadGpx}
              title="Download GPX trajectory track"
            >
              <Download size={14} />
              <span>Export GPX</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="journey-kpi-grid">
        {/* KPI 1: 24h Movement */}
        <div className="journey-kpi-card highlight-kpi">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
            <Activity size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">24-Hour Projected Drift</span>
            <div className="kpi-number-row">
              <span className="kpi-value-huge" style={{ color: '#38bdf8' }}>
                {summaryMetrics.drift24hKm.toFixed(2)}
              </span>
              <span className="kpi-unit">km</span>
            </div>
            <span className="kpi-subtext">
              <strong>{summaryMetrics.drift24hNm.toFixed(2)} NM</strong> (~{(summaryMetrics.drift24hKm / 24).toFixed(2)} km/h average drift)
            </span>
          </div>
        </div>

        {/* KPI 2: 3-Day Forecast Movement */}
        <div className="journey-kpi-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <Navigation size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">3-Day Total Projected Drift</span>
            <div className="kpi-number-row">
              <span className="kpi-value-huge" style={{ color: '#10b981' }}>
                +{summaryMetrics.total3dKm.toFixed(1)}
              </span>
              <span className="kpi-unit">km</span>
            </div>
            <span className="kpi-subtext">
              <strong>+{summaryMetrics.total3dNm.toFixed(1)} Nautical Miles</strong> multi-day displacement
            </span>
          </div>
        </div>

        {/* KPI 3: Drift Heading */}
        <div className="journey-kpi-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}>
            <Compass size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Drift Heading & Vector</span>
            <div className="kpi-number-row">
              <span className="kpi-value-huge">
                {summaryMetrics.driftDeg.toFixed(1)}°
              </span>
              <span className="kpi-unit">{getCardinal(summaryMetrics.driftDeg)}</span>
            </div>
            <span className="kpi-subtext">
              ΔX: {prediction && prediction.predicted_dx_km >= 0 ? '+' : ''}{prediction?.predicted_dx_km.toFixed(2) ?? '0.00'} km • ΔY: {prediction && prediction.predicted_dy_km >= 0 ? '+' : ''}{prediction?.predicted_dy_km.toFixed(2) ?? '0.00'} km
            </span>
          </div>
        </div>

        {/* KPI 4: Wind Forcing */}
        <div className="journey-kpi-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(129, 140, 248, 0.15)', color: '#818cf8' }}>
            <Wind size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">10m Surface Wind Forcing</span>
            <div className="kpi-number-row">
              <span className="kpi-value-huge">{summaryMetrics.windSpeedMps.toFixed(1)}</span>
              <span className="kpi-unit">m/s</span>
            </div>
            <span className="kpi-subtext">
              ~{summaryMetrics.windSpeedKts.toFixed(1)} kts wind • u10: {iceberg.u10} m/s, v10: {iceberg.v10} m/s
            </span>
          </div>
        </div>

        {/* KPI 5: Iceberg Surface Area */}
        <div className="journey-kpi-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#eab308' }}>
            <Layers size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Iceberg Surface Area</span>
            <div className="kpi-number-row">
              <span className="kpi-value-huge">{iceberg.size.toFixed(0)}</span>
              <span className="kpi-unit">km²</span>
            </div>
            <span className="kpi-subtext">
              {iceberg.size > 2500 ? 'Ultra-large calved megaberg' : iceberg.size > 500 ? 'Major tabular ice platform' : 'Medium-scale iceberg body'}
            </span>
          </div>
        </div>

        {/* KPI 6: Hazard Level */}
        <div className="journey-kpi-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
            <AlertTriangle size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Navigational Risk Radius</span>
            <div className="kpi-number-row">
              <span className="kpi-value-huge" style={{ fontSize: '1.6rem', color: '#ef4444' }}>
                50 NM
              </span>
            </div>
            <span className="kpi-subtext">Bergy bit & growler fragmentation zone</span>
          </div>
        </div>
      </div>

      {/* 3-Day Forecast Progression Cards */}
      {prediction?.trajectory && prediction.trajectory.length > 0 && (
        <div className="route-profile-panel" style={{ background: 'rgba(15, 23, 42, 0.55)' }}>
          <div className="profile-header">
            <div>
              <span className="profile-title">3-Day Trajectory Movement Forecast</span>
              <span className="profile-subtitle">
                Physics-informed machine learning forecast of multi-day drift displacement
              </span>
            </div>
          </div>
          <div className="forecast-cards" style={{ marginTop: '0.5rem' }}>
            {prediction.trajectory.map((step) => (
              <div key={step.step} className="forecast-card iceberg-step-card">
                <div className="forecast-date">Forecast Day +{step.step} (+{step.step * 24}h)</div>
                <div className="forecast-value">
                  +{step.movement_km.toFixed(1)} km
                </div>
                <div className="iceberg-step-coord">
                  {formatCoord(step.lat, step.lon)}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '4px' }}>
                  ΔX: {step.predicted_dx_km >= 0 ? '+' : ''}{step.predicted_dx_km.toFixed(1)} km | ΔY: {step.predicted_dy_km >= 0 ? '+' : ''}{step.predicted_dy_km.toFixed(1)} km
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Chronological Trajectory Table */}
      <div className="waypoint-table-panel">
        <div className="table-header-row">
          <div className="table-title-wrap">
            <FileSpreadsheet size={18} color="#38bdf8" />
            <div>
              <h3 className="table-title">Chronological Drift & Observation Log</h3>
              <p className="table-subtitle">
                Historical satellite tracking coordinates (T-4 → T-1) and forward ML predicted trajectory (T-0 → +72h)
              </p>
            </div>
          </div>
        </div>

        <div className="table-responsive-wrapper">
          <table className="waypoint-table">
            <thead>
              <tr>
                <th>Time Horizon</th>
                <th>Coordinates (°Lat, °Lon)</th>
                <th>Step Movement</th>
                <th>Cumulative Drift</th>
                <th>Tracking Type / Source</th>
              </tr>
            </thead>
            <tbody>
              {timelineRows.map((r, idx) => {
                const isCurrent = r.type === 'current';
                const isPredicted = r.type === 'predicted';

                return (
                  <tr
                    key={idx}
                    className={`waypoint-tr ${isCurrent ? 'start-tr' : isPredicted ? 'heavy-ice-tr' : ''}`}
                  >
                    <td>
                      <span
                        className={`wpt-id-badge ${
                          isCurrent ? 'wpt-start' : isPredicted ? 'wpt-end' : 'wpt-mid'
                        }`}
                      >
                        {r.step}
                      </span>
                    </td>
                    <td className="coord-cell">
                      <strong>{formatCoord(r.lat, r.lon)}</strong>
                    </td>
                    <td>
                      <span className="dist-text">
                        {r.movementKm > 0 ? `+${r.movementKm.toFixed(2)} km (${r.movementNm.toFixed(2)} NM)` : 'Baseline'}
                      </span>
                    </td>
                    <td>
                      <strong className="dist-highlight">{r.cumKm.toFixed(2)} km</strong>
                      <span className="nm-subtext">({(r.cumKm / 1.852).toFixed(2)} NM)</span>
                    </td>
                    <td>
                      <span
                        className="sic-pill-badge"
                        style={{
                          background:
                            isCurrent
                              ? 'rgba(16, 185, 129, 0.15)'
                              : isPredicted
                              ? 'rgba(239, 68, 68, 0.15)'
                              : 'rgba(56, 189, 248, 0.15)',
                          color: isCurrent ? '#10b981' : isPredicted ? '#ef4444' : '#38bdf8',
                          border: `1px solid ${
                            isCurrent
                              ? 'rgba(16, 185, 129, 0.35)'
                              : isPredicted
                              ? 'rgba(239, 68, 68, 0.35)'
                              : 'rgba(56, 189, 248, 0.35)'
                          }`,
                        }}
                      >
                        <span
                          className="pill-dot"
                          style={{
                            background: isCurrent ? '#10b981' : isPredicted ? '#ef4444' : '#38bdf8',
                          }}
                        />
                        {r.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Navigational & Ice Hazard Advisory Notice */}
      <div className="polar-advisory-notice">
        <div className="notice-icon">
          <ShieldAlert size={24} color="#f59e0b" />
        </div>
        <div className="notice-text">
          <strong>Iceberg Maritime Operational Advisory:</strong>
          <p>
            Vessels operating within 50 nautical miles of {iceberg.name} ({iceberg.region}) should exercise extreme vigilance.
            Tabular icebergs generate extensive sub-surface ice rams and calve dense fields of growlers and bergy bits that are difficult to detect on radar during heavy swells.
            Wind forcing ({summaryMetrics.windSpeedMps.toFixed(1)} m/s) and Southern Ocean Ekman currents dictate an active drift heading of ~{summaryMetrics.driftDeg.toFixed(0)}°.
            Maintain continuous radar watch and enforce increased safety clearance margins.
          </p>
        </div>
      </div>
    </section>
  );
};
