import { useState, useEffect, useCallback } from "react";
import Layout from "../../components/Layout";
import "./CustomerManagementPage.scss";
import api from "../../api/axios";
import { toast } from "react-toastify";

export default function CustomerManagementPage() {
  const [customers, setCustomers] = useState([]);
  const [activeForm, setActiveForm] = useState(""); // "", "group", "store"
  const [loading, setLoading] = useState(true);
  const [parentCompanies, setParentCompanies] = useState([]);
  const token = localStorage.getItem("accessToken");

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/customers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCustomers(res.data);
      setParentCompanies(res.data.filter((c) => !c.parent_company_id));
    } catch (err) {
      toast.error("Müşteriler yüklenirken hata oluştu ❌");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const verifyAdmin = async () => {
    const password = prompt("Lütfen admin şifrenizi girin:");
    if (!password) return false;
    const email = localStorage.getItem("email");
    try {
      const res = await api.post(
        "/customers/verify-admin",
        { email, password },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return res.data.success;
    } catch (err) {
      toast.error(err.response?.data?.message || "Şifre doğrulama hatası ❌");
      return false;
    }
  };

  const handleAddGroup = async (e) => {
    e.preventDefault();
    if (!(await verifyAdmin())) return;

    const formData = Object.fromEntries(new FormData(e.target));
    try {
      await api.post("/customers/add-group", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Grup eklendi 🎉");
      fetchCustomers();
      setActiveForm("");
    } catch (err) {
      console.error(err);
      toast.error("Grup eklenirken hata oluştu ❌");
    }
  };

  const handleAddStore = async (e) => {
    e.preventDefault();
    if (!(await verifyAdmin())) return;

    const formData = Object.fromEntries(new FormData(e.target));
    try {
      await api.post("/customers/add-store", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Mağaza eklendi 🎉");
      fetchCustomers();
      setActiveForm("");
    } catch (err) {
      console.error(err);
      toast.error("Mağaza eklenirken hata oluştu ❌");
    }
  };

  return (
    <Layout>
      <div className="customer-management-page">
        <h1>Müşteri Yönetim Paneli</h1>

        {/* Form Seçim Butonları */}
        <div className="form-buttons">
          <button
            onClick={() => setActiveForm(activeForm === "group" ? "" : "group")}
          >
            Grup Şirket Ekle
          </button>
          <button
            onClick={() => setActiveForm(activeForm === "store" ? "" : "store")}
          >
            Mağaza Ekle
          </button>
        </div>

        {/* Formlar */}
        {activeForm === "group" && (
          <form className="add-form" onSubmit={handleAddGroup}>
            <h3>Yeni Grup Şirket</h3>
            <input name="name" placeholder="Grup Adı" required />
            <input name="email" placeholder="Email" />
            <input name="title" placeholder="Ünvan" />
            <button type="submit">Kaydet</button>
          </form>
        )}

        {activeForm === "store" && (
          <form className="add-form" onSubmit={handleAddStore}>
            <h3>Yeni Mağaza</h3>
            <input name="name" placeholder="Mağaza Adı" required />
            <input name="email" placeholder="Email" />
            <input name="title" placeholder="Ünvan" />
            <select name="parent_company_id">
              <option value="">Grup Seç (Opsiyonel)</option>
              {parentCompanies.map((pc) => (
                <option key={pc.id} value={pc.id}>
                  {pc.name}
                </option>
              ))}
            </select>
            <button type="submit">Kaydet</button>
          </form>
        )}

        {/* Müşteri Tablosu */}
        {loading ? (
          <p>Yükleniyor...</p>
        ) : (
          <table className="customer-table">
            <thead>
              <tr>
                <th>İsim</th>
                <th>Email</th>
                <th>Ünvan</th>
                <th>Bağlı Grup</th>
                <th>Bağlı Mağaza</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.email || "-"}</td>
                  <td>{c.title || "-"}</td>
                  <td>{c.parent_company_id || "-"}</td>
                  <td>{c.store_id || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Layout>
  );
}
