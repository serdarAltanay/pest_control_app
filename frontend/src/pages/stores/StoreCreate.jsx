import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import MapPicker from "../../components/MapPickerLeaflet";
import "./StoreForm.scss";

export default function StoreCreate() {
  const { customerId } = useParams();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    code: "",
    city: "",
    address: "",
    phone: "",
    manager: "",
    isActive: true,
  });
  const [pos, setPos] = useState(null); // {lat, lng}

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/customers/${customerId}`);
        setCustomer(data);
      } catch {
        toast.error("Müşteri bilgisi alınamadı");
      }
    })();
  }, [customerId]);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((s) => ({ ...s, [name]: type === "checkbox" ? checked : value }));
  };

  const submit = async () => {
    if (!form.name.trim()) return toast.error("Mağaza adı zorunludur.");
    setSaving(true);
    try {
      await api.post("/stores", {
        ...form,
        customerId: Number(customerId),
        latitude: pos?.lat ?? null,
        longitude: pos?.lng ?? null,
      });
      toast.success("Mağaza eklendi");
      navigate(`/admin/customers/${customerId}`);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="store-form-page">
        <div className="page-head">
          <h1>Mağaza Ekle</h1>
          <div className="actions">
            <Link className="btn" to={`/admin/customers/${customerId}`}>Geri</Link>
            <button className="btn primary" onClick={submit} disabled={saving}>{saving ? "Kaydediliyor..." : "Kaydet"}</button>
          </div>
        </div>

        <div className="card">
          <div className="kv grid-2">
            <label><b>Mağaza Adı *</b><input name="name" value={form.name} onChange={onChange} /></label>
            <label><b>Kod</b><input name="code" value={form.code} onChange={onChange} placeholder="Örn: MRKZ" /></label>
            <label><b>Şehir</b><input name="city" value={form.city} onChange={onChange} /></label>
            <label><b>Telefon</b><input name="phone" value={form.phone} onChange={onChange} /></label>
            <label className="col2"><b>Adres</b><input name="address" value={form.address} onChange={onChange} /></label>
            <label className="col2"><b>Yetkili</b><input name="manager" value={form.manager} onChange={onChange} /></label>
            <label className="checkbox"><input type="checkbox" name="isActive" checked={form.isActive} onChange={onChange} /><span>Aktif</span></label>
          </div>
        </div>

        <div className="card">
          <div className="card-title">Konum</div>
          <p className="muted">Haritaya tıklayarak konumu seçin. Seçili pin sürüklenebilir.</p>
          <MapPicker
                initialCenter={{ lat: 39.925533, lng: 32.866287 }} // istersen müşteri şehrine göre set edebilirsin
                value={pos}
                onChange={setPos}
                />
          <div className="coords">
            <span>Lat: <b>{pos?.lat?.toFixed(6) || "—"}</b></span>
            <span>Lng: <b>{pos?.lng?.toFixed(6) || "—"}</b></span>
          </div>
        </div>
      </div>
    </Layout>
  );
}
