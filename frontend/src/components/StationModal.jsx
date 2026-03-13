// src/components/StationModal.jsx
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
    isGroup: false,
    totalCount: 1,
  });

  useEffect(() => {
    if (initial) {
      setForm({
        type: initial.type || "FARE_YEMLEME",
        name: initial.name || "",
        code: initial.code || "",
        isGroup: !!initial.isGroup,
        totalCount: initial.totalCount || 1,
      });
    }
  }, [initial]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const save = async () => {
    setSaving(true);
    const payload = {
      type: form.type,
      name: form.name.trim(),
      code: form.code.trim(),
      isGroup: !!form.isGroup,
      totalCount: Number(form.totalCount) || 1,
    };

    try {
      if (isEdit) {
        // UPDATE
        try {
          await api.put(`/stations/${initial.id}`, payload);
        } catch {
          await api.put(`/stores/${storeId}/stations/${initial.id}`, payload);
        }
        toast.success("İstasyon güncellendi");
      } else {
        // CREATE
        try {
          await api.post(`/stations`, { ...payload, storeId });
        } catch {
          await api.post(`/stores/${storeId}/stations`, payload);
        }
        toast.success("İstasyon eklendi");
      }
      onSaved?.(); // listeyi yenilesin
      onClose?.();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("İstasyon adı zorunludur.");
    if (!form.code.trim()) return toast.error("Barkod & QR zorunludur.");
    save();
  };

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
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
              <label>Barkod &amp; QR *</label>
              <input name="code" value={form.code} onChange={onChange} required />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "25px" }}>
              <input 
                type="checkbox" 
                id="isGroup" 
                name="isGroup" 
                checked={form.isGroup || false} 
                onChange={(e) => setForm(p => ({ ...p, isGroup: e.target.checked }))} 
              />
              <label htmlFor="isGroup" style={{ cursor: "pointer", margin: 0 }}>Toplu Grup (Büyük İşletme)</label>
            </div>
            {form.isGroup && (
              <div>
                <label>Toplam İstasyon Adedi *</label>
                <input 
                  type="number" 
                  name="totalCount" 
                  value={form.totalCount || 1} 
                  onChange={onChange} 
                  min="1" 
                  required 
                />
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button type="submit" className="btn primary" disabled={saving}>
              {saving
                ? (isEdit ? "Güncelleniyor..." : "Kaydediliyor...")
                : (isEdit ? "İstasyon Güncelle" : "İstasyon Ekle")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
