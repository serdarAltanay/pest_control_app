import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import "./VisitCalendar.scss";

/* ───────── Yardımcılar ───────── */
const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
const toDateInput  = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const toMonthInput = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;

const startOfDay   = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay     = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
const endOfMonth   = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
const startOfYear  = (d) => new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
const endOfYear    = (d) => new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);

const VIEW = { DAY: "day", MONTH: "month", YEAR: "year" };

const COLORS = [
  "#60a5fa","#34d399","#fbbf24","#f87171","#a78bfa","#22d3ee",
  "#f472b6","#f97316","#84cc16","#e879f9","#38bdf8",
];

const minutesFromMidnight = (d) => d.getHours() * 60 + d.getMinutes();
const nearestQuarter = (min) => Math.round(min / 15) * 15;

function hashColorFromId(id) {
  if (!id && id !== 0) return COLORS[0];
  let h = 0; const s = String(id);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return COLORS[h % COLORS.length];
}

/* ───────── Status label & class ───────── */
const STATUS_LABEL = {
  PENDING:   "Henüz yapılmadı",
  PLANNED:   "Planlandı",
  COMPLETED: "Yapıldı",
  FAILED:    "Yapılamadı",
  CANCELLED: "İptal edildi",
  POSTPONED: "Ertelendi",
};
const statusLabel = (s) => STATUS_LABEL[s] || "—";
const statusClass = (s) => `st-${(s || "PLANNED").toLowerCase()}`;

/* ───────── Ziyaret Türleri (Başlık için) ───────── */
const VISIT_TYPE_TR = {
  PERIYODIK: "Periyodik Ziyaret",
  ACIL_CAGRI: "Acil Çağrı",
  ISTASYON_KURULUM: "İstasyon Kurulum",
  ILK_ZIYARET: "İlk Ziyaret",
};

/* ───────── Çakışan etkinlikleri şeritlere dağıt ───────── */
function assignLanesForDay(list) {
  const evs = [...list].sort((a, b) => a.start - b.start);
  const laneEnds = [];
  for (const ev of evs) {
    let placed = false;
    for (let i = 0; i < laneEnds.length; i++) {
      if (ev.start >= laneEnds[i]) {
        ev._lane = i;
        laneEnds[i] = ev.end;
        placed = true;
        break;
      }
    }
    if (!placed) {
      ev._lane = laneEnds.length;
      laneEnds.push(ev.end);
    }
  }
  return { events: evs, laneCount: Math.max(1, laneEnds.length) };
}

