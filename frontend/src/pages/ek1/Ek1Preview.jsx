import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";

export default function Ek1Preview() {
  const { storeId, visitId } = useParams();
  const navigate = useNavigate();

  const buildPdf = async () => {
    try {
      await api.post(`/visits/${visitId}/ek1/submit`); // backend: pdf oluştur + SUBMITTED yap
      toast.success("Belge oluşturuldu, onaya gönderildi");
      navigate(`/admin/stores/${storeId}/ek1`);
    } catch (e) {
      toast.error(e?.response?.data?.message || "İşlem başarısız");
    }
  };

  return (
    <Layout>
      <div className="page">
        <div className="page-header">
          <h1>EK-1 – Önizleme</h1>
          <div className="header-actions">
            <Link className="btn ghost" to={`/admin/stores/${storeId}/visits/${visitId}/biocides`}>Geri</Link>
            <button className="btn primary" onClick={buildPdf}>PDF Oluştur & Onaya Gönder</button>
          </div>
        </div>

        <div className="card">
          <div className="empty">Buraya PDF önizlemesi / özet bilgileri gelecek.</div>
        </div>
      </div>
    </Layout>
  );
}
