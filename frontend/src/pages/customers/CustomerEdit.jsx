import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./CustomerEdit.scss";

// Yardımcı: public URL (uploads için)
const toPublicUrl = (p, cacheKey) => {
  if (!p) return "/noavatar.jpg";
  let clean = String(p).replace(/\\/g, "/");
  if (!clean.startsWith("/")) clean = "/" + clean;
  const BASE = import.meta.env.VITE_BACKEND_URL || "";
  const bust = cacheKey ? `?v=${encodeURIComponent(cacheKey)}` : "";
  return `${BASE}${clean}${bust}`;
};

const PERIOD_TR = {
  BELIRTILMEDI: "Belirtilmedi",
  HAFTALIK: "1 Haftalık",
  IKIHAFTALIK: "2 Haftalık",
  AYLIK: "1 Aylık",
  IKIAYLIK: "2 Aylık",
  UCAYLIK: "3 Aylık",
};

const PERIODS = Object.keys(PERIOD_TR); // enum

const PEST_TYPES = ["BELIRTILMEDI", "KEMIRGEN", "HACCADI", "UCAN"];
const PLACE_TYPES = ["BELIRTILMEDI", "OFIS", "DEPO", "MAGAZA", "FABRIKA"];

export default function CustomerEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState([]);

  // presence
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

  const fmtPeriod = (p) => PERIOD_TR[p] || "Belirtilmedi";

  // load
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [{ data: c }, emps] = await Promise.all([
          api.get(`/customers/${id}`),
          // admin listesi: sorumlu atamak için
          api.get("/employees").catch(() => ({ data: [] })),
        ]);
        setCustomer({
          ...c,
          // null/undefined guard — input kontrollü olsun
          code: c.code || "",
          title: c.title || "",
          accountingTitle: c.accountingTitle || "",
          email: c.email || "",
          contactFullName: c.contactFullName || "",
          phone: c.phone || "",
          gsm: c.gsm || "",
          taxOffice: c.taxOffice || "",
          taxNumber: c.taxNumber || "",
          address: c.address || "",
          city: c.city || "",
          pestType: c.pestType || "BELIRTILMEDI",
          areaM2: c.areaM2 ?? "",
          placeType: c.placeType || "BELIRTILMEDI",
          showBalance: !!c.showBalance,
          visitPeriod: c.visitPeriod || "BELIRTILMEDI",
          employeeId: c.employee?.id || null,
        });
        setEmployees(Array.isArray(emps.data) ? emps.data : []);
      } catch (err) {
        toast.error(err.response?.data?.message || "Müşteri bilgisi alınamadı");
        navigate("/admin/customers");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  const onChange = (key, val) => {
    setCustomer((p) => ({ ...p, [key]: val }));
  };

  const save = async (e) => {
    e?.preventDefault?.();
    if (!customer) return;
    try {
      setSaving(true);
      // (Varsayım) Backend: PUT /api/customers/:id
      await api.put(`/customers/${id}`, {
        code: customer.code?.trim(),
        title: customer.title?.trim(),
        accountingTitle: customer.accountingTitle?.trim() || null,
        email: customer.email?.trim() || null,
        contactFullName: customer.contactFullName?.trim() || null,
        phone: customer.phone?.trim() || null,
        gsm: customer.gsm?.trim() || null,
        taxOffice: customer.taxOffice?.trim() || null,
        taxNumber: customer.taxNumber?.trim() || null,
        address: customer.address?.trim() || null,
        city: customer.city?.trim() || null,
        pestType: customer.pestType || "BELIRTILMEDI",
        areaM2: customer.areaM2 ? Number(customer.areaM2) : null,
        placeType: customer.placeType || "BELIRTILMEDI",
        showBalance: !!customer.showBalance,
        visitPeriod: customer.visitPeriod || "BELIRTILMEDI",
        employeeId: customer.employeeId ? Number(customer.employeeId) : null,
      });
      toast.success("Müşteri güncellendi");
      navigate(`/admin/customers/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Güncellenemedi");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !customer) {
    return (
      <Layout>
        <div className="customer-edit-page"><div className="card">Yükleniyor...</div></div>
      </Layout>
    );
  }

  // Sadece gösterim amaçlı avatar (müşteri için upload/kaldır ayrı aşama)
  const avatarUrl = toPublicUrl(customer.profileImage, customer.updatedAt || Date.now());

  return (
    <Layout>
      <div className="customer-edit-page">
        <div className="header">
          <div className="title-wrap">
            <h1 className="title">Müşteri Düzenle</h1>
            <span className={`presence ${presence.cls}`} title={`Son görüldü: ${relTime(customer.lastSeenAt)}`}>
              <span className="dot" />
              {presence.label}
            </span>
          </div>
          <div className="actions">
            <Link className="btn" to={`/admin/customers/${id}`}>İptal</Link>
            <button className="btn btn-save" onClick={save} disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</button>
          </div>
        </div>

        <div className="grid">
          {/* Sol: Form */}
          <section className="card form-card">
            <form onSubmit={save} className="form-grid">
              <div className="group">
                <div className="gtitle">Genel Bilgiler</div>
                <div className="fields">
                  <label>
                    <span>Müşteri Kodu *</span>
                    <input value={customer.code} onChange={(e)=>onChange("code", e.target.value)} required />
                  </label>
                  <label>
                    <span>Unvan *</span>
                    <input value={customer.title} onChange={(e)=>onChange("title", e.target.value)} required />
                  </label>
                  <label>
                    <span>Hesap Ünvanı</span>
                    <input value={customer.accountingTitle} onChange={(e)=>onChange("accountingTitle", e.target.value)} />
                  </label>
                  <label>
                    <span>E-posta</span>
                    <input type="email" value={customer.email} onChange={(e)=>onChange("email", e.target.value)} />
                  </label>
                  <label className="full">
                    <span>Adres</span>
                    <textarea rows={2} value={customer.address} onChange={(e)=>onChange("address", e.target.value)} />
                  </label>
                  <label>
                    <span>Şehir</span>
                    <input value={customer.city} onChange={(e)=>onChange("city", e.target.value)} />
                  </label>
                  <label>
                    <span>Ziyaret Periyodu</span>
                    <select value={customer.visitPeriod} onChange={(e)=>onChange("visitPeriod", e.target.value)}>
                      {PERIODS.map(p => <option key={p} value={p}>{PERIOD_TR[p]}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Sorumlu Personel</span>
                    <select value={customer.employeeId || ""} onChange={(e)=>onChange("employeeId", e.target.value || null)}>
                      <option value="">(atanmamış)</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.fullName} — {emp.email}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="group">
                <div className="gtitle">İletişim</div>
                <div className="fields">
                  <label>
                    <span>Yetkili</span>
                    <input value={customer.contactFullName} onChange={(e)=>onChange("contactFullName", e.target.value)} />
                  </label>
                  <label>
                    <span>Telefon</span>
                    <input value={customer.phone} onChange={(e)=>onChange("phone", e.target.value)} />
                  </label>
                  <label>
                    <span>GSM</span>
                    <input value={customer.gsm} onChange={(e)=>onChange("gsm", e.target.value)} />
                  </label>
                  <label>
                    <span>Vergi Dairesi</span>
                    <input value={customer.taxOffice} onChange={(e)=>onChange("taxOffice", e.target.value)} />
                  </label>
                  <label>
                    <span>Vergi No / TCKN</span>
                    <input value={customer.taxNumber} onChange={(e)=>onChange("taxNumber", e.target.value)} />
                  </label>
                </div>
              </div>

              <div className="group">
                <div className="gtitle">Operasyon</div>
                <div className="fields">
                  <label>
                    <span>Hedef Zararlı</span>
                    <select value={customer.pestType} onChange={(e)=>onChange("pestType", e.target.value)}>
                      {PEST_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Uygulama Alanı (m²)</span>
                    <input type="number" inputMode="decimal" value={customer.areaM2} onChange={(e)=>onChange("areaM2", e.target.value)} />
                  </label>
                  <label>
                    <span>Uygulama Yeri</span>
                    <select value={customer.placeType} onChange={(e)=>onChange("placeType", e.target.value)}>
                      {PLACE_TYPES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </label>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={!!customer.showBalance}
                      onChange={(e)=>onChange("showBalance", e.target.checked)}
                    />
                    <span>Bakiye gösterimi açık</span>
                  </label>
                </div>
              </div>

              <div className="save-row">
                <button type="button" className="btn" onClick={()=>navigate(`/admin/customers/${id}`)}>İptal</button>
                <button type="submit" className="btn btn-save" disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</button>
              </div>
            </form>
          </section>

          {/* Sağ: Avatar gösterimi */}
          <aside className="card avatar-card">
            <div className="card-title">Profil Fotoğrafı</div>
            <div className="avatar-box">
              <img src={avatarUrl} alt="Müşteri" />
            </div>
            <div className="hint">Müşteri avatar yönetimi yakında eklenecek.</div>
          </aside>
        </div>
      </div>
    </Layout>
  );
}
