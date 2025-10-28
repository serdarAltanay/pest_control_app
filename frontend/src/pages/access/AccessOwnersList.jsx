// src/pages/access/AccessOwnersList.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./Access.scss";

/** ---- Presence yardımcıları ---- */
const ONLINE_MS = 2 * 60 * 1000;  // 2 dk
const IDLE_MS   = 10 * 60 * 1000; // 10 dk

function getPresence(lastSeenAt) {
  if (!lastSeenAt) return { cls: "status-offline", label: "Offline" };
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  if (diff <= ONLINE_MS) return { cls: "status-online", label: "Online" };
  if (diff <= IDLE_MS)   return { cls: "status-idle",   label: "Idle" };
  return { cls: "status-offline", label: "Offline" };
}

function relTime(d) {
  if (!d) return "bilgi yok";
  const diff = Math.max(0, Date.now() - new Date(d).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 30) return "az önce";
  if (s < 60) return `${s} sn önce`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa önce`;
  const g = Math.floor(h / 24);
  if (g < 30) return `${g} gün önce`;
  const ay = Math.floor(g / 30);
  if (ay < 12) return `${ay} ay önce`;
  const y = Math.floor(ay / 12);
  return `${y} yıl önce`;
}

export default function AccessOwnersList() {
  const [grants, setGrants] = useState([]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");

  // presence (ownerId -> { lastSeenAt, isOnline })
  const [presenceMap, setPresenceMap] = useState(new Map());

  // Geçici şifre işlemleri
  const [issuingId, setIssuingId] = useState(null);          // işlem yapılan ownerId
  const [codes, setCodes] = useState(() => new Map());       // ownerId -> "123456"
  const [showMap, setShowMap] = useState(() => new Map());   // ownerId -> true/false (göster/gizle)

  /** Verileri yükle */
  const load = async () => {
    try {
      const [grantsRes, onlineRes] = await Promise.all([
        api.get("/access/grants"),
        api.get("/online/summary").catch(() => ({ data: null })),
      ]);

      const list = Array.isArray(grantsRes.data) ? grantsRes.data : [];
      setGrants(list);

      const map = new Map();
      const arr = onlineRes?.data?.accessOwners || [];
      arr.forEach((o) => {
        map.set(Number(o.id), { lastSeenAt: o.lastSeenAt || null, isOnline: !!o.isOnline });
      });
      setPresenceMap(map);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Erişim listesi alınamadı");
    }
  };

  useEffect(() => { load(); }, []);

  /** Owner bazında gruplama + arama/filtre + sıralama */
  const grouped = useMemo(() => {
    const m = new Map();
    grants.forEach(g => {
      const key = String(g.owner?.id ?? g.ownerId);
      if (!m.has(key)) m.set(key, { owner: g.owner, grants: [] });
      m.get(key).grants.push(g);
    });

    let arr = Array.from(m.values());

    if (role) arr = arr.filter(x => (x.owner?.role || "") === role);

    if (q.trim()) {
      const t = q.trim().toLowerCase();
      arr = arr.filter(x =>
        [x.owner?.firstName, x.owner?.lastName, x.owner?.email, x.owner?.role]
          .some(v => (v || "").toString().toLowerCase().includes(t))
      );
    }

    // Ad'a göre basit sıralama (adı yoksa soyad/e-posta fallbacks)
    return arr.sort((a, b) => {
      const an = ((a.owner?.firstName || "") + " " + (a.owner?.lastName || "")).trim() || (a.owner?.email || "");
      const bn = ((b.owner?.firstName || "") + " " + (b.owner?.lastName || "")).trim() || (b.owner?.email || "");
      return an.localeCompare(bn, "tr");
    });
  }, [grants, q, role]);

  const roles = useMemo(
    () => Array.from(new Set(grants.map(g => g.owner?.role).filter(Boolean))),
    [grants]
  );

  /** Geçici şifre üret + mail at + ekranda göster */
  const revealTempPassword = async (ownerId) => {
    try {
      setIssuingId(ownerId);
      const { data } = await api.post(`/access/owner/${ownerId}/reset-password`, {
        reveal: true,  // kodu yanıtta döndür
        notify: true,  // e-posta gönder
      });
      if (!data?.ok || !data?.code) {
        toast.error("Geçici şifre üretilemedi");
        return;
      }
      setCodes((m) => {
        const n = new Map(m);
        n.set(ownerId, data.code);
        return n;
      });
      setShowMap((m) => {
        const n = new Map(m);
        n.set(ownerId, true); // varsayılan açık göster
        return n;
      });
      toast.success("Geçici şifre oluşturuldu ve e-posta gönderildi.");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Şifre oluşturulamadı");
    } finally {
      setIssuingId(null);
    }
  };

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.info("Kopyalandı");
    } catch {
      // no-op
    }
  };

  return (
    <Layout>
      <div className="access-page">
        <div className="page-header">
          <h1>Erişim Sahipleri</h1>
          <div className="header-actions">
            <Link className="btn primary" to="/admin/access/new">+ Erişim Ver</Link>
          </div>
        </div>

        <div className="card">
          {/* Ara/Filtre */}
          <div className="toolbar" style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <div className="search" style={{ position: "relative", width: "min(420px, 100%)" }}>
              <input
                placeholder="Ara (ad / e-posta / rol)..."
                value={q}
                onChange={e => setQ(e.target.value)}
              />
              {q && (
                <button
                  className="clear"
                  onClick={() => setQ("")}
                  style={{ position: "absolute", right: 6, top: 6 }}
                >
                  ×
                </button>
              )}
            </div>
            <div className="filters">
              <select value={role} onChange={e => setRole(e.target.value)}>
                <option value="">Tümü</option>
                {roles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          {/* Liste */}
          {grouped.length === 0 ? (
            <div className="empty">Kayıt bulunamadı.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Durum</th>
                  <th>Kişi</th>
                  <th>Rol</th>
                  <th>Yetki Sayısı</th>
                  <th>Özet</th>
                  <th>Son Görülme</th>
                  <th>Geçici Şifre</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(({ owner, grants }) => {
                  const ownerId = Number(owner?.id);
                  const p = presenceMap.get(ownerId) || null;
                  const lastSeenAt = p?.lastSeenAt || null;
                  const status = getPresence(lastSeenAt);

                  const custCount  = grants.filter(g => g.scopeType === "CUSTOMER").length;
                  const storeCount = grants.filter(g => g.scopeType === "STORE").length;
                  const summary = `${custCount}× müşteri-genel / ${storeCount}× mağaza`;

                  const code = codes.get(ownerId) || null;
                  const isShown = showMap.get(ownerId) !== false;

                  const displayName = `${owner?.firstName || ""} ${owner?.lastName || ""}`.trim();

                  return (
                    <tr key={ownerId || Math.random()}>
                      <td
                        className={`presence ${status.cls}`}
                        title={lastSeenAt ? `Son görüldü: ${new Date(lastSeenAt).toLocaleString("tr-TR")}` : "bilgi yok"}
                      >
                        <span className="dot" />
                        <span className="presence-label">{status.label}</span>
                      </td>

                      <td className="strong">
                        {displayName || "—"}
                        {" "}
                        <span className="muted">({owner?.email || "—"})</span>
                      </td>

                      <td>{owner?.role || "—"}</td>
                      <td>{grants.length}</td>
                      <td>{summary}</td>
                      <td className="lastseen">{lastSeenAt ? relTime(lastSeenAt) : "—"}</td>

                      {/* Geçici Şifre sütunu */}
                      <td className="temp-pass-cell">
                        {code ? (
                          <div className="code-wrap">
                            <code className={`mono ${isShown ? "" : "blurred"}`}>
                              {isShown ? code : "••••••"}
                            </code>
                            <div className="code-actions">
                              <button
                                className="btn sm"
                                onClick={() =>
                                  setShowMap((m) => {
                                    const n = new Map(m);
                                    n.set(ownerId, !isShown);
                                    return n;
                                  })
                                }
                                title={isShown ? "Gizle" : "Göster"}
                              >
                                {isShown ? "Gizle" : "Göster"}
                              </button>
                              <button className="btn sm" onClick={() => copyCode(code)}>Kopyala</button>
                            </div>
                            <div className="muted tiny">Not: Bu kod yalnızca bu ekranda görünür.</div>
                          </div>
                        ) : (
                          <button
                            className="btn"
                            onClick={() => revealTempPassword(ownerId)}
                            disabled={issuingId === ownerId}
                            title="6 haneli geçici şifre üret, e-posta gönder ve ekranda göster"
                          >
                            {issuingId === ownerId ? "Oluşturuluyor..." : "Geçici Şifre"}
                          </button>
                        )}
                      </td>

                      <td className="actions">
                        <Link className="btn primary" to={`/admin/access/owner/${owner?.id}`}>+ Yetki / Detay</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
