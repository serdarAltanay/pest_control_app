import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./CustomerAgenda.scss";

/* ───────── helpers ───────── */
const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const toKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const startOfDay   = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay     = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
const endOfMonth   = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
const startOfYear  = (d) => new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
const endOfYear    = (d) => new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);

const fmtDayHead = (d) => d.toLocaleDateString("tr-TR", { weekday: "short", day: "2-digit", month: "short" });
const fmtTime    = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const fmtMonth   = (d) => d.toLocaleDateString("tr-TR", { month: "long", year: "numeric" });

const COLORS = ["#60a5fa","#34d399","#fbbf24","#f87171","#a78bfa","#22d3ee","#f472b6","#f97316","#84cc16","#e879f9","#38bdf8"];
const colorFromId = (id) => {
  if (!id && id !== 0) return COLORS[0];
  let h = 0; const s = String(id);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
};

/* status */
const STATUS_LABEL = {
  PENDING: "Henüz yapılmadı",
  PLANNED: "Planlandı",
  COMPLETED: "Yapıldı",
  FAILED: "Yapılamadı",
  CANCELLED: "İptal edildi",
  POSTPONED: "Ertelendi",
};
const statusClass = (s) => `st-${(s || "PLANNED").toLowerCase()}`;
// Müşteriye: planlı ve geçmiş göster (iptal hariç)
const SHOW_STATUSES = new Set(["PENDING","PLANNED","COMPLETED","FAILED","POSTPONED"]);

/* görünüm */
const VIEW = { DAY: "day", MONTH: "month", YEAR: "year" };

/* API */
async function fetchEvents(from, to) {
  const qs = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  try {
    const { data } = await api.get(`/schedule/events?${qs.toString()}`);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    toast.error(err?.response?.data?.error || "Etkinlikler getirilemedi");
    return [];
  }
}

