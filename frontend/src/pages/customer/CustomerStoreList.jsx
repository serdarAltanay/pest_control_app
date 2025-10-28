import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./CustomerStoreList.scss";

export default function CustomerStoreList() {
  const [stores, setStores] = useState(null); // null=yükleniyor
  const navigate = useNavigate();

  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        let arr = [];
        // 1) Tercih: /customer/stores (server alias → /stores/mine)
        try {
          const { data } = await api.get("/customer/stores", { signal: ctrl.signal });
          arr = Array.isArray(data) ? data : [];
        } catch {
          // 2) Yedek: /stores/mine
          try {
            const { data } = await api.get("/stores/mine", { signal: ctrl.signal });
            arr = Array.isArray(data) ? data : [];
          } catch {
            // 3) Fallback: /stores?scope=self → {items:[]}
            const { data } = await api.get("/stores?scope=self", { signal: ctrl.signal });
            arr = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
          }
        }
        setStores(arr);
      } catch (e) {
        if (e?.name !== "CanceledError") {
          toast.error(e?.response?.data?.message || "Mağazalar alınamadı");
          setStores([]);
        }
      }
    })();
    return () => ctrl.abort();
  }, []);

  if (stores === null) {
    return (
      <Layout title="Mağazalarım">
        <div className="card">Yükleniyor…</div>
      </Layout>
    );
  }

  return (
    <Layout title="Mağazalarım">
      <div className="cust-store-list">
        {stores.length === 0 ? (
          <div className="card empty">Size atanmış mağaza bulunamadı.</div>
        ) : (
          <div className="grid">
            {stores.map((s) => (
              <div
                key={s.id}
                className="card store-card"
                role="button"
                onClick={() => navigate(`/customer/stores/${s.id}`)}
              >
                <div className="head">
                  <div className="name">{s.name || "Mağaza"}</div>
                  <span className={`badge ${s.isActive ? "ok" : "no"}`}>
                    {s.isActive ? "Aktif" : "Pasif"}
                  </span>
                </div>
                <div className="meta">
                  <div><b>Kod:</b> {s.code || "—"}</div>
                  <div><b>Şehir:</b> {s.city || "—"}</div>
                </div>
                <div className="actions" onClick={(e) => e.stopPropagation()}>
                  <Link className="btn ghost" to={`/customer/stores/${s.id}`}>Detay</Link>
                  <Link className="btn" to={`/customer/stores/${s.id}/nonconformities`}>Uygunsuzluklar</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
