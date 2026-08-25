import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

if (typeof window !== 'undefined') {
  (window as any).L = L;
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

function MapUpdater({ selectedLat, selectedLon }: { selectedLat: number | null; selectedLon: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (selectedLat !== null && selectedLon !== null && !isNaN(selectedLat) && !isNaN(selectedLon)) {
      map.setView([selectedLat, selectedLon], map.getZoom(), { animate: true });
    }
  }, [selectedLat, selectedLon, map]);
  return null;
}

function MapController() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    map.setView([-50, 0], 2, { animate: false });
    const timer = setTimeout(() => {
      map.invalidateSize();
      map.setView([-50, 0], 2, { animate: false });
    }, 200);
    return () => clearTimeout(timer);
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
      // Web Mercator resolution at equator
      const metersPerPx = 156543.03 / Math.pow(2, z);
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

export const AntarcticMap: React.FC<AntarcticMapProps> = ({ onLocationSelect, selectedLat, selectedLon, selectedDate: _selectedDate }) => {
  return (
    <MapContainer
      center={[-50, 0]}
      zoom={2}
      style={{ height: '100%', width: '100%', background: '#e0f2fe' }}
      minZoom={1}
      maxZoom={18}
      zoomControl={true}
      scrollWheelZoom={true}
    >
      <MapController />
      <MapUpdater selectedLat={selectedLat} selectedLon={selectedLon} />
      {/* Explicit km/pixel Resolution Scale Badge */}
      <ResolutionBadge />
      
      {/* Light Polar Ice / Snow Theme Base Map */}
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        subdomains="abcd"
        maxZoom={18}
        minZoom={1}
        noWrap={false}
      />
      <LocationMarker onLocationSelect={onLocationSelect} selectedLat={selectedLat} selectedLon={selectedLon} />
    </MapContainer>
  );
};
