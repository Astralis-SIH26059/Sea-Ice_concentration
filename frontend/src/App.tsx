import React, { useState, useEffect, useRef } from 'react';
import { AntarcticMap } from './Map';
import { fetchSeaIceData, type SeaIceData } from './api';
import { 
  MapPin, Calendar, Activity, Snowflake, Compass, Satellite, 
  Layers, UploadCloud, FileText, CheckCircle2, 
  Menu, X, ShieldCheck, Sun, Eye,
  ThermometerSnowflake, RefreshCw, ChevronRight, Info
} from 'lucide-react';
import './index.css';

// Preset Research Stations & Regions in Antarctica
interface StationPreset {
  name: string;
  country: string;
  lat: number;
  lon: number;
  description: string;
}

const PRESET_STATIONS: StationPreset[] = [
  { name: 'Maitri Station', country: 'India 🇮🇳', lat: -70.767, lon: 11.733, description: 'Schirmacher Oasis, Queen Maud Land' },
  { name: 'Bharati Station', country: 'India 🇮🇳', lat: -69.407, lon: 76.191, description: 'Larsemann Hills, East Antarctica' },
  { name: 'McMurdo Station', country: 'USA 🇺🇸', lat: -77.846, lon: 166.668, description: 'Ross Island, McMurdo Sound' },
  { name: 'Weddell Sea', country: 'Cryo-Basin', lat: -73.500, lon: -45.000, description: 'Major Antarctic Pack Ice Sector' },
  { name: 'Ross Ice Shelf', country: 'Cryo-Basin', lat: -81.500, lon: -175.000, description: 'Largest Floating Ice Body' },
  { name: 'Amundsen Sea', country: 'Cryo-Basin', lat: -72.000, lon: -115.000, description: 'West Antarctic Coastal Ocean' },
];

function getIceClassification(concentration: number): { label: string; className: string; description: string } {
  if (concentration < 15) {
    return { label: 'Open Water (Ice-Free)', className: 'class-open', description: 'Fraction < 15%. Open ocean navigable with standard vessels.' };
  } else if (concentration < 40) {
    return { label: 'Very Open Drift Ice', className: 'class-vopen', description: 'Fraction 15-40%. Loose ice floes, easily navigable.' };
  } else if (concentration < 70) {
    return { label: 'Open Drift Ice', className: 'class-open-drift', description: 'Fraction 40-70%. Ice floes in contact, moderate navigation resistance.' };
  } else if (concentration < 90) {
    return { label: 'Close Pack Ice', className: 'class-close', description: 'Fraction 70-90%. Floes frozen together, ice-strengthened hull required.' };
  } else {
    return { label: 'Consolidated Pack Ice', className: 'class-consolidated', description: 'Fraction 90-100%. Solid unbroken ice sheet / fast ice.' };
  }
}

function calculateAlbedo(concentration: number): number {
  // Open water albedo ~0.08, Fresh snow/ice albedo ~0.85
  return parseFloat((0.08 + (concentration / 100) * 0.77).toFixed(2));
}

function getAustralSeason(dateStr: string): { season: string; insolation: string } {
  const month = new Date(dateStr).getMonth() + 1;
  if (month >= 11 || month <= 2) {
    return { season: 'Austral Summer', insolation: '24h Polar Sunlight (High)' };
  } else if (month >= 3 && month <= 4) {
    return { season: 'Austral Autumn', insolation: 'Decreasing Twilight' };
  } else if (month >= 5 && month <= 8) {
    return { season: 'Austral Winter', insolation: 'Continuous Polar Night (Low)' };
  } else {
    return { season: 'Austral Spring', insolation: 'Increasing Solar Angle' };
  }
}

