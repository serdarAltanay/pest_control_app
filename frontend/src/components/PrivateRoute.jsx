import { Navigate } from "react-router-dom";

export default function PrivateRoute({ children, allowedRoles }) {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token) return <Navigate to="/" />; // login değilse yönlendir
  if (!allowedRoles.includes(role)) return <Navigate to="/" />; // rol yetkili değilse

  return children;
}
