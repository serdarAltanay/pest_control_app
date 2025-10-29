import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./VisitDetail.scss";

const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
const COLORS = ["#60a5fa","#34d399","#fbbf24","#f87171","#a78bfa","#22d3ee","#f472b6","#f97316","#84cc16","#e879f9","#38bdf8"];
const hashColorFromId = (id) => {
  if (!id && id !== 0) return COLORS[0];
  let h = 0; const s = String(id);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
};
const fmtDate = (d) => d.toLocaleDateString("tr-TR", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
const fmtTime = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const fmtDateTime = (d) => d.toLocaleString("tr-TR", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });

const STATUS_LABEL = {
  PENDING: "Henüz yapılmadı", PLANNED: "Planlandı", COMPLETED: "Yapıldı",
  FAILED: "Yapılamadı", CANCELLED: "İptal edildi", POSTPONED: "Ertelendi",
};
const statusLabel = (s) => STATUS_LABEL[s] || "—";
const statusClass = (s) => `st-${(s || "PLANNED").toLowerCase()}`;

const role = (localStorage.getItem("role") || "").toLowerCase();
const isCustomer = role === "customer";

/* API */
async function fetchEventById(id) { const { data } = await api.get(`/schedule/events/${id}`); return data; }
async function updateStatus(id, status) {
  try { await api.put(`/schedule/events/${id}`, { status }); return true; }
  catch (e) { toast.error(e?.response?.data?.error || "Durum güncellenemedi"); return false; }
}

