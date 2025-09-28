import { useState, useEffect } from "react";
import axios from "axios";
import Layout from "../../components/Layout";
import "./AddUser.scss";

export default function AddUser() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("customer");

  const [admins, setAdmins] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [assignedTo, setAssignedTo] = useState("");
  const [parentCompany, setParentCompany] = useState("");
  const [store, setStore] = useState("");
  const [title, setTitle] = useState("");

  const token = localStorage.getItem("token");

  useEffect(() => {
    // Admin ve Employee listelerini çek
    const fetchAdmins = async () => {
      try {
        const res = await axios.get("/api/admin/list", { headers: { Authorization: `Bearer ${token}` } });
        setAdmins(res.data);
      } catch (err) {
        console.error(err);
      }
    };

    const fetchEmployees = async () => {
      try {
        const res = await axios.get("/api/employee/list", { headers: { Authorization: `Bearer ${token}` } });
        setEmployees(res.data);
      } catch (err) {
        console.error(err);
      }
    };

    if (role === "employee") fetchAdmins();
    if (role === "customer") fetchEmployees();
  }, [role, token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        "/api/admin/add-user",
        {
          name,
          email,
          password,
          role,
          assigned_to: assignedTo || undefined,
          parent_company_id: parentCompany || undefined,
          store_id: store || undefined,
          title: title || undefined,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert("Kullanıcı başarıyla eklendi!");
      // reset
      setName(""); setEmail(""); setPassword(""); setRole("customer");
      setAssignedTo(""); setParentCompany(""); setStore(""); setTitle("");
    } catch (err) {
      alert(err.response?.data?.message || "Hata oluştu");
    }
  };

  return (
    <Layout>
      <div className="add-user-form">
        <h2>Yeni Kullanıcı Ekle</h2>
        <form onSubmit={handleSubmit}>
          <input type="text" placeholder="Ad Soyad" value={name} onChange={(e) => setName(e.target.value)} required />
          <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="Şifre" value={password} onChange={(e) => setPassword(e.target.value)} />

          <select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="customer">Müşteri</option>
            <option value="employee">Çalışan</option>
            <option value="admin">Admin</option>
          </select>

          {/* Employee seçilmişse hangi admin’e bağlı */}
          {role === "employee" && (
            <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} required>
              <option value="">Bağlı Admin Seç</option>
              {admins.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}

          {/* Customer seçilmişse hangi employee’ye bağlı */}
          {role === "customer" && (
            <>
              <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} required>
                <option value="">Bağlı Çalışan Seç</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
              </select>
              <input type="text" placeholder="Ünvan" value={title} onChange={(e) => setTitle(e.target.value)} />
              <input type="text" placeholder="Bağlı Grup Şirket ID" value={parentCompany} onChange={(e) => setParentCompany(e.target.value)} />
              <input type="text" placeholder="Bağlı Mağaza ID" value={store} onChange={(e) => setStore(e.target.value)} />
            </>
          )}

          <button type="submit">Ekle</button>
        </form>
      </div>
    </Layout>
  );
}
