import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import api, { apiNoRefresh } from "../api/axios";
import { isExpired, parseJwt } from "../utils/auth";

export default function PrivateRoute({ children, allowedRoles = [] }) {
  const [busy, setBusy] = useState(true);
  const [ok, setOk] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let token = localStorage.getItem("accessToken");
      let role  = localStorage.getItem("role");

      // Token yoksa / süresi dolmuşsa sessiz refresh (BEARER yok)
      if (!token || isExpired(token)) {
        try {
          const { data } = await apiNoRefresh({
            method: "post",
            url: "/auth/refresh",
          });
          if (data?.accessToken) {
            token = data.accessToken;
            localStorage.setItem("accessToken", token);
            const p = parseJwt(token);
            role = p?.role || role;
            if (role) localStorage.setItem("role", role);
          }
        } catch {
          try {
            localStorage.removeItem("accessToken");
            localStorage.removeItem("role");
          } catch {}
        }
      }

      const allowed =
        token &&
        !isExpired(token) &&
        role &&
        allowedRoles.map(r => r.toLowerCase()).includes(String(role).toLowerCase());

      if (!cancelled) {
        setOk(Boolean(allowed));
        setBusy(false);
      }
    })();

    return () => { cancelled = true; };
  }, [allowedRoles]);

  if (busy) return null; // istersen buraya spinner

  // Yetki yoksa login'e gönderirken geldiğin yolu state.from ile taşı
  if (!ok) return <Navigate to="/" replace state={{ from: location.pathname }} />;

  return children;
}
