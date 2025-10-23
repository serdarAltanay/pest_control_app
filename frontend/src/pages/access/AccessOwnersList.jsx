// src/pages/access/AccessOwnersList.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./Access.scss";

export default function AccessOwnersList() {
  const [grants, setGrants] = useState([]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");

  const load = async () => {
    try {
      const { data } = await api.get("/access/grants");
      const list = Array.isArray(data) ? data : [];
      setGrants(list);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Erişim listesi alınamadı");
    }
  };
  useEffect(() => { load(); }, []);

  // owner bazında grupla
  const grouped = useMemo(() => {
    const m = new Map();
    grants.forEach(g => {
      const key = String(g.owner?.id || g.ownerId);
      if (!m.has(key)) m.set(key, { owner: g.owner, grants: [] });
      m.get(key).grants.push(g);
    });
    let arr = Array.from(m.values());
    if (role) arr = arr.filter(x => (x.owner?.role || "") === role);
    if (q.trim()) {
      const t = q.trim().toLowerCase();
      arr = arr.filter(x =>
        [x.owner?.firstName, x.owner?.lastName, x.owner?.email, x.owner?.role]
          .some(v => (v || "").toString().toLowerCase().includes(t))
      );
    }
    return arr.sort((a,b)=> (a.owner?.firstName || "").localeCompare(b.owner?.firstName || ""));
  }, [grants, q, role]);

  const roles = Array.from(new Set(grants.map(g => g.owner?.role).filter(Boolean)));

  return (
    <Layout>
      <div className="access-page">
        <div className="page-header">
          <h1>Erişim Sahipleri</h1>
          <div className="header-actions">
            <Link className="btn primary" to="/admin/access/new">+ Erişim Ver</Link>
          </div>
        </div>

        <div className="card">
          <div className="toolbar" style={{display:"flex", gap:10, marginBottom:10}}>
            <div className="search" style={{position:"relative", width: "min(420px, 100%)"}}>
              <input placeholder="Ara (ad / e-posta / rol)..." value={q} onChange={e=>setQ(e.target.value)} />
              {q && <button className="clear" onClick={()=>setQ("")} style={{position:"absolute", right:6, top:6}}>×</button>}
            </div>
            <div className="filters">
              <select value={role} onChange={e=>setRole(e.target.value)}>
                <option value="">Tümü</option>
                {roles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          {grouped.length === 0 ? (
            <div className="empty">Kayıt bulunamadı.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Kişi</th>
                  <th>Rol</th>
                  <th>Yetki Sayısı</th>
                  <th>Özet</th>
                  <th>Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {grouped.map(({ owner, grants }) => {
                  const summary = [
                    `${grants.filter(g=>g.scopeType==="CUSTOMER").length}× müşteri-genel`,
                    `${grants.filter(g=>g.scopeType==="STORE").length}× mağaza`
                  ].join(" / ");
                  return (
                    <tr key={owner?.id}>
                      <td className="strong">
                        {(owner?.firstName || "") + " " + (owner?.lastName || "")}
                        {" "}
                        <span className="muted">({owner?.email})</span>
                      </td>
                      <td>{owner?.role}</td>
                      <td>{grants.length}</td>
                      <td>{summary}</td>
                      <td className="actions">
                        <Link className="btn" to={`/admin/access/owner/${owner?.id}`}>Detay</Link>
                        <Link className="btn primary" to={`/admin/access/owner/${owner?.id}`}>+ Yetki</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
