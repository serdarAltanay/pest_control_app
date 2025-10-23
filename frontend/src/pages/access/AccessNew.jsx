// src/pages/access/AccessNew.jsx
import { useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./Access.scss";

const ROLES = ["CALISAN","MAGAZA_SORUMLUSU","MAGAZA_MUDURU","GENEL_MUDUR","PATRON","DIGER"];

export default function AccessNew() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("CALISAN");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  const [scopeType, setScopeType] = useState("CUSTOMER");
  const [customerId, setCustomerId] = useState("");
  const [storeId, setStoreId] = useState("");

  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return toast.error("E-posta girin");
    if (scopeType === "CUSTOMER" && !customerId) return toast.error("Müşteri ID girin");
    if (scopeType === "STORE" && !storeId) return toast.error("Mağaza ID girin");

    try {
      setSaving(true);
      const ensureBody = { email: email.trim(), role, firstName, lastName, phone, password: "123456" };
      const { data: owner } = await api.post("/access-owners/ensure", ensureBody);
      if (!owner?.id) throw new Error("Owner oluşturulamadı");

      await api.post("/access/grant", {
        ownerId: Number(owner.id),
        scopeType,
        customerId: scopeType === "CUSTOMER" ? Number(customerId) : undefined,
        storeId: scopeType === "STORE" ? Number(storeId) : undefined,
      });

      toast.success("Erişim verildi");
      setEmail(""); setFirstName(""); setLastName(""); setPhone(""); setCustomerId(""); setStoreId("");
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Kaydedilemedi");
    } finally { setSaving(false); }
  };

  return (
    <Layout>
      <div className="access-page">
        <div className="page-header">
          <h1>Yeni Erişim</h1>
          <div className="header-actions">
            <Link className="btn" to="/admin/access">Listeye Dön</Link>
          </div>
        </div>

        <section className="card">
          <div className="card-title">Erişim Sahibi</div>
          <form onSubmit={submit} className="grid-3">
            <div>
              <label>E-posta *</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
            </div>
            <div>
              <label>Rol *</label>
              <select value={role} onChange={e=>setRole(e.target.value)}>{ROLES.map(r=> <option key={r} value={r}>{r}</option>)}</select>
            </div>
            <div>
              <label>Telefon</label>
              <input value={phone} onChange={e=>setPhone(e.target.value)} />
            </div>
            <div>
              <label>Ad</label>
              <input value={firstName} onChange={e=>setFirstName(e.target.value)} />
            </div>
            <div>
              <label>Soyad</label>
              <input value={lastName} onChange={e=>setLastName(e.target.value)} />
            </div>
            <div>
              <label>Kapsam *</label>
              <select value={scopeType} onChange={e=>setScopeType(e.target.value)}>
                <option value="CUSTOMER">Müşteri-Genel</option>
                <option value="STORE">Mağaza</option>
              </select>
            </div>

            {scopeType === "CUSTOMER" ? (
              <div className="full">
                <label>Müşteri ID *</label>
                <input value={customerId} onChange={e=>setCustomerId(e.target.value)} />
              </div>
            ) : (
              <div className="full">
                <label>Mağaza ID *</label>
                <input value={storeId} onChange={e=>setStoreId(e.target.value)} />
              </div>
            )}

            <div className="full btn-row">
              <button className="btn primary" disabled={saving}>{saving ? "Kaydediliyor..." : "Erişim Ver"}</button>
              <span className="muted">Owner yoksa oluşturulur. Şifre: <b>123456</b></span>
            </div>
          </form>
        </section>
      </div>
    </Layout>
  );
}
