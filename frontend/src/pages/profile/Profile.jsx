import Layout from "../../components/Layout";

export default function Profile() {
  // LocalStorage'dan kullanıcı bilgilerini alalım
  const email = localStorage.getItem("email") || "Bilinmiyor";
  const role = localStorage.getItem("role") || "Bilinmiyor";

  return (
    <Layout>
      <div style={{ padding: "2rem" }}>
        <h1>Profil Sayfası</h1>
        <div style={{ marginTop: "1rem" }}>
          <p><strong>Email:</strong> {email}</p>
          <p><strong>Rol:</strong> {role}</p>
        </div>
      </div>
    </Layout>
  );
}
