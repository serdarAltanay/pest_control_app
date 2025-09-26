import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import './Login.scss'; // SCSS dosyasını import et

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post("/api/auth/login", { email, password });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", res.data.role);
      localStorage.setItem("name", res.data.name);
      localStorage.setItem("email",res.data.email);

      if (res.data.role === "customer") navigate("/customer");
      else navigate("/work"); // employee ve admin direkt work panel
    } catch (err) {
      alert(err.response?.data?.message || "Login hatası");
    }
  };

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <h2>Giriş Yap</h2>
      <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required />
      <input type="password" placeholder="Şifre" value={password} onChange={e => setPassword(e.target.value)} required />
      <button type="submit">Giriş Yap</button>
    </form>
  );
}
