import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Leaflet varsayılan marker fix (parcel/webpack ile path issue)
const markerIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

export default function MapPicker({
  center = [39.92077, 32.85411], // Ankara default
  value,                          // [lat,lng] veya null
  onChange,                       // (coords or null) => void
  height = 320,
  zoom = 13,
  readonly = false,
  oldValue,                       // düzenlemede eski koordinat (kırmızı pin)
}) {
  const [pos, setPos] = useState(value || null);

  useEffect(() => { setPos(value || null); }, [value]);

  const mapStyle = useMemo(() => ({ width: "100%", height }), [height]);

  const pick = (coords) => {
    setPos(coords);
    onChange?.(coords);
  };

  return (
    <div className="map-picker">
      <MapContainer center={pos || center} zoom={zoom} style={mapStyle}>
        <TileLayer
          attribution='&copy; OpenStreetMap katkıda bulunanlar'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {!readonly && <ClickHandler onPick={pick} />}
        {oldValue && Array.isArray(oldValue) && (
          <Marker position={oldValue} icon={new L.Icon({ ...markerIcon.options, className: "pin-old" })} />
        )}
        {pos && <Marker position={pos} icon={markerIcon} />}
      </MapContainer>

      <div className="map-legend">
        <span className="dot old" /> Eski Konum
        <span className="dot new" /> Yeni Konum
      </div>
    </div>
  );
}
