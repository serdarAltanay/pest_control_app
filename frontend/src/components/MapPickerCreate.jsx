import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../styles/Map.scss";

// Tek ikon; rengi class ile veririz (yeni konum için yeşil ton)
const baseOpts = {
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
};
const newIcon = new L.Icon({ ...baseOpts, className: "pin-new" });

function ClickCatch({ onPick, disabled }) {
  useMapEvents({
    click(e) {
      if (disabled) return;
      onPick([e.latlng.lat, e.latlng.lng]);
    },
  });
  return null;
}

/**
 * Create için controlled harita:
 * - Marker konumu sadece `value` prop’ından gelir (Array [lat,lng] ya da null).
 * - İlk mount’ta sadece `initialCenter`’a göre merkezlenir.
 * - `value` null->coords olduğunda 1 kez pan yapar; sonrasında kullanıcı hareketine saygı duyar.
 */
export default function MapPickerCreate({
  initialCenter = { lat: 39.925533, lng: 32.866287 }, // TR fallback
  value,                // [lat,lng] | null
  onChange,             // (coords|null) => void
  height = 320,
  zoom = 13,
  allowPick = true,
}) {
  const mapRef = useRef(null);
  const initialCenterRef = useRef(initialCenter);
  const sawValueRef = useRef(Array.isArray(value));

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const hasVal = Array.isArray(value);
    if (!sawValueRef.current && hasVal) {
      map.setView(value, map.getZoom(), { animate: true });
    }
    sawValueRef.current = hasVal;
  }, [value]);

  const style = useMemo(() => ({ width: "100%", height }), [height]);

  return (
    <div className="map-picker">
      <MapContainer
        whenCreated={(m) => (mapRef.current = m)}
        center={initialCenterRef.current}
        zoom={zoom}
        style={style}
        scrollWheelZoom
        doubleClickZoom
      >
        <TileLayer
          attribution='&copy; OpenStreetMap katkıda bulunanlar'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickCatch onPick={(c) => onChange?.(c)} disabled={!allowPick} />

        {Array.isArray(value) && (
          <Marker position={value} icon={newIcon} />
        )}
      </MapContainer>

      <div className="map-legend">
        <span className="dot new" /> Konum
      </div>
    </div>
  );
}
