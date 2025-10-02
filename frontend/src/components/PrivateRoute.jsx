import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import api from "../api/axios";
import { isExpired, parseJwt } from "../utils/auth";

export default function PrivateRoute({ children, allowedRoles }) {
  const [busy, setBusy] = useState(true);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let token = localStorage.getItem("accessToken");
      let role  = localStorage.getItem("role");

      if (!token || isExpired(token)) {
        try {
          const { data } = await api.post("/auth/refresh", {}, { withCredentials: true });
          if (data?.accessToken) {
            token = data.accessToken;
            localStorage.setItem("accessToken", token);
            const payload = parseJwt(token);
            role = payload?.role || role;
            if (role) localStorage.setItem("role", role);
          }
        } catch { /* sessizce geç */ }
      }

      const allowed = token && !isExpired(token) && role &&
        allowedRoles.map(r => r.toLowerCase()).includes(String(role).toLowerCase());

      if (!cancelled) { setOk(!!allowed); setBusy(false); }
    })();
    return () => { cancelled = true; };
  }, [allowedRoles]);

  if (busy) return null;        // istersen spinner koy
  if (!ok) return <Navigate to="/" replace />;
  return children;
}
