import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./CustomerDetail.scss";

const PERIOD_TR = {
  BELIRTILMEDI: "Belirtilmedi",
  HAFTALIK: "1 Haftalık",
  IKIHAFTALIK: "2 Haftalık",
  AYLIK: "1 Aylık",
  IKIAYLIK: "2 Aylık",
  UCAYLIK: "3 Aylık",
};

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/customers/${id}`);
      setCustomer(data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Müşteri bilgisi alınamadı");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const ONLINE_MS = 2 * 60 * 1000;
  const IDLE_MS = 10 * 60 * 1000;

  const presence = useMemo(() => {
    const d = customer?.lastSeenAt ? new Date(customer.lastSeenAt).getTime() : 0;
    if (!d) return { cls: "status-offline", label: "Offline" };
    const diff = Date.now() - d;
    if (diff <= ONLINE_MS) return { cls: "status-online", label: "Online" };
    if (diff <= IDLE_MS) return { cls: "status-idle", label: "Idle" };
    return { cls: "status-offline", label: "Offline" };
  }, [customer?.lastSeenAt]);

  const relTime = (dt) => {
    if (!dt) return "bilgi yok";
    const diff = Math.max(0, Date.now() - new Date(dt).getTime());
    const s = Math.floor(diff / 1000);
    if (s < 30) return "az önce";
    if (s < 60) return `${s} sn önce`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} dk önce`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} sa önce`;
    const g = Math.floor(h / 24);
    if (g < 30) return `${g} gün önce`;
    const ay = Math.floor(g / 30);
    if (ay < 12) return `${ay} ay önce`;
    const y = Math.floor(ay / 12);
    return `${y} yıl önce`;
  };

  const fmt = (val) => {
    if (!val) return "—";
    try { return new Date(val).toLocaleString("tr-TR"); }
    catch { return String(val); }
  };
  const fmtPeriod = (p) => PERIOD_TR[p] || "Belirtilmedi";

  const handleDelete = async () => {
    if (!window.confirm("Bu müşteriyi silmek istediğinize emin misiniz?")) return;
    try {
      await api.delete(`/customers/${id}`);
      toast.success("Müşteri silindi");
      navigate("/admin/customers");
    } catch (err) {
      toast.error(err.response?.data?.message || "Silinemedi");
    }
  };
  const goEdit = () => navigate(`/admin/customers/${id}/edit`);

  return (
    <Layout>
      <div className="customer-detail-page">
        <div className="header">
          <div className="title-wrap">
            <h1 className="title">{customer?.title || "—"}</h1>
            <span
              className={`presence ${presence.cls}`}
              title={`Son görüldü: ${relTime(customer?.lastSeenAt)}`}
            >
              <span className="dot" />
              {presence.label}
            </span>
          </div>

          <div className="actions">
            <button className="btn btn-edit" onClick={goEdit}>Düzenle</button>
            <button className="btn btn-danger" onClick={handleDelete}>Sil</button>
          </div>
        </div>

        {loading ? (
          <div className="card">Yükleniyor...</div>
        ) : !customer ? (
          <div className="card">Kayıt bulunamadı.</div>
        ) : (
          <>
            {/* ÜST GRID: bilgi kartları */}
            <div className="top-grid">
              <section className="card">
                <div className="card-title">Genel Bilgiler</div>
                <div className="kv">
                  <div><b>Müşteri Kodu</b><span>{customer.code || "—"}</span></div>
                  <div><b>Şehir</b><span>{customer.city || "—"}</span></div>
                  <div><b>Email</b><span>{customer.email || "—"}</span></div>
                  <div><b>Ziyaret Periyodu</b><span>{fmtPeriod(customer.visitPeriod)}</span></div>
                  <div><b>Sorumlu Personel</b><span>{customer.employee?.fullName || "—"}</span></div>
                  <div className="full"><b>Adres</b><span>{customer.address || "—"}</span></div>
                </div>
              </section>

              <section className="card">
                <div className="card-title">İletişim</div>
                <div className="kv">
                  <div><b>Yetkili</b><span>{customer.contactFullName || "—"}</span></div>
                  <div><b>Telefon</b><span>{customer.phone || "—"}</span></div>
                  <div><b>GSM</b><span>{customer.gsm || "—"}</span></div>
                  <div><b>Vergi Dairesi</b><span>{customer.taxOffice || "—"}</span></div>
                  <div><b>Vergi No / TCKN</b><span>{customer.taxNumber || "—"}</span></div>
                </div>
              </section>

              <section className="card">
                <div className="card-title">Operasyon</div>
                <div className="kv">
                  <div><b>Hedef Zararlı</b><span>{customer.pestType || "—"}</span></div>
                  <div><b>Uygulama Alanı (m²)</b><span>{customer.areaM2 ?? "—"}</span></div>
                  <div><b>Uygulama Yeri</b><span>{customer.placeType || "—"}</span></div>
                  <div><b>Bakiye Gösterimi</b><span>{customer.showBalance ? "Evet" : "Hayır"}</span></div>
                </div>
              </section>

              <section className="card">
                <div className="card-title">Sistem</div>
                <div className="kv">
                  <div><b>Son Giriş</b><span>{fmt(customer.lastLoginAt)}</span></div>
                  <div><b>Son Görülme</b><span>{customer.lastSeenAt ? relTime(customer.lastSeenAt) : "—"}</span></div>
                  <div><b>Oluşturulma</b><span>{fmt(customer.createdAt)}</span></div>
                  <div><b>Güncelleme</b><span>{fmt(customer.updatedAt)}</span></div>
                </div>
              </section>
            </div>

            {/* ALT GRID: Mağazalar (2/3) + Erişim Sahipleri (1/3) */}
            <div className="bottom-grid">
              <section className="card stores">
                <div className="card-title">Mağazalar</div>
                <div className="empty">Bu müşteri için mağaza yönetimi yakında eklenecek.</div>
              </section>

              <section className="card access">
                <div className="card-title">Erişim Sahipleri</div>
                <div className="empty">Mağaza sorumluları & grup yöneticileri burada yönetilecek.</div>
              </section>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
