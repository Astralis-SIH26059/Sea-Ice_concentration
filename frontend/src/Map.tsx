import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, CircleMarker, Polyline, Tooltip, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import proj4 from 'proj4';
import 'proj4leaflet';
import 'leaflet/dist/leaflet.css';

if (typeof window !== 'undefined') {
  (window as any).L = L;
  (window as any).proj4 = proj4;
}

// Fix Leaflet's default icon path issues with Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Define EPSG:3031 - Antarctic Polar Stereographic
const crs = new L.Proj.CRS(
  'EPSG:3031',
  '+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs',
  {
    origin: [-4194304, 4194304],
    resolutions: [
      16384.0, 8192.0, 4096.0, 2048.0, 1024.0, 512.0, 256.0, 128.0, 64.0, 32.0, 16.0, 8.0, 4.0
    ],
    bounds: L.bounds(
      L.point(-4194304, -4194304),
      L.point(4194304, 4194304)
    )
  }
);

export interface TrajectoryPoint {
  lat: number;
  lon: number;
  label?: string;
  type: 'history' | 'current' | 'predicted';
}

export interface AntarcticMapProps {
  onLocationSelect?: (lat: number, lon: number) => void;
  selectedLat: number | null;
  selectedLon: number | null;
  selectedDate?: string;
  trajectoryPoints?: TrajectoryPoint[];
  pathPoints?: { lat: number; lon: number }[];
}

function LocationMarker({ onLocationSelect, selectedLat, selectedLon }: { onLocationSelect?: (lat: number, lon: number) => void, selectedLat: number | null, selectedLon: number | null }) {
  useMapEvents({
    click(e) {
      if (onLocationSelect) {
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      }
    },
  });

  return selectedLat !== null && selectedLon !== null ? (
    <Marker position={[selectedLat, selectedLon]} />
  ) : null;
}

// Bounding extent of Antarctic EPSG:3031 polar projection in WGS84
const antarcticBounds = L.latLngBounds([[-38.94137, -135], [-38.94137, 45]]);

function MapUpdater({ selectedLat, selectedLon }: { selectedLat: number | null; selectedLon: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (selectedLat !== null && selectedLon !== null && !isNaN(selectedLat) && !isNaN(selectedLon)) {
      if (map.getZoom() > 0) {
        map.setView([selectedLat, selectedLon], map.getZoom(), { animate: true });
      }
    }
  }, [selectedLat, selectedLon, map]);
  return null;
}

function ZoomDragManager() {
  const map = useMap();

  useEffect(() => {
    const handleZoomAndDrag = () => {
      const zoom = map.getZoom();
      if (zoom <= 0) {
        // At 1x (zoom 0), lock the map centered and disable dragging
        map.dragging.disable();
        map.setView([-90, 0], 0, { animate: false });
      } else {
        // When zoomed in, allow dragging without continuous runaway drift
        map.dragging.enable();
      }
    };

    map.invalidateSize();
    handleZoomAndDrag();

    const timer = setTimeout(() => {
      map.invalidateSize();
      if (map.getZoom() <= 0) {
        map.setView([-90, 0], 0, { animate: false });
      }
    }, 200);

    map.on('zoomend', handleZoomAndDrag);
    return () => {
      clearTimeout(timer);
      map.off('zoomend', handleZoomAndDrag);
    };
  }, [map]);

  return null;
}

function ResolutionBadge() {
  const map = useMap();
  const [resText, setResText] = useState('16.38 km / px');
  const [zoomLevel, setZoomLevel] = useState(0);

  useEffect(() => {
    const updateResolution = () => {
      const z = map.getZoom();
      setZoomLevel(z);
      // Polar resolution
      const metersPerPx = 16384 / Math.pow(2, z);
      if (metersPerPx >= 1000) {
        setResText(`${(metersPerPx / 1000).toFixed(2)} km / pixel`);
      } else {
        setResText(`${Math.round(metersPerPx)} m / pixel`);
      }
    };

    updateResolution();
    map.on('zoomend', updateResolution);
    return () => {
      map.off('zoomend', updateResolution);
    };
  }, [map]);

  return (
    <div className="resolution-badge">
      <span className="res-dot"></span>
      <span className="res-val">{resText}</span>
      <span className="res-divider">|</span>
      <span className="res-zoom">Zoom {zoomLevel}x</span>
    </div>
  );
}

