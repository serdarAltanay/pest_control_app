import { useRef, useState } from "react";
import api from "../api/axios";
import { toast } from "react-toastify";
import "../styles/Modal.scss";

/**
 * Kullanım:
 * <AvatarPicker value={avatarUrl} onChange={(urlOrNull)=>...} />
 * - Yükle: /api/upload/avatar   (Authorization header axios instance’dan geliyor)
 * - Sil:   onChange(null) => üst component PUT ile profileImage:null gönderir
 */
export default function AvatarPicker({ value, onChange, sideNote }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null); // local seçilen

  const pick = () => inputRef.current?.click();

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("avatar", file);

    try {
      setBusy(true);
      const { data } = await api.post("/upload/avatar", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = data?.profileImage || null;
      setPreview(null);
      onChange?.(url);
      toast.success("Profil fotoğrafı güncellendi");
    } catch (err) {
      toast.error(err.response?.data?.error || "Yüklenemedi");
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const remove = async () => {
    if (!window.confirm("Profil fotoğrafı kaldırılsın mı?")) return;
    try {
      setBusy(true);
      // Sadece üst componente haber veriyoruz; gerçek silmeyi o yapacak (profileImage:null PUT).
      onChange?.(null);
      toast.success("Profil fotoğrafı kaldırıldı");
    } finally {
      setBusy(false);
    }
  };

  const shown = preview || value;

  return (
    <div className="avatar-picker">
      <div className="avatar">
        {shown ? (
          // eslint-disable-next-line jsx-a11y/img-redundant-alt
          <img src={shown.startsWith("http") ? shown : `/${shown}`} alt="Avatar image" />
        ) : (
          <div className="placeholder">Fotoğraf Yok</div>
        )}
      </div>

      <div className="controls">
        <button className="btn" onClick={pick} disabled={busy}>Foto Yükle</button>
        <button className="btn danger" onClick={remove} disabled={busy || !shown}>Kaldır</button>
      </div>

      {sideNote && <div className="hint">{sideNote}</div>}

      <input type="file" ref={inputRef} accept="image/*" style={{ display:"none" }} onChange={onFile}/>
    </div>
  );
}
