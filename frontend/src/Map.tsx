import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
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
// Coordinates bounds and extended resolutions for deep zoom capability
const crs = new L.Proj.CRS(
  'EPSG:3031',
  '+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs',
  {
    origin: [-4194304, 4194304],
    resolutions: [
      8192.0, 4096.0, 2048.0, 1024.0, 512.0, 256.0, 128.0, 64.0, 32.0, 16.0, 8.0, 4.0, 2.0
    ],
    bounds: L.bounds(
      L.point(-4194304, -4194304),
      L.point(4194304, 4194304)
    )
  }
);

interface AntarcticMapProps {
  onLocationSelect: (lat: number, lon: number) => void;
  selectedLat: number | null;
  selectedLon: number | null;
  selectedDate: string;
}

function LocationMarker({ onLocationSelect, selectedLat, selectedLon }: { onLocationSelect: (lat: number, lon: number) => void, selectedLat: number | null, selectedLon: number | null }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });

  return selectedLat !== null && selectedLon !== null ? (
    <Marker position={[selectedLat, selectedLon]} />
  ) : null;
}

function MapController() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    map.setView([-90, 0], 0, { animate: false });
    const timer = setTimeout(() => {
      map.invalidateSize();
      map.setView([-90, 0], 0, { animate: false });
    }, 200);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

function ResolutionBadge() {
  const map = useMap();
  const [resText, setResText] = useState('8.19 km / px');
  const [zoomLevel, setZoomLevel] = useState(0);

  useEffect(() => {
    const updateResolution = () => {
      const z = map.getZoom();
      setZoomLevel(z);
      const metersPerPx = 8192 / Math.pow(2, z);
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

export const AntarcticMap: React.FC<AntarcticMapProps> = ({ onLocationSelect, selectedLat, selectedLon, selectedDate }) => {
  return (
    <MapContainer
      center={[-90, 0]}
      zoom={0}
      crs={crs}
      style={{ height: '100%', width: '100%', background: '#020617' }}
      minZoom={0}
      maxZoom={8}
      zoomControl={true}
      scrollWheelZoom={true}
    >
      <MapController />
      {/* Explicit km/pixel Resolution Scale Badge */}
      <ResolutionBadge />
      
      {/* High-detail Polar Base Map */}
      <TileLayer
        url="https://gibs.earthdata.nasa.gov/wmts/epsg3031/best/BlueMarble_ShadedRelief_Bathymetry/default/500m/{z}/{y}/{x}.jpeg"
        attribution="NASA EOSDIS GIBS"
        tileSize={512}
        maxNativeZoom={4}
        maxZoom={8}
        minZoom={0}
        noWrap={true}
      />
      {/* Near-Realtime / Historical Satellite True Color Overlay */}
      <TileLayer
        key={selectedDate}
        url={`https://gibs.earthdata.nasa.gov/wmts/epsg3031/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${selectedDate}/250m/{z}/{y}/{x}.jpg`}
        attribution="NASA EOSDIS GIBS"
        tileSize={512}
        maxNativeZoom={4}
        maxZoom={8}
        minZoom={0}
        opacity={0.8}
        noWrap={true}
      />
      <LocationMarker onLocationSelect={onLocationSelect} selectedLat={selectedLat} selectedLon={selectedLon} />
    </MapContainer>
  );
};
