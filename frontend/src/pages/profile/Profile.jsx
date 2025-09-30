import { useEffect, useState } from "react";
import Layout from "../../components/Layout";
import api from "../../api/axios.js";
import { toast } from "react-toastify";
import "./Profile.scss";

export default function Profile() {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get("/profile");
        setProfile(res.data);
      } catch (err) {
        console.error("Profil yükleme hatası:", err);
        toast.error(err.response?.data?.error || "Profil bilgisi alınamadı ❌");
      }
    };
    fetchProfile();
  }, []);

  if (!profile) {
    return (
      <Layout>
        <div className="profile-container">
          <div className="profile-card">Profil bilgileri yükleniyor...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="profile-container">
        <div className="profile-card">
          <h1>Profilim</h1>
          <div className="profile-field">
            <strong>Ad Soyad:</strong> {profile.name}
          </div>
          <div className="profile-field">
            <strong>Email:</strong> {profile.email}
          </div>
          <div className="profile-field">
            <strong>Rol:</strong> {profile.role}
          </div>
          <div className="profile-field">
            <strong>Şirket:</strong> {profile.company || "Belirtilmemiş"}
          </div>
        </div>
      </div>
    </Layout>
  );
}
