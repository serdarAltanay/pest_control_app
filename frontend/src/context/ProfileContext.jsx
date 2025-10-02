// ProfileContext.jsx
import { createContext, useState, useEffect } from "react";
import api from "../api/axios.js";
import { toast } from "react-toastify";

export const ProfileContext = createContext();

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(null);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem("accessToken");
      if (!token) return;

      const res = await api.get("/profile");
      setProfile(res.data);
      localStorage.setItem("profileImage", res.data.profileImage || "/noavatar.jpg");
    } catch (err) {
      console.error("Profil yükleme hatası:", err);
      if (err.response?.status !== 401) {
        toast.error(err.response?.data?.error || "Profil bilgisi alınamadı ❌");
      }
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  return (
    <ProfileContext.Provider value={{ profile, setProfile, fetchProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}
