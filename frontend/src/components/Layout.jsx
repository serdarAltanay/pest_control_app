// src/components/Layout.jsx
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import Footer from "./Footer";
import "../styles/Layout.scss";
import { useContext } from "react";
import { ProfileContext } from "../context/ProfileContext";
import useHeartbeat from "../hooks/useHeartbeat";

export default function Layout({ children, onCustomerClick }) {
  const { profile } = useContext(ProfileContext);
  const role = (profile?.role || "").toLowerCase();
  // çalışan için konum takibi açık, diğer rollerde sadece pulse
  useHeartbeat(!!profile, 60_000, role === "employee");

  return (
    <div className="layout">
      <Navbar />
      <Sidebar onCustomerClick={onCustomerClick} />
      <main className="content">{children}</main>
      <Footer />
    </div>
  );
}
