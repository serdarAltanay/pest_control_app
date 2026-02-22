import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import "../styles/NotificationBell.scss";

const PREVIEW_LIMIT = 5;
// Personel tarafından GÖRÜNMEYECEK bildirim tipleri
const EMPLOYEE_BLOCKED_TYPES = new Set([
  "COMPLAINT_NEW",
  "COMPLAINT_SEEN",
  "SUGGESTION_NEW",
]);

// Tip etiketlerini biraz daha okunur göstermek istersen:
const TYPE_TR = {
  COMPLAINT_NEW: "Şikâyet",
  COMPLAINT_SEEN: "Şikâyet (Görüldü)",
  SUGGESTION_NEW: "Öneri",
  VISIT_PLANNED: "Ziyaret Planı",
  VISIT_ASSIGNED: "Ziyaret Ataması",
  EK1_SUBMITTED: "EK-1 Formu",
};

export default function NotificationBell() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState([]);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [total, setTotal] = useState(0);

  const wrapRef = useRef(null);
  const hoverTimer = useRef(null);
  const navigate = useNavigate();

  const role = (localStorage.getItem("role") || "").toLowerCase();

  const fetchCount = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/notifications/unread-count");
      let c = Number(data?.count || 0);

      // Emniyet: Backend zaten filtreliyor ama yine de "employee" isek
      // bloklu tiplerden gelen varsa sayıyı küçültmeye çalış.
      if (role === "employee" && Array.isArray(preview) && preview.length) {
        const blockedUnread = preview.filter(
          (n) => !n.isRead && EMPLOYEE_BLOCKED_TYPES.has(n.type)
        ).length;
        c = Math.max(0, c - blockedUnread);
      }

      setCount(c);
    } catch {
      // sessiz geç
    } finally {
      setLoading(false);
    }
  };

  const fetchPreview = async () => {
    try {
      setPreviewBusy(true);
      const { data } = await api.get("/notifications");
      let list = Array.isArray(data) ? data : [];

      // Personel için FE tarafında da filtrele
      if (role === "employee") {
        list = list.filter((n) => !EMPLOYEE_BLOCKED_TYPES.has(n.type));
      }

      setTotal(list.length);
      setPreview(list.slice(0, PREVIEW_LIMIT));
    } catch {
      setPreview([]);
      setTotal(0);
    } finally {
      setPreviewBusy(false);
    }
  };

  useEffect(() => {
    fetchCount();
    const id = setInterval(fetchCount, 30000); // 30 sn’de bir yenile
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // Hover ile aç/kapa
  const handleEnter = () => {
    clearTimeout(hoverTimer.current);
    setOpen(true);
    fetchPreview(); // her açılışta tazele
  };
  const handleLeave = () => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setOpen(false), 120);
  };

  // Item tıklama → okundu işaretle + linke git
  const openItem = async (n) => {
    try {
      // Emniyet: employee ise bloklu tipleri hiç işlem alma
      if (role === "employee" && EMPLOYEE_BLOCKED_TYPES.has(n.type)) {
        return;
      }

      if (!n.isRead) {
        await api.patch(`/notifications/${n.id}/read`);
        // UI’yı canlı güncelle
        setPreview((arr) =>
          arr.map((x) => (x.id === n.id ? { ...x, isRead: true } : x))
        );
        setCount((c) => (c > 0 ? c - 1 : 0));
      }
    } catch {
      // görmezden gel
    }

    if (n.link) {
      setOpen(false);
      navigate(n.link);
    }
  };

  const goAll = () => {
    setOpen(false);
    navigate("/notifications");
  };

  const extra = Math.max(total - PREVIEW_LIMIT, 0);

  return (
    <div
      className="notif-bell-wrap"
      ref={wrapRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        className="notif-bell"
        onClick={() => {
          // mobil/klavye için click de açsın
          const next = !open;
          setOpen(next);
          if (next) fetchPreview();
        }}
        title="Bildirimler"
        aria-haspopup="menu"
        aria-expanded={open ? "true" : "false"}
      >
        <span className="icon" aria-hidden>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12 22a2 2 0 002-2h-4a2 2 0 002 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4a1.5 1.5 0 00-3 0v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" />
          </svg>
        </span>
        {!loading && count > 0 && <span className="badge">{count}</span>}
      </button>

      <div className={`notif-popover ${open ? "open" : ""}`} role="menu">
        <div className="np-head">
          <div className="np-title">Bildirimler</div>
          <button className="np-all" onClick={goAll}>
            Tümü
          </button>
        </div>

        <div className="np-list" aria-busy={previewBusy ? "true" : "false"}>
          {previewBusy && <div className="np-empty">Yükleniyor…</div>}

          {!previewBusy && preview.length === 0 && (
            <div className="np-empty">Bildirim yok.</div>
          )}

          {!previewBusy &&
            preview.map((n) => (
              <div
                key={n.id}
                className={`np-item ${n.isRead ? "read" : "unread"}`}
                onClick={() => openItem(n)}
                role="menuitem"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") openItem(n);
                }}
              >
                <div className="np-row">
                  <span className="np-type">{TYPE_TR[n.type] || n.type}</span>
                  <span className="np-time">
                    {new Date(n.createdAt).toLocaleString("tr-TR")}
                  </span>
                </div>
                <div className="np-titleline">{n.title}</div>
                {n.body && <div className="np-body">{n.body}</div>}
              </div>
            ))}

          {!previewBusy && extra > 0 && (
            <button className="np-more" onClick={goAll}>
              +{extra} daha
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
