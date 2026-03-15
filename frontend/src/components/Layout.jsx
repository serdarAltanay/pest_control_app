// src/components/Layout.jsx
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import Footer from "./Footer";
import GlobalLoader from "./GlobalLoader";
import "../styles/Layout.scss";
import { useContext, useState, useCallback, useEffect } from "react";
import { ProfileContext } from "../context/ProfileContext";
import { useLocation } from "react-router-dom";
import useHeartbeat from "../hooks/useHeartbeat";

export default function Layout({ children, onCustomerClick, title }) {
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
      <GlobalLoader />
      <div
        className={`sidebar-backdrop ${mobileOpen ? "visible" : ""}`}
        onClick={closeMobileSidebar}
      />
      <Sidebar
        onCustomerClick={onCustomerClick}
        mobileOpen={mobileOpen}
        onMobileClose={closeMobileSidebar}
      />
      <main className="content">
        {title && (
          <div className="page-header">
            <h1 className="page-title">{title}</h1>
          </div>
        )}
        {children}
      </main>
      <Footer />
    </div>
  );
}
