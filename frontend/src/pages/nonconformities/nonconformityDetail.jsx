import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./nonconformityDetail.scss";

export default function NonconformityDetail() {
  const { storeId, ncrId } = useParams();
  const navigate = useNavigate();

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fmt = (d) => (d ? new Date(d).toLocaleString("tr-TR") : "—");

    // NonconformityDetail.jsx (load fonksiyonunu güncelle)
    const load = async () => {
    setLoading(true);
    try {
        const { data } = await api.get(`/nonconformities/${ncrId}`);
        setItem(data);
    } catch (e) {
        const msg = e?.response?.data?.error || e?.message || "Kayıt alınamadı";
        toast.error(msg);
        // 404 ise listeye döndürmek mantıklı
        if (e?.response?.status === 404) {
        navigate(`/admin/stores/${storeId}/nonconformities`);
        return;
        }
    } finally {
        setLoading(false);
    }
    };


  useEffect(() => { load(); /* eslint-disable-next-line */ }, [ncrId]);

  const toggleSolved = async () => {
    try {
      setToggling(true);
      const { data } = await api.patch(`/nonconformities/${ncrId}/toggle`);
      setItem(data);
      toast.success(data.resolved ? "Çözüldü olarak işaretlendi" : "Çözülmedi olarak işaretlendi");
    } catch {
      toast.error("Durum güncellenemedi");
    } finally {
      setToggling(false);
    }
  };

  const del = async () => {
    if (!window.confirm("Bu uygunsuzluk silinsin mi?")) return;
    try {
      setDeleting(true);
      await api.delete(`/nonconformities/${ncrId}`);
      toast.success("Silindi");
      navigate(`/admin/stores/${storeId}/nonconformities`);
    } catch {
      toast.error("Silinemedi");
      setDeleting(false);
    }
  };

  const imageUrl = useMemo(() => (item?.image ? `/${item.image}` : null), [item]);

  return (
    <Layout title="Uygunsuzluk Detayı">
      <div className="ncr-detail-page">
        {/* Üst başlık */}
        <div className="page-head">
          <div className="title">
            <h1>Uygunsuzluk Detayı</h1>
            <div className="sub">
              Mağaza:{" "}
              <Link className="link" to={`/admin/stores/${storeId}`}>#{storeId}</Link>
              {" • "}
              <span className={`badge ${item?.resolved ? "ok" : "no"}`}>
                {item?.resolved ? "Çözüldü" : "Çözülmedi"}
              </span>
              {item?.resolved && item?.resolvedAt ? (
                <span className="muted"> — {fmt(item.resolvedAt)}</span>
              ) : null}
            </div>
          </div>
          <div className="head-actions">
            <Link className="btn ghost" to={`/admin/stores/${storeId}/nonconformities`}>Listeye Dön</Link>
          </div>
        </div>

        {loading ? (
          <div className="card">Yükleniyor…</div>
        ) : !item ? (
          <div className="card empty">Kayıt bulunamadı.</div>
        ) : (
          <>
            {/* Üst: Bilgiler */}
            <section className="card meta-card">
            <div className="card-title">Uygunsuzluk Bilgileri</div>
            <table className="kv-table">
                <tbody>
                <tr>
                    <th>Kategori</th>
                    <td>{item.category || "—"}</td>
                </tr>
                <tr>
                    <th>Başlık</th>
                    <td>{item.title || "—"}</td>
                </tr>
                <tr className="notes-row">
                    <th>Açıklama</th>
                    <td>{item.notes || "—"}</td>
                </tr>
                <tr>
                    <th>Gözlem Tarihi</th>
                    <td>{fmt(item.observedAt)}</td>
                </tr>
                <tr>
                    <th>Oluşturulma</th>
                    <td>{fmt(item.createdAt)}</td>
                </tr>
                <tr>
                    <th>Oluşturan</th>
                    <td>{item.createdByName || `${item.createdByRole || ""} #${item.createdById || ""}` || "—"}</td>
                </tr>
                <tr>
                    <th>Durum</th>
                    <td>
                    <span className={`badge ${item?.resolved ? "ok" : "no"}`}>
                        {item?.resolved ? "Çözüldü" : "Çözülmedi"}
                    </span>
                    {item?.resolved && item?.resolvedAt ? (
                        <span className="muted" style={{ marginLeft: 8 }}>{fmt(item.resolvedAt)}</span>
                    ) : null}
                    </td>
                </tr>
                </tbody>
            </table>
            </section>


            {/* Orta: Görsel */}
            <section className="card image-card">
              <div className="card-title">Yüklenmiş Görsel</div>
              {imageUrl ? (
                <a href={imageUrl} target="_blank" rel="noreferrer" className="image-wrap" title="Yeni sekmede aç">
                  <img src={imageUrl} alt={item.title || "Uygunsuzluk görseli"} />
                </a>
              ) : (
                <div className="empty">Görsel yok.</div>
              )}
            </section>

            {/* Alt: Butonlar */}
            <div className="card action-bar">
              <div className="actions">
                <button className="btn warn" disabled={toggling} onClick={toggleSolved}>
                  {toggling ? "Güncelleniyor…" : (item?.resolved ? "Çözülmedi Yap" : "Çözüldü")}
                </button>
                <button className="btn danger" disabled={deleting} onClick={del}>
                  {deleting ? "Siliniyor…" : "Sil"}
                </button>
                <Link className="btn ghost" to={`/admin/stores/${storeId}/nonconformities`}>
                  Listeye Dön
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
