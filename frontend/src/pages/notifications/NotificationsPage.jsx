// src/pages/notifications/NotificationsPage.jsx
import { useEffect, useRef, useState } from "react";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import "./NotificationsPage.scss";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState({}); // { [id]: true }
  const navigate = useNavigate();
  const role = (localStorage.getItem("role") || "").toLowerCase();
  const storeCache = useRef({});

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
        _title = "Şikayet";
        const m = typeof _body === "string" ? _body.match(re) : null;
        if (m) {
          const sid = m[1];
          let storeName =
            role === "customer" ? customerStoreMap[sid] : storeCache.current[sid];
          if (!storeName && role !== "customer") {
            storeName = await resolveStoreNameAdmin(sid);
          }
          _body = storeName
            ? _body.replace(re, `(${storeName})`)
            : _body.replace(re, "").trim();
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchAll(); }, []);

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

  const withBusy = (id, fn) => async (e) => {
    e.stopPropagation();
    if (actionBusy[id]) return;
    setActionBusy((p) => ({ ...p, [id]: true }));
    try { await fn(); } finally {
      setActionBusy((p) => ({ ...p, [id]: false }));
    }
  };

  const markRead = (n) => withBusy(n.id, async () => {
    await api.patch(`/notifications/${n.id}/read`);
    setItems((prev) => prev.map((x) => x.id === n.id ? { ...x, isRead: true } : x));
    toast.success("Okundu olarak işaretlendi");
  });

  const markUnread = (n) => withBusy(n.id, async () => {
    await api.patch(`/notifications/${n.id}/unread`);
    setItems((prev) => prev.map((x) => x.id === n.id ? { ...x, isRead: false } : x));
    toast.info("Okunmadı olarak işaretlendi");
  });

  const deleteNotif = (n) => withBusy(n.id, async () => {
    await api.delete(`/notifications/${n.id}`);
    setItems((prev) => prev.filter((x) => x.id !== n.id));
    toast.success("Bildirim silindi");
  });

  const TYPE_LABELS = {
    COMPLAINT_NEW: "Şikayet",
    COMPLAINT_REPLY: "Şikayet Yanıtı",
    VISIT_SCHEDULED: "Ziyaret",
    VISIT_COMPLETED: "Ziyaret Tamamlandı",
    EK1_SIGNED: "EK-1 İmzalandı",
    FEEDBACK: "Geri Bildirim",
  };

  return (
    <Layout title="Bildirimler">
      <div className="notifications-page">
        <div className="head">
          <h1>Bildirimler</h1>
          <div className="head-actions">
            <span className="count-badge">{items.length} bildirim</span>
            <button className="btn-mark-all" onClick={markAll} disabled={busy}>
              {busy ? "İşleniyor…" : "Tümünü okundu işaretle"}
            </button>
          </div>
        </div>

        <div className="list">
          {items.length === 0 && (
            <div className="empty">
              <span className="empty-icon">🔔</span>
              <p>Bildirim yok.</p>
            </div>
          )}

          {items.map((n) => (
            <div
              key={n.id}
              className={`notif-card ${n.isRead ? "read" : "unread"}`}
              onClick={() => openItem(n)}
            >
              {/* Sol – içerik */}
              <div className="notif-body">
                <div className="notif-meta">
                  <span className="notif-type">
                    {TYPE_LABELS[n.type] ?? n.type}
                  </span>
                  {!n.isRead && <span className="unread-dot" />}
                  <span className="notif-time">
                    {new Date(n.createdAt).toLocaleString("tr-TR")}
                  </span>
                </div>
                <div className="notif-title">{n._title ?? n.title}</div>
                {(n._body ?? n.body) && (
                  <div className="notif-text">{n._body ?? n.body}</div>
                )}
                {n.link && <div className="notif-link">Git →</div>}
              </div>

              {/* Sağ – aksiyonlar */}
              <div className="notif-actions" onClick={(e) => e.stopPropagation()}>
                {n.isRead ? (
                  <button
                    className="action-btn unread-btn"
                    title="Okunmadı olarak işaretle"
                    disabled={actionBusy[n.id]}
                    onClick={markUnread(n)}
                  >
                    <span className="action-icon">↩</span>
                    <span className="action-label">Okunmadı</span>
                  </button>
                ) : (
                  <button
                    className="action-btn read-btn"
                    title="Okundu olarak işaretle"
                    disabled={actionBusy[n.id]}
                    onClick={markRead(n)}
                  >
                    <span className="action-icon">✓</span>
                    <span className="action-label">Okundu</span>
                  </button>
                )}
                <button
                  className="action-btn delete-btn"
                  title="Bildirimi sil"
                  disabled={actionBusy[n.id]}
                  onClick={deleteNotif(n)}
                >
                  <span className="action-icon">🗑</span>
                  <span className="action-label">Sil</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
