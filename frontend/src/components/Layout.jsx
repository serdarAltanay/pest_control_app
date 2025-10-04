import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import Footer from "./Footer";
import "../styles/Layout.scss";
import { useContext } from "react";
import { ProfileContext } from "../context/ProfileContext";
import useHeartbeat from "../hooks/useHeartbeat";

export default function Layout({ children, onCustomerClick }) {
  const { profile } = useContext(ProfileContext);
  // kullanıcı varsa heartbeat aktif
  useHeartbeat(!!profile);

  return (
    <div className="layout">
      <Navbar />
      <Sidebar onCustomerClick={onCustomerClick} />
      <main className="content">{children}</main>
      <Footer />
    </div>
  );
}
