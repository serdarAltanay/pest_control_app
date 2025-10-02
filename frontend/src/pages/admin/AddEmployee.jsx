import { useEffect, useState } from "react";
import api from "../../api/axios";
import Layout from "../../components/Layout";
import { toast } from "react-toastify";
import "./AddEmployee.scss";

export default function AddEmployee() {
  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [gsm, setGsm]           = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [adminId, setAdminId]   = useState("");
  const [admins, setAdmins]     = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/admin/admins");
        setAdmins(res.data || []);
      } catch {}
    })();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/employees", {
        fullName, jobTitle, gsm,
        username: username || undefined,
        email: email || undefined,
        password: password || undefined,
        adminId: adminId ? Number(adminId) : undefined,
      });
      toast.success("Personel eklendi");
      setFullName(""); setJobTitle(""); setGsm(""); setUsername(""); setEmail(""); setPassword(""); setAdminId("");
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
            <div><label>Personel Adı Soyadı *</label><input value={fullName} onChange={(e)=>setFullName(e.target.value)} required/></div>
            <div><label>Görevi *</label><input value={jobTitle} onChange={(e)=>setJobTitle(e.target.value)} required/></div>
            <div><label>GSM *</label><input value={gsm} onChange={(e)=>setGsm(e.target.value)} required/></div>

            <div><label>Kullanıcı</label><input value={username} onChange={(e)=>setUsername(e.target.value)} /></div>
            <div><label>Parola</label><input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} /></div>
            <div><label>E-Mail</label><input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} /></div>

            <div>
              <label>Bağlı Admin</label>
              <select value={adminId} onChange={(e)=>setAdminId(e.target.value)}>
                <option value="">Seçiniz</option>
                {admins.map(a => <option key={a.id} value={a.id}>{a.fullName} ({a.email})</option>)}
              </select>
            </div>
          </div>
          <button className="primary">Personel Ekle</button>
        </form>
      </div>
    </Layout>
  );
}
