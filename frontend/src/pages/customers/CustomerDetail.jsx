// src/pages/customers/CustomerDetail.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import { getAvatarUrl } from "../../utils/getAssetUrl";
import "./CustomerDetail.scss";

const PERIOD_TR = {
  BELIRTILMEDI: "Belirtilmedi",
  HAFTALIK: "1 Haftalık",
  IKIHAFTALIK: "2 Haftalık",
  AYLIK: "1 Aylık",
  IKIAYLIK: "2 Aylık",
  UCAYLIK: "3 Aylık",
};

const ONLINE_MS = 2 * 60 * 1000;
const IDLE_MS = 10 * 60 * 1000;

/* --- Erişim listesi (müşteri) --- */
function CustomerAccessList({ customerId }) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/access/customer/${customerId}`);
        const list = Array.isArray(data?.grants) ? data.grants : (Array.isArray(data) ? data : []);
        setRows(list);
      } catch {
        /* sessiz düş */
      }
    })();
  }, [customerId]);

  if (!rows.length) return <div className="empty">Erişim sahibi yok.</div>;

  return (
    <table className="table">
      <thead>
        <tr>
          <th>Kişi</th>
          <th>Rol</th>
          <th>Kapsam</th>
          <th>Detay</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((g) => (
          <tr key={g.id}>
            <td className="strong">
              {(g.owner?.firstName || "") + " " + (g.owner?.lastName || "")}{" "}
              <span className="muted">({g.owner?.email})</span>
            </td>
            <td>{g.owner?.role || "—"}</td>
            <td>{g.scopeType === "CUSTOMER" ? "Müşteri-Genel" : "Mağaza"}</td>
            <td>
              {g.scopeType === "CUSTOMER"
                ? (g.customer?.title || g.customerId)
                : (g.store?.name || g.storeId)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState(null);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [query, setQuery] = useState("");

  const filteredStores = useMemo(() => {
    const t = query.trim().toLowerCase();
    if (!t) return stores;
    return stores.filter((s) =>
      [s.name, s.code, s.city, s.phone, s.manager]
        .some((v) => (v ?? "").toString().toLowerCase().includes(t))
    );
  }, [query, stores]);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/customers/${id}`);
      setCustomer(data);
      setStores(Array.isArray(data?.stores) ? data.stores : []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Müşteri bilgisi alınamadı");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Presence
  const presence = useMemo(() => {
    const last = customer?.lastSeenAt ? new Date(customer.lastSeenAt).getTime() : 0;
    if (!last) return { cls: "status-offline", label: "Offline" };
    const diff = Date.now() - last;
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
    const mo = Math.floor(g / 30);
    if (mo < 12) return `${mo} ay önce`;
    const y = Math.floor(mo / 12);
    return `${y} yıl önce`;
  };

  const fmtDate = (val) => {
    if (!val) return "—";
    try { return new Date(val).toLocaleString("tr-TR"); }
    catch { return String(val); }
  };

  const fmtPeriod = (p) => PERIOD_TR[p] || "Belirtilmedi";

  const goEditCustomer = () => navigate(`/admin/customers/${id}/edit`);

  const deleteCustomer = async () => {
    if (!window.confirm("Bu müşteriyi silmek istediğinize emin misiniz?")) return;
    try {
      await api.delete(`/customers/${id}`);
      toast.success("Müşteri silindi");
      navigate("/admin/customers");
    } catch (err) {
      toast.error(err.response?.data?.message || "Silinemedi");
    }
  };

  const removeAvatar = async () => {
    if (!window.confirm("Profil fotoğrafını kaldırmak istiyor musunuz?")) return;
    try {
      setRemoving(true);
      await api.delete(`/upload/avatar/customer/${id}`);
      setCustomer((p) => (p ? { ...p, profileImage: null, updatedAt: new Date().toISOString() } : p));
      toast.success("Profil fotoğrafı kaldırıldı");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Fotoğraf kaldırılamadı");
    } finally {
      setRemoving(false);
    }
  };

  const deleteStore = async (storeId) => {
    if (!window.confirm("Bu mağazayı silmek istiyor musunuz?")) return;
    const prev = stores;
    setStores((s) => s.filter((x) => x.id !== storeId));
    try {
      await api.delete(`/stores/${storeId}`);
      toast.success("Mağaza silindi");
    } catch (err) {
      setStores(prev);
      toast.error(err.response?.data?.message || "Silinemedi");
    }
  };
  const goStore   = (storeId) => navigate(`/admin/stores/${storeId}`);
  const stop      = (e) => e.stopPropagation();

  const avatarSrc = getAvatarUrl(customer?.profileImage);

  // ---- Operasyon metrikleri (STORE'lardan) ----
  const storeCount = stores.length;
  const totalArea = useMemo(
    () => stores.reduce((acc, s) => acc + (Number(s.areaM2) || 0), 0),
    [stores]
  );
  const placeTypes = useMemo(
    () => Array.from(new Set(stores.map(s => s.placeType).filter(Boolean))),
    [stores]
  );
  const pestTypes = useMemo(
   () => Array.from(new Set(stores.map(s => s.pestType).filter(Boolean))),
    [stores]
  );

  return (
    <Layout>
      <div className="customer-detail-page">
        <div className="header">
          {/* Sol blok: başlık + presence + avatar */}
          <div className="identity">
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

            <div className="avatar-stack">
              <div className="avatar-wrap">
                <img src={avatarSrc} alt="Profil" />
              </div>
              <button
                type="button"
                className="btn danger"
                onClick={removeAvatar}
                disabled={removing || !customer?.profileImage}
                title={!customer?.profileImage ? "Fotoğraf yok" : "Profil fotoğrafını kaldır"}
              >
                {removing ? "Kaldırılıyor..." : (customer?.profileImage ? "Kaldır" : "Fotoğraf Yok")}
              </button>
            </div>
          </div>

          {/* Sağ blok: aksiyonlar */}
          <div className="actions">
            <button className="btn btn-edit" onClick={goEditCustomer}>Düzenle</button>
            <button className="btn btn-danger" onClick={deleteCustomer}>Sil</button>
          </div>
        </div>

        {loading ? (
          <div className="card">Yükleniyor...</div>
        ) : !customer ? (
          <div className="card">Kayıt bulunamadı.</div>
        ) : (
          <>
            {/* Üst bilgi blokları */}
            <div className="top-grid">
              <section className="card">
                <div className="card-title">Genel Bilgiler</div>
                <div className="kv">
                  <div><b>Müşteri Kodu</b><span>{customer.code || "—"}</span></div>
                  <div><b>Şehir</b><span>{customer.city || "—"}</span></div>
                  <div><b>Email</b><span className="email">{customer.email || "—"}</span></div>
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

              {/* GÜNCEL: Operasyon bilgileri STORE'lardan türetiliyor */}
              <section className="card">
                <div className="card-title">Operasyon</div>
                <div className="kv">
                  <div><b>Mağaza Sayısı</b><span>{storeCount}</span></div>
                  <div><b>Toplam Uygulama Alanı (m²)</b><span>{totalArea || "—"}</span></div>
                  <div><b>Uygulama Yeri Tür(leri)</b><span>{placeTypes.length ? placeTypes.join(", ") : "—"}</span></div>
                  <div><b>Bakiye Gösterimi</b><span>{customer.showBalance ? "Evet" : "Hayır"}</span></div>
                  <div><b>Hedef Zararlı Tür(leri)</b><span>{pestTypes.length ? pestTypes.join(", ") : "—"}</span></div>
                </div>
              </section>

              <section className="card">
                <div className="card-title">Sistem</div>
                <div className="kv">
                  <div><b>Son Giriş</b><span>{fmtDate(customer.lastLoginAt)}</span></div>
                  <div><b>Son Görülme</b><span>{customer.lastSeenAt ? relTime(customer.lastSeenAt) : "—"}</span></div>
                  <div><b>Oluşturulma</b><span>{fmtDate(customer.createdAt)}</span></div>
                  <div><b>Güncelleme</b><span>{fmtDate(customer.updatedAt)}</span></div>
                </div>
              </section>
            </div>

            {/* Mağazalar + Erişim Sahipleri */}
            <div className="bottom-grid">
              <section className="card stores">
                <div className="card-title">Mağazalar</div>

                <div className="store-toolbar">
                  <div className="search">
                    <input
                      type="search"
                      placeholder="Mağaza ara (ad, kod, şehir, yetkili)…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                    {query && (
                      <button
                        type="button"
                        className="clear"
                        aria-label="Temizle"
                        onClick={() => setQuery("")}
                      >
                        ×
                      </button>
                    )}
                  </div>

                  <Link className="btn primary" to={`/admin/customers/${id}/stores/new`}>
                    + Mağaza Ekle
                  </Link>
                </div>

                {stores.length === 0 ? (
                  <div className="empty">Kayıtlı mağaza yok.</div>
                ) : filteredStores.length === 0 ? (
                  <div className="empty">Aramanıza uygun mağaza bulunamadı.</div>
                ) : (
                  <div className="store-table-wrap">
                    <table className="store-table">
                      <thead>
                        <tr>
                          <th>Ad</th>
                          <th>Kod</th>
                          <th>Şehir</th>
                          <th>Telefon</th>
                          <th>Yetkili</th>
                          <th>Durum</th>
                          <th>İşlem</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStores.map((s) => (
                          <tr
                            key={s.id}
                            className="clickable"
                            role="button"
                            tabIndex={0}
                            onClick={() => goStore(s.id)}
                            onKeyDown={(e) => { if (e.key === "Enter") goStore(s.id); }}
                          >
                            <td className="strong name-cell">
                              {s.name}
                              {!s.latitude || !s.longitude ? (
                                <span className="badge warn" title="Koordinat yok">Koordinat Yok</span>
                              ) : (
                                <span className="badge ok" title={`${s.latitude}, ${s.longitude}`}>Konum Var</span>
                              )}
                            </td>
                            <td>{s.code || "—"}</td>
                            <td>{s.city || "—"}</td>
                            <td>{s.phone || "—"}</td>
                            <td>{s.manager || "—"}</td>
                            <td>
                              <span className={`badge ${s.isActive ? "ok" : "no"}`}>
                                {s.isActive ? "Aktif" : "Pasif"}
                              </span>
                            </td>

                            {/* İşlemler – satır tıklamasını engelliyoruz */}
                            <td className="actions" onClick={stop}>
                              <Link className="btn" to={`/admin/stores/${s.id}/edit`}>Düzenle</Link>
                              <button className="btn danger" onClick={(e) => { e.stopPropagation(); deleteStore(s.id); }}>
                                Sil
                              </button>
                              {s.latitude != null && s.longitude != null && (
                                <a
                                  className="btn ghost"
                                  href={`https://www.google.com/maps?q=${s.latitude},${s.longitude}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  title="Haritada Aç"
                                >
                                  Haritada Aç
                                </a>
                              )}
                            </td>

                            {/* En sağda “Mağaza” sayfası */}
                            <td className="go" onClick={stop}>
                              <Link className="btn primary" to={`/admin/stores/${s.id}`}>
                                Mağaza
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="card access">
                <div className="card-title">
                  Erişim Sahipleri
                  <Link className="btn" style={{ marginLeft: 8 }} to={`/admin/customers/${id}/access`}>Yönet</Link>
                </div>
                <CustomerAccessList customerId={id} />
              </section>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
