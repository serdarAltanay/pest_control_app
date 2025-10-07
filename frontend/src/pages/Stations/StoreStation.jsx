import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
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

export default function StoreStations({openMode}) {
  const { storeId, stationId } = useParams();
  const navigate = useNavigate();

  const [store, setStore] = useState(null);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editStation, setEditStation] = useState(null);

    useEffect(() => {
    if (openMode === "create") {
      setEditStation(null);
      setModalOpen(true);
    }
  }, [openMode]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [s, list] = await Promise.all([
        api.get(`/stores/${storeId}`),
        api.get(`/stations/store/${storeId}`),
      ]);
      setStore(s.data);
      setStations(Array.isArray(list.data) ? list.data : []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "İstasyonlar alınamadı");
    } finally {
      setLoading(false);
    }
  };

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
    if (!window.confirm("Bu istasyonu silmek istediğinize emin misiniz?")) return;
    const prev = stations;
    setStations((arr) => arr.filter((x) => x.id !== id));
    try {
      await api.delete(`/stations/${id}`);
      toast.success("İstasyon silindi");
    } catch (e) {
      setStations(prev);
      toast.error(e?.response?.data?.message || "Silinemedi");
    }
  };

  const qrPreview = (code) => {
    if (!code) return toast.info("Barkod/QR bulunamadı");
    // Projene göre bu URL’yi istediğin gibi güncelle
    window.open(`/qr/preview/${encodeURIComponent(code)}`, "_blank", "noopener");
  };

  return (
    <Layout>
      <div className="store-stations-page">
        <div className="page-head">
          <div>
            <h1>{store?.name || "Mağaza"} – İstasyonlar</h1>
            <div className="sub">
              {store?.name ? (
                <>
                  Mağaza: <b>{store.name}</b> • Müşteri:{" "}
                  <Link to={`/admin/customers/${store.customerId}`}>{store.customerTitle || "—"}</Link>
                </>
              ) : (
                "Mağaza bilgisi yükleniyor…"
              )}
            </div>
          </div>
          <div className="head-actions">
            <button
              className="btn primary"
              onClick={() => { setEditStation(null); setModalOpen(true); }}
            >
              + İstasyon Ekle
            </button>
            <Link className="btn ghost" to={`/admin/stores/${storeId}`}>Mağaza Sayfası</Link>
          </div>
        </div>

        {loading ? (
          <div className="card">Yükleniyor…</div>
        ) : (
          <div className="station-grid">
            {/* Yeni istasyon kutusu */}
            <div className="card new-card">
              <div className="title">Yeni İstasyon Oluşturun</div>
              <p>
                Yeni bir istasyon oluşturun, barkod & QR bilgilerinin benzersiz olmasına
                dikkat edin.
              </p>
              <button
                className="btn primary"
                onClick={() => { setEditStation(null); setModalOpen(true); }}
              >
                Ekle
              </button>
            </div>

            {/* İstasyon kartları */}
            {stations.map((st) => (
              <div key={st.id} className="card station-card">
                <div className="card-title">{TYPE_TR[st.type] || st.type}</div>
                <div className="kv">
                  <div><b>Adı:</b> <span>{st.name || "—"}</span></div>
                  <div className="qr">
                    <b>Barkod & QR:</b>{" "}
                    {st.code ? (
                      <button
                        className="link-like"
                        type="button"
                        onClick={() => qrPreview(st.code)}
                        title="QR Önizle"
                      >
                        {st.code}
                      </button>
                    ) : (<span>—</span>)}
                  </div>
                  <div><b>Tarih:</b> <span>{st.createdAt ? new Date(st.createdAt).toLocaleString("tr-TR") : "—"}</span></div>
                </div>

                <div className="actions">
                  <button className="btn indigo" onClick={() => qrPreview(st.code)}>QR Önizle</button>
                  <button
                    className="btn warn"
                    onClick={() => { setEditStation(st); setModalOpen(true); }}
                  >
                    Güncelle
                  </button>
                  <button className="btn danger" onClick={() => del(st.id)}>Sil</button>
                </div>
              </div>
            ))}

            {stations.length === 0 && (
              <div className="card empty-wide">Bu mağazaya ait istasyon bulunmuyor.</div>
            )}
          </div>
        )}

        {modalOpen && (
          <StationModal
            storeId={Number(storeId)}
            initial={editStation}
            onClose={() => setModalOpen(false)}
            onSaved={fetchAll}
          />
        )}
      </div>
    </Layout>
  );
}
