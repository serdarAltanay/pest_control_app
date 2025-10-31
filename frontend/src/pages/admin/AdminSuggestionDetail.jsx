// src/pages/admin/AdminSuggestionDetail.jsx
import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./AdminSuggestion.scss";

function toDateTime(s) {
  if (!s) return "-";
  try { return new Date(s).toLocaleString("tr-TR"); } catch { return s; }
}

export default function AdminSuggestionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [busy, setBusy] = useState(false);

  const fetchItem = async () => {
    try {
      setBusy(true);
      const { data } = await api.get(`/feedback/admin/suggestions/${id}`);
      setItem(data || null);
      // Not: Öneriler için "seen" akışı yok. (Şikayetlerde var)
    } catch (e) {
      toast.error(e?.response?.data?.message || "Öneri getirilemedi");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { fetchItem(); /* eslint-disable-next-line */ }, [id]);

  if (!item) {
    return (
      <Layout title="Öneri Detayı">
        <div className="admin-suggestions-page">
          <div className="card">Yükleniyor…</div>
        </div>
      </Layout>
    );
  }

  const ownerName =
    [item?.owner?.firstName, item?.owner?.lastName].filter(Boolean).join(" ") ||
    item?.owner?.email ||
    "-";

  return (
    <Layout title="Öneri Detayı">
      <div className="admin-suggestions-page">
        <div className="detail-head card">
          <div className="left">
            <h1>{item?.title || "Öneri"}</h1>
            <div className="meta">
              <span>Oluşturan: <b>{ownerName}</b></span>
              <span>Tarih: <b>{toDateTime(item?.createdAt)}</b></span>
            </div>
          </div>
          <div className="right actions">
            <button className="btn ghost" onClick={() => navigate(-1)}>Geri</button>
            <Link className="btn" to="/admin/suggestions">Öneri Listesi</Link>
          </div>
        </div>

        <div className="card body-text">
          {item?.message ? (
            <pre className="pre">{String(item.message)}</pre>
          ) : (
            <div>-</div>
          )}
        </div>

        {/* Önerilerde görsel alanı yok; eğer ileride eklersen, aşağıyı açabilirsin
        {item?.image && (
          <div className="card">
            <div className="sec-title">Ekli Görsel</div>
            <div className="img-wrap">
              <img src={`/${String(item.image).replace(/^\/+/, "")}`} alt="Öneri görseli" />
            </div>
          </div>
        )} */}
      </div>
    </Layout>
  );
}
