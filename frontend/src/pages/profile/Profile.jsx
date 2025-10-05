import { useEffect, useState, useRef, useContext, useCallback } from "react";
import Layout from "../../components/Layout";
import api from "../../api/axios.js";
import { toast } from "react-toastify";
import Cropper from "react-easy-crop";
import getCroppedImg from "../../utils/cropImage.jsx";
import { ProfileContext } from "../../context/ProfileContext";
import EditNameModal from "../../utils/EditNameModal.jsx";
import "./Profile.scss";

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

  useEffect(() => {
    if (!profile) fetchProfile();
  }, [profile, fetchProfile]);

  // modal kapanınca kamera stop
  useEffect(() => {
    if (!editModalOpen) stopCamera();
  }, [editModalOpen, stopCamera]);

  if (!profile) {
    return (
      <Layout>
        <div className="profile-container">
          <div className="profile-card">Profil bilgileri yükleniyor...</div>
        </div>
      </Layout>
    );
  }

  // tek kaynak
  const profileImage = profile.profileImage || "/noavatar.jpg";

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

      // backend { profileImage } döndürüyor
      const rawUrl = res.data.profileImage;
      const nextUrl = rawUrl
        ? `${rawUrl}${rawUrl.includes("?") ? "&" : "?"}v=${Date.now()}`
        : "";

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

  // --- YENİ: sadece kendi avatarını kaldır ---
  const handleRemoveAvatar = async () => {
    if (!window.confirm("Profil fotoğrafınızı kaldırmak istiyor musunuz?")) return;
    try {
      await api.delete("/upload/avatar"); // self delete
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
                  <span className="name-text">
                    {profile.role === "customer"
                      ? profile.contactFullName || profile.title || "—"
                      : profile.fullName || "—"}
                  </span>
                  <button className="edit-btn" onClick={() => setEditNameOpen(true)}>
                    Düzenle
                  </button>
                </span>
              </div>

              <div className="profile-field">
                <strong>E-posta:</strong>
                <span>{profile.email}</span>
              </div>

              <div className="profile-field">
                <strong>Rol:</strong>
                <span>{profile.role}</span>
              </div>

              {profile.role !== "admin" && (
                <div className="profile-field">
                  <strong>Şirket:</strong>
                  <span>{profile.company || "Belirtilmemiş"}</span>
                </div>
              )}
            </div>

            <div className="profile-avatar-block">
              <div className="profile-avatar" onClick={handleAvatarClick}>
                <img src={profileImage} alt="Profil Fotoğrafı" />
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
          </div>
        </div>

        {editNameOpen && (
          <EditNameModal
            currentName={profile.fullName}
            onClose={() => setEditNameOpen(false)}
            onSave={(u) => setProfile((prev) => ({ ...prev, fullName: u.fullName }))}
          />
        )}

        {editModalOpen && (
          <div className="modal-backdrop">
            <div className="modal-content">
              <h2>Profil Fotoğrafını Güncelle</h2>

              {!imageSrc && !cameraOpen && (
                <>
                  <button onClick={() => fileInputRef.current.click()}>Yerelden Seç</button>
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
