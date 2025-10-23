// src/pages/access/AccessManageCustomer.jsx
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

export default function AccessManageCustomer() {
  const { customerId } = useParams();
  const [customer, setCustomer] = useState(null);
  const [rows, setRows] = useState([]);

  // yeni alanlar
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("CALISAN");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [scopeType, setScopeType] = useState("CUSTOMER");
  const [storeId, setStoreId] = useState("");

  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const { data: c } = await api.get(`/customers/${customerId}`);
      setCustomer(c);
    } catch {}
    try {
      const { data } = await api.get(`/access/customer/${customerId}`);
      const list = Array.isArray(data?.grants) ? data.grants : (Array.isArray(data) ? data : []);
      setRows(list);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Liste alınamadı");
    }
  };
  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, [customerId]);

  const addGrant = async (e) => {
    e.preventDefault();
    if (!email.trim()) return toast.error("E-posta girin");
    if (scopeType === "STORE" && !storeId) return toast.error("Mağaza ID girin");

    try {
      setSaving(true);

      // 1) Owner'ı garanti et (varsa getir, yoksa 123456 ile oluştur)
      const ensureBody = { email: email.trim(), role, firstName, lastName, phone, password: "123456" };
      const { data: owner } = await api.post("/access-owners/ensure", ensureBody);

      if (!owner?.id) throw new Error("Owner oluşturulamadı");

      // 2) Grant ver
      const payload = {
        ownerId: Number(owner.id),
        scopeType,
        customerId: scopeType === "CUSTOMER" ? Number(customerId) : undefined,
        storeId: scopeType === "STORE" ? Number(storeId) : undefined,
      };
      await api.post("/access/grant", payload);

      toast.success("Erişim verildi");
      setEmail(""); setFirstName(""); setLastName(""); setPhone(""); setStoreId("");
      await load();
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Kaydedilemedi");
    } finally { setSaving(false); }
  };

  const revoke = async (id) => {
    if (!window.confirm("Bu erişimi kaldırmak istiyor musunuz?")) return;
    try {
      await api.delete(`/access/${id}`);
      setRows(rs => rs.filter(r => r.id !== id));
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Silinemedi");
    }
  };

  const customerLevel = rows.filter(r => r.scopeType === "CUSTOMER");
  const storeLevel = rows.filter(r => r.scopeType === "STORE");

  return (
    <Layout>
      <div className="access-page">
        <div className="page-header">
          <h1>Müşteri Erişimi – {customer?.title || `#${customerId}`}</h1>
          <div className="header-actions">
            <Link className="btn" to={`/admin/customers/${customerId}`}>Müşteri</Link>
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
                <option value="CUSTOMER">Müşteri-Genel (tüm mağazalar)</option>
                <option value="STORE">Tekil Mağaza</option>
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

            {scopeType === "STORE" && (
              <div className="full">
                <label>Mağaza ID *</label>
                <input placeholder="ör. 345" value={storeId} onChange={e=>setStoreId(e.target.value)} />
              </div>
            )}

            <div className="full btn-row">
              <button className="btn primary" disabled={saving}>{saving ? "Kaydediliyor..." : "Erişim Ver"}</button>
              <span className="muted">Not: Owner yoksa e-posta + rol ile oluşturulur. Şifre: <b>123456</b></span>
            </div>
          </form>
        </section>

        <section className="card">
          <div className="card-title">Müşteri-Genel Erişimler</div>
          {customerLevel.length === 0 ? (
            <div className="empty">Kayıt yok.</div>
          ) : (
            <table className="table">
              <thead><tr><th>Kişi</th><th>Rol</th><th>Veriliş</th><th>İşlem</th></tr></thead>
              <tbody>
                {customerLevel.map(r=>(
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
          <div className="card-title">Tekil Mağaza Erişimleri</div>
          {storeLevel.length === 0 ? (
            <div className="empty">Kayıt yok.</div>
          ) : (
            <table className="table">
              <thead><tr><th>Kişi</th><th>Rol</th><th>Mağaza</th><th>İşlem</th></tr></thead>
              <tbody>
                {storeLevel.map(r=>(
                  <tr key={r.id}>
                    <td className="strong">
                      {(r.owner?.firstName || "") + " " + (r.owner?.lastName || "")} <span className="muted">({r.owner?.email})</span>
                    </td>
                    <td>{r.owner?.role}</td>
                    <td className="muted">{r.store?.name || r.storeId}</td>
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