/* ───────── Personel & Müşteri & Mağaza fetch ───────── */
async function fetchEmployees() {
  try {
    const { data } = await api.get("/employees");
    return Array.isArray(data) ? data : [];
  } catch {
    try {
      const { data } = await api.get("/admin/employees");
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }
}

async function fetchCustomers() {
  const tryList = ["/customers", "/admin/customers", "/api/customers"];
  for (const path of tryList) {
    try {
      const { data } = await api.get(path);
      if (Array.isArray(data)) return data;
    } catch {}
  }
  return [];
}

async function fetchStoresByCustomer(customerId) {
  if (!customerId) return [];
  try {
    const { data } = await api.get(`/stores/customer/${customerId}`);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

// Basit sıralama
function rankStores(list, q) {
  if (!q) return list;
  const needle = q.toLowerCase();
  const score = (s) => {
    const t = (s || "").toLowerCase();
    if (t.startsWith(needle)) return 0;
    if (t.includes(needle)) return 1;
    return 2;
  };
  return [...list].sort((a, b) => {
    const as = Math.min(score(a.name), score(a.code));
    const bs = Math.min(score(b.name), score(b.code));
    if (as !== bs) return as - bs;
    return (a.name || "").localeCompare(b.name || "");
  });
}

/* ───────── Events API ───────── */
async function fetchEventsInRange(from, to) {
  const qs = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  try {
    const { data } = await api.get(`/schedule/events?${qs.toString()}`);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("GET /schedule/events hata:", err);
    const msg = err?.response?.data?.error || err?.message || "Etkinlikler getirilemedi";
    toast.error(msg);
    return [];
  }
}
async function createEvent(payload) {
  const { title, notes, employeeId, storeId, start, end } = payload;
  const body = { title, notes, employeeId, storeId, start, end };
  const { data } = await api.post("/schedule/events", body);
  return data;
}

/* ───────── Görsel sabitler (px) ve gün penceresi ───────── */
const HOUR_PX = 60;      // 1 saat = 60px
const MIN_EVENT_PX = 72; // etkinlik min. yükseklik

// Gün: 07:00 → ertesi gün 02:00 (19 saat)
const DAY_START_MIN = 7 * 60;
const DAY_END_MIN   = 26 * 60; // 24 + 2
const DAY_SPAN_MIN  = DAY_END_MIN - DAY_START_MIN; // 1140 dk
const GRID_HOURS    = DAY_SPAN_MIN / 60; // 19

function windowBoundsForDay(d) {
  const ws = new Date(d); ws.setHours(7, 0, 0, 0);
  const we = new Date(d); we.setDate(we.getDate() + 1); we.setHours(2, 0, 0, 0);
  return { ws, we };
}

export default function VisitCalendar() {
  const isAdmin = (localStorage.getItem("role") || "").toLowerCase() === "admin";
  const navigate = useNavigate();

  const [view, setView] = useState(VIEW.DAY);
  const [anchor, setAnchor] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalDate, setModalDate] = useState(null);
  const [modalDefaults, setModalDefaults] = useState(null);

  // Create form state
  const [employees, setEmployees] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [storesAll, setStoresAll] = useState([]);
  const [stores, setStores] = useState([]);
  const [storeQ, setStoreQ] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [storesLoading, setStoresLoading] = useState(false);

  // Range
  const range = useMemo(() => {
    if (view === VIEW.DAY) {
      const d0 = new Date(anchor); d0.setDate(d0.getDate() - 1);
      const d1 = new Date(anchor); d1.setDate(d1.getDate() + 2);
      return { from: startOfDay(d0), to: endOfDay(d1) };
    }
    if (view === VIEW.MONTH) return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
    return { from: startOfYear(anchor), to: endOfYear(anchor) };
  }, [anchor, view]);

  // Events yükle
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await fetchEventsInRange(range.from, range.to);
      const norm = raw.map((e) => ({
        ...e,
        start: new Date(e.start),
        end: new Date(e.end),
        color: e.color || hashColorFromId(e.employeeId),
        status: e.status || "PLANNED",
      }));
      setEvents(norm);
    } catch (e) {
      toast.error(e?.response?.data?.error || "Takvim yüklenemedi");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [range]);
  useEffect(() => { load(); }, [load]);

  // Çalışanlar/Müşteriler
  useEffect(() => { (async () => setEmployees(await fetchEmployees()))(); }, []);
  useEffect(() => { (async () => setCustomers(await fetchCustomers()))(); }, []);

  // Seçilen müşteri → mağazalar
  useEffect(() => {
    (async () => {
      setStoresAll([]); setStores([]); setSelectedStoreId(null);
      if (!selectedCustomerId) return;
      setStoresLoading(true);
      const list = await fetchStoresByCustomer(selectedCustomerId);
      setStoresAll(Array.isArray(list) ? list : []);
      setStoresLoading(false);
    })();
  }, [selectedCustomerId]);

  // Arama
  useEffect(() => {
    const q = storeQ.trim();
    const ranked = rankStores(storesAll, q).slice(0, 10);
    setStores(ranked);
  }, [storeQ, storesAll]);

  // View helpers
  const goToday = () => setAnchor(new Date());
  const prev = () => {
    if (view === VIEW.DAY)   { const d = new Date(anchor); d.setDate(d.getDate() - 1); setAnchor(d); }
    else if (view === VIEW.MONTH) { const d = new Date(anchor); d.setMonth(d.getMonth() - 1); setAnchor(d); }
    else { const d = new Date(anchor); d.setFullYear(d.getFullYear() - 1); setAnchor(d); }
  };
  const next = () => {
    if (view === VIEW.DAY)   { const d = new Date(anchor); d.setDate(d.getDate() + 1); setAnchor(d); }
    else if (view === VIEW.MONTH) { const d = new Date(anchor); d.setMonth(d.getMonth() + 1); setAnchor(d); }
    else { const d = new Date(anchor); d.setFullYear(d.getFullYear() + 1); setAnchor(d); }
  };

  // Ay başlığı (tr-TR)
  const monthLabel = useMemo(
    () => anchor.toLocaleDateString("tr-TR", { month: "long", year: "numeric" }),
    [anchor]
  );

  // Create
  const openCreateForDay = (day, defaults) => {
    if (!isAdmin) return;
    setModalDate(startOfDay(day));
    setModalDefaults(defaults || null);
    setModalOpen(true);
  };

  const formRef = useRef(null);
  const onCreate = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;
    const form = formRef.current;
    if (!form) return toast.error("Form bulunamadı.");

    const fd = new FormData(form);
    const employeeId = Number(fd.get("employeeId") || 0);
    const pickedStoreId = Number(fd.get("storeId") || selectedStoreId || 0);

    // ▼▼▼ Yeni: ziyaret türü (başlık buradan türetilir)
    const visitTypeKey = fd.get("visitType") || "";
    const title = VISIT_TYPE_TR[visitTypeKey] || "Ziyaret";
    // ▲▲▲

    const notes = fd.get("notes") || "";

    if (!employeeId) return toast.error("Personel seçin");
    if (!pickedStoreId) return toast.error("Mağaza seçin");

    const startTime = fd.get("start");
    const endTime   = fd.get("end");
    if (!startTime || !endTime) return toast.error("Başlangıç ve bitiş saati seçin");

    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);

    // 00–06 seçilirse ertesi güne kaydır
    const start = new Date(modalDate);
    if (sh < 7) start.setDate(start.getDate() + 1);
    start.setHours(sh, sm, 0, 0);

    const end = new Date(modalDate);
    if (eh < 7) end.setDate(end.getDate() + 1);
    end.setHours(eh, em, 0, 0);

    if (end <= start) return toast.error("Bitiş, başlangıçtan sonra olmalı");

    try {
      setSaving(true);
      await createEvent({ title, notes, employeeId, storeId: pickedStoreId, start, end });
      toast.success("Ziyaret planlandı");
      setModalOpen(false);
      setSelectedStoreId(null);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  // Saat etiketleri: 07..23, ardından 00..01
  const dayHourLabels = useMemo(() => {
    if (view !== VIEW.DAY) return [];
    const labels = [];
    for (let h = 7; h <= 23; h++) labels.push(`${pad2(h)}:00`);
    labels.push("00:00", "01:00");
    return labels;
  }, [view]);

  // Gün kolonları: -1, 0, +1, +2
  const dayColumns = useMemo(() => {
    if (view !== VIEW.DAY) return [];
    const offsets = [-1, 0, 1, 2];
    return offsets.map((off) => {
      const d = new Date(anchor);
      d.setDate(d.getDate() + off);
      return d;
    });
  }, [view, anchor]);

  // Bir gün penceresine göre (07→02) eventleri paketle
  const dayEventsByDate = useMemo(() => {
    if (view !== VIEW.DAY) return {};
    const map = {};
    for (const d of dayColumns) {
      const key = toDateInput(d);
      const { ws, we } = windowBoundsForDay(d);

      // Pencere ile kesişenleri al, pencereye göre kırp
      const winEvents = [];
      for (const e of events) {
        if (e.end <= ws || e.start >= we) continue; // kesişmiyor
        const s = new Date(Math.max(e.start, ws));
        const ee = new Date(Math.min(e.end, we));
        winEvents.push({
          ...e,
          // şerit atama için pencere-tabanlı start/end
          start: s,
          end: ee,
          // render için göreli dakika
          _relStartMin: Math.round((s - ws) / 60000),
          _relEndMin: Math.round((ee - ws) / 60000),
        });
      }

      const packed = assignLanesForDay(winEvents);
      map[key] = packed;
    }
    return map;
  }, [view, dayColumns, events]);

  // Ay görünümü
  const monthMatrix = useMemo(() => {
    if (view !== VIEW.MONTH) return [];
    const first = startOfMonth(anchor);
    const last  = endOfMonth(anchor);
    const start = new Date(first);
    start.setDate(first.getDate() - (first.getDay() || 7) + 1);
    const weeks = [];
    let cur = new Date(start);
    while (cur <= last || weeks.length < 6) {
      const row = [];
      for (let i = 0; i < 7; i++) {
        row.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
      weeks.push(row);
      if (cur > last && weeks.length >= 6) break;
    }
    return weeks;
  }, [view, anchor]);

  const monthEventsByDayKey = useMemo(() => {
    if (view !== VIEW.MONTH) return {};
    const map = {};
    for (const ev of events) {
      const key = toDateInput(ev.start);
      (map[key] ||= []).push(ev);
    }
    for (const k of Object.keys(map)) map[k].sort((a, b) => a.start - b.start);
    return map;
  }, [view, events]);

  // Yıl görünümü
  const yearMonths = useMemo(() => {
    if (view !== VIEW.YEAR) return [];
    return Array.from({ length: 12 }, (_, i) => new Date(anchor.getFullYear(), i, 1));
  }, [view, anchor]);

  // Grid tıklama → 07→02 aralığına göre default saat üret
  const onGridClick = (day, e) => {
    if (!isAdmin) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const relMin = Math.round((y / rect.height) * DAY_SPAN_MIN);
    const sRel = nearestQuarter(Math.max(0, Math.min(DAY_SPAN_MIN - 15, relMin)));
    // mutlak gün içi dakika (0..1439)
    const absStart = (DAY_START_MIN + sRel) % (24 * 60);
    const absEnd   = (absStart + 60) % (24 * 60);
    const defaults = { startMin: absStart, endMin: absEnd };
    openCreateForDay(day, defaults);
  };

  return (
    <Layout title="Ziyaret Takvimi">
      <div className="vc-page">
        {/* Toolbar */}
        <div className="vc-toolbar">
          <div className="left">
            <div className="seg">
              <button className={view === VIEW.DAY ? "on" : ""} onClick={() => setView(VIEW.DAY)}>Gün</button>
              <button className={view === VIEW.MONTH ? "on" : ""} onClick={() => setView(VIEW.MONTH)}>Ay</button>
              <button className={view === VIEW.YEAR ? "on" : ""} onClick={() => setView(VIEW.YEAR)}>Yıl</button>
            </div>
            <div className="seg">
              <button onClick={prev}>‹</button>
              <button onClick={goToday}>Bugün</button>
              <button onClick={next}>›</button>
            </div>
          </div>

          <div className="right">
            {view === VIEW.DAY && (
              <input
                type="date"
                value={toDateInput(anchor)}
                onChange={(e) => {
                  const [y, m, d] = e.target.value.split("-").map(Number);
                  setAnchor(new Date(y, m - 1, d));
                }}
              />
            )}
            {view === VIEW.MONTH && (
              <input
                type="month"
                value={toMonthInput(anchor)}
                onChange={(e) => {
                  const [y, m] = e.target.value.split("-").map(Number);
                  setAnchor(new Date(y, m - 1, 1));
                }}
              />
            )}
            {view === VIEW.YEAR && (
              <input
                type="number"
                value={anchor.getFullYear()}
                onChange={(e) => {
                  const y = Number(e.target.value || new Date().getFullYear());
                  setAnchor(new Date(y, 0, 1));
                }}
              />
            )}
          </div>
        </div>

        {/* Legend */}
        {employees?.length > 0 && (
          <div className="vc-legend card">
            {employees.map(e => (
              <div className="lg-item" key={e.id}>
                <span className="dot" style={{ background: hashColorFromId(e.id) }} />
                <span className="name">{e.fullName || e.name || e.email}</span>
              </div>
            ))}
          </div>
        )}

        {!isAdmin && (
          <div className="vc-tip card">
            Bu takvimi admin ve çalışanlar görebilir. <b>Yeni ziyaret planlama sadece admin içindir.</b>
          </div>
        )}

        {/* BODY */}
        {loading ? (
          <div className="card">Yükleniyor…</div>
        ) : view === VIEW.DAY ? (
          <div className="vc-day" style={{ "--grid-hours": GRID_HOURS }}>
            {/* Saat kolonu */}
            <div className="hours">
              <div className="hours-head" />
              <div className="hours-grid">
                {dayHourLabels.map((lbl, i) => (
                  <div className="h" key={i}>{lbl}</div>
                ))}
              </div>
            </div>

            {/* Günler */}
            <div className="days">
              {dayColumns.map((d) => {
                const key = toDateInput(d);
                const meta = dayEventsByDate[key] || { events: [], laneCount: 1 };
                const isSelected = d.toDateString() === anchor.toDateString();
                return (
                  <div className={`col ${isSelected ? "is-selected" : ""}`} key={key}>
                    <div className="col-head" onClick={() => openCreateForDay(d)}>
                      {toDateInput(d)}{isSelected ? " • Seçili" : ""}
                    </div>

                    <div
                      className="col-grid"
                      onClick={(e) => onGridClick(d, e)}
                      style={{ "--lane-count": meta.laneCount }}
                    >
                      {meta.events.map((ev) => {
                        const topPx    = (ev._relStartMin / 60) * HOUR_PX;
                        const durMin   = Math.max(1, ev._relEndMin - ev._relStartMin);
                        const heightPx = Math.max((durMin / 60) * HOUR_PX, MIN_EVENT_PX);

                        return (
                          <div
                            key={ev.id}
                            className="event"
                            style={{
                              "--lane-index": ev._lane,
                              top: `${topPx}px`,
                              height: `${heightPx}px`,
                              background: ev.color,
                              cursor: "pointer"
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/calendar/visit/${ev.id}`);
                            }}
                            title={`${ev.title} • ${ev.employeeName || ""} • ${ev.storeName || ""}`}
                          >
                            <span className={`badge ${statusClass(ev.status)}`}>
                              {statusLabel(ev.status)}
                            </span>

                            <div className="ev-title">{ev.title}</div>
                            <div className="ev-meta">
                              {pad2(ev.start.getHours())}:{pad2(ev.start.getMinutes())}
                              {" – "}
                              {pad2(ev.end.getHours())}:{pad2(ev.end.getMinutes())}
                            </div>
                            <div className="ev-sub">
                              {ev.employeeName || ""}{ev.employeeName && ev.storeName ? " · " : ""}{ev.storeName || ""}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : view === VIEW.MONTH ? (
          <div className="vc-month">
            {/* Ay başlık + oklar */}
            <div className="month-nav">
              <button
                className="nav-btn"
                onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))}
                aria-label="Önceki ay"
              >
                ‹
              </button>
              <div className="month-title">{monthLabel}</div>
              <button
                className="nav-btn"
                onClick={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))}
                aria-label="Sonraki ay"
              >
                ›
              </button>
            </div>

            <div className="dow">
              {["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"].map((l) => <div key={l}>{l}</div>)}
            </div>
            <div className="grid">
              {monthMatrix.map((row, ri) => (
                <div className="row" key={ri}>
                  {row.map((d) => {
                    const key = toDateInput(d);
                    const dayEvs = (monthEventsByDayKey[key] || []).sort((a,b)=>a.start-b.start);
                    const isOtherMonth = d.getMonth() !== anchor.getMonth();
                    return (
                      <div className={`cell ${isOtherMonth ? "muted" : ""}`} key={key}>
                        <div className="date" onClick={() => openCreateForDay(d)}>{d.getDate()}</div>
                        <div className="list">
                          {dayEvs.slice(0, 3).map((ev) => (
                            <div
                              key={ev.id}
                              className="pill"
                              style={{ background: ev.color, cursor: "pointer" }}
                              onClick={() => navigate(`/calendar/visit/${ev.id}`)}
                              title={`${ev.title} • ${ev.employeeName || ""} • ${ev.storeName || ""}`}
                            >
                              <span className={`badge xs ${statusClass(ev.status)}`}>{statusLabel(ev.status)}</span>
                              <span className="t">{ev.title}</span>
                              <span className="m">
                                {pad2(ev.start.getHours())}:{pad2(ev.start.getMinutes())}
                              </span>
                            </div>
                          ))}
                          {dayEvs.length > 3 && <div className="more">+{dayEvs.length - 3} daha</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="vc-year">
            {yearMonths.map((m) => {
              const label = `${m.getFullYear()} / ${pad2(m.getMonth() + 1)}`;
              const monthStart = startOfMonth(m);
              const monthEnd = endOfMonth(m);
              const count = events.filter(ev => ev.start >= monthStart && ev.start <= monthEnd).length;
              return (
                <div className="ym" key={label} onClick={() => { setView(VIEW.MONTH); setAnchor(m); }}>
                  <div className="ym-head">{label}</div>
                  <div className="ym-body">
                    <span className="count-badge">{count}</span> planlı ziyaret
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* CREATE MODAL */}
        {modalOpen && (
          <div
            className="vc-modal-backdrop"
            onClick={(e) => {
              if (e.target.classList.contains("vc-modal-backdrop")) setModalOpen(false);
            }}
          >
            <div className="vc-modal">
              <div className="vc-modal-head">
                <div>Ziyaret Planla</div>
                <button className="close" onClick={() => setModalOpen(false)}>×</button>
              </div>

              <form className="vc-modal-body" onSubmit={onCreate} ref={formRef}>
                <input type="hidden" name="storeId" value={selectedStoreId ?? ""} />

                <div className="field">
                  <label>Tarih</label>
                  <input type="date" value={toDateInput(modalDate)} readOnly/>
                </div>

                <div className="field">
                  <label>Başlangıç</label>
                  <select name="start" defaultValue={
                    modalDefaults?.startMin != null
                      ? `${pad2(Math.floor(modalDefaults.startMin/60))}:${pad2(modalDefaults.startMin%60)}`
                      : "09:00"
                  }>
                    {Array.from({ length: 24 * 60 / 15 }, (_, i) => {
                      const m = i * 15;
                      return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
                    }).map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div className="field">
                  <label>Bitiş</label>
                  <select name="end" defaultValue={
                    modalDefaults?.endMin != null
                      ? `${pad2(Math.floor(modalDefaults.endMin/60))}:${pad2(modalDefaults.endMin%60)}`
                      : "10:00"
                  }>
                    {Array.from({ length: 24 * 60 / 15 }, (_, i) => {
                      const m = i * 15;
                      return `${pad2(Math.floor(m / 60))}:${pad2(m % 60)}`;
                    }).map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>

                <div className="field">
                  <label>Personel</label>
                  <select name="employeeId" required>
                    <option value="">Seçin…</option>
                    {employees.map(e => (
                      <option key={e.id} value={e.id}>{e.fullName || e.name || e.email}</option>
                    ))}
                  </select>
                </div>

                {/* Müşteri -> Mağaza */}
                <div className="field">
                  <label>Müşteri</label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    required
                  >
                    <option value="">Seçin…</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {(c.code ? `${c.code} – ` : "") + (c.name || c.fullName || c.title || c.email || `Müşteri #${c.id}`)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field full">
                  <label>Mağaza</label>
                  <input
                    type="text"
                    placeholder="Mağaza ara…"
                    value={storeQ}
                    onChange={(e) => setStoreQ(e.target.value)}
                    disabled={!selectedCustomerId || storesLoading}
                  />
                  <div className="store-results">
                    {!selectedCustomerId && <div className="store-empty">Önce müşteri seçin</div>}
                    {selectedCustomerId && storesLoading && <div className="store-loading">Mağazalar yükleniyor…</div>}
                    {selectedCustomerId && !storesLoading && stores.length === 0 && storeQ.trim() && (
                      <div className="store-empty">Sonuç yok</div>
                    )}
                    {selectedCustomerId && !storesLoading && stores.map(s => (
                      <label key={s.id} className={`store-item ${selectedStoreId === s.id ? "on" : ""}`}>
                        <input
                          type="radio"
                          name="storeId-radio"
                          value={s.id}
                          checked={selectedStoreId === s.id}
                          onChange={() => setSelectedStoreId(s.id)}
                        />
                        <span>{s.code ? `${s.code} – ` : ""}{s.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* ▼▼▼ Güncellendi: Başlık yerine Ziyaret Türü seçimi */}
                <div className="field full">
                  <label>Ziyaret Türü</label>
                  <select name="visitType" defaultValue="PERIYODIK" required>
                    <option value="PERIYODIK">{VISIT_TYPE_TR.PERIYODIK}</option>
                    <option value="ACIL_CAGRI">{VISIT_TYPE_TR.ACIL_CAGRI}</option>
                    <option value="ISTASYON_KURULUM">{VISIT_TYPE_TR.ISTASYON_KURULUM}</option>
                    <option value="ILK_ZIYARET">{VISIT_TYPE_TR.ILK_ZIYARET}</option>
                  </select>
                </div>
                {/* ▲▲▲ */}

                <div className="field full">
                  <label>Notlar</label>
                  <textarea name="notes" rows={3} placeholder="(Opsiyonel) Not ekleyin…" />
                </div>
              </form>

              <div className="vc-modal-foot">
                <button className="btn ghost" onClick={() => setModalOpen(false)}>Vazgeç</button>
                <button className="btn" onClick={onCreate} disabled={saving}>
                  {saving ? "Kaydediliyor…" : "Planla"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
