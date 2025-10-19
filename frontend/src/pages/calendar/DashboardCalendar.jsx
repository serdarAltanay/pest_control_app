import { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";
import "./DashboardCalendar.scss";

const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0,0,0,0);
const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23,59,59,999);

const COLORS = [
  "#60a5fa","#34d399","#fbbf24","#f87171","#a78bfa","#22d3ee","#f472b6","#f97316","#84cc16","#e879f9","#38bdf8",
];
const hashColorFromId = (id) => COLORS[(String(id).split("").reduce((a,c)=>a+c.charCodeAt(0),0)) % COLORS.length];

async function fetchEventsInRange(from, to) {
  const qs = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  try {
    const { data } = await api.get(`/schedule/events?${qs.toString()}`);
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

export default function DashboardCalendar() {
  const [items, setItems] = useState([]);
  const range = useMemo(() => {
    const now = new Date();
    const from = startOfDay(now);
    const to = endOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7));
    return { from, to };
  }, []);

  useEffect(() => {
    (async () => {
      const raw = await fetchEventsInRange(range.from, range.to);
      const norm = raw.map(e => ({
        ...e,
        start: new Date(e.start), end: new Date(e.end),
        color: e.color || hashColorFromId(e.employeeId),
        key: `${e.id}-${e.start}`,
      }));
      norm.sort((a,b)=> a.start - b.start);
      setItems(norm);
    })();
  }, [range]);

  return (
    <div className="dash-cal card">
      <div className="head">
        <div className="t">Önümüzdeki 7 Gün – Ziyaretler</div>
      </div>
      <div className="list">
        {items.length === 0 ? (
          <div className="empty">Planlı ziyaret yok.</div>
        ) : items.map(ev => (
          <div className="row" key={ev.key}>
            <div className="dot" style={{ background: ev.color }} />
            <div className="meta">
              <div className="title">{ev.title}</div>
              <div className="sub">
                {ev.storeName || "Mağaza"} · {ev.employeeName || "Personel"} ·
                {" "}
                {pad2(ev.start.getDate())}.{pad2(ev.start.getMonth()+1)} {pad2(ev.start.getHours())}:{pad2(ev.start.getMinutes())}
                {" – "}
                {pad2(ev.end.getHours())}:{pad2(ev.end.getMinutes())}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
