// WorkDashboard.jsx
import { useState, useEffect } from "react";
import Layout from "../../components/Layout";
import axios from "axios";
import "./WorkDashboard.scss";

export default function WorkDashboard() {
  const role = localStorage.getItem("role");
  const [showCustomerSection, setShowCustomerSection] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [activeForm, setActiveForm] = useState(""); // "group" veya "store"
  const [parentCompanies, setParentCompanies] = useState([]);

  useEffect(() => {
    if (showCustomerSection) {
      const token = localStorage.getItem("token");
      axios.get("/api/customers", { headers: { Authorization: `Bearer ${token}` } })
        .then(res => {
          setCustomers(res.data);
          setParentCompanies(res.data.filter(c => !c.parent_company_id)); // sadece grup şirketler
        })
        .catch(err => console.error(err));
    }
  }, [showCustomerSection]);

const verifyAdmin = async () => {
  const password = prompt("Lütfen admin şifrenizi girin:");
  if (!password) return false;

  const email = localStorage.getItem("email");
  if (!email) {
    alert("Email bilgisi yok, lütfen tekrar giriş yapın.");
    return false;
  }

  const token = localStorage.getItem("token");
  if (!token) {
    alert("Token yok, lütfen tekrar giriş yapın.");
    return false;
  }

  try {
    const res = await axios.post("/api/customers/verify-admin", 
      { email, password },
      { headers: { Authorization: `Bearer ${token}` } }
    );
    return res.data.success;
  } catch (err) {
    console.error(err.response?.data || err);
    alert(err.response?.data?.message || "Şifre doğrulama hatası");
    return false;
  }
};

  const handleAddGroup = async (e) => {
  e.preventDefault();

  // Admin şifre doğrulama
  if (!(await verifyAdmin())) return;

  const formData = Object.fromEntries(new FormData(e.target));
  const token = localStorage.getItem("token");

  try {
    const res = await axios.post("/api/customers/add-group", formData, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.data.success) {
      alert("Grup şirket başarıyla eklendi!");
      // Listeyi güncelle
      const updatedList = await axios.get("/api/customers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCustomers(updatedList.data);
      setParentCompanies(updatedList.data.filter(c => !c.parent_company_id));

      // Formu kapat
      setActiveForm("");
    }
  } catch (err) {
    console.error(err);
    alert("Grup şirket eklenirken hata oluştu!");
  }
};


  const handleAddStore = async (e) => {
  e.preventDefault();

  if (!(await verifyAdmin())) return;

  const formData = Object.fromEntries(new FormData(e.target));
  const token = localStorage.getItem("token");

  try {
    const res = await axios.post("/api/customers/add-store", formData, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.data.success) {
      alert("Mağaza başarıyla eklendi!");
      const updatedList = await axios.get("/api/customers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCustomers(updatedList.data);
      setParentCompanies(updatedList.data.filter(c => !c.parent_company_id));
      setActiveForm("");
    }
  } catch (err) {
    console.error(err);
    alert("Mağaza eklenirken hata oluştu!");
  }
};


  return (
    <Layout onCustomerClick={() => setShowCustomerSection(true)}>
      <div className="work-dashboard">
        <h1>İş Takip Paneli</h1>

        {showCustomerSection && (
          <section className="customer-section">
            <h2>Müşteri İşleri</h2>

            {role === "admin" && (
              <div className="admin-buttons">
                <button onClick={() => setActiveForm(activeForm === "group" ? "" : "group")}>
                  Grup Şirket Ekle
                </button>
                <button onClick={() => setActiveForm(activeForm === "store" ? "" : "store")}>
                  Mağaza Ekle
                </button>
              </div>
            )}

            {/* Formlar */}
            {activeForm === "group" && (
              <form className="add-form" onSubmit={handleAddGroup}>
                <h3>Yeni Grup Şirket</h3>
                <input name="name" placeholder="Şirket Adı" required />
                <input name="email" type="email" placeholder="Email" />
                <input name="title" placeholder="Ünvan" />
                <button type="submit">Kaydet</button>
              </form>
            )}

            {activeForm === "store" && (
              <form className="add-form" onSubmit={handleAddStore}>
                <h3>Yeni Mağaza</h3>
                <input name="name" placeholder="Mağaza Adı" required />
                <input name="email" type="email" placeholder="Email" />
                <input name="title" placeholder="Ünvan" />
                <select name="parent_company_id">
                  <option value="">Grup Seç (Opsiyonel)</option>
                  {parentCompanies.map(pc => (
                    <option key={pc.id} value={pc.id}>{pc.name}</option>
                  ))}
                </select>
                <button type="submit">Kaydet</button>
              </form>
            )}

            {/* Tablo */}
            <table className="customer-table">
              <thead>
                <tr>
                  <th>İsim</th>
                  <th>Email</th>
                  <th>Ünvan</th>
                  <th>Sorumlu</th>
                  <th>İşi Alma Tarihi</th>
                  <th>Kayıt Tarihi</th>
                  <th>Bağlı şirket</th>
                </tr>
              </thead>
              <tbody>
                {customers.map(c => (
                  <tr key={c.id}>
                    <td>{c.name}</td>
                    <td>{c.email}</td>
                    <td>{c.title}</td>
                    <td>{c.assigned_to}</td>
                    <td>{c.job_start_date}</td>
                    <td>{c.registered_at}</td>
                    <td>{c.parent_company_id || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </div>
    </Layout>
  );
}
