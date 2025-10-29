// src/pages/customer/CustomerDashboard.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./CustomerDashboard.scss";

const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay   = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const addDays    = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
const STATUS_LABEL = { PENDING: "Henüz yapılmadı", PLANNED: "Planlandı", COMPLETED: "Yapıldı", FAILED: "Yapılamadı", CANCELLED: "İptal edildi", POSTPONED: "Ertelendi" };
const statusLabel = (s) => STATUS_LABEL[s] || "—";
const statusClass = (s) => `st-${(s || "PLANNED").toLowerCase()}`;
const COLORS = ["#60a5fa","#34d399","#fbbf24","#f87171","#a78bfa","#22d3ee","#f472b6","#f97316","#84cc16","#e879f9","#38bdf8"];
const hashColorFromId = (id) => COLORS[(String(id ?? "x").split("").reduce((a,c)=>a+c.charCodeAt(0),0)) % COLORS.length];

const role = (localStorage.getItem("role") || "").toLowerCase();
const isCustomer = role === "customer";

/* ───────── Carousel ───────── */
function HeroCarousel() {
  const slides = useMemo(() => ([
    { id: 1, title: "PestApp – Dijital Servis Takibi", text: "Ziyaretlerinizi ve raporlarınızı tek panelde izleyin.", cta: { text: "EK-1 Kayıtlarını Gör", to: "/customer/ek1" }, theme: "g1" },
    { id: 2, title: "Canlı İzleme", text: "İstasyon aktivite ve risk durumlarını anlık takip edin.", cta: { text: "Mağazalarım", to: "/customer/stores" }, theme: "g2" },
    { id: 3, title: "Planlı Ziyaretler", text: "Yaklaşan randevulardan haberdar olun.", cta: { text: "Takvim", to: "/customer/calendar" }, theme: "g3" },
  ]), []);

  const [index, setIndex] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setIndex((i) => (i + 1) % slides.length), 5000);
    return () => clearInterval(timerRef.current);
  }, [slides.length]);

  const go = (i) => setIndex(((i % slides.length) + slides.length) % slides.length);

  return (
    <div className="hero-carousel card">
      <div className="viewport">
        {slides.map((s, i) => (
          <div key={s.id} className={`slide ${s.theme} ${i === index ? "is-active" : ""}`} aria-hidden={i !== index}>
            <div className="content">
              <h3>{s.title}</h3>
              <p>{s.text}</p>
              <Link className="btn" to={s.cta.to}>{s.cta.text}</Link>
            </div>
          </div>
        ))}
      </div>
      <button className="nav prev" onClick={() => go(index - 1)} aria-label="Önceki">‹</button>
      <button className="nav next" onClick={() => go(index + 1)} aria-label="Sonraki">›</button>
      <div className="dots">
        {slides.map((_, i) => (
          <button key={i} className={`dot ${i === index ? "active" : ""}`} onClick={() => go(i)} aria-label={`Slayt ${i+1}`} />
        ))}
      </div>
    </div>
  );
}

/* ───────── API ───────── */
async function fetchEventsInRange(from, to) {
  const qs = new URLSearchParams({ from: from.toISOString(), to: to.toISOString(), scope: "mine" });
  try {
    const { data } = await api.get(`/schedule/events?${qs.toString()}`);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error(e);
    toast.error("Ziyaretler alınamadı");
    return [];
  }
}

