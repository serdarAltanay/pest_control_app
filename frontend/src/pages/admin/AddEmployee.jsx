import { useEffect, useState } from "react";
import api from "../../api/axios";
import Layout from "../../components/Layout";
import { toast } from "react-toastify";
import { getAvatarUrl } from "../../utils/getAssetUrl";
import "./AddEmployee.scss";
import "../shared/ModalWithAvatar.scss";

function EditEmployeeModal({ employee, onClose, onChanged }) {
  const [fullName, setFullName] = useState(employee.fullName || "");
  const [jobTitle, setJobTitle] = useState(employee.jobTitle || "");
  const [gsm, setGsm]           = useState(employee.gsm || "");
  const [email, setEmail]       = useState(employee.email || "");
  const [password, setPassword] = useState("");

  const img = getAvatarUrl(employee?.profileImage);

  const handleRemoveAvatar = async () => {
    if (!window.confirm("Bu personelin profil fotoğrafını kaldırmak istiyor musunuz?")) return;
    try {
      await api.delete(`/upload/avatar/employee/${employee.id}`);
      toast.success("Avatar kaldırıldı");
      onChanged?.();
    } catch (err) {
      toast.error(err?.response?.data?.error || "Kaldırılamadı");
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      await api.put(`/employees/${employee.id}`, {
        fullName, jobTitle, gsm, email,
        password: password || undefined,
      });
      toast.success("Personel güncellendi");
      onChanged?.();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Güncellenemedi");
    }
  };

  return (
    <div className="mwav-backdrop" onClick={(e)=> e.target.classList.contains("mwav-backdrop") && onClose()}>
      <div className="mwav-modal">
        <div className="mwav-header">
          <h3>Personel Güncelle</h3>
          <button className="mwav-close" onClick={onClose}>×</button>
        </div>

        <form className="mwav-body" onSubmit={handleSave}>
          <div className="mwav-form">
            <label>Ad Soyad *</label>
            <input value={fullName} onChange={(e)=>setFullName(e.target.value)} required/>

            <label>Görevi *</label>
            <input value={jobTitle} onChange={(e)=>setJobTitle(e.target.value)} required/>

            <label>GSM *</label>
            <input value={gsm} onChange={(e)=>setGsm(e.target.value)} required/>

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

export default function AddEmployee() {
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [gsm, setGsm]           = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [adminId, setAdminId]   = useState("");

  const [admins, setAdmins]       = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [editing, setEditing]     = useState(null);

  const fmt = (v)=> v ? new Date(v).toLocaleString("tr-TR") : "—";
  const ONLINE_MS = 2 * 60 * 1000, IDLE_MS = 10 * 60 * 1000;
  const presence = (t)=> {
    if (!t) return { cls:"status-offline", label:"Offline" };
    const d = Date.now()-new Date(t).getTime();
    if (d<=ONLINE_MS) return { cls:"status-online", label:"Online" };
    if (d<=IDLE_MS)   return { cls:"status-idle",   label:"Idle" };
    return { cls:"status-offline", label:"Offline" };
  };

  const fetchAll = async () => {
    try {
      setLoading(true);
      const adm = await api.get("/admin/admins");
      setAdmins(adm.data || []);
      const emp = await api.get("/employees");
      setEmployees(emp.data || []);
    } catch (e) {
      toast.error("Veriler alınamadı");
    } finally { setLoading(false); }
  };

  useEffect(()=>{ fetchAll(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/employees/create", {
        fullName, jobTitle, gsm, email, password,
        adminId: adminId ? Number(adminId) : undefined,
      });
      toast.success("Personel eklendi");
      setFullName(""); setJobTitle(""); setGsm(""); setEmail(""); setPassword(""); setAdminId("");
      fetchAll();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Hata");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Bu personeli silmek istiyor musunuz?")) return;
    try {
      await api.delete(`/employees/${id}`);
      toast.success("Personel silindi");
      fetchAll();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Silinemedi");
    }
  };

  return (
    <Layout>
      <div className="add-user-page">
        <h2>Personel Ekle</h2>

        <form className="panel" onSubmit={submit}>
          <div className="grid3">
            <div><label>Ad Soyad *</label><input value={fullName} onChange={(e)=>setFullName(e.target.value)} required/></div>
            <div><label>Görevi *</label><input value={jobTitle} onChange={(e)=>setJobTitle(e.target.value)} required/></div>
            <div><label>GSM *</label><input value={gsm} onChange={(e)=>setGsm(e.target.value)} required/></div>
            <div><label>Parola *</label><input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required/></div>
            <div><label>E-posta *</label><input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required/></div>
            <div>
              <label>Bağlı Admin</label>
              <select value={adminId} onChange={(e)=>setAdminId(e.target.value)}>
                <option value="">Seçiniz</option>
                {admins.map(a=> <option key={a.id} value={a.id}>{a.fullName} ({a.email})</option>)}
              </select>
            </div>
          </div>
          <button className="primary">Personel Ekle</button>
        </form>

        <div className="employees-list">
          <div className="list-header">
            <h3>Mevcut Personeller</h3>
            <button type="button" onClick={fetchAll} disabled={loading}>{loading ? "Yükleniyor..." : "Yenile"}</button>
          </div>

          <div className="table-wrapper">
            <table className="employees-table">
              <thead>
                <tr>
                  <th>Durum</th><th>Ad Soyad</th><th>E-posta</th><th>Görevi</th>
                  <th>Son Görülme</th><th>Son Giriş</th><th>Eklenme</th><th>Son Güncelleme</th><th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {employees.length===0 && !loading ? (
                  <tr><td colSpan={9} style={{textAlign:"center"}}>Kayıt bulunamadı</td></tr>
                ) : employees.map(emp=>{
                  const p = presence(emp.lastSeenAt);
                  const initials = (emp.fullName||"").split(" ").filter(Boolean).slice(0,2).map(w=>w[0]).join("").toUpperCase();
                  return (
                    <tr key={emp.id}>
                      <td className={`presence ${p.cls}`}><span className="dot"/><span className="presence-label">{p.label}</span></td>
                      <td><div className="name"><span className="avatar">{initials||"PE"}</span><span className="full">{emp.fullName||"—"}</span></div></td>
                      <td>{emp.email||"—"}</td>
                      <td>{emp.jobTitle||"—"}</td>
                      <td>{emp.lastSeenAt ? new Date(emp.lastSeenAt).toLocaleString("tr-TR") : "—"}</td>
                      <td>{fmt(emp.lastLoginAt)}</td>
                      <td>{fmt(emp.createdAt)}</td>
                      <td>{fmt(emp.updatedAt)}</td>
                      <td className="actions">
                        <button className="btn btn-edit" onClick={()=>setEditing(emp)}>Düzenle</button>
                        <button className="btn btn-delete" onClick={()=>handleDelete(emp.id)}>Sil</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {editing && (
          <EditEmployeeModal
            employee={editing}
            onClose={()=>setEditing(null)}
            onChanged={fetchAll}
          />
        )}
      </div>
    </Layout>
  );
}
