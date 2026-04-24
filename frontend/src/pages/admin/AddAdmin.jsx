import api from "../../api/axios";
import Layout from "../../components/Layout";
import { toast } from "react-toastify";
import { useMemo, useState, useEffect } from "react";
import { getAvatarUrl } from "../../utils/getAssetUrl";
import useAuth from "../../hooks/useAuth";
import "./AddAdmin.scss";
import "../shared/ModalWithAvatar.scss";

function EditAdminModal({ admin, onClose, onChanged }) {
  const [fullName, setFullName] = useState(admin.fullName || "");
  const [password, setPassword] = useState("");
  const [avatarPath, setAvatarPath] = useState(admin?.profileImage ?? null);
  const [email, setEmail] = useState(admin?.email || "");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get(`/admin/${admin.id}`);
        if (!alive) return;
        setFullName(data.fullName || "");
        setEmail(data.email || "");
        setAvatarPath(data.profileImage || null);
      } catch {}
    })();
    return () => { alive = false; };
  }, [admin.id]);

  const img = useMemo(() => getAvatarUrl(avatarPath, { bust: true }), [avatarPath]);

  const handleRemoveAvatar = async () => {
    if (!window.confirm("Bu yöneticinin profil fotoğrafını kaldırmak istiyor musunuz?")) return;
    try {
      await api.delete("/upload/avatar", { data: { role: "admin", id: admin.id } });
      setAvatarPath(null);
      toast.success("Avatar kaldırıldı");
      onChanged?.();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Kaldırılamadı");
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/admin/${admin.id}`, {
        fullName,
        password: password || undefined,
      });
      toast.success("Yönetici güncellendi");
      onChanged?.();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Güncellenemedi");
    }
  };

  return (
    <div className="mwav-backdrop" onClick={(e)=>e.target.classList.contains("mwav-backdrop") && onClose()}>
      <div className="mwav-modal">
        <div className="mwav-header">
          <h3>Yönetici Güncelle</h3>
          <button className="mwav-close" onClick={onClose}>×</button>
        </div>

        <form className="mwav-body" onSubmit={handleSave}>
          <div className="mwav-form">
            <label>Ad Soyad *</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />

            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              E-posta
              <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400, background: "#f1f5f9", padding: "2px 8px", borderRadius: 12 }}>
                değiştirilemez
              </span>
            </label>
            <input
              type="email"
              value={email}
              readOnly
              disabled
              style={{ background: "#f8fafc", color: "#94a3b8", cursor: "not-allowed" }}
              title="E-posta adresi sistem tarafından belirlenir ve değiştirilemez"
            />

            <label>Parola (opsiyonel)</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Boş bırakırsan değişmez" />
          </div>

          <aside className="mwav-aside">
            <img src={img} alt="avatar" onError={(e) => { e.currentTarget.src = "/noavatar.jpg"; }} />
            <button type="button" className="mwav-danger" onClick={handleRemoveAvatar}>Profil Fotoğrafını Kaldır</button>
          </aside>
        </form>

        <div className="mwav-footer">
          <button className="mwav-primary" onClick={handleSave}>Kaydet</button>
          <button className="mwav-ghost" onClick={onClose}>Kapat</button>
        </div>
      </div>
    </div>
  );
}

/* ── Şifreli Silme Onay Modal'ı ─────────────────────────────── */
function DeleteConfirmModal({ targetAdmin, onClose, onConfirmed }) {
  const [pwd, setPwd]       = useState("");
  const [loading, setLoading] = useState(false);
  const [pwdVisible, setPwdVisible] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!pwd.trim()) return;
    setLoading(true);
    try {
      await onConfirmed(pwd);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="del-confirm-backdrop"
      onClick={(e) => e.target.classList.contains("del-confirm-backdrop") && !loading && onClose()}
    >
      <div className="del-confirm-modal">
        {/* Başlık */}
        <div className="del-confirm-header">
          <span className="del-confirm-icon">⚠️</span>
          <div>
            <h3>Yönetici Silme Onayı</h3>
            <p>Bu işlem <strong>geri alınamaz</strong>.</p>
          </div>
          <button className="del-confirm-close" onClick={onClose} disabled={loading}>×</button>
        </div>

        {/* Hedef admin */}
        <div className="del-confirm-target">
          <span className="del-confirm-avatar">
            {(targetAdmin.fullName || "?").split(" ").filter(Boolean).slice(0,2).map(w => w[0]).join("").toUpperCase()}
          </span>
          <div>
            <div className="del-confirm-name">{targetAdmin.fullName}</div>
            <div className="del-confirm-email">{targetAdmin.email}</div>
          </div>
        </div>

        {/* Onay formu */}
        <form className="del-confirm-form" onSubmit={handleSubmit}>
          {/* Statik onay metni */}
          <div className="del-confirm-phrase-wrap">
            <p className="del-confirm-phrase-label">Bu işlemi onaylamak için aşağıdaki metni okuyun:</p>
            <div className="del-confirm-phrase">
              "<strong>{targetAdmin.fullName}</strong> isimli admini sistemden silmek istiyorum"
            </div>
          </div>

          {/* Şifre alanı */}
          <label className="del-confirm-label">Kendi şifrenizi girerek onaylayın</label>
          <div className="del-confirm-pwd-wrap">
            <input
              type={pwdVisible ? "text" : "password"}
              className="del-confirm-pwd-input"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="Şifreniz..."
              autoFocus
              disabled={loading}
              required
            />
            <button
              type="button"
              className="del-confirm-eye"
              onClick={() => setPwdVisible(v => !v)}
              tabIndex={-1}
            >
              {pwdVisible ? "🙈" : "👁"}
            </button>
          </div>

          {/* Aksiyonlar */}
          <div className="del-confirm-actions">
            <button
              type="button"
              className="del-confirm-btn del-confirm-cancel"
              onClick={onClose}
              disabled={loading}
            >
              İptal
            </button>
            <button
              type="submit"
              className="del-confirm-btn del-confirm-delete"
              disabled={loading || !pwd.trim()}
            >
              {loading ? "Siliniyor…" : "Evet, Sil"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AddAdmin() {
  const { user } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");

  const [admins, setAdmins]     = useState([]);
  const [loading, setLoading]   = useState(false);
  const [editing, setEditing]   = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // { id, fullName, email }

  // presence (adminId -> lastSeenAt) + reltime ticker
  const [presenceMap, setPresenceMap] = useState(new Map());
  const [, setTick] = useState(0);

  // presence helpers
  const ONLINE_MS = 2 * 60 * 1000;
  const IDLE_MS   = 10 * 60 * 1000;
  const getPresence = (lastSeenAt) => {
    if (!lastSeenAt) return { cls: "status-offline", label: "Offline" };
    const diff = Date.now() - new Date(lastSeenAt).getTime();
    if (diff <= ONLINE_MS) return { cls: "status-online", label: "Online" };
    if (diff <= IDLE_MS)   return { cls: "status-idle", label: "Idle" };
    return { cls: "status-offline", label: "Offline" };
  };
  const relTime = (d) => {
    if (!d) return "—";
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
  };
  const fmt = (v) => (v ? new Date(v).toLocaleString("tr-TR") : "—");

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const [listRes, onlineRes] = await Promise.all([
        api.get("/admin/admins"),
        api.get("/online/summary").catch(() => ({ data: null })), // admin yetkisi yoksa sorun etme
      ]);
      const list = Array.isArray(listRes.data) ? listRes.data : [];
      setAdmins(list);

      const map = new Map();
      (onlineRes?.data?.admins || []).forEach(u => {
        map.set(Number(u.id), u.lastSeenAt || null);
      });
      setPresenceMap(map);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Yöneticiler alınamadı");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAdmins(); }, []);
  // her 30 sn’de bir re-render ki relTime güncellensin
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/create", { fullName, email, password });
      toast.success("Yönetici eklendi — giriş bilgileri e-posta ile gönderildi 📧");
      setFullName(""); setEmail(""); setPassword("");
      fetchAdmins();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Hata");
    }
  };

  const handleDelete = (id) => {
    if (id === user?.id) {
      toast.error("Kendinizi silemezsiniz.");
      return;
    }
    const target = admins.find(a => a.id === id);
    if (target) setDeleteTarget(target);
  };

  const handleDeleteConfirmed = async (pwd) => {
    try {
      await api.delete(`/admin/${deleteTarget.id}`, { data: { password: pwd } });
      toast.success(`"${deleteTarget.fullName}" sistemden silindi.`);
      setDeleteTarget(null);
      fetchAdmins();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Silinemedi");
    }
  };

  return (
    <Layout>
      <div className="add-user-page">
        <h2>Yönetici Yönetimi</h2>
        <p className="page-desc" style={{ color: "#64748b", marginBottom: 20, fontSize: 14 }}>
          Yeni yönetici ekleyebilir ya da mevcut yöneticileri düzenleyip silebilirsiniz.
          Eklenen yöneticiye giriş bilgileri <strong>otomatik olarak e-posta ile gönderilir</strong>.
          Şifreler sisteme kaydedilmez.
        </p>

        <form className="panel" onSubmit={submit}>
          <div className="row">
            <div><label>Ad Soyad *</label><input value={fullName} onChange={(e) => setFullName(e.target.value)} required /></div>
            <div><label>E-posta *</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
            <div><label>Parola *</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          </div>
          <button className="primary">Yönetici Ekle</button>
        </form>

        <div className={`admins-list${loading ? " is-loading" : ""}`}>
          <div className="list-header">
            <h3>Mevcut Yöneticiler</h3>
            <div className="actions">
              <button className="btn" onClick={fetchAdmins} disabled={loading}>
                {loading ? "Yükleniyor..." : "Yenile"}
              </button>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="admins-table">
              <thead>
                <tr>
                  <th>Durum</th>
                  <th>Ad Soyad</th>
                  <th>E-posta</th>
                  <th>Son Giriş</th>
                  <th>Son Görülme</th>
                  <th>Son Güncelleme</th>
                  <th>Eklenme</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {admins.length === 0 && !loading ? (
                  <tr className="empty-row"><td colSpan={8}>Kayıt bulunamadı</td></tr>
                ) : (
                  admins.map((a) => {
                    const lastSeen = presenceMap.get(a.id) ?? a.lastSeenAt ?? null;
                    const p = getPresence(lastSeen);
                    const initials = (a.fullName || "")
                      .split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();

                    return (
                      <tr key={a.id}>
                        <td className={`presence ${p.cls}`} title={lastSeen ? fmt(lastSeen) : "—"}>
                          <span className="dot" />
                          <span className="presence-label">{p.label}</span>
                        </td>
                        <td>
                          <div className="name">
                            <span className="avatar">{initials || "AD"}</span>
                            <span>{a.fullName || "—"}</span>
                          </div>
                        </td>
                        <td className="muted">{a.email || "—"}</td>
                        <td>{fmt(a.lastLoginAt)}</td>
                        <td>{lastSeen ? relTime(lastSeen) : "—"}</td>
                        <td>{fmt(a.updatedAt)}</td>
                        <td>{fmt(a.createdAt)}</td>
                        <td className="actions">
                          <button className="btn btn-edit" onClick={() => setEditing(a)}>Düzenle</button>
                          <button
                            className="btn btn-delete"
                            onClick={() => handleDelete(a.id)}
                            disabled={a.id === user?.id}
                            title={a.id === user?.id ? "Kendinizi silemezsiniz" : "Bu yöneticiyi sil"}
                            style={a.id === user?.id ? { opacity: 0.4, cursor: "not-allowed" } : {}}
                          >
                            Sil
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {editing && (
          <EditAdminModal admin={editing} onClose={() => setEditing(null)} onChanged={fetchAdmins} />
        )}
        {deleteTarget && (
          <DeleteConfirmModal
            targetAdmin={deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onConfirmed={handleDeleteConfirmed}
          />
        )}
      </div>
    </Layout>
  );
}
