import { useEffect, useMemo, useState } from "react";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import "./EmployeeTracking.scss";

import L from "leaflet";
import marker2x from "leaflet/dist/images/marker-icon-2x.png";
import marker1x from "leaflet/dist/images/marker-icon.png";
import markerSh from "leaflet/dist/images/marker-shadow.png";

import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Leaflet marker icon fix (bundler)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: marker2x,
  iconUrl: marker1x,
  shadowUrl: markerSh,
});

const COLORS = ["#60a5fa","#34d399","#fbbf24","#f87171","#a78bfa","#22d3ee","#f472b6","#f97316","#84cc16","#e879f9","#38bdf8"];
const hashColorFromId = (id) => COLORS[(String(id ?? "x").split("").reduce((a,c)=>a+c.charCodeAt(0),0)) % COLORS.length];

const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
const toDateKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;

// Personelin son noktasını kendi renginde gösterecek DivIcon
const makePinIcon = (hex) =>
  L.divIcon({
    className: "emp-pin-icon",
    html: `<div class="emp-pin" style="background:${hex}"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

/** Haritayı mağaza (veya görünür rota) noktalarına göre sığdırır.
 *  Tek bir personel görünürse mağazaları sığdırmaya katmıyoruz (yalnızca rotayı temel al).
 */
function AutoFitBounds({ stores, tracks, visible }) {
  const map = useMap();

  useEffect(() => {
    const pts = [];
    const single = visible?.size === 1;

    // Birden fazla personel görünüyorsa mağazaları da sığdırma hesabına kat
    if (!single) {
      for (const s of stores || []) {
        if (Number.isFinite(s.lat) && Number.isFinite(s.lng)) {
          pts.push([s.lat, s.lng]);
        }
      }
    }

    // Görünür çalışanların rota noktaları
    for (const [k, v] of Object.entries(tracks || {})) {
      const empId = Number(k);
      if (!visible?.has(empId)) continue;
      for (const p of v.points || []) {
        if (Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
          pts.push([p.lat, p.lng]);
        }
      }
    }

    if (pts.length === 0) return;

    if (pts.length === 1) {
      map.setView(pts[0], 14);
    } else {
      const b = L.latLngBounds(pts);
      map.fitBounds(b, { padding: [50, 50], maxZoom: 15 });
    }
  }, [stores, tracks, visible, map]);

  return null;
}

export default function EmployeeRoutes() {
  const today = new Date();
  const last7 = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today); d.setDate(today.getDate() - i);
      return d;
    });
  }, [today]);

  const [activeDayKey, setActiveDayKey] = useState(toDateKey(today));
  const [tracks, setTracks] = useState({});
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(() => new Set());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [{ data: tr }, { data: sm }] = await Promise.all([
          api.get(`/presence/tracks?day=${activeDayKey}`),
          api.get(`/stores/min`)
        ]);

        const grouped = tr?.data || {};
        setTracks(grouped);
        setVisible(new Set(Object.keys(grouped).map(Number))); // o güne veri olanlar varsayılan görünür

        const ss = Array.isArray(sm?.stores) ? sm.stores : [];
        setStores(ss);
      } catch (e) {
        console.error(e);
        setTracks({});
        setStores([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [activeDayKey]);

  // Başlangıç merkezi
  const initialCenter = useMemo(() => {
    const pts = (stores || []).map(s => [s.lat, s.lng]).filter(([lat,lng]) => Number.isFinite(lat) && Number.isFinite(lng));

    if (pts.length >= 2) {
      let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
      for (const [lat, lng] of pts) {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
      }
      return [(minLat + maxLat) / 2, (minLng + maxLng) / 2];
    }
    if (pts.length === 1) return pts[0];

    // Mağaza yoksa görünür rotalardan bir nokta bul
    for (const [k, v] of Object.entries(tracks)) {
      if (!visible.has(Number(k))) continue;
      const p = v.points?.[0];
      if (p) return [p.lat, p.lng];
    }
    return [39.0, 35.0]; // TR ortası
  }, [stores, tracks, visible]);

  const toggleEmp = (id) => {
    setVisible(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  // İSİME TIKLA → sadece o personele odaklan
  const focusEmp = (id) => {
    setVisible(new Set([id]));
  };

  return (
    <Layout>
      <div className="routes-page">
        <div className="rp-head card">
          <div className="left">
            <div className="title">Çalışan Rotaları (Son 7 Gün)</div>
            <div className="days">
              {last7.map((d) => {
                const key = toDateKey(d);
                const isOn = key === activeDayKey;
                return (
                  <button
                    key={key}
                    className={`day ${isOn ? "on" : ""}`}
                    onClick={() => setActiveDayKey(key)}
                    title={key}
                  >
                    {d.toLocaleDateString("tr-TR", { weekday: "short" })} {d.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="right">
            {loading ? <span className="hint">Yükleniyor…</span> : <span className="hint">{Object.keys(tracks).length} personel</span>}
          </div>
        </div>

        <div className="rp-body">
          <div className="rp-legend card">
            <div className="sec-title">Personel</div>
            <div className="emp-list">
              {Object.keys(tracks).length === 0 && <div className="muted">Bu günde rota bulunamadı.</div>}
              {Object.entries(tracks).map(([k, v]) => {
                const empId = Number(k);
                const emp = v.employee || { id: empId, name: `Personel #${k}`, color: hashColorFromId(empId) };
                const checked = visible.has(empId);
                return (
                  <label key={empId} className={`emp ${checked ? "on" : ""}`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleEmp(empId)} />
                    <span className="dot" style={{ background: emp.color }} />
                    {/* İSİM = ODAKLA */}
                    <button type="button" className="nm as-link" onClick={() => focusEmp(empId)} title="Sadece bu rotayı göster">
                      {emp.name}
                    </button>
                    <span className="cnt">{v.points?.length || 0} nokta</span>
                  </label>
                );
              })}
            </div>

            <div className="sec-title" style={{ marginTop: 10 }}>Mağazalar</div>
            <div className="muted small">Haritada tüm mağazalar işaretlenir. (Tek personel görünürken harita o rotaya odaklanır.)</div>
          </div>

          <div className="rp-map card">
            <MapContainer
              center={initialCenter}
              zoom={6}
              style={{ height: "70vh", width: "100%" }}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Mağazalar */}
              {stores.map(s => (
                <Marker key={s.id} position={[s.lat, s.lng]}>
                  <Popup><b>{s.name}</b></Popup>
                </Marker>
              ))}

              {/* Personel rotaları + SON NOKTA PİNİ */}
              {Object.entries(tracks).map(([k, v]) => {
                const empId = Number(k);
                if (!visible.has(empId)) return null;
                const emp = v.employee || { id: empId, color: hashColorFromId(empId) };
                const pts = (v.points || []).map(p => [p.lat, p.lng]);
                if (pts.length < 2) return null;

                const last = v.points[v.points.length - 1]; // son nokta
                return (
                  <>
                    <Polyline
                      key={`pl-${empId}`}
                      positions={pts}
                      pathOptions={{ color: emp.color, weight: 4, opacity: 0.8 }}
                    />
                    {last && Number.isFinite(last.lat) && Number.isFinite(last.lng) && (
                      <Marker
                        key={`last-${empId}`}
                        position={[last.lat, last.lng]}
                        icon={makePinIcon(emp.color)}
                      >
                        <Popup>
                          <div style={{ fontWeight: 600 }}>{emp.name}</div>
                          <div>Son nokta: {new Date(last.at).toLocaleString("tr-TR")}</div>
                          {last.accuracy != null && <div>Doğruluk: ±{last.accuracy} m</div>}
                        </Popup>
                      </Marker>
                    )}
                  </>
                );
              })}

              {/* Görünürlüğe göre otomatik sığdır */}
              <AutoFitBounds stores={stores} tracks={tracks} visible={visible} />
            </MapContainer>
          </div>
        </div>
      </div>
    </Layout>
  );
}
