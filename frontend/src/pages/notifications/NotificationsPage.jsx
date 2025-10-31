// src/pages/notifications/NotificationsPage.jsx
import { useEffect, useRef, useState } from "react";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import "./NotificationsPage.scss";
import { useNavigate } from "react-router-dom";

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const role = (localStorage.getItem("role") || "").toLowerCase();
  const storeCache = useRef({}); // { [id]: name }

  const resolveStoreNameAdmin = async (id) => {
    if (storeCache.current[id]) return storeCache.current[id];
    try {
      const { data } = await api.get(`/stores/${id}`);
      const name = data?.name || data?.store?.name;
      if (name) storeCache.current[id] = name;
      return name || null;
    } catch {
      return null;
    }
  };

  const buildCustomerStoreMap = async () => {
    try {
      const { data } = await api.get("/feedback/customer/my-stores");
      const arr = Array.isArray(data) ? data : [];
      const map = {};
      for (const s of arr) map[String(s.id)] = s.name;
      return map;
    } catch {
      return {};
    }
  };

  // COMPLAINT_* bildirimlerini zenginleştir
  const normalizeRows = async (rows) => {
    let customerStoreMap = {};
    if (role === "customer") {
      customerStoreMap = await buildCustomerStoreMap();
    }

    const re = /\(Mağaza\s*#(\d+)\)/i;

    const out = [];
    for (const n of rows) {
      let _title = n.title;
      let _body = n.body;

      if ((n.type || "").startsWith("COMPLAINT_")) {
        // Başlığı "Şikayet" yap
        _title = "Şikayet";

        // Body içindeki (Mağaza #ID) → mağaza adı
        const m = typeof _body === "string" ? _body.match(re) : null;
        if (m) {
          const sid = m[1];
          let storeName =
            role === "customer" ? customerStoreMap[sid] : storeCache.current[sid];

          if (!storeName && role !== "customer") {
            storeName = await resolveStoreNameAdmin(sid);
          }

          if (storeName) {
            _body = _body.replace(re, `(${storeName})`);
          } else {
            // isim bulunamazsa en azından #id kısmını gizle
            _body = _body.replace(re, "").trim();
          }
        }
      }

      out.push({ ...n, _title, _body });
    }
    return out;
  };

  const fetchAll = async () => {
    try {
      const { data } = await api.get("/notifications");
      const rows = Array.isArray(data) ? data : [];
      const enriched = await normalizeRows(rows);
      setItems(enriched);
    } catch {}
  };

  useEffect(() => { fetchAll(); /* eslint-disable-next-line */ }, []);

  const markAll = async () => {
    try {
      setBusy(true);
      await api.post("/notifications/mark-all-read");
      await fetchAll();
    } catch {} finally { setBusy(false); }
  };

  const openItem = async (n) => {
    try {
      if (!n.isRead) await api.patch(`/notifications/${n.id}/read`);
    } catch {}
    if (n.link) navigate(n.link);
  };

  return (
    <Layout title="Bildirimler">
      <div className="notifications-page">
        <div className="head">
          <h1>Bildirimler</h1>
          <button onClick={markAll} disabled={busy}>Tümünü okundu işaretle</button>
        </div>

        <div className="list">
          {items.length === 0 && <div className="empty">Bildirim yok.</div>}

          {items.map((n) => (
            <div
              key={n.id}
              className={`notif-card ${n.isRead ? "read" : "unread"}`}
              onClick={() => openItem(n)}
            >
              <div className="row">
                <div className="type">{n.type}</div>
                <div className="time">{new Date(n.createdAt).toLocaleString("tr-TR")}</div>
              </div>
              <div className="title">{n._title ?? n.title}</div>
              { (n._body ?? n.body) && <div className="body">{n._body ?? n.body}</div> }
              { n.link && <div className="link">Git →</div> }
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
