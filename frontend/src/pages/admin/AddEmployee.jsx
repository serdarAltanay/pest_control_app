import { useEffect, useState } from "react";
import api from "../../api/axios";
import Layout from "../../components/Layout";
import { toast } from "react-toastify";
import "./AddEmployee.scss";

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

  const fmt = (val) => {
    if (!val) return "—";
    try { return new Date(val).toLocaleString("tr-TR"); }
    catch { return String(val); }
  };

  // ---- Presence helpers ----
  const ONLINE_MS = 2 * 60 * 1000;   // 0–2 dk -> online
  const IDLE_MS   = 10 * 60 * 1000;  // 2–10 dk -> idle, >10 dk -> offline

  const getPresence = (lastSeenAt) => {
    if (!lastSeenAt) return { cls: "status-offline", label: "Offline" };
    const diff = Date.now() - new Date(lastSeenAt).getTime();
    if (diff <= ONLINE_MS) return { cls: "status-online", label: "Online" };
    if (diff <= IDLE_MS)   return { cls: "status-idle",   label: "Idle" };
    return { cls: "status-offline", label: "Offline" };
  };

  const relTime = (d) => {
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
  };
  // -----------------------------------------------------------

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/employees");
      setEmployees(data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Personeller alınamadı");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/admin/admins");
        setAdmins(res.data || []);
      } catch {}
      fetchEmployees();
    })();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/employees/create", {
        fullName,
        jobTitle,
        gsm,
        email,
        password,
        adminId: adminId ? Number(adminId) : undefined,
      });
      toast.success("Personel eklendi");
      setFullName(""); setJobTitle(""); setGsm(""); setEmail(""); setPassword(""); setAdminId("");
      fetchEmployees(); // eklemeden sonra tabloyu yenile
    } catch (err) {
      toast.error(err.response?.data?.message || "Hata");
    }
  };

  return (
    <Layout>
      <div className="add-user-page">
        <h2>Personel Ekle</h2>

        <form className="panel" onSubmit={submit}>
          <div className="grid3">
            <div>
              <label>Personel Adı Soyadı *</label>
              <input value={fullName} onChange={(e)=>setFullName(e.target.value)} required/>
            </div>
            <div>
              <label>Görevi *</label>
              <input value={jobTitle} onChange={(e)=>setJobTitle(e.target.value)} required/>
            </div>
            <div>
              <label>GSM *</label>
              <input value={gsm} onChange={(e)=>setGsm(e.target.value)} required/>
            </div>
            <div>
              <label>Parola *</label>
              <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required/>
            </div>
            <div>
              <label>E-Mail *</label>
              <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required/>
            </div>
            <div>
              <label>Bağlı Admin</label>
              <select value={adminId} onChange={(e)=>setAdminId(e.target.value)}>
                <option value="">Seçiniz</option>
                {admins.map(a => (
                  <option key={a.id} value={a.id}>{a.fullName} ({a.email})</option>
                ))}
              </select>
            </div>
          </div>

          <button className="primary">Personel Ekle</button>
        </form>

        {/* --- Personeller Listesi --- */}
        <div className="employees-list">
          <div className="list-header">
            <h3>Mevcut Personeller</h3>
            <button type="button" onClick={fetchEmployees} disabled={loading}>
              {loading ? "Yükleniyor..." : "Yenile"}
            </button>
          </div>

          <div className="table-wrapper">
            <table className="employees-table">
              <thead>
                <tr>
                  <th>Durum</th>
                  <th>Ad Soyad</th>
                  <th>E-posta</th>
                  <th>Görevi</th>
                  <th>Son Görülme</th>
                  <th>Son Giriş</th>
                  <th>Eklenme</th>
                  <th>Son Güncelleme</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign:"center" }}>Kayıt bulunamadı</td>
                  </tr>
                ) : (
                  employees.map(emp => {
                    const p = getPresence(emp.lastSeenAt);
                    const initials = (emp.fullName || "")
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map(w => w[0]?.toUpperCase())
                      .join("");

                    return (
                      <tr key={emp.id}>
                        <td className={`presence ${p.cls}`} title={`Son görüldü: ${relTime(emp.lastSeenAt)}`}>
                          <span className="dot" />
                          <span className="presence-label">{p.label}</span>
                        </td>

                        <td>
                          <div className="name">
                            <span className="avatar">{initials || "PE"}</span>
                            <span className="full">{emp.fullName || "—"}</span>
                          </div>
                        </td>

                        <td>{emp.email || "—"}</td>
                        <td>{emp.jobTitle || "—"}</td>
                        <td>{emp.lastSeenAt ? relTime(emp.lastSeenAt) : "—"}</td>
                        <td>{fmt(emp.lastLoginAt)}</td>
                        <td>{fmt(emp.createdAt)}</td>
                        <td>{fmt(emp.updatedAt)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
