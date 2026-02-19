import { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import api from "../api/axios.js";

export default function EditNameModal({ currentName, onClose, onSave }) {
  const [fullName, setFullName] = useState(currentName || "");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  const MAX = 20;
  const MIN = 2;

  useEffect(() => {
    // modal açılınca input'a fokus
    inputRef.current?.focus();
  }, []);

  const validate = (val) => {
    const trimmed = val.replace(/\s+/g, " ").trim();
    if (trimmed.length < MIN || trimmed.length > MAX) {
      toast.error(`İsim ${MIN}-${MAX} karakter arasında olmalı`);
      return null;
    }
    return trimmed;
  };

  const handleSave = async () => {
    const trimmed = validate(fullName);
    if (!trimmed) return;

    // değişiklik yoksa kaydetme
    if (trimmed === (currentName || "").replace(/\s+/g, " ").trim()) {
      toast.info("Değişiklik yok");
      return;
    }

    try {
      setLoading(true);
      const res = await api.put("/profile/update-info", { fullName: trimmed });
      onSave(res.data.user);             // ProfileContext'i güncelle
      toast.success("İsim başarıyla güncellendi.");
      onClose();
    } catch (err) {
      console.error("İsim güncelleme hatası:", err);
      toast.error(err.response?.data?.error || "İsim güncellenemedi.");
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="edit-name-title">
        <h2 id="edit-name-title">İsmini Güncelle</h2>

        <input
          ref={inputRef}
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={MAX}
          placeholder="Ad Soyad"
        />

        <div className="modal-meta">
          <small>{fullName.length}/{MAX}</small>
        </div>

        <div className="modal-actions">
          <button onClick={handleSave} disabled={loading}>
            {loading ? "Kaydediliyor..." : "Kaydet"}
          </button>
          <button onClick={onClose} disabled={loading}>İptal</button>
        </div>
      </div>
    </div>
  );
}
