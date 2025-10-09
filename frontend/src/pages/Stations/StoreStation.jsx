// src/pages/stores/StoreStations.jsx
import { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import StationModal from "../../components/StationModal.jsx";
import "./StoreStations.scss";

const TYPE_TR = {
  FARE_YEMLEME: "Fare Yemleme İstasyonu",
  CANLI_YAKALAMA: "Canlı Yakalama İstasyonu",
  ELEKTRIKLI_SINEK_TUTUCU: "Elektrikli Sinek Tutucu",
  BOCEK_MONITOR: "Böcek Monitörü",
  GUVE_TUZAGI: "Güve Tuzağı",
};

export default function StoreStations({ openMode }) {
  const { storeId, stationId } = useParams();

  const [store, setStore] = useState(null);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editStation, setEditStation] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);

    // 1) Mağazayı getir (tek başına, hata olsa bile UI'yı bloklamayalım)
    try {
      const { data: s } = await api.get(`/stores/${storeId}`);
      let customerTitle = s.customer?.title || s.customerTitle || "";
      if (!customerTitle && s.customerId) {
        try {
          const { data: c } = await api.get(`/customers/${s.customerId}`);
          customerTitle = c?.title || "";
        } catch {/* sessiz */}
      }
      setStore({ ...s, customerTitle });
    } catch (e) {
      toast.error(e?.response?.data?.message || "Mağaza bilgisi alınamadı");
      setStore(null);
    }

    // 2) İstasyon listesi – farklı backend'lere uyum için fallback
    try {
      let list = [];
      try {
        const { data } = await api.get(`/stations/store/${storeId}`);
        list = data;
      } catch (e1) {
        // örn: /stores/:id/stations kullanılıyordur
        const { data } = await api.get(`/stores/${storeId}/stations`);
        list = data;
      }
      setStations(Array.isArray(list) ? list : []);
    } catch (e) {
      setStations([]);
      if (e?.response?.status === 404) {
        toast.warn("İstasyon uçları bulunamadı (404). Liste boş gösterilecek.");
      } else {
        toast.error(e?.response?.data?.message || "İstasyonlar alınamadı");
      }
    }

    setLoading(false);
  }, [storeId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (openMode === "create") { setEditStation(null); setModalOpen(true); }
  }, [openMode]);

  useEffect(() => {
    if (openMode === "edit" && stationId) {
      (async () => {
        try {
          const { data } = await api.get(`/stations/${stationId}`);
          setEditStation(data);
          setModalOpen(true);
        } catch {
          toast.error("İstasyon bulunamadı");
        }
      })();
    }
  }, [openMode, stationId]);

  const del = async (id) => {
    if (!window.confirm("Bu istasyonu silmek istiyor musunuz?")) return;
    const prev = stations;
    setStations((arr) => arr.filter((x) => x.id !== id));
    try {
      // fallback: bazı backend'ler /stores/:sid/stations/:id ister
      try {
        await api.delete(`/stations/${id}`);
      } catch {
        await api.delete(`/stores/${storeId}/stations/${id}`);
      }
      toast.success("İstasyon silindi");
    } catch (e) {
      setStations(prev);
      toast.error(e?.response?.data?.message || "Silinemedi");
    }
  };

  const qrPreview = (code) => {
    if (!code) return toast.info("Barkod/QR bulunamadı");
    window.open(`/qr/preview/${encodeURIComponent(code)}`, "_blank", "noopener");
  };

  const handleSaved = () => { setModalOpen(false); setEditStation(null); fetchAll(); };

  return (
    <Layout>
      <div className="store-stations-page">
        <div className="page-head">
          <div>
            <h1>{store?.name || "Mağaza"} – İstasyonlar</h1>
            <div className="sub">
              {loading ? "Mağaza bilgisi yükleniyor…" : (
                <>
                  Mağaza: <b>{store?.name || "—"}</b> • Müşteri:{" "}
                  {store?.customerId ? (
                    <Link to={`/admin/customers/${store.customerId}`}>
                      {store?.customerTitle || "—"}
                    </Link>
                  ) : "—"}
                </>
              )}
            </div>
          </div>

          <div className="head-actions">
            <button className="btn primary" onClick={() => { setEditStation(null); setModalOpen(true); }}>
              + İstasyon Ekle
            </button>
            <Link className="btn ghost" to={`/admin/stores/${storeId}`}>Mağaza Sayfası</Link>
          </div>
        </div>

        {loading ? (
          <div className="card">Yükleniyor…</div>
        ) : (
          <div className="station-grid">
            <div className="card new-card">
              <div className="title">Yeni İstasyon Oluşturun</div>
              <p>Yeni bir istasyon oluşturun, barkod &amp; QR bilgilerinin benzersiz olmasına dikkat edin.</p>
              <button className="btn primary" onClick={() => { setEditStation(null); setModalOpen(true); }}>Ekle</button>
            </div>

            {stations.map((st) => (
              <div key={st.id} className="card station-card">
                <div className="card-title">{TYPE_TR[st.type] || st.type}</div>
                <div className="kv">
                  <div><b>Adı:</b> <span>{st.name || "—"}</span></div>
                  <div className="qr">
                    <b>Barkod &amp; QR:</b>{" "}
                    {st.code ? (
                      <button className="link-like" onClick={() => qrPreview(st.code)} title="QR Önizle">
                        {st.code}
                      </button>
                    ) : "—"}
                  </div>
                  <div><b>Tarih:</b> <span>{st.createdAt ? new Date(st.createdAt).toLocaleString("tr-TR") : "—"}</span></div>
                </div>
                <div className="actions">
                  <button className="btn indigo" onClick={() => qrPreview(st.code)}>QR Önizle</button>
                  <button className="btn warn" onClick={() => { setEditStation(st); setModalOpen(true); }}>Güncelle</button>
                  <button className="btn danger" onClick={() => del(st.id)}>Sil</button>
                </div>
              </div>
            ))}

            {stations.length === 0 && <div className="card empty-wide">Bu mağazaya ait istasyon bulunmuyor.</div>}
          </div>
        )}

        {modalOpen && (
          <StationModal
            storeId={Number(storeId)}
            initial={editStation}
            onClose={() => setModalOpen(false)}
            onSaved={handleSaved}
          />
        )}
      </div>
    </Layout>
  );
}
