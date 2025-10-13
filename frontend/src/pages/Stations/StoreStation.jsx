import { useEffect, useState, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
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

const ACT_PATH = {
  FARE_YEMLEME: "rodent-bait",
  CANLI_YAKALAMA: "live-catch",
  ELEKTRIKLI_SINEK_TUTUCU: "efk",
  BOCEK_MONITOR: "insect-monitor",
  GUVE_TUZAGI: "moth-trap",
};

export default function StoreStations() {

  const navigate = useNavigate();

  const { storeId } = useParams();

  const [store, setStore] = useState(null);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);

  // YENİ ekleme modalı
  const [createOpen, setCreateOpen] = useState(false);

  // En son ziyaret id (aktivasyon sayfasını doğrudan ziyaret bağlamında açmak için)
  const [lastVisitId, setLastVisitId] = useState(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);

    // 1) Mağaza
    try {
      const { data: s } = await api.get(`/stores/${storeId}`);
      let customerTitle = s.customer?.title || s.customerTitle || "";
      if (!customerTitle && s.customerId) {
        try {
          const { data: c } = await api.get(`/customers/${s.customerId}`);
          customerTitle = c?.title || "";
        } catch {}
      }
      setStore({ ...s, customerTitle });
    } catch (e) {
      toast.error(e?.response?.data?.message || "Mağaza bilgisi alınamadı");
      setStore(null);
    }

    // 2) İstasyonlar
    try {
      let list = [];
      try {
        const { data } = await api.get(`/stations/store/${storeId}`);
        list = data;
      } catch {
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

    // 3) Son ziyaret (varsa)
    try {
      let visits = [];
      try {
        const { data } = await api.get(`/visits/store/${storeId}`);
        visits = data;
      } catch {
        const { data } = await api.get(`/stores/${storeId}/visits`);
        visits = data;
      }
      if (Array.isArray(visits) && visits.length) {
        visits.sort((a, b) => new Date(b.date) - new Date(a.date));
        setLastVisitId(visits[0].id);
      } else {
        setLastVisitId(null);
      }
    } catch {
      setLastVisitId(null);
    }

    setLoading(false);
  }, [storeId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const del = async (id) => {
    if (!window.confirm("Bu istasyonu silmek istiyor musunuz?")) return;
    const prev = stations;
    setStations(arr => arr.filter(x => x.id !== id));
    try {
      try { await api.delete(`/stations/${id}`); }
      catch { await api.delete(`/stores/${storeId}/stations/${id}`); }
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

  const handleCreated = () => { setCreateOpen(false); fetchAll(); };

  // Aktivasyon sayfasına DOĞRUDAN giden rota (varsa son ziyaretle)
const activationHref = (station) => {
  const slug = ACT_PATH[station.type];
  if (!slug) return null;
  const base = `/admin/stores/${storeId}/stations/${station.id}/activation/${slug}`;
  const withVisit = lastVisitId
    ? `/admin/stores/${storeId}/visits/${lastVisitId}/stations/${station.id}/activation/${slug}`
    : base;
  // console.log("ACT PATH ->", withVisit); // bir kere bak
  return withVisit;
};


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
            <button className="btn primary" onClick={() => setCreateOpen(true)}>+ İstasyon Ekle</button>
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
              <button className="btn primary" onClick={() => setCreateOpen(true)}>Ekle</button>
            </div>

            {stations.map((st) => (
              <div key={st.id} className="card station-card">
                <div className="card-title">
                  <Link
                    to={`/admin/stations/${st.id}`}
                    className="link"
                    onClick={(e) => e.stopPropagation()}   // << ekle
                  >
                    {TYPE_TR[st.type] || st.type}
                  </Link>
                </div>
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

                <div className="actions" onClick={(e)=> e.stopPropagation()}>
                  <button className="btn indigo" onClick={() => qrPreview(st.code)}>QR Önizle</button>

                  {/* GÜNCELLE => StationDetail + modal */}
                  <Link
                    className="btn warn"
                    to={`/admin/stations/${st.id}/edit`}
                    title="Güncelle"
                  >
                    Güncelle
                  </Link>

                  <button className="btn danger" onClick={() => del(st.id)}>Sil</button>

                  {/* AKTİVASYON: doğrudan oluşturma sayfası */}
                  {ACT_PATH[st.type] ? (
                    <button
                      type="button"
                      className="btn primary"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const slug = ACT_PATH[st.type];
                        if (!slug) return toast.error("Bu istasyon tipi için aktivasyon sayfası yok.");
                        navigate(`/admin/stores/${storeId}/stations/${st.id}/activation/${slug}`);
                      }}
                      title="Aktivasyon Ekle"
                    >
                      Aktivasyon
                    </button>
                  ) : (
                    <button className="btn" disabled>Aktivasyon</button>
                  )}

                </div>
              </div>
            ))}

            {stations.length === 0 && (
              <div className="card empty-wide">Bu mağazaya ait istasyon bulunmuyor.</div>
            )}
          </div>
        )}

        {createOpen && (
          <StationModal
            storeId={Number(storeId)}
            initial={null}
            onClose={() => setCreateOpen(false)}
            onSaved={handleCreated}
          />
        )}
      </div>
    </Layout>
  );
}
