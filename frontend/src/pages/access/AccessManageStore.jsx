// src/pages/access/AccessManageStore.jsx
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./Access.scss";

const ROLES = [
  "CALISAN",
  "MAGAZA_SORUMLUSU",
  "MAGAZA_MUDURU",
  "GENEL_MUDUR",
  "PATRON",
  "DIGER",
];

export default function AccessManageStore() {
  const { storeId } = useParams();
  const [store, setStore] = useState(null);
  const [rows, setRows] = useState([]);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("CALISAN");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [scopeType, setScopeType] = useState("STORE");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try { const { data: s } = await api.get(`/stores/${storeId}`); setStore(s); } catch {}
    try {
      const { data } = await api.get(`/access/store/${storeId}`);
      const list = Array.isArray(data?.grants) ? data.grants : (Array.isArray(data) ? data : []);
      setRows(list);
    } catch (e) { toast.error(e?.response?.data?.message || "Liste alınamadı"); }
  };
  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, [storeId]);

  const direct = rows.filter(r => r.scopeType === "STORE");
  const inherited = rows.filter(r => r.scopeType === "CUSTOMER");

  const addGrant = async (e) => {
    e.preventDefault();
    if (!email.trim()) return toast.error("E-posta girin");

    try {
      setSaving(true);

      const ensureBody = { email: email.trim(), role, firstName, lastName, phone, password: "123456" };
      const { data: owner } = await api.post("/access-owners/ensure", ensureBody);
      if (!owner?.id) throw new Error("Owner oluşturulamadı");

      const payload = {
        ownerId: Number(owner.id),
        scopeType,
        storeId: scopeType === "STORE" ? Number(storeId) : undefined,
        customerId: scopeType === "CUSTOMER" ? Number(store?.customerId) : undefined,
      };
      await api.post("/access/grant", payload);

      toast.success("Erişim verildi");
      setEmail(""); setFirstName(""); setLastName(""); setPhone("");
      await load();
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Kaydedilemedi");
    } finally { setSaving(false); }
  };

  const revoke = async (id) => {
    if (!window.confirm("Bu erişimi kaldırmak istiyor musunuz?")) return;
    try { await api.delete(`/access/${id}`); setRows(rs => rs.filter(r => r.id !== id)); }
    catch (e2) { toast.error(e2?.response?.data?.message || "Silinemedi"); }
  };

  return (
    <Layout>
      <div className="access-page">
        <div className="page-header">
          <h1>Mağaza Erişimi – {store?.name || `#${storeId}`}</h1>
          <div className="header-actions">
            <Link className="btn" to={`/admin/stores/${storeId}`}>Mağaza</Link>
          </div>
        </div>

        <section className="card">
          <div className="card-title">Yeni Erişim Ver</div>

          <form onSubmit={addGrant} className="grid-3">
            <div>
              <label>E-posta *</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="kisi@firma.com" required />
            </div>
            <div>
              <label>Rol *</label>
              <select value={role} onChange={e=>setRole(e.target.value)}>
                {ROLES.map(r=> <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label>Kapsam *</label>
              <select value={scopeType} onChange={e=>setScopeType(e.target.value)}>
                <option value="STORE">Sadece bu Mağaza</option>
                <option value="CUSTOMER">Müşteri-Genel (tüm mağazalar)</option>
              </select>
            </div>

            <div>
              <label>Ad</label>
              <input value={firstName} onChange={e=>setFirstName(e.target.value)} placeholder="Opsiyonel" />
            </div>
            <div>
              <label>Soyad</label>
              <input value={lastName} onChange={e=>setLastName(e.target.value)} placeholder="Opsiyonel" />
            </div>
            <div>
              <label>Telefon</label>
              <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Opsiyonel" />
            </div>

            <div className="full btn-row">
              <button className="btn primary" disabled={saving}>{saving ? "Kaydediliyor..." : "Erişim Ver"}</button>
              <span className="muted">Not: Owner yoksa e-posta + rol ile oluşturulur. Şifre: <b>123456</b></span>
            </div>
          </form>
        </section>

        <section className="card">
          <div className="card-title">Doğrudan Bu Mağazaya Erişenler</div>
          {direct.length === 0 ? (
            <div className="empty">Doğrudan mağaza erişimi yok.</div>
          ) : (
            <table className="table">
              <thead><tr><th>Kişi</th><th>Rol</th><th>Veriliş</th><th>İşlem</th></tr></thead>
              <tbody>
                {direct.map(r=>(
                  <tr key={r.id}>
                    <td className="strong">
                      {(r.owner?.firstName || "") + " " + (r.owner?.lastName || "")} <span className="muted">({r.owner?.email})</span>
                    </td>
                    <td>{r.owner?.role}</td>
                    <td className="muted">{new Date(r.createdAt).toLocaleString("tr-TR")}</td>
                    <td className="actions"><button className="btn danger" onClick={()=>revoke(r.id)}>Kaldır</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="card">
          <div className="card-title">Müşteri-Genel Erişimle Bu Mağazaya Ulaşanlar</div>
          {inherited.length === 0 ? (
            <div className="empty">Müşteri-genel erişim yok.</div>
          ) : (
            <table className="table">
              <thead><tr><th>Kişi</th><th>Rol</th><th>Kapsam</th><th>İşlem</th></tr></thead>
              <tbody>
                {inherited.map(r=>(
                  <tr key={r.id}>
                    <td className="strong">
                      {(r.owner?.firstName || "") + " " + (r.owner?.lastName || "")} <span className="muted">({r.owner?.email})</span>
                    </td>
                    <td>{r.owner?.role}</td>
                    <td className="muted">{r.customer?.title || r.customerId}</td>
                    <td className="actions"><button className="btn danger" onClick={()=>revoke(r.id)}>Kaldır</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </Layout>
  );
}
