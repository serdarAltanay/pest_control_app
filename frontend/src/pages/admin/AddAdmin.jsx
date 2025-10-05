import { useEffect, useState } from "react";
import api from "../../api/axios";
import Layout from "../../components/Layout";
import { toast } from "react-toastify";
import "./AddAdmin.scss";
import "../shared/ModalWithAvatar.scss";



function EditAdminModal({ admin, onClose, onChanged }) {
  const [fullName, setFullName] = useState(admin.fullName || "");
  const [email, setEmail] = useState(admin.email || "");
  const [password, setPassword] = useState("");

  const img = admin.profileImage || "/noavatar.jpg";

  const handleRemoveAvatar = async () => {
    if (!window.confirm("Bu yöneticinin profil fotoğrafını kaldırmak istiyor musunuz?")) return;
    try {
      await api.delete(`/upload/avatar/admin/${admin.id}`);
      toast.success("Avatar kaldırıldı");
      onChanged?.(); // listeyi yenile
    } catch (err) {
      toast.error(err?.response?.data?.error || "Kaldırılamadı");
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/admin/${admin.id}`, {
        fullName,
        email,
        password: password || undefined, // boşsa dokunma
      });
      toast.success("Yönetici güncellendi");
      onChanged?.();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Güncellenemedi");
    }
  };

  return (
    <div className="mwav-backdrop" onClick={(e) => e.target.classList.contains("mwav-backdrop") && onClose()}>
      <div className="mwav-modal">
        <div className="mwav-header">
          <h3>Yönetici Güncelle</h3>
          <button className="mwav-close" onClick={onClose}>×</button>
        </div>

        <form className="mwav-body" onSubmit={handleSave}>
          <div className="mwav-form">
            <label>Ad Soyad *</label>
            <input value={fullName} onChange={(e)=>setFullName(e.target.value)} required/>

            <label>E-posta *</label>
            <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required/>

            <label>Parola (opsiyonel)</label>
            <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Boş bırakırsan değişmez"/>
          </div>

          <aside className="mwav-aside">
            <img src={img} alt="avatar" />
            <button type="button" className="mwav-danger" onClick={handleRemoveAvatar}>
              Profil Fotoğrafını Kaldır
            </button>
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

export default function AddAdmin() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");

  const [admins, setAdmins]   = useState([]);
  const [loading, setLoading] = useState(false);

  const [editing, setEditing] = useState(null); // seçili admin

  const ONLINE_MS = 2 * 60 * 1000;
  const IDLE_MS   = 10 * 60 * 1000;

  const getPresence = (lastSeenAt) => {
    if (!lastSeenAt) return { cls: "status-offline", label: "Offline" };
    const diff = Date.now() - new Date(lastSeenAt).getTime();
    if (diff <= ONLINE_MS) return { cls: "status-online", label: "Online" };
    if (diff <= IDLE_MS)   return { cls: "status-idle",   label: "Idle" };
    return { cls: "status-offline", label: "Offline" };
  };
  const fmt = (v)=> v ? new Date(v).toLocaleString("tr-TR") : "—";

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/admin/admins");
      setAdmins(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Yöneticiler alınamadı");
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=>{ fetchAdmins(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/create", { fullName, email, password });
      toast.success("Yönetici eklendi");
      setFullName(""); setEmail(""); setPassword("");
      fetchAdmins();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Hata");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Bu yöneticiyi silmek istiyor musunuz?")) return;
    try {
      await api.delete(`/admin/${id}`);
      toast.success("Yönetici silindi");
      fetchAdmins();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Silinemedi");
    }
  };

  return (
    <Layout>
      <div className="add-user-page">
        <h2>Yönetici Ekle</h2>

        <form className="panel" onSubmit={submit}>
          <div className="row">
            <div>
              <label>Ad Soyad *</label>
              <input value={fullName} onChange={(e)=>setFullName(e.target.value)} required/>
            </div>
            <div>
              <label>E-posta *</label>
              <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required/>
            </div>
            <div>
              <label>Parola *</label>
              <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required/>
            </div>
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
                ) : admins.map((a)=> {
                  const p = getPresence(a.lastSeenAt);
                  const initials = (a.fullName||"").split(" ").filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase();
                  return (
                    <tr key={a.id}>
                      <td className={`presence ${p.cls}`}><span className="dot"/><span className="presence-label">{p.label}</span></td>
                      <td><div className="name"><span className="avatar">{initials||"AD"}</span><span>{a.fullName||"—"}</span></div></td>
                      <td className="muted">{a.email||"—"}</td>
                      <td>{fmt(a.lastLoginAt)}</td>
                      <td>{fmt(a.lastSeenAt)}</td>
                      <td>{fmt(a.updatedAt)}</td>
                      <td>{fmt(a.createdAt)}</td>
                      <td className="actions">
                        <button className="btn btn-edit" onClick={()=>setEditing(a)}>✏️</button>
                        <button className="btn btn-delete" onClick={()=>handleDelete(a.id)}>🗑️</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {editing && (
          <EditAdminModal
            admin={editing}
            onClose={()=>setEditing(null)}
            onChanged={fetchAdmins}
          />
        )}
      </div>
    </Layout>
  );
}
