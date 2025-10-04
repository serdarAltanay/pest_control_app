import { useEffect, useState } from "react";
import api from "../../api/axios";
import Layout from "../../components/Layout";
import { toast } from "react-toastify";
import "./AddAdmin.scss";

export default function AddAdmin() {
  const [fullName, setFullName]   = useState("");
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");

  const [admins, setAdmins]       = useState([]);
  const [loading, setLoading]     = useState(false);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      // Router'ınız büyük ihtimalle /admin ile mount ediliyor.
      // create'e post attığınız path ile tutarlı: /admin/create
      const { data } = await api.get("/admin/admins");
      setAdmins(data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Yöneticiler alınamadı");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/create", { fullName, email, password });
      toast.success("Yönetici eklendi");
      setFullName(""); setEmail(""); setPassword("");
      fetchAdmins(); // ekledikten sonra listeyi tazele
    } catch (err) {
      toast.error(err.response?.data?.message || "Hata");
    }
  };

  const fmt = (val) => {
    if (!val) return "—";
    try {
      return new Date(val).toLocaleString("tr-TR");
    } catch {
      return String(val);
    }
  };

  return (
    <Layout>
      <div className="add-user-page">
        <h2>Yönetici Ekle</h2>
        <form className="panel" onSubmit={submit}>
          <div className="row">
            <label>Personel Adı Soyadı *</label>
            <input
              value={fullName}
              onChange={(e)=>setFullName(e.target.value)}
              required
            />

            <label>Giriş Mail Adresi *</label>
            <input
              type="email"
              value={email}
              onChange={(e)=>setEmail(e.target.value)}
              required
            />

            <label>Parola *</label>
            <input
              type="password"
              value={password}
              onChange={(e)=>setPassword(e.target.value)}
              required
            />
          </div>
          <button className="primary">Yönetici Ekle</button>
        </form>

        {/* --- Yöneticiler Listesi --- */}
        <div className="admins-list">
          <div className="list-header">
            <h3>Mevcut Yöneticiler</h3>
            <button type="button" onClick={fetchAdmins} disabled={loading}>
              {loading ? "Yükleniyor..." : "Yenile"}
            </button>
          </div>

          <div className="table-wrapper">
            <table className="admins-table">
              <thead>
                <tr>
                  <th>Ad Soyad</th>
                  <th>E-posta</th>
                  <th>Son Giriş</th>
                  <th>Son Güncelleme</th>
                  <th>Eklenme</th>
                </tr>
              </thead>
              <tbody>
                {admins.length === 0 && !loading ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center" }}>
                      Kayıt bulunamadı
                    </td>
                  </tr>
                ) : (
                  admins.map((a) => (
                    <tr key={a.id}>
                      <td>{a.fullName || "—"}</td>
                      <td>{a.email}</td>
                      <td>{fmt(a.lastLoginAt)}</td>
                      <td>{fmt(a.updatedAt)}</td>
                      <td>{fmt(a.createdAt)}</td>
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
