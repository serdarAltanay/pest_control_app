import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./CustomerNcrDetail.scss";

export default function CustomerNcrDetail() {
  const { storeId, ncrId } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);

  const fmt = (d) => (d ? new Date(d).toLocaleString("tr-TR") : "—");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await api.get(`/nonconformities/${ncrId}`);
        setItem(data);
      } catch (e) {
        toast.error(e?.response?.data?.error || "Kayıt alınamadı");
        navigate(`/customer/stores/${storeId}/nonconformities`);
        return;
      } finally { setLoading(false); }
    })();
  }, [ncrId, storeId, navigate]);

  const imageUrl = useMemo(()=> item?.image ? `/${item.image}` : null, [item]);

  return (
    <Layout title="Uygunsuzluk Detayı (Müşteri)">
      <div className="cust-ncr-detail">
        <div className="page-head">
          <h1>Uygunsuzluk Detayı</h1>
          <Link className="btn ghost" to={`/customer/stores/${storeId}/nonconformities`}>Listeye Dön</Link>
        </div>

        {loading ? (
          <div className="card">Yükleniyor…</div>
        ) : !item ? (
          <div className="card empty">Kayıt bulunamadı.</div>
        ) : (
          <>
            <section className="card">
              <div className="card-title">Bilgiler</div>
              <table className="kv-table">
                <tbody>
                  <tr><th>Kategori</th><td>{item.category || "—"}</td></tr>
                  <tr><th>Başlık</th><td>{item.title || "—"}</td></tr>
                  <tr><th>Açıklama</th><td>{item.notes || "—"}</td></tr>
                  <tr><th>Gözlem Tarihi</th><td>{fmt(item.observedAt)}</td></tr>
                  <tr><th>Oluşturulma</th><td>{fmt(item.createdAt)}</td></tr>
                  <tr>
                    <th>Durum</th>
                    <td>
                      <span className={`badge ${item?.resolved ? "ok":"no"}`}>{item?.resolved ? "Çözüldü":"Çözülmedi"}</span>
                      {item?.resolved && item?.resolvedAt ? <span className="muted"> — {fmt(item.resolvedAt)}</span> : null}
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section className="card">
              <div className="card-title">Görsel</div>
              {imageUrl ? (
                <a href={imageUrl} className="image-wrap" target="_blank" rel="noreferrer">
                  <img src={imageUrl} alt={item.title || "Uygunsuzluk görseli"} />
                </a>
              ) : <div className="empty">Görsel yok.</div>}
            </section>
          </>
        )}
      </div>
    </Layout>
  );
}