export default function CustomerAgenda() {
  const navigate = useNavigate();

  const [view, setView] = useState(VIEW.DAY);
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  // Range
  const range = useMemo(() => {
    if (view === VIEW.DAY)   return { from: startOfDay(anchor),  to: endOfDay(addDays(anchor, 5)) };
    if (view === VIEW.MONTH) return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
    return { from: startOfYear(anchor), to: endOfYear(anchor) };
  }, [view, anchor]);

  // Fetch
  useEffect(() => {
    (async () => {
      setLoading(true);
      const raw = await fetchEvents(range.from, range.to);
      const norm = raw
        .filter((e) => SHOW_STATUSES.has(String(e.status || "PLANNED")))
        .map((e) => ({
          ...e,
          start: new Date(e.start),
          end: new Date(e.end),
          color: e.color || colorFromId(e.employeeId),
          status: e.status || "PLANNED",
          employeeName: e.employeeName || null,
          storeName: e.storeName || null,
          title: e.title || "Ziyaret",
        }));
      setEvents(norm);
      setLoading(false);
    })();
  }, [range]);

  /* ───────── DAY (6 gün) ───────── */
  const days = useMemo(() => Array.from({ length: 6 }, (_, i) => addDays(anchor, i)), [anchor]);

  const byDay = useMemo(() => {
    const map = {};
    for (const d of days) map[toKey(d)] = [];
    for (const ev of events) {
      const k = toKey(ev.start);
      if (k in map) map[k].push(ev);
    }
    for (const k of Object.keys(map)) map[k].sort((a,b)=> a.start - b.start || (a.storeName||"").localeCompare(b.storeName||""));
    return map;
  }, [days, events]);

  /* ───────── MONTH ───────── */
  const monthMatrix = useMemo(() => {
    if (view !== VIEW.MONTH) return [];
    const first = startOfMonth(anchor);
    const last  = endOfMonth(anchor);
    // haftayı Pazartesi ile başlat
    const start = new Date(first);
    const w = (first.getDay() || 7); // Pzt=1, Paz=7
    start.setDate(first.getDate() - (w - 1));
    const weeks = [];
    let cur = new Date(start);
    while (cur <= last || weeks.length < 6) {
      const row = [];
      for (let i = 0; i < 7; i++) { row.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
      weeks.push(row);
      if (cur > last && weeks.length >= 6) break;
    }
    return weeks;
  }, [view, anchor]);

  const monthEventsByKey = useMemo(() => {
    if (view !== VIEW.MONTH) return {};
    const map = {};
    for (const ev of events) {
      const k = toKey(ev.start);
      (map[k] ||= []).push(ev);
    }
    for (const k of Object.keys(map)) map[k].sort((a,b)=>a.start-b.start);
    return map;
  }, [view, events]);

  /* ───────── YEAR ───────── */
  const yearMonths = useMemo(() => {
    if (view !== VIEW.YEAR) return [];
    return Array.from({ length: 12 }, (_, i) => new Date(anchor.getFullYear(), i, 1));
  }, [view, anchor]);

  /* ───────── toolbar nav ───────── */
  const goToday = () => setAnchor(startOfDay(new Date()));
  const prev = () => {
    if (view === VIEW.DAY)   setAnchor(addDays(anchor, -6));
    else if (view === VIEW.MONTH) setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1));
    else setAnchor(new Date(anchor.getFullYear() - 1, 0, 1));
  };
  const next = () => {
    if (view === VIEW.DAY)   setAnchor(addDays(anchor, 6));
    else if (view === VIEW.MONTH) setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1));
    else setAnchor(new Date(anchor.getFullYear() + 1, 0, 1));
  };

  return (
    <Layout title="Ajanda">
      <div className="ca-page">
        {/* toolbar */}
        <div className="ca-toolbar">
          <div className="left">
            <div className="seg">
              <button className={view===VIEW.DAY ? "on":""} onClick={()=>setView(VIEW.DAY)}>Gün</button>
              <button className={view===VIEW.MONTH ? "on":""} onClick={()=>setView(VIEW.MONTH)}>Ay</button>
              <button className={view===VIEW.YEAR ? "on":""} onClick={()=>setView(VIEW.YEAR)}>Yıl</button>
            </div>
            <div className="seg">
              <button onClick={prev}>‹</button>
              <button onClick={goToday}>Bugün</button>
              <button onClick={next}>›</button>
            </div>
          </div>

          <div className="right">
            {view === VIEW.DAY   && <div className="range">{fmtDayHead(days[0])} — {fmtDayHead(days[5])}</div>}
            {view === VIEW.MONTH && <div className="range">{fmtMonth(anchor)}</div>}
            {view === VIEW.YEAR  && <div className="range">{anchor.getFullYear()}</div>}
          </div>
        </div>

        {/* body */}
        {loading ? (
          <div className="card">Yükleniyor…</div>
        ) : view === VIEW.DAY ? (
          <div className="ca-grid">
            {days.map((d) => {
              const key = toKey(d);
              const list = byDay[key] || [];
              return (
                <div className="ca-day card" key={key}>
                  <div className="date">{fmtDayHead(d)}</div>
                  <div className="list">
                    {list.length === 0 ? (
                      <div className="empty">Ziyaret yok</div>
                    ) : (
                      list.map((ev) => (
                        <div
                          key={ev.id}
                          className="pill"
                          onClick={() => navigate(`/calendar/visit/${ev.id}`)}
                          title={`${ev.title} • ${ev.storeName || ""} • ${ev.employeeName || ""}`}
                        >
                          <span className="dot" style={{ background: ev.color }} />
                          <div className="txt">
                            <div className="t">{ev.title}</div>
                            <div className="s">
                              <span className={`badge xs ${statusClass(ev.status)}`}>{STATUS_LABEL[ev.status]}</span>
                              <span className="time">{fmtTime(ev.start)} – {fmtTime(ev.end)}</span>
                            </div>
                            {(ev.storeName || ev.employeeName) && (
                              <div className="meta">
                                {ev.storeName || "-"} {ev.employeeName ? `· ${ev.employeeName}` : ""}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : view === VIEW.MONTH ? (
          <div className="ca-month">
            <div className="dow">{["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"].map(d => <div key={d}>{d}</div>)}</div>
            <div className="grid">
              {monthMatrix.map((row, ri) => (
                <div className="row" key={ri}>
                  {row.map((d) => {
                    const key = toKey(d);
                    const list = (monthEventsByKey[key] || []).slice(0, 4);
                    const isOther = d.getMonth() !== anchor.getMonth();
                    return (
                      <div className={`cell ${isOther ? "muted" : ""}`} key={key}>
                        <div className="date">{d.getDate()}</div>
                        <div className="list">
                          {list.map((ev) => (
                            <div
                              key={ev.id}
                              className="pill"
                              style={{ background: ev.color }}
                              onClick={() => navigate(`/calendar/visit/${ev.id}`)}
                              title={`${ev.title} • ${ev.storeName || ""} • ${ev.employeeName || ""}`}
                            >
                              <span className={`badge xs ${statusClass(ev.status)}`}>{STATUS_LABEL[ev.status]}</span>
                              <span className="t">{ev.title}</span>
                              <span className="m">{fmtTime(ev.start)}</span>
                            </div>
                          ))}
                          {(monthEventsByKey[key]?.length || 0) > 4 && (
                            <div className="more">+{monthEventsByKey[key].length - 4} daha</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="ca-year">
            {yearMonths.map((m) => {
              const label = `${m.getFullYear()} / ${pad2(m.getMonth() + 1)}`;
              const mStart = startOfMonth(m);
              const mEnd = endOfMonth(m);
              const count = events.filter(ev => ev.start >= mStart && ev.start <= mEnd).length;
              return (
                <div className="ym" key={label} onClick={() => { setView(VIEW.MONTH); setAnchor(m); }}>
                  <div className="ym-head">{m.toLocaleDateString("tr-TR",{ month:"long", year:"numeric" })}</div>
                  <div className="ym-body">
                    <span className="count-badge">{count}</span> planlı/gerçekleşen ziyaret
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
