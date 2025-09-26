import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import Footer from "./Footer";
import "../styles/Layout.scss";

export default function Layout({ children, onCustomerClick }) {
  return (
    <div className="layout">
      <Navbar />
      <Sidebar onCustomerClick={onCustomerClick} />
      <main className="content">{children}</main>
      <Footer />
    </div>
  );
}