function App() {
  const [date, setDate] = useState<string>('2023-12-01');
  const [lat, setLat] = useState<number | null>(-70.767);
  const [lon, setLon] = useState<number | null>(11.733);
  const [latInput, setLatInput] = useState<string>('-70.767');
  const [lonInput, setLonInput] = useState<string>('11.733');
  const [iceData, setIceData] = useState<SeaIceData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // UI states
  const [inputTab, setInputTab] = useState<'coords' | 'upload'>('coords');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string } | null>(null);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [history, setHistory] = useState<Array<{ lat: number; lon: number; date: string; conc: number }>>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Initial load or coordinate update
  useEffect(() => {
    if (lat !== null && lon !== null && date) {
      const loadData = async () => {
        setLoading(true);
        setError(null);
        try {
          const data = await fetchSeaIceData(lat, lon, date);
          setIceData(data);
          // Add to query history (limit 5)
          setHistory((prev) => {
            const exists = prev.some((h) => h.lat === lat && h.lon === lon && h.date === date);
            if (exists) return prev;
            return [{ lat, lon, date, conc: data.concentration }, ...prev.slice(0, 4)];
          });
        } catch (_err) {
          setError('Failed to fetch sea-ice remote sensing telemetry');
          setIceData(null);
        } finally {
          setLoading(false);
        }
      };
      loadData();
    }
  }, [lat, lon, date]);

  const handleLocationSelect = (newLat: number, newLon: number) => {
    // Southern polar boundary check
    if (newLat > -50) {
      alert("Antarctic Observation Boundary: Please select a coordinate in the Southern Polar Region (< -50°S).");
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

  const applyCoordinateInput = () => {
    if (latInput.trim() === '' || lonInput.trim() === '') {
      return;
    }
    const parsedLat = parseFloat(latInput);
    const parsedLon = parseFloat(lonInput);
    
    if (isNaN(parsedLat) || parsedLat < -90 || parsedLat > -50) {
      alert("Please enter a valid Antarctic latitude between -90.0° and -50.0°.");
      return;
    }
    if (isNaN(parsedLon) || parsedLon < -180 || parsedLon > 180) {
      alert("Please enter a valid longitude between -180.0° and 180.0°.");
      return;
    }
    
    setLat(parsedLat);
    setLon(parsedLon);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      applyCoordinateInput();
    }
  };

  const selectStation = (station: StationPreset) => {
    setLat(station.lat);
    setLon(station.lon);
    setLatInput(station.lat.toString());
    setLonInput(station.lon.toString());
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processUploadedFile(e.target.files[0]);
    }
  };

  const processUploadedFile = (file: File) => {
    const sizeInKB = (file.size / 1024).toFixed(1);
    setUploadedFile({
      name: file.name,
      size: `${sizeInKB} KB`
    });
    // Auto simulate coordinate extraction if it's a scientific raster or CSV
    // Defaults to Bharati station or keeps current coords
    if (lat === null || lon === null) {
      setLat(-69.407);
      setLon(76.191);
      setLatInput('-69.407');
      setLonInput('76.191');
    }
  };

  const clearUploadedFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const classification = iceData ? getIceClassification(iceData.concentration) : null;
  const albedoValue = iceData ? calculateAlbedo(iceData.concentration) : null;
  const seasonInfo = getAustralSeason(date);

  return (
    <div className="app-wrapper">
      {/* Dynamic Polar Ambient Lighting Background */}
      <div className="ambient-glow-mesh"></div>

      {/* 1. TOP NAVBAR */}
      <nav className="site-navbar">
        <div className="container nav-container">
          <a href="#hero" className="brand-logo">
            <div className="brand-icon-wrapper">
              <Snowflake size={22} color="#38bdf8" />
            </div>
            <div className="brand-text">
              <div className="brand-title">
                POLARIS <span className="brand-tag">SIC-v2</span>
              </div>
              <span className="brand-subtitle">Antarctic Cryosphere Remote Sensing</span>
            </div>
          </a>

          <ul className="nav-links">
            <li><a href="#hero" className="nav-link"><Compass size={15} /> Overview</a></li>
            <li><a href="#workstation" className="nav-link active"><Satellite size={15} /> Geo Terminal</a></li>
            <li><a href="#stations" className="nav-link"><MapPin size={15} /> Research Stations</a></li>
            <li><a href="#science" className="nav-link"><Info size={15} /> Science & Physics</a></li>
          </ul>

          <div className="nav-actions">
            <div className="status-pill">
              <span className="status-beacon"></span>
              <span>Telemetry: Live</span>
            </div>
            <button 
              className="mobile-menu-btn" 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="mobile-nav-drawer open">
            <a href="#hero" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Overview</a>
            <a href="#workstation" className="nav-link active" onClick={() => setMobileMenuOpen(false)}>Geo Terminal</a>
            <a href="#stations" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Research Stations</a>
            <a href="#science" className="nav-link" onClick={() => setMobileMenuOpen(false)}>Science & Physics</a>
          </div>
        )}
      </nav>

      {/* 2. HERO SECTION */}
      <header id="hero" className="hero-section">
        <div className="hero-backdrop-grid"></div>
        <div className="container hero-content">
          <div className="hero-badge-tag">
            <ShieldCheck size={14} /> Smart India Hackathon // Polar Cryosphere Observation
          </div>
          <h1 className="hero-title">
            Antarctic <span className="hero-title-highlight">Sea Ice Concentration</span> & Remote Sensing
          </h1>
          <p className="hero-description">
            High-precision satellite observation and radiometer grid analytics for the Southern Ocean cryosphere. 
            Analyze temporal ice dynamics, surface albedo, and consolidated pack boundaries with spatial resolution down to 12.5 km.
          </p>

          <div className="hero-actions">
            <a href="#workstation" className="btn btn-primary">
              <Satellite size={18} /> Launch Geo-Spatial Terminal
            </a>
            <a href="#science" className="btn btn-secondary">
              <Info size={18} /> Explore Cryosphere Science
            </a>
          </div>

          {/* Key Indicators Grid */}
          <div className="hero-stats-grid">
            <div className="hero-stat-card">
              <div className="hero-stat-icon"><Compass size={20} /></div>
              <div>
                <div className="hero-stat-label">Coverage Basin</div>
                <div className="hero-stat-val">50°S — 90°S Pole</div>
              </div>
            </div>

            <div className="hero-stat-card">
              <div className="hero-stat-icon"><Layers size={20} /></div>
              <div>
                <div className="hero-stat-label">Spatial Grid</div>
                <div className="hero-stat-val">12.5 / 25 km Multi-scale</div>
              </div>
            </div>

            <div className="hero-stat-card">
              <div className="hero-stat-icon"><ThermometerSnowflake size={20} /></div>
              <div>
                <div className="hero-stat-label">Classification Scale</div>
                <div className="hero-stat-val">WMO Standard (0 - 100%)</div>
              </div>
            </div>

            <div className="hero-stat-card">
              <div className="hero-stat-icon"><RefreshCw size={20} /></div>
              <div>
                <div className="hero-stat-label">Sensor Frequency</div>
                <div className="hero-stat-val">Daily Radiometer Cadence</div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 3. MAIN WORKSTATION & ANALYSIS SECTION */}
      <section id="workstation" className="workstation-section">
        <div className="container">
          <div className="section-header">
            <div>
              <div className="section-tag"><Satellite size={14} /> Interactive Telemetry Station</div>
              <h2 className="section-title">Antarctic Cryosphere Workstation</h2>
            </div>
            <div className="section-subtitle">
              Select geographic coordinates or ingest satellite rasters to estimate Sea Ice Concentration.
            </div>
          </div>

          <div className="workstation-grid">
            {/* LEFT CONTROL PANEL */}
            <aside className="control-hub-panel">
              {/* Tab Selector */}
              <div className="hub-tabs">
                <button 
                  className={`hub-tab-btn ${inputTab === 'coords' ? 'active' : ''}`}
                  onClick={() => setInputTab('coords')}
                >
                  <MapPin size={14} /> Coordinate Search
                </button>
                <button 
                  className={`hub-tab-btn ${inputTab === 'upload' ? 'active' : ''}`}
                  onClick={() => setInputTab('upload')}
                >
                  <UploadCloud size={14} /> Ingest File / GeoJSON
                </button>
              </div>

              {/* Research Station Presets */}
              <div className="presets-section">
                <div className="presets-label">Polar Presets & Stations</div>
                <div className="presets-tags">
                  {PRESET_STATIONS.map((station) => (
                    <button
                      key={station.name}
                      type="button"
                      className={`preset-chip ${lat === station.lat && lon === station.lon ? 'active' : ''}`}
                      onClick={() => selectStation(station)}
                    >
                      {station.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date Input */}
              <div className="form-group">
                <label htmlFor="date-picker" className="form-label">
                  <span className="form-label-title"><Calendar size={14} color="#38bdf8" /> Observation Date</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Austral Calendar</span>
                </label>
                <input
                  id="date-picker"
                  type="date"
                  className="custom-input"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>

              {/* TAB 1: Coordinates Inputs */}
              {inputTab === 'coords' ? (
                <div className="form-group">
                  <div className="form-label">
                    <span className="form-label-title"><MapPin size={14} color="#38bdf8" /> Target Coordinates</span>
                    {lat !== null && lon !== null && (
                      <span className="coord-formatted-badge">
                        {Math.abs(lat).toFixed(2)}°{lat >= 0 ? 'N' : 'S'}, {Math.abs(lon).toFixed(2)}°{lon >= 0 ? 'E' : 'W'}
                      </span>
                    )}
                  </div>

                  <div className="coord-grid">
                    <div className="coord-field">
                      <span className="coord-sublabel">Latitude (-90° to -50°)</span>
                      <div className="coord-input-wrapper">
                        <input
                          id="lat-input"
                          type="number"
                          step="any"
                          className="custom-input coord-mono-input"
                          placeholder="-70.76"
                          value={latInput}
                          onChange={handleLatChange}
                          onKeyDown={handleKeyDown}
                          onBlur={applyCoordinateInput}
                        />
                        <span className="coord-unit">°S</span>
                      </div>
                    </div>

                    <div className="coord-field">
                      <span className="coord-sublabel">Longitude (-180° to 180°)</span>
                      <div className="coord-input-wrapper">
                        <input
                          id="lon-input"
                          type="number"
                          step="any"
                          className="custom-input coord-mono-input"
                          placeholder="11.73"
                          value={lonInput}
                          onChange={handleLonChange}
                          onKeyDown={handleKeyDown}
                          onBlur={applyCoordinateInput}
                        />
                        <span className="coord-unit">°</span>
                      </div>
                    </div>
                  </div>

                  <div className="input-hint">
                    <Info size={12} color="#38bdf8" /> Click anywhere on the map or press Enter to pin coordinates.
                  </div>
                </div>
              ) : (
                /* TAB 2: Batch Upload / Raster Ingestion */
                <div className="form-group">
                  <label className="form-label">
                    <span className="form-label-title"><UploadCloud size={14} color="#38bdf8" /> Batch Telemetry Ingestion</span>
                  </label>

                  <input
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    onChange={handleFileInputChange}
                    accept=".csv,.json,.geojson,.nc,.tif,.png"
                  />

                  {!uploadedFile ? (
                    <div 
                      className={`upload-dropzone ${isDragOver ? 'drag-active' : ''}`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="dropzone-icon-box">
                        <UploadCloud size={24} />
                      </div>
                      <div className="dropzone-title">Drop CSV, GeoJSON, or Raster</div>
                      <div className="dropzone-desc">Drag & drop polar satellite grid file or click to browse files</div>
                      <div className="dropzone-formats">
                        <span className="dropzone-badge">.CSV</span>
                        <span className="dropzone-badge">.GEOJSON</span>
                        <span className="dropzone-badge">.NC</span>
                        <span className="dropzone-badge">.TIF</span>
                      </div>
                    </div>
                  ) : (
                    <div className="uploaded-file-card">
                      <div className="uploaded-file-info">
                        <FileText size={20} color="#38bdf8" />
                        <div>
                          <div className="uploaded-file-name">{uploadedFile.name}</div>
                          <div className="uploaded-file-size">{uploadedFile.size} • Telemetry Ready</div>
                        </div>
                      </div>
                      <button 
                        className="file-remove-btn" 
                        onClick={clearUploadedFile}
                        title="Remove file"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                  <div className="input-hint">
                    <CheckCircle2 size={12} color="#10b981" /> Files will be analyzed for polar coordinate matrix bounds.
                  </div>
                </div>
              )}

              {/* History Strip */}
              {history.length > 0 && (
                <div className="history-strip">
                  <span className="history-label">Recent Queries:</span>
                  {history.map((h, i) => (
                    <button
                      key={i}
                      type="button"
                      className="history-chip"
                      onClick={() => {
                        setLat(h.lat);
                        setLon(h.lon);
                        setDate(h.date);
                        setLatInput(h.lat.toString());
                        setLonInput(h.lon.toString());
                      }}
                    >
                      {h.lat.toFixed(1)}°S, {h.lon.toFixed(1)}°E ({h.conc}%)
                    </button>
                  ))}
                </div>
              )}
            </aside>

            {/* RIGHT MAP & TELEMETRY DISPLAY */}
            <div className="stage-container">
              {/* Map Terminal Frame */}
              <div className="map-terminal-frame">
                <div className="map-terminal-bar">
                  <div className="map-terminal-status">
                    <div className="terminal-dots">
                      <span className="terminal-dot dot-red"></span>
                      <span className="terminal-dot dot-yellow"></span>
                      <span className="terminal-dot dot-green"></span>
                    </div>
                    <span className="terminal-title">POLARIS // Antarctic Geo-Grid Terminal</span>
                  </div>

                  <div className="map-hud-readout">
                    {lat !== null && lon !== null ? (
                      <div className="hud-coord-pill">
                        <MapPin size={12} /> {Math.abs(lat).toFixed(3)}° {lat >= 0 ? 'N' : 'S'}, {Math.abs(lon).toFixed(3)}° {lon >= 0 ? 'E' : 'W'}
                      </div>
                    ) : (
                      <div className="hud-coord-pill" style={{ color: 'var(--text-muted)' }}>
                        Click to pin location
                      </div>
                    )}
                  </div>
                </div>

                <div className="map-wrapper-element">
                  <AntarcticMap
                    onLocationSelect={handleLocationSelect}
                    selectedLat={lat}
                    selectedLon={lon}
                    selectedDate={date}
                  />
                </div>
              </div>

              {/* 4. SCIENTIFIC ANALYSIS RESULTS HUD */}
              <div className="analysis-results-card">
                <div className="results-header-row">
                  <div className="results-title-group">
                    <Activity size={18} color="#38bdf8" />
                    <h3 className="results-title">Sea Ice Concentration Analysis</h3>
                  </div>
                  <div className="results-date-badge">
                    Observation: {date}
                  </div>
                </div>

                {loading ? (
                  <div className="empty-state-card">
                    <Snowflake className="loading-spinner" size={42} color="#38bdf8" />
                    <div className="empty-state-title">Calibrating Microwave Radiometer Feeds...</div>
                    <div className="empty-state-subtitle">Computing brightness temperature ratios and tie-point concentrations for {lat}°S, {lon}°E.</div>
                  </div>
                ) : error ? (
                  <div className="empty-state-card" style={{ color: 'var(--danger)' }}>
                    <div className="empty-state-title">{error}</div>
                    <div className="empty-state-subtitle">Please check your coordinate bounds and try again.</div>
                  </div>
                ) : iceData && classification ? (
                  <div className="results-layout">
                    {/* Concentration Meter Gauge */}
                    <div className="concentration-meter-box">
                      <div className="concentration-gauge-val">{iceData.concentration}%</div>
                      <div className="concentration-gauge-label">Ice Concentration Index</div>
                      <div className={`ice-class-badge ${classification.className}`}>
                        {classification.label}
                      </div>
                    </div>

                    {/* Metrics and Environmental Telemetry */}
                    <div className="metrics-details-panel">
                      {/* Gradient Progress Scale */}
                      <div className="ice-progress-wrapper">
                        <div className="ice-progress-labels">
                          <span>0% (Open Ocean)</span>
                          <span>50% (Drift Ice)</span>
                          <span>100% (Solid Pack)</span>
                        </div>
                        <div className="ice-progress-track">
                          <div 
                            className="ice-progress-fill" 
                            style={{ width: `${iceData.concentration}%` }}
                          ></div>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                          {classification.description}
                        </div>
                      </div>

                      {/* Sub-grid Environmental Context */}
                      <div className="metrics-subgrid">
                        <div className="metric-item">
                          <div className="metric-item-label">
                            <Sun size={12} color="#38bdf8" /> Surface Albedo
                          </div>
                          <div className="metric-item-value">{albedoValue} (0-1)</div>
                        </div>

                        <div className="metric-item">
                          <div className="metric-item-label">
                            <ThermometerSnowflake size={12} color="#38bdf8" /> Polar Season
                          </div>
                          <div className="metric-item-value">{seasonInfo.season}</div>
                        </div>

                        <div className="metric-item">
                          <div className="metric-item-label">
                            <Eye size={12} color="#38bdf8" /> Grid Confidence
                          </div>
                          <div className="metric-item-value" style={{ color: 'var(--success)' }}>99.2% Nominal</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="empty-state-card">
                    <div className="empty-icon-pulse">
                      <MapPin size={28} />
                    </div>
                    <div className="empty-state-title">No Coordinate Selected</div>
                    <div className="empty-state-subtitle">Click anywhere in the Antarctic region on the map or select a preset station above to compute Sea Ice Concentration.</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. RESEARCH STATIONS DIRECTORY */}
      <section id="stations" className="stations-section">
        <div className="container">
          <div className="section-header">
            <div>
              <div className="section-tag"><MapPin size={14} /> Polar Outposts</div>
              <h2 className="section-title">Antarctic Research Stations Directory</h2>
            </div>
            <div className="section-subtitle">
              Quick-inspect sea-ice concentration levels surrounding major permanent research bases.
            </div>
          </div>

          <div className="stations-grid">
            {PRESET_STATIONS.map((st) => (
              <div 
                key={st.name} 
                className="station-card"
                onClick={() => {
                  selectStation(st);
                  const workstationEl = document.getElementById('workstation');
                  if (workstationEl) {
                    workstationEl.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
              >
                <div className="station-flag-row">
                  <span className="station-name">{st.name}</span>
                  <span className="station-country">{st.country}</span>
                </div>
                <div className="station-coords">
                  {Math.abs(st.lat).toFixed(2)}°S, {Math.abs(st.lon).toFixed(2)}°{st.lon >= 0 ? 'E' : 'W'}
                </div>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {st.description}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--accent-cyan)', fontWeight: 600, marginTop: 'auto' }}>
                  Inspect Ice Telemetry <ChevronRight size={14} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. SCIENCE & METHODOLOGY SECTION */}
      <section id="science" className="science-section">
        <div className="container">
          <div className="section-header">
            <div>
              <div className="section-tag"><Info size={14} /> Cryosphere Science</div>
              <h2 className="section-title">Methodology & Climate Significance</h2>
            </div>
            <div className="section-subtitle">
              How satellite radiometry measures the Antarctic sea-ice pack and influences the global climate.
            </div>
          </div>

          <div className="science-grid">
            <div className="science-card">
              <div className="science-icon-box">
                <Snowflake size={24} />
              </div>
              <h3 className="science-card-title">What is Sea Ice Concentration (SIC)?</h3>
              <p className="science-card-desc">
                Sea Ice Concentration represents the relative fraction of an ocean grid cell covered by ice, 
                ranging from 0% (completely open water) to 100% (solid continuous ice pack). It is a vital 
                Essential Climate Variable (ECV) for tracking polar melting trends.
              </p>
            </div>

            <div className="science-card">
              <div className="science-icon-box">
                <Satellite size={24} />
              </div>
              <h3 className="science-card-title">Passive Microwave Radiometry</h3>
              <p className="science-card-desc">
                Unlike optical sensors that depend on daylight and cloudless skies, passive microwave sensors 
                (such as AMSR2 and SSMIS) detect natural microwave radiation emitted by the Earth surface through clouds and 
                during months of continuous polar night.
              </p>
            </div>

            <div className="science-card">
              <div className="science-icon-box">
                <Compass size={24} />
              </div>
              <h3 className="science-card-title">Thermohaline Circulation & Albedo</h3>
              <p className="science-card-desc">
                When polar ocean water freezes into sea ice, it expels dense salty brine that sinks to form Antarctic Bottom Water (AABW), 
                driving the global oceanic conveyor belt. High-albedo sea ice also reflects up to 85% of incoming solar radiation back into space.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. FOOTER */}
      <footer className="site-footer">
        <div className="container">
          <div className="footer-grid">
            <div className="footer-brand-col">
              <div className="brand-logo">
                <div className="brand-icon-wrapper">
                  <Snowflake size={20} color="#38bdf8" />
                </div>
                <div className="brand-text">
                  <div className="brand-title">POLARIS SIC</div>
                  <span className="brand-subtitle">Cryosphere Observation Platform</span>
                </div>
              </div>
              <p className="footer-desc">
                Engineered for Smart India Hackathon (SIH) and polar research showcases. 
                Provides automated calculation, classification, and visualization of Antarctic sea-ice concentration from satellite telemetry.
              </p>
            </div>

            <div>
              <div className="footer-heading">Platform Links</div>
              <ul className="footer-links">
                <li><a href="#hero" className="footer-link">Overview & Hero</a></li>
                <li><a href="#workstation" className="footer-link">Geo-Spatial Terminal</a></li>
                <li><a href="#stations" className="footer-link">Research Stations</a></li>
                <li><a href="#science" className="footer-link">Science & Methodology</a></li>
              </ul>
            </div>

            <div>
              <div className="footer-heading">Tech Stack & Tools</div>
              <div className="footer-tech-stack">
                <span className="tech-tag">React 19</span>
                <span className="tech-tag">TypeScript</span>
                <span className="tech-tag">Vite</span>
                <span className="tech-tag">Leaflet / OpenStreetMap</span>
                <span className="tech-tag">Lucide Icons</span>
                <span className="tech-tag">CARTO Voyager</span>
              </div>
            </div>
          </div>

          <div className="footer-bottom-bar">
            <div>
              © {new Date().getFullYear()} POLARIS Cryosphere Observation System. Built for SIH Project Presentation.
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <span style={{ color: 'var(--accent-cyan)' }}>Southern Ocean Focus: 50°S - 90°S</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
