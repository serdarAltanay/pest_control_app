// src/pages/access/AccessOwnerDetail.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./Access.scss";

export default function AccessOwnerDetail() {
  const { ownerId } = useParams();
  const navigate = useNavigate();

  const [owner, setOwner] = useState(null);
  const [grants, setGrants] = useState([]);

  const [scopeType, setScopeType] = useState("CUSTOMER");
  const [customerId, setCustomerId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get(`/access/owner/${ownerId}`);
      setOwner(data?.owner || null);
      setGrants(Array.isArray(data?.grants) ? data.grants : []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Detay alınamadı");
    }
  };
  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, [ownerId]);

  const addGrant = async (e) => {
    e.preventDefault();
    const payload = {
      ownerId: Number(ownerId),
      scopeType,
      customerId: scopeType === "CUSTOMER" ? Number(customerId) : undefined,
      storeId: scopeType === "STORE" ? Number(storeId) : undefined,
    };
    if (scopeType === "CUSTOMER" && !payload.customerId) return toast.error("Müşteri ID girin");
    if (scopeType === "STORE" && !payload.storeId) return toast.error("Mağaza ID girin");

    try {
      setSaving(true);
      await api.post("/access/grant", payload);
      toast.success("Erişim verildi");
      setCustomerId(""); setStoreId("");
      await load();
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Kaydedilemedi");
    } finally { setSaving(false); }
  };

  const revoke = async (grantId) => {
    if (!window.confirm("Bu erişimi kaldırmak istiyor musunuz?")) return;
    try {
      await api.delete(`/access/${grantId}`);
      toast.success("Erişim kaldırıldı");
      setGrants(gs => gs.filter(g=>g.id !== grantId));
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Silinemedi");
    }
  };

  return (
    <Layout>
      <div className="access-page">
        <div className="page-header">
          <h1>
            Erişim Sahibi – {(owner?.firstName || "") + " " + (owner?.lastName || "")}
            {" "}
            <span className="muted">({owner?.email} · {owner?.role})</span>
          </h1>
          <div className="header-actions">
            <Link className="btn" to="/admin/access">Liste</Link>
          </div>
        </div>

        <section className="card">
          <div className="card-title">Yeni Erişim Ver</div>

          <form onSubmit={addGrant}>
            <div className="grid-3">
              <div>
                <label>Kapsam</label>
                <select value={scopeType} onChange={e=>setScopeType(e.target.value)}>
                  <option value="CUSTOMER">Müşteri (tüm mağazalar)</option>
                  <option value="STORE">Mağaza (tekil)</option>
                </select>
              </div>

              {scopeType === "CUSTOMER" ? (
                <div className="full">
                  <label>Müşteri ID</label>
                  <input placeholder="ör. 12" value={customerId} onChange={e=>setCustomerId(e.target.value)} />
                </div>
              ) : (
                <div className="full">
                  <label>Mağaza ID</label>
                  <input placeholder="ör. 345" value={storeId} onChange={e=>setStoreId(e.target.value)} />
                </div>
              )}
            </div>

            <div className="btn-row" style={{marginTop: 10}}>
              <button className="btn primary" disabled={saving}>{saving ? "Kaydediliyor..." : "Erişim Ver"}</button>
              <span className="muted">Not: Müşteri/mağaza için ileride arama ile seçim gelecek.</span>
            </div>
          </form>
        </section>

        <section className="card">
          <div className="card-title">Mevcut Erişimler</div>

          {grants.length === 0 ? (
            <div className="empty">Bu kullanıcıya tanımlı erişim yok.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Kapsam</th>
                  <th>Detay</th>
                  <th>Oluşturulma</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {grants.map(g => (
                  <tr key={g.id}>
                    <td>{g.scopeType === "CUSTOMER" ? "Müşteri-Genel" : "Mağaza"}</td>
                    <td>{g.scopeType === "CUSTOMER" ? (g.customer?.title || g.customerId) : (g.store?.name || g.storeId)}</td>
                    <td className="muted">{new Date(g.createdAt).toLocaleString("tr-TR")}</td>
                    <td className="actions"><button className="btn danger" onClick={()=>revoke(g.id)}>Kaldır</button></td>
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
