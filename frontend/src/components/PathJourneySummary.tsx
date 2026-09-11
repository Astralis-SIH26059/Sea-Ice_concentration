import React, { useState, useMemo } from 'react';
import {
  type PathNode,
  type PathPredictionSummary,
} from '../api';
import {
  Compass,
  Navigation,
  Clock,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Download,
  Copy,
  Check,
  Activity,
  Waves,
  MapPin,
  ChevronDown,
  ChevronUp,
  Snowflake,
  FileSpreadsheet,
} from 'lucide-react';

interface PathJourneySummaryProps {
  summary?: PathPredictionSummary | null;
  pathPoints: PathNode[];
  startPoint: { lat: number; lon: number } | null;
  endPoint: { lat: number; lon: number } | null;
  presetName?: string | null;
}

export const PathJourneySummary: React.FC<PathJourneySummaryProps> = ({
  summary,
  pathPoints,
  startPoint,
  endPoint,
  presetName,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'ice' | 'milestones'>('all');
  const [copied, setCopied] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<{ node: PathNode; index: number } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Client-side fallback metrics calculation if backend summary is absent
  const metrics = useMemo(() => {
    if (summary) return summary;

    if (pathPoints.length === 0) {
      return {
        avg_ice_concentration: 0,
        max_ice_concentration: 0,
        min_ice_concentration: 0,
        total_distance_km: 0,
        total_distance_nm: 0,
        total_waypoints: 0,
        estimated_duration_hours: 0,
        ice_free_distance_km: 0,
        ice_affected_distance_km: 0,
        ice_free_ratio_percent: 100,
        risk_level: 'Low' as const,
        risk_label: 'Open Water Corridor (<15% SIC)',
        recommended_polar_class: 'IMO Category C / Standard Hull',
      };
    }

    const sics = pathPoints.map((p) => p.sic ?? 0);
    const avgSic = sics.reduce((a, b) => a + b, 0) / (sics.length || 1);
    const maxSic = Math.max(...sics, 0);
    const minSic = Math.min(...sics, 0);
    const totalDist = pathPoints[pathPoints.length - 1]?.cumulative_distance_km ?? 0;
    const totalNm = totalDist / 1.852;

    let iceFreeDist = 0;
    let iceAffectedDist = 0;
    let estHours = 0;

    pathPoints.forEach((p) => {
      const legDist = p.distance_from_prev_km ?? 0;
      const sic = p.sic ?? 0;
      if (sic < 15.0) {
        iceFreeDist += legDist;
        estHours += legDist / (12.0 * 1.852);
      } else {
        iceAffectedDist += legDist;
        const spd = Math.max(4.5, 12.0 - (sic - 15.0) * 0.11);
        estHours += legDist / (spd * 1.852);
      }
    });

    const riskLevel: 'Low' | 'Moderate' | 'Elevated' | 'High' =
      maxSic < 15 ? 'Low' : maxSic < 40 ? 'Moderate' : maxSic < 70 ? 'Elevated' : 'High';

    const riskLabel =
      maxSic < 15
        ? 'Open Water Corridor (<15% SIC)'
        : maxSic < 40
        ? 'Marginal Ice Zone (15%–40% SIC)'
        : maxSic < 70
        ? 'Pack Ice Zone (40%–70% SIC)'
        : 'Heavy Consolidated Sea Ice (>70% SIC)';

    const polarClass =
      maxSic < 15
        ? 'IMO Category C / Standard Hull'
        : maxSic < 40
        ? 'IMO Polar Class PC7 (Light Ice-Strengthened)'
        : maxSic < 70
        ? 'IMO Polar Class PC5/PC6 (Medium Icebreaker Escort)'
        : 'IMO Polar Class PC1–PC3 (Heavy Polar Icebreaker)';

    const iceFreeRatio = totalDist > 0 ? (iceFreeDist / totalDist) * 100 : 100;

    return {
      avg_ice_concentration: parseFloat(avgSic.toFixed(1)),
      max_ice_concentration: parseFloat(maxSic.toFixed(1)),
      min_ice_concentration: parseFloat(minSic.toFixed(1)),
      total_distance_km: parseFloat(totalDist.toFixed(2)),
      total_distance_nm: parseFloat(totalNm.toFixed(2)),
      total_waypoints: pathPoints.length,
      estimated_duration_hours: parseFloat(estHours.toFixed(1)),
      ice_free_distance_km: parseFloat(iceFreeDist.toFixed(2)),
      ice_affected_distance_km: parseFloat(iceAffectedDist.toFixed(2)),
      ice_free_ratio_percent: parseFloat(iceFreeRatio.toFixed(1)),
      risk_level: riskLevel,
      risk_label: riskLabel,
      recommended_polar_class: polarClass,
    };
  }, [summary, pathPoints]);

  // Filtered waypoints list
  const filteredWaypoints = useMemo(() => {
    if (filterMode === 'ice') {
      return pathPoints.filter((p, i) => i === 0 || i === pathPoints.length - 1 || (p.sic ?? 0) > 0);
    }
    if (filterMode === 'milestones') {
      return pathPoints.filter(
        (p, i) =>
          i === 0 ||
          i === pathPoints.length - 1 ||
          i % 4 === 0 ||
          (p.sic ?? 0) === metrics.max_ice_concentration
      );
    }
    return pathPoints;
  }, [pathPoints, filterMode, metrics.max_ice_concentration]);

  // Display subset or all waypoints
  const displayedWaypoints = isExpanded ? filteredWaypoints : filteredWaypoints.slice(0, 8);

  // Format latitude/longitude nicely (e.g. 58.200° S, 60.150° W)
  const formatCoord = (lat: number, lon: number) => {
    const latDir = lat < 0 ? 'S' : 'N';
    const lonDir = lon < 0 ? 'W' : 'E';
    return `${Math.abs(lat).toFixed(3)}° ${latDir}, ${Math.abs(lon).toFixed(3)}° ${lonDir}`;
  };

  // Convert hours to formatted days & hours (e.g., "2d 5h" or "18.5 hrs")
  const formatDuration = (hours: number) => {
    if (hours < 24) {
      return `${hours.toFixed(1)} hrs`;
    }
    const days = Math.floor(hours / 24);
    const remHours = Math.round(hours % 24);
    return `${days}d ${remHours}h (${hours.toFixed(0)} hrs)`;
  };

  // Heading cardinal helper
  const getBearingCardinal = (deg: number = 0) => {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(((deg % 360) / 45)) % 8;
    return directions[index];
  };

  // Ice severity badge helper
  const getIceBadge = (sic: number = 0) => {
    if (sic <= 0.5) {
      return { label: 'Ice-Free (0%)', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)' };
    }
    if (sic < 15) {
      return { label: `Open Water (${sic}%)`, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', border: 'rgba(56, 189, 248, 0.3)' };
    }
    if (sic < 40) {
      return { label: `Very Open Drift (${sic}%)`, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)' };
    }
    if (sic < 70) {
      return { label: `Open Drift Ice (${sic}%)`, color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.3)' };
    }
    return { label: `Close Pack Ice (${sic}%)`, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)' };
  };

  // Copy Waypoints CSV to clipboard
  const handleCopyCsv = () => {
    const headers = ['Waypoint', 'Latitude', 'Longitude', 'Leg_Distance_km', 'Cumulative_Distance_km', 'Bearing_deg', 'Sea_Ice_Conc_pct', 'Recommended_Speed_kts'];
    const rows = pathPoints.map((pt, idx) => [
      idx === 0 ? 'WPT-00 (Departure)' : idx === pathPoints.length - 1 ? `WPT-${idx.toString().padStart(2, '0')} (Arrival)` : `WPT-${idx.toString().padStart(2, '0')}`,
      pt.lat.toFixed(4),
      pt.lon.toFixed(4),
      pt.distance_from_prev_km?.toFixed(2) ?? '0.00',
      pt.cumulative_distance_km?.toFixed(2) ?? '0.00',
      pt.bearing_deg?.toFixed(1) ?? '0.0',
      pt.sic?.toFixed(1) ?? '0.0',
      pt.recommended_speed_knots?.toFixed(1) ?? '12.0',
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    navigator.clipboard.writeText(csvContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Download GPX file
  const handleDownloadGpx = () => {
    const today = new Date().toISOString();
    const gpxPoints = pathPoints
      .map(
        (p, idx) => `      <rtept lat="${p.lat}" lon="${p.lon}">
        <name>WPT-${idx.toString().padStart(2, '0')}</name>
        <desc>SIC: ${p.sic ?? 0}%, CumDist: ${p.cumulative_distance_km ?? 0}km</desc>
      </rtept>`
      )
      .join('\n');

    const gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Polaris Polar Navigation System" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${presetName || 'Antarctic Optimal Ice-Avoidance Route'}</name>
    <time>${today}</time>
  </metadata>
  <rte>
    <name>Polaris Calculated Sea Route</name>
    <desc>Total Distance: ${metrics.total_distance_km} km (${metrics.total_distance_nm} NM) | Avg SIC: ${metrics.avg_ice_concentration}%</desc>
${gpxPoints}
  </rte>
</gpx>`;

    const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `polar_route_${new Date().toISOString().split('T')[0]}.gpx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (pathPoints.length === 0) return null;

  return (
    <section id="journey-summary" className="journey-summary-wrapper">
      {/* Header Bar */}
      <div className="journey-summary-header">
        <div className="journey-header-left">
          <div className="journey-title-row">
            <div className="journey-icon-box">
              <Navigation size={22} color="#38bdf8" />
            </div>
            <div>
              <h2 className="journey-title">
                {presetName ? presetName : 'Optimal Voyage & Route Summary'}
              </h2>
              <div className="journey-coords-subtitle">
                <span>
                  <MapPin size={12} color="#10b981" /> Departure:{' '}
                  <strong>{startPoint ? formatCoord(startPoint.lat, startPoint.lon) : 'Start'}</strong>
                </span>
                <span className="route-arrow">→</span>
                <span>
                  <MapPin size={12} color="#ef4444" /> Arrival:{' '}
                  <strong>{endPoint ? formatCoord(endPoint.lat, endPoint.lon) : 'Destination'}</strong>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Header Right / Badges & Action Toolbar */}
        <div className="journey-header-actions">
          <div
            className={`risk-advisory-badge risk-${metrics.risk_level.toLowerCase()}`}
            title={metrics.risk_label}
          >
            {metrics.risk_level === 'Low' ? (
              <ShieldCheck size={16} />
            ) : metrics.risk_level === 'Moderate' ? (
              <Activity size={16} />
            ) : (
              <ShieldAlert size={16} />
            )}
            <span>{metrics.risk_label}</span>
          </div>

          <div className="export-btn-group">
            <button
              type="button"
              className="summary-export-btn"
              onClick={handleCopyCsv}
              title="Copy route waypoints as CSV data"
            >
              {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              <span>{copied ? 'Copied CSV' : 'Copy CSV'}</span>
            </button>

            <button
              type="button"
              className="summary-export-btn highlight"
              onClick={handleDownloadGpx}
              title="Download nautical GPX file for chartplotters"
            >
              <Download size={14} />
              <span>Export GPX</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main KPI Stat Grid */}
      <div className="journey-kpi-grid">
        {/* KPI 1: Average Sea Ice Concentration */}
        <div className="journey-kpi-card highlight-kpi">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
            <Snowflake size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Average Sea Ice Concentration</span>
            <div className="kpi-number-row">
              <span
                className="kpi-value-huge"
                style={{
                  color:
                    metrics.avg_ice_concentration < 15
                      ? '#10b981'
                      : metrics.avg_ice_concentration < 40
                      ? '#f59e0b'
                      : '#ef4444',
                }}
              >
                {metrics.avg_ice_concentration.toFixed(1)}
              </span>
              <span className="kpi-unit">%</span>
            </div>
            <span className="kpi-subtext">
              {metrics.avg_ice_concentration < 15
                ? 'Predominantly open ocean corridor'
                : metrics.avg_ice_concentration < 40
                ? 'Marginal drift ice regime'
                : 'Significant polar pack ice present'}
            </span>
          </div>
        </div>

        {/* KPI 2: Max Ice Encountered */}
        <div className="journey-kpi-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
            <AlertTriangle size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Peak Ice Concentration</span>
            <div className="kpi-number-row">
              <span
                className="kpi-value-huge"
                style={{
                  color:
                    metrics.max_ice_concentration < 15
                      ? '#10b981'
                      : metrics.max_ice_concentration < 40
                      ? '#f59e0b'
                      : '#ef4444',
                }}
              >
                {metrics.max_ice_concentration.toFixed(1)}
              </span>
              <span className="kpi-unit">%</span>
            </div>
            <span className="kpi-subtext">Highest concentration along any route segment</span>
          </div>
        </div>

        {/* KPI 3: Total Nautical Distance */}
        <div className="journey-kpi-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
            <Waves size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Total Voyage Distance</span>
            <div className="kpi-number-row">
              <span className="kpi-value-huge">{metrics.total_distance_km.toFixed(1)}</span>
              <span className="kpi-unit">km</span>
            </div>
            <span className="kpi-subtext">
              <strong>{metrics.total_distance_nm.toFixed(1)} Nautical Miles (NM)</strong>
            </span>
          </div>
        </div>

        {/* KPI 4: Waypoints Count & Legs */}
        <div className="journey-kpi-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
            <Compass size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Total Waypoints</span>
            <div className="kpi-number-row">
              <span className="kpi-value-huge">{metrics.total_waypoints}</span>
              <span className="kpi-unit">pts</span>
            </div>
            <span className="kpi-subtext">
              {metrics.total_waypoints > 1
                ? `${metrics.total_waypoints - 1} navigational course segments`
                : 'Single point'}
            </span>
          </div>
        </div>

        {/* KPI 5: Estimated Transit Time */}
        <div className="journey-kpi-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#eab308' }}>
            <Clock size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Estimated Transit Time</span>
            <div className="kpi-number-row">
              <span className="kpi-value-huge" style={{ fontSize: '1.6rem' }}>
                {formatDuration(metrics.estimated_duration_hours)}
              </span>
            </div>
            <span className="kpi-subtext">At ~12 kts cruising, ice-resistance adjusted</span>
          </div>
        </div>

        {/* KPI 6: IMO Polar Code Vessel Advisory */}
        <div className="journey-kpi-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(14, 165, 233, 0.15)', color: '#38bdf8' }}>
            <ShieldCheck size={20} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">IMO Polar Code Advisory</span>
            <div className="kpi-polar-class">
              {metrics.recommended_polar_class}
            </div>
            <span className="kpi-subtext">
              {metrics.ice_free_ratio_percent.toFixed(0)}% ice-free water track
            </span>
          </div>
        </div>
      </div>

      {/* Ice Distribution Bar & Split Ratio */}
      <div className="journey-distribution-panel">
        <div className="distribution-header">
          <div className="dist-title">
            <Activity size={15} color="#38bdf8" />
            <span>Voyage Ice Exposure Breakdown</span>
          </div>
          <div className="dist-legend">
            <span className="legend-chip open-water">
              <span className="dot" style={{ background: '#10b981' }}></span>
              Open Water (&lt;15%): <strong>{metrics.ice_free_distance_km.toFixed(1)} km ({metrics.ice_free_ratio_percent}%)</strong>
            </span>
            <span className="legend-chip ice-affected">
              <span className="dot" style={{ background: '#f59e0b' }}></span>
              Ice Field (≥15%): <strong>{metrics.ice_affected_distance_km.toFixed(1)} km ({(100 - metrics.ice_free_ratio_percent).toFixed(1)}%)</strong>
            </span>
          </div>
        </div>

        {/* Proportional Split Bar */}
        <div className="split-progress-bar">
          <div
            className="split-bar-fill open-water-fill"
            style={{ width: `${Math.max(1, metrics.ice_free_ratio_percent)}%` }}
            title={`Open Water: ${metrics.ice_free_ratio_percent}%`}
          />
          <div
            className="split-bar-fill ice-fill"
            style={{ width: `${Math.max(0, 100 - metrics.ice_free_ratio_percent)}%` }}
            title={`Ice Field: ${(100 - metrics.ice_free_ratio_percent).toFixed(1)}%`}
          />
        </div>
      </div>

      {/* Visual Route Ice Elevation & Profile Strip */}
      <div className="route-profile-panel">
        <div className="profile-header">
          <div>
            <span className="profile-title">Route Ice Concentration Profile</span>
            <span className="profile-subtitle">
              Sea-ice concentration gradient from Departure (0 km) to Destination ({metrics.total_distance_km.toFixed(0)} km)
            </span>
          </div>
          {hoveredNode && (
            <div className="profile-hover-info">
              <span className="hover-badge">
                WPT {hoveredNode.index}: {hoveredNode.node.sic ?? 0}% SIC • {hoveredNode.node.cumulative_distance_km ?? 0} km • Heading {hoveredNode.node.bearing_deg ?? 0}°
              </span>
            </div>
          )}
        </div>

        {/* Segmented Profile Bar with interactive hover bars */}
        <div className="profile-timeline-container">
          <div className="profile-bars-wrapper">
            {pathPoints.map((pt, idx) => {
              const sic = pt.sic ?? 0;
              const heightPct = Math.max(8, Math.min(100, sic));
              let barColor = '#10b981';
              if (sic > 70) barColor = '#ef4444';
              else if (sic > 40) barColor = '#f97316';
              else if (sic > 15) barColor = '#f59e0b';
              else if (sic > 0) barColor = '#38bdf8';

              return (
                <div
                  key={idx}
                  className="profile-bar-column"
                  onMouseEnter={() => setHoveredNode({ node: pt, index: idx })}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  <div
                    className="profile-bar-pillar"
                    style={{
                      height: `${heightPct}%`,
                      backgroundColor: barColor,
                      boxShadow: hoveredNode?.index === idx ? `0 0 12px ${barColor}` : 'none',
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Timeline Milestones Markers */}
          <div className="profile-timeline-ticks">
            <span>Departure (0 km)</span>
            <span>{(metrics.total_distance_km * 0.25).toFixed(0)} km</span>
            <span>Midpoint ({(metrics.total_distance_km * 0.5).toFixed(0)} km)</span>
            <span>{(metrics.total_distance_km * 0.75).toFixed(0)} km</span>
            <span>Arrival ({metrics.total_distance_km.toFixed(0)} km)</span>
          </div>
        </div>
      </div>

      {/* Detailed Waypoint Navigation Log Table */}
      <div className="waypoint-table-panel">
        <div className="table-header-row">
          <div className="table-title-wrap">
            <FileSpreadsheet size={18} color="#38bdf8" />
            <div>
              <h3 className="table-title">Waypoints Navigation Log</h3>
              <p className="table-subtitle">
                Course breakdown, coordinates, local ice conditions, and compass headings
              </p>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="table-filter-tabs">
            <button
              type="button"
              className={`table-filter-tab ${filterMode === 'all' ? 'active' : ''}`}
              onClick={() => setFilterMode('all')}
            >
              All Waypoints ({pathPoints.length})
            </button>
            <button
              type="button"
              className={`table-filter-tab ${filterMode === 'ice' ? 'active' : ''}`}
              onClick={() => setFilterMode('ice')}
            >
              Ice Encountered ({pathPoints.filter((p) => (p.sic ?? 0) > 0).length})
            </button>
            <button
              type="button"
              className={`table-filter-tab ${filterMode === 'milestones' ? 'active' : ''}`}
              onClick={() => setFilterMode('milestones')}
            >
              Key Milestones
            </button>
          </div>
        </div>

        {/* Responsive Table */}
        <div className="table-responsive-wrapper">
          <table className="waypoint-table">
            <thead>
              <tr>
                <th>Waypoint</th>
                <th>Coordinates (°Lat, °Lon)</th>
                <th>Leg Distance</th>
                <th>Cumulative Distance</th>
                <th>Heading / Bearing</th>
                <th>Sea Ice Concentration</th>
                <th>Advisory Speed</th>
              </tr>
            </thead>
            <tbody>
              {displayedWaypoints.map((pt) => {
                const originalIndex = pathPoints.indexOf(pt);
                const isStart = originalIndex === 0;
                const isEnd = originalIndex === pathPoints.length - 1;
                const badge = getIceBadge(pt.sic ?? 0);
                const bearing = pt.bearing_deg ?? 0;
                const cardinal = getBearingCardinal(bearing);

                return (
                  <tr
                    key={originalIndex}
                    className={`waypoint-tr ${isStart ? 'start-tr' : isEnd ? 'end-tr' : ''} ${
                      (pt.sic ?? 0) >= 40 ? 'heavy-ice-tr' : ''
                    }`}
                  >
                    <td>
                      <div className="wpt-badge-wrap">
                        <span
                          className={`wpt-id-badge ${
                            isStart ? 'wpt-start' : isEnd ? 'wpt-end' : 'wpt-mid'
                          }`}
                        >
                          {isStart
                            ? 'WPT-00 (Start)'
                            : isEnd
                            ? `WPT-${originalIndex.toString().padStart(2, '0')} (End)`
                            : `WPT-${originalIndex.toString().padStart(2, '0')}`}
                        </span>
                      </div>
                    </td>
                    <td className="coord-cell">
                      <strong>{formatCoord(pt.lat, pt.lon)}</strong>
                    </td>
                    <td>
                      <span className="dist-text">
                        {isStart ? '—' : `+${(pt.distance_from_prev_km ?? 0).toFixed(1)} km`}
                      </span>
                    </td>
                    <td>
                      <strong className="dist-highlight">
                        {(pt.cumulative_distance_km ?? 0).toFixed(1)} km
                      </strong>
                      <span className="nm-subtext">
                        ({((pt.cumulative_distance_km ?? 0) / 1.852).toFixed(1)} NM)
                      </span>
                    </td>
                    <td>
                      <div className="bearing-cell">
                        <Compass
                          size={14}
                          color="#38bdf8"
                          style={{ transform: `rotate(${bearing}deg)`, transition: 'transform 0.2s' }}
                        />
                        <span>
                          {bearing.toFixed(1)}° {cardinal}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        className="sic-pill-badge"
                        style={{
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`,
                        }}
                      >
                        <span className="pill-dot" style={{ background: badge.color }}></span>
                        {badge.label}
                      </span>
                    </td>
                    <td>
                      <span className="speed-badge">
                        {(pt.recommended_speed_knots ?? 12.0).toFixed(1)} kts
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Expand / Collapse Waypoints Button */}
        {filteredWaypoints.length > 8 && (
          <div className="table-footer-actions">
            <button
              type="button"
              className="toggle-expand-btn"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? (
                <>
                  <ChevronUp size={16} />
                  <span>Collapse Waypoint Log (Showing all {filteredWaypoints.length})</span>
                </>
              ) : (
                <>
                  <ChevronDown size={16} />
                  <span>
                    Show All {filteredWaypoints.length} Waypoints ({filteredWaypoints.length - 8} more)
                  </span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Polar Maritime Safety Advisory Notice */}
      <div className="polar-advisory-notice">
        <div className="notice-icon">
          <ShieldAlert size={24} color="#38bdf8" />
        </div>
        <div className="notice-text">
          <strong>Polar Route Operational Guidance:</strong>
          <p>
            {metrics.max_ice_concentration < 15
              ? 'Route operates within clear open ocean corridors. Standard high-latitude navigational watch protocols apply. Maintain radar watch for anomalous ice fragments.'
              : metrics.max_ice_concentration < 40
              ? 'Route traverses marginal sea ice regions. Vessels should maintain reduced speed in restricted leads, ensure hull monitoring, and keep a dedicated 24-hour ice lookout.'
              : 'Significant pack ice and consolidated floes detected along the route. Requires Polar Class hull reinforcement (PC6 or better). Consult icebreaker escort services and update radar satellite synthetic aperture imagery prior to entry.'}
          </p>
        </div>
      </div>
    </section>
  );
};
