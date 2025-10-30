// src/pages/reports/ReportDetail.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./ReportDetail.scss";
import { toAbsoluteUrl, addCacheBust } from "../../utils/getAssetUrl";

export default function ReportDetail() {
  const { storeId, reportId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const inCustomer = location.pathname.startsWith("/customer/");
  const backHref = inCustomer
    ? (storeId ? `/customer/reports?storeId=${storeId}` : "/customer/reports")
    : (storeId ? `/admin/stores/${storeId}/reports` : "/admin");

  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const fmt = (d) => (d ? new Date(d).toLocaleString("tr-TR") : "—");

  const load = async () => {
    try {
      const { data } = await api.get(`/reports/${reportId}`);
      setItem(data);
    } catch (e) {
      toast.error(e?.response?.data?.error || "Rapor getirilemedi");
      navigate(-1);
      return;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [reportId]);

  const isPdf = useMemo(() => item?.mime?.includes("pdf"), [item?.mime]);
  const isImage = useMemo(() => item?.mime?.startsWith("image/"), [item?.mime]);

  const fileUrl = useMemo(() => {
    if (!item?.file) return null;
    return addCacheBust(toAbsoluteUrl(item.file, { forceApi: true }));
  }, [item?.file]);

  const onDelete = async () => {
    if (!window.confirm("Rapor silinsin mi?")) return;
    try {
      setDeleting(true);
      await api.delete(`/reports/${reportId}`);
      toast.success("Silindi");
      navigate(backHref);
    } catch {
      toast.error("Silinemedi");
      setDeleting(false);
    }
  };

  return (
    <Layout title="Rapor Detayı">
      <div className="report-detail-page">
        <div className="head">
          <div>
            <h1>{item?.title || "Rapor"}</h1>
            <div className="sub">
              Yüklendi: <b>{fmt(item?.uploadedAt)}</b>
              {item?.mime ? <> • Tür: <span className="mono">{item.mime}</span></> : null}
            </div>
          </div>
          <div className="head-actions">
            <Link className="btn ghost" to={backHref}>Listeye Dön</Link>
          </div>
        </div>

        {loading ? (
          <div className="card">Yükleniyor…</div>
        ) : !item ? (
          <div className="card empty">Kayıt bulunamadı.</div>
        ) : (
          <>
            <section className="card meta">
              <table className="info">
                <tbody>
                  <tr><th>Başlık</th><td>{item.title || "—"}</td></tr>
                  <tr><th>Yüklenme</th><td>{fmt(item.uploadedAt)}</td></tr>
                  <tr><th>Notlar</th><td>{item.notes || "—"}</td></tr>
                  <tr><th>Dosya</th><td>{fileUrl ? <a href={fileUrl} target="_blank" rel="noreferrer">{item.file}</a> : "—"}</td></tr>
                </tbody>
              </table>
            </section>

            <section className="card viewer">
              <div className="card-title">Önizleme</div>
              {isPdf && fileUrl ? (
                <embed src={fileUrl} type="application/pdf" className="pdf-view" />
              ) : isImage && fileUrl ? (
                <img src={fileUrl} alt={item.title} className="img-view" />
              ) : fileUrl ? (
                <div className="empty">
                  Bu dosya tarayıcıda görüntülenemiyor.
                  <div style={{ marginTop: 8 }}>
                    <a className="btn" href={fileUrl} target="_blank" rel="noreferrer">Yeni Sekmede Aç</a>
                  </div>
                </div>
              ) : (
                <div className="empty">Dosya yok.</div>
              )}
            </section>

            <div className="card actions-bar">
              <div className="actions">
                <a className="btn" href={toAbsoluteUrl(`api/reports/${reportId}/download`, { forceApi: true })}>İndir</a>
                {/* müşteri arayüzünde silme butonunu gösterme */}
                {!inCustomer && (
                  <button className="btn danger" onClick={onDelete} disabled={deleting}>
                    {deleting ? "Siliniyor…" : "Sil"}
                  </button>
                )}
                <Link className="btn ghost" to={backHref}>Listeye Dön</Link>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
