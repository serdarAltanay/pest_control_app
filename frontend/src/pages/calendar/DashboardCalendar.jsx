// src/pages/dashboard/DashboardCalendar.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import "./DashboardCalendar.scss";

/* ───────── utils ───────── */
const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay   = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

const COLORS = ["#60a5fa","#34d399","#fbbf24","#f87171","#a78bfa","#22d3ee","#f472b6","#f97316","#84cc16","#e879f9","#38bdf8"];
const hashColorFromId = (id) =>
  COLORS[(String(id ?? "x").split("").reduce((a,c)=>a+c.charCodeAt(0),0)) % COLORS.length];

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

/* Personel adı soyadı birleştirici (tamamlananlar tablosu için özellikle) */
const employeeFullNameOf = (ev) => {
  const bySingle = ev.employeeFullName || ev.employeeName || ev.employee;
  if (bySingle && String(bySingle).trim()) return bySingle;
  const byParts = [ev.employeeFirstName, ev.employeeLastName].filter(Boolean).join(" ").trim();
  return byParts || "—";
};

/* ───────── API ───────── */
async function fetchEventsInRange(from, to) {
  const qs = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  try {
    const { data } = await api.get(`/schedule/events?${qs.toString()}`);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

/* ───────── hooks ───────── */
function useEvents(from, to, filterFn) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    (async () => {
      const raw = await fetchEventsInRange(from, to);
      let norm = raw.map(e => ({
        ...e,
        start: new Date(e.start),
        end: new Date(e.end),
        color: e.color || hashColorFromId(e.employeeId),
      }));
      if (typeof filterFn === "function") norm = norm.filter(filterFn);
      norm.sort((a,b)=> a.start - b.start);
      setItems(norm);
    })();
    // filterFn dependency'ye bilinçli alınmadı
  }, [from, to]);
  return items;
}

/* ───────── shared row ───────── */
function Row({ ev, showDate }) {
  const navigate = useNavigate();
  const datePart = `${pad2(ev.start.getDate())}.${pad2(ev.start.getMonth()+1)}`;
  const timePart = `${pad2(ev.start.getHours())}:${pad2(ev.start.getMinutes())} – ${pad2(ev.end.getHours())}:${pad2(ev.end.getMinutes())}`;

  return (
    <div className="row clickable" onClick={() => navigate(`/calendar/visit/${ev.id}`)} title="Detaya git">
      <div className="dot" style={{ background: ev.color }} />
      <div className="c-title">{ev.title}</div>
      <div className="c-store">{ev.storeName || "Mağaza"}</div>
      <div className="c-emp">{ev.employeeName || "Personel"}</div>
      <div className="c-when">{showDate ? `${datePart} ${timePart}` : timePart}</div>
      <div className="c-status">
        <span className={`badge ${statusClass(ev.status)}`}>{statusLabel(ev.status)}</span>
      </div>
    </div>
  );
}

/* ───────── 1) Bugünün Tüm Ziyaretleri ───────── */
function DashCalToday() {
  const now = new Date();
  const range = useMemo(() => ({ from: startOfDay(now), to: endOfDay(now) }), [now]);
  const items = useEvents(range.from, range.to);

  return (
    <div className="dash-cal card">
      <div className="head"><div className="t">Bugünün Ziyaretleri</div></div>
      <div className="list">
        <div className="cols-head">
          <div />{/* dot */}
          <div>Başlık</div>
          <div>Mağaza</div>
          <div>Personel</div>
          <div>Saat</div>
          <div>Durum</div>
        </div>
        {items.length === 0 ? (
          <div className="empty">Bugün için ziyaret yok.</div>
        ) : items.map(ev => <Row key={`${ev.id}-${ev.start}`} ev={ev} showDate={false} />)}
      </div>
    </div>
  );
}

/* ───────── (opsiyonel) Bugün – Sadece Tamamlananlar ───────── */
function DashCalTodayCompleted() {
  const now = new Date();
  const range = useMemo(() => ({ from: startOfDay(now), to: endOfDay(now) }), [now]);
  const items = useEvents(range.from, range.to, (e) => (e.status || "").toUpperCase() === "COMPLETED");

  return (
    <div className="dash-cal card">
      <div className="head"><div className="t">Bugün – Tamamlanan Ziyaretler</div></div>
      <div className="list">
        <div className="cols-head">
          <div />
          <div>Başlık</div>
          <div>Mağaza</div>
          <div>Personel</div>
          <div>Saat</div>
          <div>Durum</div>
        </div>
        {items.length === 0 ? (
          <div className="empty">Bugün tamamlanan ziyaret yok.</div>
        ) : items.map(ev => <Row key={`${ev.id}-${ev.start}`} ev={ev} showDate={false} />)}
      </div>
    </div>
  );
}