export default function VisitDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const ev = await fetchEventById(id);
        ev.start = new Date(ev.start);
        ev.end = new Date(ev.end);
        if (ev.plannedAt) ev.plannedAt = new Date(ev.plannedAt);
        ev.color = ev.color || hashColorFromId(ev.employeeId);
        ev.status = ev.status || "PLANNED";
        setEvent(ev);
        setStore(ev.store || null);
      } catch (e) {
        toast.error(e?.response?.data?.error || e.message || "Detaylar getirilemedi");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const employeeDisplay = useMemo(() => {
    if (!event) return "";
    return (
      event.employee?.fullName ||
      event.employeeName ||
      event.employee?.name ||
      event.employee?.email ||
      `Personel #${event.employeeId}`
    );
  }, [event]);

  const plannedByDisplay = useMemo(() => event?.plannedByName || "-", [event]);
  const durationMin = useMemo(() => (event ? Math.round((event.end - event.start) / 60000) : 0), [event]);

  const mapSrc = useMemo(() => {
    if (!store) return null;
    const { latitude, longitude, address, city, name } = store;
    if (latitude != null && longitude != null) return `https://maps.google.com/maps?q=${latitude},${longitude}&z=15&output=embed`;
    const q = encodeURIComponent(address || city || name || "");
    return q ? `https://maps.google.com/maps?q=${q}&z=14&output=embed` : null;
  }, [store]);

  const directionsUrl = useMemo(() => {
    if (!store) return null;
    const { latitude, longitude, address, city, name } = store;
    if (latitude != null && longitude != null) return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    const q = encodeURIComponent(address || `${name || ""} ${city || ""}`.trim());
    return q ? `https://www.google.com/maps/dir/?api=1&destination=${q}` : null;
  }, [store]);

  if (loading) {
    return (
      <Layout title="Ziyaret Detayı">
        <div className="vd-page"><div className="card">Yükleniyor…</div></div>
      </Layout>
    );
  }
  if (!event) {
    return (
      <Layout title="Ziyaret Detayı">
        <div className="vd-page"><div className="card">Ziyaret bulunamadı.</div></div>
      </Layout>
    );
  }

  // ✅ Ziyarete bağlı bir visitId varsa EK-1 önizleme rotasına gidebiliriz.
  const visitId = event?.visitId || event?.visit?.id || null;
  const canViewEk1 = event?.status === "COMPLETED" && !!visitId;
  const ek1PreviewPath = visitId ? `/ek1/visit/${visitId}` : null;

  // Admin/employee için doğru mağaza detayı rotası
  const storeDetailPath = store?.id
    ? (isCustomer ? `/customer/stores/${store.id}` : `/admin/stores/${store.id}`)
    : null;

  return (
    <Layout title="Ziyaret Detayı">
      <div className="vd-page">
        {/* Başlık */}
        <div className="vd-head card">
          <div className="title">
            <span className="dot" style={{ background: event.color }} />
            <h1>{event.title || "Ziyaret"}</h1>
          </div>
          <div className="actions">
            {storeDetailPath && <Link className="btn ghost" to={storeDetailPath}>Mağaza Detayı</Link>}

            {/* Admin/Employee: Ziyaret tamamlandıysa EK-1 Görüntüle; her zaman EK-1 Rapor Doldur */}
            {!isCustomer && canViewEk1 && ek1PreviewPath && (
              <Link to={ek1PreviewPath} className="btn">EK-1 Görüntüle</Link>
            )}
            {!isCustomer && store?.id && (
              <Link to={`/admin/stores/${store.id}/ek1`} className="btn">EK-1 Rapor Doldur</Link>
            )}

            {/* Müşteri: sadece tamamlandıysa EK-1 Görüntüle */}
            {isCustomer && canViewEk1 && ek1PreviewPath && (
              <Link to={ek1PreviewPath} className="btn">EK-1 Görüntüle</Link>
            )}
          </div>
        </div>

        {/* Bilgiler */}
        <div className="vd-grid">
          <div className="card info">
            <div className="sec-title">Ziyaret Bilgisi</div>

            <div className="kv"><div className="k">Tarih</div><div className="v">{fmtDate(event.start)}</div></div>
            <div className="kv"><div className="k">Saat</div><div className="v">{fmtTime(event.start)} – {fmtTime(event.end)} ({durationMin} dk)</div></div>
            <div className="kv">
              <div className="k">Personel</div>
              <div className="v">
                <span className="chip" style={{ background: event.color, color: "#0b1220" }} title={employeeDisplay}>
                  {employeeDisplay}
                </span>
              </div>
            </div>
            {!isCustomer && (
              <div className="kv"><div className="k">Planlayan</div><div className="v">{plannedByDisplay}</div></div>
            )}
            {!isCustomer && (
              <div className="kv"><div className="k">Planlama Zamanı</div><div className="v">{event.plannedAt ? fmtDateTime(event.plannedAt) : "-"}</div></div>
            )}
            {event.storeName && <div className="kv"><div className="k">Mağaza</div><div className="v">{event.storeName}</div></div>}
            {event.notes && <div className="kv"><div className="k">Notlar</div><div className="v">{event.notes}</div></div>}
            <div className="kv">
              <div className="k">Durum</div>
              <div className="v"><span className={`badge ${statusClass(event.status)}`}>{statusLabel(event.status)}</span></div>
            </div>

            {/* Admin/Employee durumu değiştirebilir, müşteri göremez */}
            {!isCustomer && (
              <div className="kv">
                <div className="k">Durumu Değiştir</div>
                <div className="v">
                  <div className="status-radios">
                    {["PENDING","PLANNED","COMPLETED","FAILED","CANCELLED","POSTPONED"].map(s => (
                      <label key={s} className={`radio ${statusClass(s)}`}>
                        <input
                          type="radio"
                          name="visit-status"
                          value={s}
                          checked={event.status === s}
                          onChange={async () => {
                            const ok = await updateStatus(event.id, s);
                            if (ok) {
                              setEvent(prev => ({ ...prev, status: s }));
                              toast.success("Durum güncellendi");
                            }
                          }}
                        />
                        <span>{statusLabel(s)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="card info">
            <div className="sec-title">Mağaza Bilgisi</div>
            {store ? (
              <>
                <div className="kv"><div className="k">Adı</div><div className="v">{store.code ? `${store.code} – ` : ""}{store.name}</div></div>
                {store.city && <div className="kv"><div className="k">Şehir</div><div className="v">{store.city}</div></div>}
                {store.address && <div className="kv"><div className="k">Adres</div><div className="v">{store.address}</div></div>}
                {(store.manager || store.phone) && (
                  <div className="kv"><div className="k">İrtibat</div><div className="v">{store.manager || "-"}{store.phone ? ` · ${store.phone}` : ""}</div></div>
                )}
                <div className="kv"><div className="k">Durum</div><div className="v">{store.isActive ? "Aktif" : "Pasif"}</div></div>
              </>
            ) : <div>Mağaza bilgisi bulunamadı.</div>}
          </div>
        </div>

        {/* Harita */}
        <div className="card map-card">
          <div className="sec-title row">
            <span>Konum</span>
            {directionsUrl && <a className="btn ghost" href={directionsUrl} target="_blank" rel="noopener noreferrer">Yol Tarifi</a>}
          </div>
          {mapSrc ? (
            <div className="map-wrap">
              <iframe title="store-map" src={mapSrc} width="100%" height={420} style={{ border: 0, borderRadius: 10 }} allowFullScreen loading="lazy" />
            </div>
          ) : <div>Konum bilgisi bulunamadı.</div>}
        </div>

        {/* Alt */}
        <div className="vd-foot">
          <button className="btn ghost" onClick={() => navigate(-1)}>Geri</button>
          {storeDetailPath && <Link className="btn ghost" to={storeDetailPath}>Mağaza Detayı</Link>}

          {/* Admin/Employee alt aksiyonları */}
          {!isCustomer && canViewEk1 && ek1PreviewPath && <Link className="btn" to={ek1PreviewPath}>EK-1 Görüntüle</Link>}
          {!isCustomer && store?.id && <Link className="btn" to={`/admin/stores/${store.id}/ek1`}>EK-1 Rapor Doldur</Link>}

          {/* Müşteri alt aksiyonları */}
          {isCustomer && canViewEk1 && ek1PreviewPath && <Link className="btn" to={ek1PreviewPath}>EK-1 Görüntüle</Link>}
        </div>
      </div>
    </Layout>
  );
}
