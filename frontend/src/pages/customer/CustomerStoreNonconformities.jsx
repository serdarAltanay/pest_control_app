import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./CustomerStoreNonconformities.scss";

export default function CustomerStoreNonconformities() {
  const { storeId } = useParams();
  const navigate = useNavigate();
  const [list, setList] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/nonconformities/store/${storeId}`);
        setList(Array.isArray(data) ? data : []);
      } catch {
        toast.error("Uygunsuzluklar alınamadı");
        setList([]);
      }
    })();
  }, [storeId]);

  const fmtDT = (d) => (d ? new Date(d).toLocaleString("tr-TR") : "—");
  const fmtD  = (d) => (d ? new Date(d).toLocaleDateString("tr-TR") : "—");

  return (
    <Layout title="Uygunsuzluklar (Müşteri)">
      <div className="cust-ncr">
        <div className="page-head">
          <h1>Uygunsuzluklar</h1>
          <Link className="btn ghost" to={`/customer/stores/${storeId}`}>Mağaza Sayfası</Link>
        </div>

        {list === null ? (
          <div className="card">Yükleniyor…</div>
        ) : list.length === 0 ? (
          <div className="card empty">Kayıt yok.</div>
        ) : (
          <section className="card">
            <div className="card-title">Kayıtlı Uygunsuzluklar</div>
            <table className="table">
              <thead>
                <tr>
                  <th>#</th><th>Tarih (Olay)</th><th>Yüklendi</th><th>Kategori</th><th>Başlık</th><th>Durum</th><th>Detay</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r,i)=>(
                  <tr key={r.id} className="row-link" onClick={()=>navigate(`/customer/stores/${storeId}/nonconformities/${r.id}`)}>
                    <td>{i+1}</td>
                    <td>{fmtD(r.observedAt)}</td>
                    <td>{fmtDT(r.createdAt)}</td>
                    <td>{r.category}</td>
                    <td className="notes">{r.title || "—"}</td>
                    <td>
                      <span className={`badge ${r.resolved ? "ok":"no"}`}>{r.resolved ? "Çözüldü":"Çözülmedi"}</span>
                    </td>
                    <td><span className="link-like">Detay</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </Layout>
  );
}