/* ───────── 2) Önümüzdeki 3 Gün – Planlananlar ───────── */
function DashCalNext3() {
  const today = new Date();
  const from = useMemo(() => startOfDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)), [today]); // yarın
  const to   = useMemo(() => endOfDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3)), [today]);  // +3 gün
  const items = useEvents(from, to, (e) => (e.status || "PLANNED") === "PLANNED");

  return (
    <div className="dash-cal card">
      <div className="head"><div className="t">Önümüzdeki 3 Gün – Planlanan Ziyaretler</div></div>
      <div className="list">
        <div className="cols-head">
          <div />
          <div>Başlık</div>
          <div>Mağaza</div>
          <div>Personel</div>
          <div>Tarih & Saat</div>
          <div>Durum</div>
        </div>
        {items.length === 0 ? (
          <div className="empty">Önümüzdeki 3 gün için planlanan ziyaret yok.</div>
        ) : items.map(ev => <Row key={`${ev.id}-${ev.start}`} ev={ev} showDate />)}
      </div>
    </div>
  );
}

/* ───────── 3) Son 7 Gün – Başarısız (İptal/Yapılamadı/Ertelendi) ───────── */
function DashCalFailedLast7() {
  const today = new Date();
  const from = useMemo(() => startOfDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7)), [today]);
  const to   = useMemo(() => endOfDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)), [today]); // dünü dahil
  const FAILED_SET = new Set(["FAILED","CANCELLED","POSTPONED"]);
  const items = useEvents(from, to, (e) => FAILED_SET.has((e.status || "").toUpperCase()));

  return (
    <div className="dash-cal card">
      <div className="head"><div className="t">Geçtiğimiz 7 Gün – Başarısız Ziyaretler</div></div>
      <div className="list">
        <div className="cols-head">
          <div />
          <div>Başlık</div>
          <div>Mağaza</div>
          <div>Personel</div>
          <div>Tarih & Saat</div>
          <div>Durum</div>
        </div>
        {items.length === 0 ? (
          <div className="empty">Son 1 haftada başarısız ziyaret yok.</div>
        ) : items.map(ev => <Row key={`${ev.id}-${ev.start}`} ev={ev} showDate />)}
      </div>
    </div>
  );
}

/* ───────── 4) Tamamlanan Tüm Ziyaretler – Tablo ───────── */
function CompletedVisitsTable() {
  const navigate = useNavigate();

  // geniş aralık: tüm completed’ları çek
  const from = useMemo(() => new Date(2000, 0, 1, 0, 0, 0, 0), []);
  const to   = useMemo(() => new Date(2100, 0, 1, 0, 0, 0, 0), []);
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(false);

  // UI
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const qs = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
        const { data } = await api.get(`/schedule/events?${qs.toString()}`);
        const arr = Array.isArray(data) ? data : [];
        const completed = arr
          .filter((e) => (e.status || "").toUpperCase() === "COMPLETED")
          .map((e) => ({
            ...e,
            start: new Date(e.start),
            end: new Date(e.end),
          }))
          .sort((a, b) => b.start - a.start); // yeni → eski
        setAll(completed);
        setPage(1);
      } catch {
        setAll([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [from, to]);

  const fmtDT = (d) =>
    `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()} ` +
    `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;

  // Arama filtresi
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((e) =>
      [
        e.title || "",
        e.storeName || "",
        employeeFullNameOf(e) || "",
        fmtDT(e.start),
      ].join(" ").toLowerCase().includes(q)
    );
  }, [all, query]);

  // Sayfalama
  const totalPages  = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIdx    = (currentPage - 1) * pageSize;
  const pageItems   = filtered.slice(startIdx, startIdx + pageSize);

  useEffect(() => { setPage(1); }, [query, pageSize]);

  const goDetail = (id) => navigate(`/calendar/visit/${id}`);

  return (
    <div className="completed-visits">
      <div className="cv-head">
        <div className="t">Tamamlanan Görevler</div>
      </div>

      <div className="toolbar">
        <input
          className="search"
          placeholder="Ara: başlık, mağaza, personel, tarih…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="right-controls">
          <div className="page-size">
            <label>Göster</label>
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table className="completed-table">
          <thead>
            <tr>
              <th>Başlık</th>
              <th>Mağaza</th>
              <th>Personel</th>
              <th>Tarih & Saat</th>
              <th className="th-status">Durum</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ textAlign: "center" }}>Yükleniyor…</td></tr>
            ) : pageItems.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: "center" }}>Kayıt bulunamadı</td></tr>
            ) : (
              pageItems.map((e) => (
                <tr key={e.id} className="clickable" onClick={() => goDetail(e.id)}>
                  <td className="strong">{e.title}</td>
                  <td>{e.storeName || "—"}</td>
                  <td>{employeeFullNameOf(e)}</td> {/* Ad Soyad kesin göster */}
                  <td>{fmtDT(e.start)} – {fmtDT(e.end).slice(11)}</td>
                  <td className="td-status">
                    <span className={`badge ${statusClass(e.status)}`}>{statusLabel(e.status)}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button className="page-btn" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          Prev
        </button>
        <span className="page-indicator">{currentPage}</span>
        <button className="page-btn" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
          Next
        </button>
        <div className="count-info">
          {filtered.length === 0
            ? "0"
            : `${startIdx + 1}-${Math.min(startIdx + pageSize, filtered.length)} / ${filtered.length}`}
        </div>
      </div>
    </div>
  );
}

/* ───────── Exports ───────── */
export {
  DashCalToday,
  DashCalTodayCompleted,
  DashCalNext3,
  DashCalFailedLast7,
  CompletedVisitsTable,
};
export default DashCalToday;
