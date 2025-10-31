// src/pages/customer/ComplaintDetail.jsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import "./Feedback.scss";

export default function ComplaintDetailCustomer() {
  const { id } = useParams();
  const [item, setItem] = useState(null);

  useEffect(() => {
    api.get(`/feedback/${id}`).then(({ data }) => setItem(data)).catch(()=>{});
  }, [id]);

  if (!item) return (
    <Layout title="Şikayet Detayı">
      <div className="feedback-page"><div className="empty">Yükleniyor...</div></div>
    </Layout>
  );

  return (
    <Layout title="Şikayet Detayı">
      <div className="feedback-page">
        <div className="card detail">
          <div className="row">
            <div className="k">Başlık</div><div className="v">{item.title}</div>
          </div>
          <div className="row">
            <div className="k">Tür</div><div className="v">{item.type}</div>
          </div>
          <div className="row">
            <div className="k">Mağaza</div>
            <div className="v">
              {item.store?.code ? `${item.store.code} – ` : ""}{item.store?.name} {item.store?.city ? `(${item.store.city})` : ""}
            </div>
          </div>
          {item.employeeName && (
            <div className="row">
              <div className="k">Personel</div><div className="v">{item.employeeName}</div>
            </div>
          )}
          <div className="row">
            <div className="k">Metin</div><div className="v prewrap">{item.message}</div>
          </div>
          {item.image && (
            <div className="image-wrap">
              <img src={`/${item.image}`} alt="complaint" />
            </div>
          )}
          <div className="row">
            <div className="k">Oluşturulma</div><div className="v">{new Date(item.createdAt).toLocaleString("tr-TR")}</div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
