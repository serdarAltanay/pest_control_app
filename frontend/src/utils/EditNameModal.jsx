import { useState } from "react";
import { toast } from "react-toastify";
import api from "../api/axios.js";

export default function EditNameModal({ currentName, onClose, onSave }) {
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 20) {
      return toast.error("İsim 2 ile 20 karakter arasında olmalı");
    }

    try {
      setLoading(true);
      const res = await api.put("/profile/update-info", { name: trimmed });
      onSave(res.data.user); // ProfileContext güncelle
      toast.success("İsim güncellendi 🎉");
      onClose();
    } catch (err) {
      console.error("İsim güncelleme hatası:", err);
      toast.error(err.response?.data?.error || "Güncellenemedi ❌");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h2>İsmini Güncelle</h2>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={20}
        />
        <div className="modal-actions">
          <button onClick={handleSave} disabled={loading}>
            {loading ? "Kaydediliyor..." : "Kaydet"}
          </button>
          <button onClick={onClose}>İptal</button>
        </div>
      </div>
    </div>
  );
}