export const AntarcticMap: React.FC<AntarcticMapProps> = ({
  onLocationSelect,
  selectedLat,
  selectedLon,
  selectedDate,
  trajectoryPoints = [],
  pathPoints = [],
}) => {
  const historyLine = trajectoryPoints
    .filter((p) => p.type === 'history' || p.type === 'current')
    .map((p) => [p.lat, p.lon] as [number, number]);

  const predictedLine = trajectoryPoints
    .filter((p) => p.type === 'current' || p.type === 'predicted')
    .map((p) => [p.lat, p.lon] as [number, number]);

  return (
    <MapContainer
      center={[-90, 0]}
      zoom={0}
      crs={crs}
      style={{ height: '100%', width: '100%', background: '#020617' }}
      minZoom={0}
      maxZoom={10}
      zoomControl={true}
      scrollWheelZoom={true}
      inertia={false}
      maxBounds={antarcticBounds}
      maxBoundsViscosity={0.7}
    >
      <ZoomDragManager />
      <MapUpdater selectedLat={selectedLat} selectedLon={selectedLon} />
      {/* Explicit km/pixel Resolution Scale Badge */}
      <ResolutionBadge />
      
      {/* High-detail Polar Base Map */}
      <TileLayer
        url="https://gibs.earthdata.nasa.gov/wmts/epsg3031/best/BlueMarble_ShadedRelief_Bathymetry/default/500m/{z}/{y}/{x}.jpeg"
        attribution="NASA EOSDIS GIBS"
        tileSize={256}
        maxNativeZoom={4}
        maxZoom={10}
        minZoom={0}
        noWrap={true}
      />
      {/* Near-Realtime / Historical Satellite True Color Overlay */}
      {selectedDate && (
        <TileLayer
          key={selectedDate}
          url={`https://gibs.earthdata.nasa.gov/wmts/epsg3031/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${selectedDate}/250m/{z}/{y}/{x}.jpg`}
          attribution="NASA EOSDIS GIBS"
          tileSize={256}
          maxNativeZoom={5}
          maxZoom={10}
          minZoom={0}
          opacity={0.8}
          noWrap={true}
        />
      )}

      {/* Trajectory Polyline: History -> Current */}
      {historyLine.length > 1 && (
        <Polyline
          positions={historyLine}
          pathOptions={{ color: '#38bdf8', weight: 3, dashArray: '6, 6', opacity: 0.85 }}
        />
      )}

      {/* Trajectory Polyline: Current -> Predicted */}
      {predictedLine.length > 1 && (
        <Polyline
          positions={predictedLine}
          pathOptions={{ color: '#f59e0b', weight: 4, dashArray: '4, 6', opacity: 0.95 }}
        />
      )}

      {/* Trajectory Waypoint Markers */}
      {trajectoryPoints.map((pt, idx) => (
        <CircleMarker
          key={idx}
          center={[pt.lat, pt.lon]}
          radius={pt.type === 'current' ? 9 : pt.type === 'predicted' ? 9 : 6}
          pathOptions={{
            color: pt.type === 'predicted' ? '#f59e0b' : pt.type === 'current' ? '#ffffff' : '#0284c7',
            fillColor: pt.type === 'predicted' ? '#ef4444' : pt.type === 'current' ? '#38bdf8' : '#38bdf8',
            fillOpacity: 0.9,
            weight: pt.type === 'history' ? 1.5 : 3,
          }}
        >
          {pt.label && (
            <Tooltip permanent direction="top" offset={[0, -8]}>
              <span>{pt.label}</span>
            </Tooltip>
          )}
        </CircleMarker>
      ))}

      {/* Path Prediction Line */}
      {pathPoints.length > 1 && (
        <Polyline
          positions={pathPoints.map(p => [p.lat, p.lon])}
          pathOptions={{ color: '#10b981', weight: 4, opacity: 0.9, dashArray: '8, 8' }}
        />
      )}
      
      {/* Start/End Markers for Path */}
      {pathPoints.length > 0 && (
        <>
          <CircleMarker center={[pathPoints[0].lat, pathPoints[0].lon]} radius={8} pathOptions={{ color: '#fff', fillColor: '#10b981', fillOpacity: 1, weight: 2 }}>
            <Tooltip permanent direction="top" offset={[0, -8]}><span>Start</span></Tooltip>
          </CircleMarker>
          {pathPoints.length > 1 && (
            <CircleMarker center={[pathPoints[pathPoints.length - 1].lat, pathPoints[pathPoints.length - 1].lon]} radius={8} pathOptions={{ color: '#fff', fillColor: '#ef4444', fillOpacity: 1, weight: 2 }}>
              <Tooltip permanent direction="top" offset={[0, -8]}><span>End</span></Tooltip>
            </CircleMarker>
          )}
        </>
      )}

      {/* Fallback Single Selection Marker */}
      {trajectoryPoints.length === 0 && (
        <LocationMarker onLocationSelect={onLocationSelect} selectedLat={selectedLat} selectedLon={selectedLon} />
      )}
    </MapContainer>
  );
};

