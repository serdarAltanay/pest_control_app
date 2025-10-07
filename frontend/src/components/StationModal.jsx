import { useEffect, useState } from "react";
import api from "../api/axios";
import { toast } from "react-toastify";

const TYPE_TR = {
  FARE_YEMLEME: "Fare Yemleme İstasyonu",
  CANLI_YAKALAMA: "Canlı Yakalama İstasyonu",
  ELEKTRIKLI_SINEK_TUTUCU: "Elektrikli Sinek Tutucu",
  BOCEK_MONITOR: "Böcek Monitörü",
  GUVE_TUZAGI: "Güve Tuzağı",
};
const TYPES = Object.keys(TYPE_TR);

export default function StationModal({ storeId, initial, onClose, onSaved }) {
  const isEdit = !!initial?.id;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    type: "FARE_YEMLEME",
    name: "",
    code: "",
  });

  useEffect(() => {
    if (initial) {
      setForm({
        type: initial.type || "FARE_YEMLEME",
        name: initial.name || "",
        code: initial.code || "",
      });
    }
  }, [initial]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.type) return toast.error("İstasyon tipi zorunludur.");
    if (!form.name.trim()) return toast.error("İstasyon adı zorunludur.");
    if (!form.code.trim()) return toast.error("Barkod & QR zorunludur.");

    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/stations/${initial.id}`, { ...form });
        toast.success("İstasyon güncellendi");
      } else {
        await api.post("/stations", { ...form, storeId });
        toast.success("İstasyon eklendi");
      }
      onClose?.();
      onSaved?.();
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "İşlem başarısız");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="modal">
        <div className="modal-head">
          <div className="title">
            {isEdit ? `İstasyon Güncelle – ${initial?.name || ""}` : "İstasyon Ekle"}
          </div>
          <button className="close" onClick={onClose}>×</button>
        </div>

        <form className="modal-body" onSubmit={submit}>
          <div className="grid-3">
            <div>
              <label>İstasyon Tipi *</label>
              <select name="type" value={form.type} onChange={onChange} required>
                {TYPES.map((t) => (
                  <option key={t} value={t}>{TYPE_TR[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label>İstasyon Adı *</label>
              <input name="name" value={form.name} onChange={onChange} required />
            </div>
            <div>
              <label>Barkod & QR *</label>
              <input name="code" value={form.code} onChange={onChange} required />
            </div>
          </div>

          <div className="modal-actions">
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? (isEdit ? "Güncelleniyor..." : "Kaydediliyor...") : (isEdit ? "İstasyon Güncelle" : "İstasyon Ekle")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
