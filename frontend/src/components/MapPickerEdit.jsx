import { useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "../styles/Map.scss";

// Tek bir ikon seti; rengi CSS class ile veriyoruz
const baseOpts = {
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
};
const oldIcon = new L.Icon({ ...baseOpts, className: "pin-old" });
const newIcon = new L.Icon({ ...baseOpts, className: "pin-new" });

// Haritaya tıklama -> üst komponente coords bildir
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
 * Tamamen controlled:
 * - Marker konumu YALNIZCA `value` prop'tan gelir.
 * - İç state YOK, bu yüzden "eskiye geri zıplama" olamaz.
 * - İlk mount'ta `initialCenter`/`oldValue`/`value` sırasıyla merkeze alınır.
 * - Sadece `value` null->coords olduğunda 1 kez merkeze alınır.
 */
export default function MapPickerEdit({
  initialCenter = { lat: 39.92077, lng: 32.85411 },
  oldValue,           // [lat,lng] | null (kırmızı)
  value,              // [lat,lng] | null (yeşil)
  onChange,           // (coords|null) => void
  height = 320,
  zoom = 13,
  allowDrag = true,
}) {
  const mapRef = useRef(null);

  // İlk merkez: oldValue > value > initialCenter (sadece ilk mount’ta kullanılır)
  const initialCenterRef = useRef(
    Array.isArray(oldValue)
      ? { lat: oldValue[0], lng: oldValue[1] }
      : Array.isArray(value)
      ? { lat: value[0], lng: value[1] }
      : initialCenter
  );

  // Sadece ilk kez value null->coords geçişinde pan yapalım
  const sawValueRef = useRef(!!Array.isArray(value));
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
        center={initialCenterRef.current}   // sadece ilk mount’ta
        zoom={zoom}
        style={style}
        scrollWheelZoom
        doubleClickZoom
      >
        <TileLayer
          attribution='&copy; OpenStreetMap katkıda bulunanlar'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <ClickCatch onPick={(c) => onChange?.(c)} disabled={!allowDrag} />

        {Array.isArray(oldValue) && <Marker position={oldValue} icon={oldIcon} />}

        {Array.isArray(value) && (
          <Marker
            position={value}
            icon={newIcon}
            draggable={allowDrag}
            eventHandlers={
              allowDrag
                ? {
                    dragend: (e) => {
                      const { lat, lng } = e.target.getLatLng();
                      onChange?.([lat, lng]);
                    },
                  }
                : undefined
            }
          />
        )}
      </MapContainer>

      <div className="map-legend">
        <span className="dot old" /> Eski Konum
        <span className="dot new" /> Yeni Konum
      </div>
    </div>
  );
}