/* ───────── Listeler ───────── */
function PlannedVisits({ days = 14 }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const now = new Date();
  const from = startOfDay(now);
  const to   = endOfDay(addDays(now, days));

  useEffect(() => {
    (async () => {
      setLoading(true);
      const raw = await fetchEventsInRange(from, to);
      const planned = raw
        .filter((e) => (e.status || "PLANNED").toUpperCase() === "PLANNED")
        .map((e) => ({ ...e, start: new Date(e.start), end: new Date(e.end), color: hashColorFromId(e.storeId ?? e.employeeId) }))
        .sort((a,b)=> a.start - b.start);
      setItems(planned);
      setLoading(false);
    })();
  }, []); // sabit aralık

  const fmtDT = (d) => `${pad2(d.getDate())}.${pad2(d.getMonth()+1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const base = isCustomer ? "/customer" : ""; // müşteri için müşteri rotasına git

  return (
    <section className="card list-card">
      <div className="card-title">Planlanmış Ziyaretler <span className="muted">({days} gün)</span></div>
      <div className="list-head">
        <div />
        <div>Başlık</div>
        <div>Mağaza</div>
        <div>Tarih & Saat</div>
        <div>Durum</div>
      </div>

      {loading ? (
        <div className="empty">Yükleniyor…</div>
      ) : items.length === 0 ? (
        <div className="empty">Planlanmış ziyaret bulunmuyor.</div>
      ) : (
        items.map((e) => (
          <div key={`${e.id}-${e.start}`} className="row clickable" onClick={() => navigate(`${base}/calendar/visit/${e.id}`)}>
            <div className="dot" style={{ background: e.color }} />
            <div className="strong">{e.title || "Ziyaret"}</div>
            <div>{e.storeName || "—"}</div>
            <div className="mono">{fmtDT(e.start)} – {fmtDT(e.end).slice(11)}</div>
            <div><span className={`badge ${statusClass(e.status)}`}>{statusLabel(e.status)}</span></div>
          </div>
        ))
      )}
    </section>
  );
}

function RecentCompletedVisits({ days = 30 }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const now = new Date();
  const from = startOfDay(addDays(now, -days));
  const to   = endOfDay(now);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const raw = await fetchEventsInRange(from, to);
      const done = raw
        .filter((e) => (e.status || "").toUpperCase() === "COMPLETED")
        .map((e) => ({ ...e, start: new Date(e.start), end: new Date(e.end), color: hashColorFromId(e.employeeId) }))
        .sort((a,b)=> b.start - a.start);
      setItems(done);
      setLoading(false);
    })();
  }, []);

  const fmtDT = (d) => `${pad2(d.getDate())}.${pad2(d.getMonth()+1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const base = isCustomer ? "/customer" : "";

  return (
    <section className="card list-card">
      <div className="card-title">Geçmiş Ziyaretler <span className="muted">(Son {days} gün)</span></div>
      <div className="list-head">
        <div />
        <div>Başlık</div>
        <div>Mağaza</div>
        <div>Tarih & Saat</div>
        <div>Durum</div>
      </div>

      {loading ? (
        <div className="empty">Yükleniyor…</div>
      ) : items.length === 0 ? (
        <div className="empty">Son {days} günde tamamlanan ziyaret yok.</div>
      ) : (
        items.map((e) => (
          <div key={`${e.id}-${e.start}`} className="row clickable" onClick={() => navigate(`${base}/calendar/visit/${e.id}`)}>
            <div className="dot" style={{ background: e.color }} />
            <div className="strong">{e.title || "Ziyaret"}</div>
            <div>{e.storeName || "—"}</div>
            <div className="mono">{fmtDT(e.start)} – {fmtDT(e.end).slice(11)}</div>
            <div><span className={`badge ${statusClass(e.status)}`}>{statusLabel(e.status)}</span></div>
          </div>
        ))
      )}
    </section>
  );
}

/* ───────── EK-1 listesi ───────── */
let Ek1List;
try { Ek1List = require("../ek1/Ek1List.jsx").default; } catch {}

export default function CustomerDashboard() {
  return (
    <Layout>
      <div className="customer-dashboard">
        <HeroCarousel />
        <div className="lists-grid">
          <PlannedVisits days={14} />
          <RecentCompletedVisits days={30} />
        </div>
        <section className="card">
          <div className="card-title">Ziyaret Kayıtları (EK-1) – Yeni → Eski</div>
          {!Ek1List ? <div className="empty">EK-1 listesi bileşeni yüklenemedi.</div> : <Ek1List />}
        </section>
      </div>
    </Layout>
  );
}
