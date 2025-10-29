import { createContext, useState, useEffect, useRef } from "react";
import api, { apiNoRefresh } from "../api/axios.js";
import { toast } from "react-toastify";
import { getAvatarUrl } from "../utils/getAssetUrl";

export const ProfileContext = createContext();

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(null);
  const hbTimerRef = useRef(null);
  const mountedOnceRef = useRef(false);

  const clearSession = () => {
    try {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("role");
      localStorage.removeItem("fullName");
      localStorage.removeItem("name");
      localStorage.removeItem("email");
      localStorage.removeItem("profileImage");
      localStorage.removeItem("accessOwnerRole");
    } catch {}
  };

  const attemptRefresh = async () => {
    try {
      const r = await apiNoRefresh({
        method: "post",
        url: "/auth/refresh",
      });
      const t = r?.data?.accessToken;
      if (t) {
        localStorage.setItem("accessToken", t);
        return true;
      }
    } catch {}
    return false;
  };

  const readProfile = async () => {
    const { data } = await api.get("/profile");
    setProfile(data);

    const role = data?.role || "customer";
    localStorage.setItem("role", role);

    const fullName =
      data?.fullName ||
      [data?.firstName, data?.lastName].filter(Boolean).join(" ") ||
      data?.email || "";
    localStorage.setItem("fullName", fullName);
    localStorage.setItem("name", fullName);
    localStorage.setItem("email", data?.email || "");

    if (data?.accessOwnerRole) {
      localStorage.setItem("accessOwnerRole", data.accessOwnerRole);
    } else {
      localStorage.removeItem("accessOwnerRole");
    }

    const absUrl = getAvatarUrl?.(data?.profileImage, { bust: true }) || "/noavatar.jpg";
    localStorage.setItem("profileImage", absUrl);
  };

  const fetchProfile = async () => {
    try {
      // Token yoksa önce sessiz refresh dene
      if (!localStorage.getItem("accessToken")) {
        const ok = await attemptRefresh();
        if (!ok) {
          clearSession();
          setProfile(null);
          return;
        }
      }

      // Profil isteği
      await readProfile();
    } catch (err) {
      // 401 ise bir kez daha refresh dene ve tekrar iste
      if (err?.response?.status === 401) {
        const ok = await attemptRefresh();
        if (ok) {
          try {
            await readProfile();
            return;
          } catch {}
        }
        clearSession();
        setProfile(null);
        return;
      }

      console.error("Profil yükleme hatası:", err);
      toast.error(
        err?.response?.data?.message ||
          err?.response?.data?.error ||
          "Profil bilgisi alınamadı ❌"
      );
      setProfile(null);
    }
  };

  useEffect(() => {
    if (mountedOnceRef.current) return; // Strict Mode’u tek çağrıya indir
    mountedOnceRef.current = true;
    fetchProfile();
  }, []);

  // Heartbeat (presence)
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token || !profile) return;

    if (hbTimerRef.current) clearInterval(hbTimerRef.current);

    const beat = async () => {
      try {
        await api.post("/presence/heartbeat", null, {
          headers: { "x-silent": "1" },
          _isHeartbeat: true,
        });
      } catch {}
    };

    beat();
    hbTimerRef.current = setInterval(beat, 60_000);
    return () => {
      clearInterval(hbTimerRef.current);
      hbTimerRef.current = null;
    };
  }, [profile]);

  return (
    <ProfileContext.Provider value={{ profile, setProfile, fetchProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}
