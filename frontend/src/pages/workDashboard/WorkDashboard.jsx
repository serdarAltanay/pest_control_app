// WorkDashboard.jsx
import { useState } from "react";
import Layout from "../../components/Layout";
import "./WorkDashboard.scss";

export default function WorkDashboard() {
  const role = localStorage.getItem("role");
  const [showCustomerSection, setShowCustomerSection] = useState(true);

  return (
    <Layout onCustomerClick={() => setShowCustomerSection(true)}>
      <div className="work-dashboard">
        <h1>İş Takip Paneli</h1>

        {showCustomerSection && (
          <section className="customer-section">
            <h2>Müşteri İşleri</h2>
            {/* Artık ekleme/çıkarma formları ve tablo yok */}
            {role === "admin" && (
              <div className="admin-buttons">
                <p>Admin olarak buradan görev dağıtımı yapabilirsiniz.</p>
              </div>
            )}

            <p>Görevleri bu sayfadan yönetebilirsiniz. Müşteri ve mağaza ekleme ayrı sayfada olacak.</p>
          </section>
        )}
      </div>
    </Layout>
  );
}
