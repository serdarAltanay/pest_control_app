// src/pages/customer/FeedbackList.jsx
import { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import "./Feedback.scss";
import { Link } from "react-router-dom";

export default function FeedbackList() {
  const [complaints, setComplaints] = useState([]);
  const [suggestions, setSuggestions] = useState([]);

  const load = async () => {
    try {
      const c = await api.get("/feedback/complaints/me");
      const s = await api.get("/feedback/suggestions/me");
      setComplaints(Array.isArray(c.data) ? c.data : []);
      setSuggestions(Array.isArray(s.data) ? s.data : []);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  return (
    <Layout title="Şikayet/Önerilerim">
      <div className="feedback-page">
        <h2>Şikayetlerim</h2>
        <div className="list">
          {complaints.length === 0 && <div className="empty">Henüz şikayet yok.</div>}
          {complaints.map(it => (
            <Link key={it.id} to={`/customer/feedback/${it.id}`} className={`f-card ${!it.adminSeenAt ? "unseen" : ""}`}>
              <div className="row">
                <div className="type">{it.type}</div>
                <div className="time">{new Date(it.createdAt).toLocaleString("tr-TR")}</div>
              </div>
              <div className="title">{it.title}</div>
              <div className="sub">
                {it.store?.code ? `${it.store.code} – ` : ""}{it.store?.name} {it.store?.city ? `(${it.store.city})` : ""}
              </div>
              {!it.adminSeenAt && <div className="badge">Admin tarafından henüz görülmedi</div>}
            </Link>
          ))}
        </div>

        <h2>Önerilerim</h2>
        <div className="list">
          {suggestions.length === 0 && <div className="empty">Henüz öneri yok.</div>}
          {suggestions.map(it => (
            <div key={it.id} className="f-card">
              <div className="row">
                <div className="type">ÖNERİ</div>
                <div className="time">{new Date(it.createdAt).toLocaleString("tr-TR")}</div>
              </div>
              <div className="title">{it.title}</div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
