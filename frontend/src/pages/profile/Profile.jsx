import { useEffect, useState, useRef, useContext, useCallback } from "react";
import Layout from "../../components/Layout";
import api from "../../api/axios.js";
import { toast } from "react-toastify";
import Cropper from "react-easy-crop";
import getCroppedImg from "../../utils/cropImage.jsx";
import { ProfileContext } from "../../context/ProfileContext";
import EditNameModal from "../../utils/EditNameModal.jsx";
import { getAvatarUrl, addCacheBust } from "../../utils/getAssetUrl.js";
import "./Profile.scss";

/** fullName'i "Ad Soyad" -> {firstName,lastName} ayır */
function splitFullName(fullName) {
  const s = String(fullName || "").trim();
  if (!s) return { firstName: "", lastName: "" };
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  const lastName = parts.pop();
  return { firstName: parts.join(" "), lastName };
}

/** AccessOwner iş rolleri: FE rozeti */
const ACCESS_ROLE_TR = {
  CALISAN: "Çalışan",
  MAGAZA_SORUMLUSU: "Mağaza Sorumlusu",
  MAGAZA_MUDURU: "Mağaza Müdürü",
  GENEL_MUDUR: "Genel Müdür",
  PATRON: "Patron",
  DIGER: "Diğer",
};

