// src/pages/admin/ComplaintDetail.jsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import "./ComplaintAdmin.scss";

export default function ComplaintDetailAdmin() {
  const { id } = useParams();
  const [item, setItem] = useState(null);

  useEffect(() => {
    api
      .get(`/feedback/admin/complaints/${id}`)
      .then(({ data }) => setItem(data))
      .catch(() => {});
  }, [id]);

  if (!item)
    return (
      <Layout title="Şikayet Detayı">
        <div className="complaints-admin">
          <div className="empty">Yükleniyor...</div>
        </div>
      </Layout>
    );

  const ownerName =
    (item.owner?.firstName || item.owner?.lastName)
      ? `${item.owner?.firstName || ""} ${item.owner?.lastName || ""}`.trim()
      : null;
  const ownerEmail = item.owner?.email;

  return (
    <Layout title="Şikayet Detayı">
      <div className="complaints-admin">
        <div className="detail card">
          <div className="row">
            <div className="k">Başlık</div>
            <div className="v">{item.title}</div>
          </div>

          <div className="row">
            <div className="k">Tür</div>
            <div className="v">{item.type}</div>
          </div>

          <div className="row">
            <div className="k">Mağaza</div>
            <div className="v">
              {item.store?.code ? `${item.store.code} – ` : ""}
              {item.store?.name} {item.store?.city ? `(${item.store.city})` : ""}
            </div>
          </div>

          {item.employeeName && (
            <div className="row">
              <div className="k">Personel</div>
              <div className="v">{item.employeeName}</div>
            </div>
          )}

          <div className="row">
            <div className="k">Metin</div>
            <div className="v prewrap">{item.message}</div>
          </div>

          {item.image && (
            <div className="image-wrap">
              <img src={`/${item.image}`} alt="complaint" />
            </div>
          )}

          <div className="row">
            <div className="k">Oluşturan</div>
            <div className="v">
              {ownerName ? <span>{ownerName}</span> : null}
              {ownerName && ownerEmail ? " — " : null}
              {ownerEmail ? (
                <a href={`mailto:${ownerEmail}`} title="E-posta gönder">
                  {ownerEmail}
                </a>
              ) : null}
            </div>
          </div>

          <div className="row">
            <div className="k">Oluşturulma</div>
            <div className="v">
              {new Date(item.createdAt).toLocaleString("tr-TR")}
            </div>
          </div>

          <div className="row">
            <div className="k">Görüldü</div>
            <div className="v">
              {item.adminSeenAt
                ? new Date(item.adminSeenAt).toLocaleString("tr-TR")
                : "Henüz değil"}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
