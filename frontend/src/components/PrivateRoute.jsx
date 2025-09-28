import { Navigate } from "react-router-dom";

export default function PrivateRoute({ children, allowedRoles }) {
  const token = localStorage.getItem("accessToken"); // accessToken olarak kontrol et
  const role = localStorage.getItem("role");

  if (!token) return <Navigate to="/" replace />; // login değilse yönlendir
  if (!allowedRoles.includes(role)) return <Navigate to="/" replace />; // rol yetkili değilse

  return children;
}