export default function Profile() {
  const { profile, setProfile, fetchProfile } = useContext(ProfileContext);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [editNameOpen, setEditNameOpen] = useState(false);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((t) => t.stop());
      videoRef.current.srcObject = null;
    }
    setCameraOpen(false);
  }, []);

  useEffect(() => { if (!profile) fetchProfile(); }, [profile, fetchProfile]);
  useEffect(() => { if (!editModalOpen) stopCamera(); }, [editModalOpen, stopCamera]);

  if (!profile) {
    return (
      <Layout>
        <div className="profile-container">
          <div className="profile-card">Profil bilgileri yükleniyor...</div>
        </div>
      </Layout>
    );
  }

  // Rol kontrolleri
  const isAccessOwner = profile.role === "customer" && !!profile.accessOwnerRole;
  const isAdminOrEmployee = profile.role === "admin" || profile.role === "employee";

  // Görünen ad
  const visibleName =
    [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
    profile.fullName ||
    profile.contactFullName ||
    profile.title ||
    profile.email ||
    "—";

  // Avatar URL (admin/employee için server’dan gelecek; yoksa noavatar)
  const avatarUrl = isAdminOrEmployee
    ? (getAvatarUrl(profile?.profileImage, { bust: true }) || "/noavatar.jpg")
    : "/noavatar.jpg";

  const handleAvatarClick = () => setEditModalOpen(true);
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageSrc(reader.result);
    reader.readAsDataURL(file);
  };

  const openCamera = async () => {
    setCameraOpen(true);
    setEditModalOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      console.error("Kamera açılamadı:", err);
      toast.error("Kamera açılamadı 😕");
      setCameraOpen(false);
    }
  };

  const captureCameraPhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg");
    setImageSrc(dataUrl);
    stopCamera();
  };

  const onCropComplete = (_area, areaPx) => setCroppedAreaPixels(areaPx);

  const handleUpload = async () => {
    try {
      const croppedBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      const formData = new FormData();
      formData.append("avatar", croppedBlob, "avatar.jpg");

      const res = await api.post("/upload/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Backend'in döndüğü yol uploads/... ise absolute'e çevir
      const abs = getAvatarUrl(res.data.profileImage, { bust: true });
      const nextUrl = addCacheBust(abs);

      setProfile((prev) => ({
        ...prev,
        profileImage: nextUrl,
        updatedAt: new Date().toISOString(),
      }));
      localStorage.setItem("profileImage", nextUrl);

      setEditModalOpen(false);
      setImageSrc(null);
      toast.success("Profil fotoğrafı güncellendi");
    } catch (err) {
      console.error("Avatar güncelleme hatası:", err);
      toast.error(err?.response?.data?.error || "Avatar güncellenemedi 😕");
    }
  };

  const handleRemoveAvatar = async () => {
    if (!window.confirm("Profil fotoğrafınızı kaldırmak istiyor musunuz?")) return;
    try {
      await api.delete("/upload/avatar");
      setProfile((prev) => ({
        ...prev,
        profileImage: null,
        updatedAt: new Date().toISOString(),
      }));
      localStorage.removeItem("profileImage");
      toast.success("Profil fotoğrafınız kaldırıldı");
    } catch (err) {
      console.error("Avatar kaldırma hatası:", err);
      toast.error(err?.response?.data?.error || "Kaldırılamadı");
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("Hesabınızı silmek/anonimleştirmek istediğinize emin misiniz? Bu işlem geri alınamaz!")) return;
    try {
      await api.delete("/profile");
      toast.success("Hesabınız kalıcı olarak silindi ve verileriniz anonimleştirildi.");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("role");
      localStorage.removeItem("profileImage");
      setTimeout(() => {
        window.location.href = "/";
      }, 1500);
    } catch (e) {
      console.error(e);
      toast.error("Hesap silinirken hata oluştu.");
    }
  };

  /** İsim kalıcılığı */
  const persistName = async (fullName) => {
    const wantsSplit = isAccessOwner || "firstName" in profile || "lastName" in profile;
    const payload = wantsSplit ? splitFullName(fullName) : { fullName };

    try {
      await api.put("/profile/update-info", payload);
    } catch (e) {
      console.warn("Profil adı kaydedilemedi:", e?.response?.data || e?.message);
      toast.error(e?.response?.data?.message || "Ad güncellenemedi");
    } finally {
      setProfile((prev) => ({
        ...prev,
        ...payload,
        fullName: fullName,
        updatedAt: new Date().toISOString(),
      }));
    }
  };

  return (
    <Layout>
      <div className="profile-container">
        <div className="profile-card">
          <div className="profile-table">
            <div className="profile-info">
              <h1>Profilim</h1>

              <div className="profile-field">
                <strong>Ad Soyad:</strong>
                <span className="name-wrapper">
                  <span className="name-text">{visibleName}</span>
                  <button className="edit-btn" onClick={() => setEditNameOpen(true)}>
                    Düzenle
                  </button>
                </span>
              </div>

              <div className="profile-field">
                <strong>E-posta:</strong>
                <span>{profile.email || "—"}</span>
              </div>

              <div className="profile-field">
                <strong>Sistem Rolü:</strong>
                <span className="badge">{profile.role}</span>
              </div>

              {isAccessOwner && (
                <div className="profile-field">
                  <strong>Erişim Rolü:</strong>
                  <span className="badge">
                    {ACCESS_ROLE_TR[profile.accessOwnerRole] || profile.accessOwnerRole}
                  </span>
                </div>
              )}

              {"company" in profile && (
                <div className="profile-field">
                  <strong>Şirket:</strong>
                  <span>{profile.company || "Belirtilmemiş"}</span>
                </div>
              )}

              <div className="profile-field" style={{ marginTop: "2rem", flexDirection: "column", alignItems: "flex-start", gap: "8px" }}>
                <button
                  onClick={handleDeleteAccount}
                  style={{ background: "#ef4444", color: "white", padding: "10px 16px", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold", transition: "0.2s" }}
                  onMouseOver={(e) => e.target.style.background = "#dc2626"}
                  onMouseOut={(e) => e.target.style.background = "#ef4444"}
                >
                  Kalıcı Olarak Hesabımı Sil
                </button>
                <div style={{ fontSize: "12px", color: "#64748b" }}>
                  * KVKK unutulma hakkı gereği kişisel verileriniz (ad, iletişim) sistemden anonimleştirilecektir.
                </div>
              </div>
            </div>

            {/* Avatar BLOĞU: Sadece admin & employee için */}
            {isAdminOrEmployee && (
              <div className="profile-avatar-block">
                <div className="profile-avatar" onClick={handleAvatarClick} role="button" tabIndex={0}>
                  <img
                    src={avatarUrl}
                    alt="Profil Fotoğrafı"
                    onError={(e) => {
                      if (e.currentTarget.src.endsWith("/noavatar.jpg")) return;
                      e.currentTarget.src = "/noavatar.jpg";
                    }}
                  />
                  <div className="avatar-overlay">
                    <span>Düzenle</span>
                  </div>
                </div>

                <div className="avatar-actions">
                  <button className="btn danger" onClick={handleRemoveAvatar}>
                    Profil Fotoğrafını Kaldır
                  </button>
                </div>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  style={{ display: "none" }}
                  accept="image/*"
                />
              </div>
            )}
          </div>
        </div>

        {editNameOpen && (
          <EditNameModal
            currentName={visibleName}
            onClose={() => setEditNameOpen(false)}
            onSave={async (u) => {
              await persistName(u.fullName);
              setEditNameOpen(false);
            }}
          />
        )}

        {/* Avatar düzenleme MODALI: Sadece admin & employee */}
        {editModalOpen && isAdminOrEmployee && (
          <div className="modal-backdrop">
            <div className="modal-content">
              <h2>Profil Fotoğrafını Güncelle</h2>

              {!imageSrc && !cameraOpen && (
                <>
                  <button onClick={() => fileInputRef.current?.click()}>Yerelden Seç</button>
                  <button onClick={openCamera}>Kameradan Çek</button>
                  <button onClick={() => setEditModalOpen(false)}>İptal</button>
                </>
              )}

              {cameraOpen && (
                <>
                  <video ref={videoRef} autoPlay className="camera-preview" />
                  <button onClick={captureCameraPhoto}>Fotoğraf Çek</button>
                  <button onClick={stopCamera}>İptal</button>
                </>
              )}

              {imageSrc && (
                <>
                  <div className="crop-container">
                    <Cropper
                      image={imageSrc}
                      crop={crop}
                      zoom={zoom}
                      aspect={1}
                      onCropChange={setCrop}
                      onZoomChange={(z) => setZoom(z)}
                      onCropComplete={onCropComplete}
                    />
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.1}
                      value={zoom}
                      onChange={(e) => setZoom(parseFloat(e.target.value))}
                    />
                  </div>
                  <button onClick={handleUpload}>Kaydet</button>
                  <button
                    onClick={() => {
                      setImageSrc(null);
                      setEditModalOpen(false);
                    }}
                  >
                    İptal
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
