import { useState } from "react";
import api from "../../api/axios";
import Layout from "../../components/Layout";
import { toast } from "react-toastify";
import "./AddAdmin.scss";

export default function AddAdmin() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/admins", { fullName, email, password });
      toast.success("Yönetici eklendi");
      setFullName(""); setEmail(""); setPassword("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Hata");
    }
  };

  return (
    <Layout>
      <div className="add-user-page">
        <h2>Yönetici Ekle</h2>
        <form className="panel" onSubmit={submit}>
          <div className="row">
            <label>Personel Adı Soyadı *</label>
            <input value={fullName} onChange={(e)=>setFullName(e.target.value)} required/>

            <label>Giriş Mail Adresi *</label>
            <input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required/>

            <label>Parola *</label>
            <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required/>
          </div>
          <button className="primary">Yönetici Ekle</button>
        </form>
      </div>
    </Layout>
  );
}
