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
      setFullName("");
      setJobTitle("");
      setGsm("");
      setEmail("");
      setPassword("");
      setAdminId("");
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
              <input
                value={fullName}
                onChange={(e)=>setFullName(e.target.value)}
                required
              />
            </div>

            <div>
              <label>Görevi *</label>
              <input
                value={jobTitle}
                onChange={(e)=>setJobTitle(e.target.value)}
                required
              />
            </div>

            <div>
              <label>GSM *</label>
              <input
                value={gsm}
                onChange={(e)=>setGsm(e.target.value)}
                required
              />
            </div>

            <div>
              <label>Parola *</label>
              <input
                type="password"
                value={password}
                onChange={(e)=>setPassword(e.target.value)}
                required
              />
            </div>

            <div>
              <label>E-Mail *</label>
              <input
                type="email"
                value={email}
                onChange={(e)=>setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label>Bağlı Admin</label>
              <select
                value={adminId}
                onChange={(e)=>setAdminId(e.target.value)}
              >
                <option value="">Seçiniz</option>
                {admins.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.fullName} ({a.email})
                  </option>
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
                  <th>Ad Soyad</th>
                  <th>E-posta</th>
                  <th>Görevi</th>
                  <th>Son Giriş</th>
                  <th>Eklenme</th>
                  <th>Son Güncelleme</th>
                </tr>
              </thead>
              <tbody>
                {employees.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign:"center" }}>
                      Kayıt bulunamadı
                    </td>
                  </tr>
                ) : (
                  employees.map(emp => (
                    <tr key={emp.id}>
                      <td>{emp.fullName || "—"}</td>
                      <td>{emp.email || "—"}</td>
                      <td>{emp.jobTitle || "—"}</td>
                      <td>{fmt(emp.lastLoginAt)}</td>
                      <td>{fmt(emp.createdAt)}</td>
                      <td>{fmt(emp.updatedAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
