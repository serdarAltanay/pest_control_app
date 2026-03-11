// src/pages/stores/StoreEdit.jsx
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import Layout from "../../components/Layout.jsx";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./StoreForm.scss";

const PERIOD_TR = {
  BELIRTILMEDI: "Belirtilmedi",
  HAFTALIK: "1 Haftalık",
  IKIHAFTALIK: "2 Haftalık",
  UCHAFTALIK: "3 Haftalık",
  AYLIK: "1 Aylık",
  IKIAYLIK: "2 Aylık",
  UCAYLIK: "3 Aylık",
  ALTYAYLIK: "6 Aylık",
  YILLIK: "1 Yıllık",
};

const VISIT_PERIODS = ["BELIRTILMEDI", "HAFTALIK", "IKIHAFTALIK", "UCHAFTALIK", "AYLIK", "IKIAYLIK", "UCAYLIK", "ALTYAYLIK", "YILLIK"];
const PEST_TYPES = ["BELIRTILMEDI", "KEMIRGEN", "HACCADI", "UCAN"];
const PLACE_TYPES = ["BELIRTILMEDI", "OFIS", "DEPO", "MAGAZA", "FABRIKA"];

export default function StoreEdit() {
  const { storeId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [store, setStore] = useState(null);
  const [form, setForm] = useState({
    name: "",
    code: "",
    shortName: "",
    city: "",
    address: "",
    phone: "",
    manager: "",
    isActive: true,
    visitPeriod: "BELIRTILMEDI",
    pestType: "BELIRTILMEDI",
    placeType: "BELIRTILMEDI",
    areaM2: "",
  });

  const validate = (v) => {
    if (!v.name?.trim()) return "Mağaza adı zorunludur.";
    if (v.phone && v.phone.replace(/\D/g, "").length < 10) return "Telefon hatalı görünüyor.";
    if (v.code && v.code.length > 12) return "Kod en fazla 12 karakter olmalı.";
    return null;
  };
  const isValid = !validate(form);

  const onSave = useCallback(async (e) => {
    e?.preventDefault?.();
    const err = validate(form);
    if (err) { toast.error(err); return; }
    try {
      setSaving(true);
      const payload = {
        ...form,
        areaM2: form.areaM2 === "" ? null : Number(form.areaM2),
        shortName: form.shortName || null,
      };
      const { data } = await api.put(`/stores/${storeId}`, payload);
      toast.success("Mağaza güncellendi");
      navigate(`/admin/customers/${data.store.customerId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }, [form, storeId, navigate]);

  // 1) SADECE FETCH — onSave dependency’sini KALDIR
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/stores/${storeId}`);
        if (cancelled) return;
        setStore(data);
        setForm({
          name: data.name || "",
          code: data.code || "",
          city: data.city || "",
          address: data.address || "",
          phone: data.phone || "",
          manager: data.manager || "",
          isActive: !!data.isActive,
          visitPeriod: data.visitPeriod || "BELIRTILMEDI",
          pestType: data.pestType || "BELIRTILMEDI",
          placeType: data.placeType || "BELIRTILMEDI",
          areaM2: data.areaM2 ?? "",
          shortName: data.shortName || "",
        });
      } catch (err) {
        if (!cancelled) toast.error(err.response?.data?.message || "Mağaza bilgisi alınamadı");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [storeId]); // ❗ sadece storeId

  // 2) Kısayol efektini ayrı tut
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        onSave(e);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onSave]);

  const onChange = (e) => {
    const { name, type, checked, value } = e.target;
    setForm((p) => ({ ...p, [name]: type === "checkbox" ? checked : value }));
  };

  // Google Maps adres önizleme URL'si
  const addressPreviewSrc = form.address?.trim()
    ? `https://maps.google.com/maps?q=${encodeURIComponent(form.address.trim())}&z=15&output=embed`
    : null;

  if (loading) {
    return (
      <Layout>
        <div className="store-form-page"><div className="card">Yükleniyor...</div></div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="store-form-page">
        <div className="page-header">
          <h1>Mağaza Düzenle</h1>
          <div className="header-actions">
            <Link className="btn ghost" to={`/admin/customers/${store.customerId}`}>Geri</Link>
          </div>
        </div>

        <form className="card form" onSubmit={onSave}>
          <div className="grid-2">
            <div>
              <label>Mağaza Adı *</label>
              <input name="name" value={form.name} onChange={onChange} required />
            </div>
            <div>
              <label>Sistem Kodu (Değiştirilemez)</label>
              <input name="code" value={form.code} disabled style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }} />
            </div>
            <div>
              <label>Kısaltma (Kısa Kod)</label>
              <input name="shortName" value={form.shortName} onChange={onChange} placeholder="Örn: MRKZ" />
            </div>
            <div>
              <label>Şehir</label>
              <input name="city" value={form.city} onChange={onChange} />
            </div>
            <div>
              <label>Telefon</label>
              <input name="phone" value={form.phone} onChange={onChange} />
            </div>
            <div className="col-span-2">
              <label>Adres</label>
              <textarea rows={3} name="address" value={form.address} onChange={onChange} />
            </div>
            <div>
              <label>Yetkili</label>
              <input name="manager" value={form.manager} onChange={onChange} />
            </div>

            <div>
              <label>Ziyaret Periyodu</label>
              <select name="visitPeriod" value={form.visitPeriod} onChange={onChange}>
                {VISIT_PERIODS.map((p) => (
                  <option key={p} value={p}>{PERIOD_TR[p] || p}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Uygulama Alanı (m²)</label>
              <input name="areaM2" type="number" min="0" step="1" value={form.areaM2} onChange={onChange} />
            </div>

            <div>
              <label>Hedef Zararlı</label>
              <select name="pestType" value={form.pestType} onChange={onChange}>
                {PEST_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label>Uygulama Yeri</label>
              <select name="placeType" value={form.placeType} onChange={onChange}>
                {PLACE_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="inline">
              <label className="chk">
                Mağaza Aktif Mi?
                <input type="checkbox" name="isActive" checked={form.isActive} onChange={onChange} />
              </label>
            </div>
          </div>

          {/* Adres Önizleme — Google Maps */}
          {addressPreviewSrc && (
            <div className="card sub">
              <div className="sub-title">Konum Önizleme</div>
              <p className="muted">Girilen adrese göre Google Maps önizlemesi aşağıda gösterilmektedir.</p>
              <div className="gmaps-preview">
                <iframe
                  title="address-preview"
                  src={addressPreviewSrc}
                  width="100%"
                  height={300}
                  style={{ border: 0, borderRadius: 10 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <div className="gmaps-links">
                <a
                  href={`https://www.google.com/maps?q=${encodeURIComponent(form.address.trim())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn ghost"
                >
                  🗺️ Google Maps'te Aç
                </a>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(form.address.trim())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn ghost"
                >
                  🧭 Yol Tarifi Al
                </a>
              </div>
            </div>
          )}

          <div className="actions">
            <button className="btn primary" disabled={saving || !isValid}>
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
            <Link className="btn ghost" to={`/admin/customers/${store.customerId}`}>İptal</Link>
          </div>
        </form>
      </div>
    </Layout>
  );
}
