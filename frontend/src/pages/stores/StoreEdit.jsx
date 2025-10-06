import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import MapPicker from "../../components/MapPickerLeaflet.jsx";
import "./StoreForm.scss";

export default function StoreEdit() {
  const { storeId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [store, setStore] = useState(null);
  const [form, setForm] = useState({
    name: "",
    code: "",
    city: "",
    address: "",
    phone: "",
    manager: "",
    isActive: true,
    latitude: null,
    longitude: null,
  });

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/stores/${storeId}`);
        setStore(data);
        setForm({
          name: data.name || "",
          code: data.code || "",
          city: data.city || "",
          address: data.address || "",
          phone: data.phone || "",
          manager: data.manager || "",
          isActive: !!data.isActive,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
        });
      } catch (err) {
        toast.error(err.response?.data?.message || "Mağaza bilgisi alınamadı");
      } finally {
        setLoading(false);
      }
    })();
  }, [storeId]);

  const onChange = (e) => {
    const { name, type, checked, value } = e.target;
    setForm((p) => ({ ...p, [name]: type === "checkbox" ? checked : value }));
  };

  const onMapChange = (coords) => {
    if (!coords) return setForm((p) => ({ ...p, latitude: null, longitude: null }));
    const [lat, lng] = coords;
    setForm((p) => ({ ...p, latitude: lat, longitude: lng }));
  };

  const onSave = async (e) => {
    e.preventDefault();
    try {
      if (!form.name?.trim()) return toast.error("Mağaza adı zorunludur.");
      setSaving(true);
      const payload = { ...form };
      const { data } = await api.put(`/stores/${storeId}`, payload);
      toast.success("Mağaza güncellendi");
      navigate(`/admin/customers/${data.store.customerId}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Layout><div className="store-form-page"><div className="card">Yükleniyor...</div></div></Layout>
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
              <label>Kod</label>
              <input name="code" value={form.code} onChange={onChange} />
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
            <div className="inline">
              <label className="chk">
                <input type="checkbox" name="isActive" checked={form.isActive} onChange={onChange} />
                Aktif
              </label>
            </div>
          </div>

          <div className="card sub">
            <div className="sub-title">Konum</div>
            <MapPicker
              center={[store.latitude ?? 39.92077, store.longitude ?? 32.85411]}
              value={form.latitude && form.longitude ? [form.latitude, form.longitude] : null}
              oldValue={
                store.latitude && store.longitude ? [store.latitude, store.longitude] : null
              }
              onChange={onMapChange}
              height={340}
            />
            <div className="coords">
              <div><b>Lat:</b> <span>{form.latitude ?? "—"}</span></div>
              <div><b>Lng:</b> <span>{form.longitude ?? "—"}</span></div>
            </div>
          </div>

          <div className="actions">
            <button className="btn primary" disabled={saving}>
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </button>
            <Link className="btn ghost" to={`/admin/customers/${store.customerId}`}>İptal</Link>
          </div>
        </form>
      </div>
    </Layout>
  );
}
