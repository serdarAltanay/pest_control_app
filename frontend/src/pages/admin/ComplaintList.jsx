// src/pages/admin/ComplaintList.jsx
import { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import "./ComplaintAdmin.scss";
import { Link, useSearchParams, useNavigate } from "react-router-dom";

export default function ComplaintListAdmin() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const seen = searchParams.get("seen"); // "true" | "false" | null

  const load = async () => {
    try {
      const { data } = await api.get("/feedback/admin/complaints", { params: { seen } });
      setItems(Array.isArray(data) ? data : []);
    } catch { }
  };

  useEffect(() => { load(); }, [seen]);

  return (
    <Layout title="Şikayet İzleme">
      <div className="complaints-admin">
        <div className="head" style={{ gap: "12px", justifyContent: "flex-start", flexWrap: "wrap" }}>
          <button className="btn ghost" onClick={() => navigate(-1)} title="Geri Dön" style={{ padding: "0 8px", fontSize: "18px" }}>
            &larr;
          </button>
          <h1 style={{ margin: 0, marginRight: "auto" }}>Şikayetler</h1>
          <div className="filters">
            <button className={!seen ? "active" : ""} onClick={() => setSearchParams({})}>Tümü</button>
            <button className={seen === "false" ? "active" : ""} onClick={() => setSearchParams({ seen: "false" })}>Görülmemiş</button>
            <button className={seen === "true" ? "active" : ""} onClick={() => setSearchParams({ seen: "true" })}>Görülen</button>
          </div>
        </div>

        <div className="list">
          {items.length === 0 && <div className="empty">Kayıt yok.</div>}
          {items.map(it => (
            <Link key={it.id} to={`/admin/complaints/${it.id}`} className={`adm-card ${!it.adminSeenAt ? "unseen" : ""}`}>
              <div className="row">
                <div className="type">{it.type}</div>
                <div className="time">{new Date(it.createdAt).toLocaleString("tr-TR")}</div>
              </div>
              <div className="title">{it.title}</div>
              <div className="sub">
                {it.store?.code ? `${it.store.code} – ` : ""}{it.store?.name} {it.store?.city ? `(${it.store.city})` : ""}
              </div>
              <div className="owner">
                {it.owner?.firstName || it.owner?.lastName ? `${it.owner.firstName || ""} ${it.owner.lastName || ""}`.trim() : it.owner?.email}
              </div>
              {!it.adminSeenAt && <div className="badge">Yeni</div>}
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}
