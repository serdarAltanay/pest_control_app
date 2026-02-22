// src/components/Layout.jsx
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import Footer from "./Footer";
import "../styles/Layout.scss";
import { useContext, useState, useCallback, useEffect } from "react";
import { ProfileContext } from "../context/ProfileContext";
import { useLocation } from "react-router-dom";
import useHeartbeat from "../hooks/useHeartbeat";

export default function Layout({ children, onCustomerClick }) {
  const { profile } = useContext(ProfileContext);
  const role = (profile?.role || "").toLowerCase();
  const location = useLocation();

  // çalışan için konum takibi açık, diğer rollerde sadece pulse
  useHeartbeat(!!profile, 60_000, role === "employee");

  // Mobil sidebar state
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleMobileSidebar = useCallback(() => setMobileOpen((v) => !v), []);
  const closeMobileSidebar = useCallback(() => setMobileOpen(false), []);

  // Sayfa değiştiğinde mobil sidebar'ı kapat
  useEffect(() => {
    closeMobileSidebar();
  }, [location.pathname, closeMobileSidebar]);

  return (
    <div className="layout">
      <Navbar onHamburgerClick={toggleMobileSidebar} />
      <div
        className={`sidebar-backdrop ${mobileOpen ? "visible" : ""}`}
        onClick={closeMobileSidebar}
      />
      <Sidebar
        onCustomerClick={onCustomerClick}
        mobileOpen={mobileOpen}
        onMobileClose={closeMobileSidebar}
      />
      <main className="content">{children}</main>
      <Footer />
    </div>
  );
}
