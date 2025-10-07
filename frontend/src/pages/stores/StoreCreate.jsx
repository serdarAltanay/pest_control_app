import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import Layout from "../../components/Layout.jsx";
import api from "../../api/axios";
import { toast } from "react-toastify";
import MapPickerCreate from "../../components/MapPickerCreate.jsx";
import "../../styles/Map.scss";
import "./StoreForm.scss";

const CITY_CENTER = {
  "İSTANBUL": { lat: 41.015137, lng: 28.97953 },
  "ANKARA"  : { lat: 39.92077,  lng: 32.85411 },
  "İZMİR"   : { lat: 38.423733, lng: 27.142826 },
  "KOCAELİ" : { lat: 40.85327,  lng: 29.88152 },
  "AYDIN"   : { lat: 37.8444,   lng: 27.8458 },
};
const TR_FALLBACK = { lat: 39.925533, lng: 32.866287 };

export default function StoreCreate() {
  const { customerId } = useParams();
  const navigate = useNavigate();

  const [saving, setSaving] = useState(false);
  const [initialCenter, setInitialCenter] = useState(TR_FALLBACK);

  const [form, setForm] = useState({
    name: "",
    code: "",
    city: "",
    address: "",
    phone: "",
    manager: "",
    isActive: true,
  });

  // Harita koordinatı controlled: [lat, lng] | null
  const [pos, setPos] = useState(null);

  // Müşterinin şehrine göre başlangıç merkezi
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get(`/customers/${customerId}`);
        if (cancelled) return;
        const key = (data.city || "").toUpperCase();
        setInitialCenter(CITY_CENTER[key] || TR_FALLBACK);
      } catch {
        if (!cancelled) {
          toast.error("Müşteri bilgisi alınamadı");
          setInitialCenter(TR_FALLBACK);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [customerId]);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((s) => ({ ...s, [name]: type === "checkbox" ? checked : value }));
  };

  const validate = (v) => {
    if (!v.name?.trim()) return "Mağaza adı zorunludur.";
    if (v.phone && v.phone.replace(/\D/g, "").length < 10) return "Telefon hatalı görünüyor.";
    if (v.code && v.code.length > 12) return "Kod en fazla 12 karakter olmalı.";
    return null;
  };

  const submit = useCallback(async (e) => {
    e?.preventDefault?.();
    const err = validate(form);
    if (err) { toast.error(err); return; }
    setSaving(true);
    try {
      await api.post("/stores", {
        ...form,
        customerId: Number(customerId),
        latitude:  Array.isArray(pos) ? pos[0] : null,
        longitude: Array.isArray(pos) ? pos[1] : null,
      });
      toast.success("Mağaza eklendi");
      navigate(`/admin/customers/${customerId}`);
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }, [form, pos, customerId, navigate]);

  // Ctrl/Cmd+S kısayolu
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        submit(e);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [submit]);

  return (
    <Layout>
      <div className="store-form-page">
        <div className="page-header">
          <h1>Mağaza Ekle</h1>
          <div className="header-actions">
            <Link className="btn ghost" to={`/admin/customers/${customerId}`}>Geri</Link>
          </div>
        </div>

        <form className="card form" onSubmit={submit}>
          <div className="grid-2">
            <div>
              <label>Mağaza Adı *</label>
              <input name="name" value={form.name} onChange={onChange} required />
            </div>
            <div>
              <label>Kod</label>
              <input name="code" value={form.code} onChange={onChange} placeholder="Örn: MRKZ" />
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
              <input name="address" value={form.address} onChange={onChange} />
            </div>

            <div>
              <label>Yetkili</label>
              <input name="manager" value={form.manager} onChange={onChange} />
            </div>
            <div className="inline">
              <label className="chk">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={form.isActive}
                  onChange={onChange}
                />
                Aktif
              </label>
            </div>
          </div>

          <div className="card sub">
            <div className="sub-title">Konum</div>
            <p className="muted">Haritaya tıklayarak konumu seçin.</p>

            <MapPickerCreate
              initialCenter={initialCenter}
              value={pos}
              onChange={setPos}
              height={340}
            />

            <div className="coords">
              <div><b>Lat:</b> <span>{Array.isArray(pos) ? pos[0].toFixed(6) : "—"}</span></div>
              <div><b>Lng:</b> <span>{Array.isArray(pos) ? pos[1].toFixed(6) : "—"}</span></div>
            </div>
          </div>

          <div className="actions">
            <button className="btn primary" disabled={saving}>
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
            <Link className="btn ghost" to={`/admin/customers/${customerId}`}>İptal</Link>
          </div>
        </form>
      </div>
    </Layout>
  );
}
