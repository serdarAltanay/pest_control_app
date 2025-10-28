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
  "ANKARA": { lat: 39.92077, lng: 32.85411 },
  "İZMİR": { lat: 38.423733, lng: 27.142826 },
  "KOCAELİ": { lat: 40.85327, lng: 29.88152 },
  "AYDIN": { lat: 37.8444, lng: 27.8458 },
};
const TR_FALLBACK = { lat: 39.925533, lng: 32.866287 };

// AccessRole enum değerleri
const ACCESS_ROLES = [
  { value: "CALISAN", label: "Çalışan" },
  { value: "MAGAZA_SORUMLUSU", label: "Mağaza Sorumlusu" },
  { value: "MAGAZA_MUDURU", label: "Mağaza Müdürü" },
  { value: "GENEL_MUDUR", label: "Genel Müdür" },
  { value: "PATRON", label: "Patron" },
  { value: "DIGER", label: "Diğer" },
];

export default function StoreCreate() {
  const { customerId } = useParams();
  const navigate = useNavigate();

  const [saving, setSaving] = useState(false);
  const [initialCenter, setInitialCenter] = useState(TR_FALLBACK);

  // Mağaza formu
  const [form, setForm] = useState({
    name: "",
    code: "",
    city: "",
    address: "",
    phone: "",
    managerFirstName: "",
    managerLastName: "",
    isActive: true,
  });

  // Erişim verme (radyo: Evet/Hayır)
  const [grantAccess, setGrantAccess] = useState(false);
  const [owner, setOwner] = useState({
    email: "",
    phone: "",
    role: "MAGAZA_SORUMLUSU",
    firstName: "",
    lastName: "",
  });

  // ⬇️ YENİ: Erişim ver açılınca ve owner ad/soyad boşsa, yetkili ad/soyadıyla AUTOFILL (tek seferlik)
  useEffect(() => {
    if (!grantAccess) return;
    setOwner((s) => {
      const f = (s.firstName || "").trim();
      const l = (s.lastName || "").trim();
      if (f && l) return s; // kullanıcı zaten yazmışsa dokunma
      return {
        ...s,
        firstName: f || (form.managerFirstName || "").trim(),
        lastName:  l || (form.managerLastName  || "").trim(),
      };
    });
  }, [grantAccess]); // sadece "Evet" yapıldığında çalışsın

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

  const onOwnerChange = (e) => {
    const { name, value } = e.target;
    setOwner((s) => ({ ...s, [name]: value }));
  };

  const validate = (v) => {
    if (!v.name?.trim()) return "Mağaza adı zorunludur.";
    const digits = (v.phone || "").replace(/\D/g, "");
    if (digits.length > 0 && digits.length < 10) return "Telefon hatalı görünüyor.";
    if (v.code && v.code.length > 12) return "Kod en fazla 12 karakter olmalı.";
    return null;
  };

  const submit = useCallback(async (e) => {
    e?.preventDefault?.();
    const err = validate(form);
    if (err) { toast.error(err); return; }

    const managerText = [form.managerFirstName, form.managerLastName]
      .map((x) => (x || "").trim())
      .filter(Boolean)
      .join(" ") || null;

    if (grantAccess && !owner.email.trim()) {
      toast.error("Erişim vermek için e-posta gerekli.");
      return;
    }

    const ownerPayload = {
      ...owner,
      firstName: (owner.firstName || form.managerFirstName || "").trim(),
      lastName:  (owner.lastName  || form.managerLastName  || "").trim(),
    };

    setSaving(true);
    try {
      await api.post("/stores", {
        customerId: Number(customerId),
        name: form.name,
        code: form.code || null,
        city: form.city || null,
        address: form.address || null,
        phone: form.phone || null,
        manager: managerText,
        isActive: !!form.isActive,
        latitude: Array.isArray(pos) ? pos[0] : null,
        longitude: Array.isArray(pos) ? pos[1] : null,

        grantAccess: !!grantAccess,
        accessOwner: grantAccess ? ownerPayload : undefined,
      });

      toast.success("Mağaza eklendi");
      navigate(`/admin/customers/${customerId}`);
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }, [form, pos, customerId, navigate, grantAccess, owner]);

  // Ctrl/Cmd+S kaydet
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

            {/* Yetkili bilgisi ayrı alanlar */}
            <div>
              <label>Yetkili Ad</label>
              <input name="managerFirstName" value={form.managerFirstName} onChange={onChange} />
            </div>
            <div>
              <label>Yetkili Soyad</label>
              <input name="managerLastName" value={form.managerLastName} onChange={onChange} />
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

          {/* Erişim verme (radyo: Evet/Hayır) */}
          <div className="card sub">
            <div className="sub-title">Yetkiliye Erişim</div>

            <div className="inline access-row">
              <span className="field-label">Erişim Ver</span>
              <div className="radio-segment" role="radiogroup" aria-label="Erişim Ver">
                <label className={`seg ${!grantAccess ? "active" : ""}`}>
                  <input
                    type="radio"
                    name="grantAccess"
                    value="no"
                    checked={!grantAccess}
                    onChange={() => setGrantAccess(false)}
                  />
                  Hayır
                </label>
                <label className={`seg ${grantAccess ? "active" : ""}`}>
                  <input
                    type="radio"
                    name="grantAccess"
                    value="yes"
                    checked={grantAccess}
                    onChange={() => setGrantAccess(true)}
                  />
                  Evet
                </label>
              </div>
            </div>

            {grantAccess && (
              <>
                <div className="grid-2" style={{ marginTop: 10 }}>
                  <div>
                    <label>E-posta *</label>
                    <input
                      name="email"
                      value={owner.email}
                      onChange={onOwnerChange}
                      placeholder="ornek@firma.com"
                      required={grantAccess}
                    />
                  </div>
                  <div>
                    <label>Telefon</label>
                    <input
                      name="phone"
                      value={owner.phone}
                      onChange={onOwnerChange}
                      placeholder="5xx xxx xx xx"
                    />
                  </div>
                  <div>
                    <label>Rol</label>
                    <select name="role" value={owner.role} onChange={onOwnerChange}>
                      {ACCESS_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>
                  <div />
                </div>

                <div className="grid-2" style={{ marginTop: 8 }}>
                  <div>
                    <label>Erişim Sahibi Ad (opsiyonel)</label>
                    <input
                      name="firstName"
                      value={owner.firstName}
                      onChange={onOwnerChange}
                      placeholder={form.managerFirstName || "Ad"}
                    />
                  </div>
                  <div>
                    <label>Erişim Sahibi Soyad (opsiyonel)</label>
                    <input
                      name="lastName"
                      value={owner.lastName}
                      onChange={onOwnerChange}
                      placeholder={form.managerLastName || "Soyad"}
                    />
                  </div>
                </div>

                <p className="muted" style={{ marginTop: 6 }}>
                  Not: Şimdilik şifre <b>123456</b> olarak atanır. (Mail motoru eklenince rastgele üretip göndeririz.)
                </p>
              </>
            )}
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
