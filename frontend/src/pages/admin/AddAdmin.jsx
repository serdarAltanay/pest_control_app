import { useEffect, useState } from "react";
import api from "../../api/axios";
import Layout from "../../components/Layout";
import { toast } from "react-toastify";
import "./AddAdmin.scss";

export default function AddAdmin() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(false);

  // ---- Presence helpers ----
  const ONLINE_MS = 2 * 60 * 1000;   // 0–2 dk: online
  const IDLE_MS   = 10 * 60 * 1000;  // 2–10 dk: idle, >10 dk: offline

  const getPresence = (lastSeenAt) => {
    if (!lastSeenAt) return { cls: "status-offline", label: "Offline" };
    const diff = Date.now() - new Date(lastSeenAt).getTime();
    if (diff <= ONLINE_MS) return { cls: "status-online", label: "Online" };
    if (diff <= IDLE_MS)   return { cls: "status-idle", label: "Idle" };
    return { cls: "status-offline", label: "Offline" };
  };

  const relTime = (d) => {
    if (!d) return "bilgi yok";
    const diff = Math.max(0, Date.now() - new Date(d).getTime());
    const s = Math.floor(diff / 1000);
    if (s < 30) return "az önce";
    if (s < 60) return `${s} sn önce`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} dk önce`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} sa önce`;
    const g = Math.floor(h / 24);
    if (g < 30) return `${g} gün önce`;
    const ay = Math.floor(g / 30);
    if (ay < 12) return `${ay} ay önce`;
    const y = Math.floor(ay / 12);
    return `${y} yıl önce`;
  };

  const fmt = (val) => {
    if (!val) return "—";
    try { return new Date(val).toLocaleString("tr-TR"); }
    catch { return String(val); }
  };

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/admin/admins");
      setAdmins(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Yöneticiler alınamadı");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdmins();
    const t = setInterval(fetchAdmins, 30_000);
    return () => clearInterval(t);
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/create", { fullName, email, password });
      toast.success("Yönetici eklendi");
      setFullName("");
      setEmail("");
      setPassword("");
      fetchAdmins();
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
            <div>
              <label>Personel Adı Soyadı *</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>

            <div>
              <label>Giriş Mail Adresi *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label>Parola *</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button className="primary">Yönetici Ekle</button>
        </form>

        <div className={`admins-list${loading ? " is-loading" : ""}`}>
          <div className="list-header">
            <h3>Mevcut Yöneticiler</h3>
            <div className="actions">
              <button className="btn" type="button" onClick={fetchAdmins} disabled={loading}>
                {loading ? "Yükleniyor..." : "Yenile"}
              </button>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="admins-table">
              <thead>
                <tr>
                  <th>Durum</th>
                  <th>Ad Soyad</th>
                  <th>E-posta</th>
                  <th>Son Giriş</th>
                  <th>Son Görülme</th>
                  <th>Son Güncelleme</th>
                  <th>Eklenme</th>
                </tr>
              </thead>
              <tbody>
                {admins.length === 0 && !loading ? (
                  <tr className="empty-row">
                    <td colSpan={7}>Kayıt bulunamadı</td>
                  </tr>
                ) : (
                  admins.map((a) => {
                    const presence = getPresence(a.lastSeenAt);
                    const initials = (a.fullName || "")
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((w) => w[0]?.toUpperCase())
                      .join("");

                    return (
                      <tr key={a.id}>
                        <td
                          className={`presence ${presence.cls}`}
                          title={`Son görüldü: ${relTime(a.lastSeenAt)}`}
                        >
                          <span className="dot" />
                          <span className="presence-label">{presence.label}</span>
                        </td>

                        <td>
                          <div className="name">
                            <span className="avatar">{initials || "AD"}</span>
                            <span>{a.fullName || "—"}</span>
                          </div>
                        </td>

                        <td className="muted">{a.email || "—"}</td>
                        <td>{fmt(a.lastLoginAt)}</td>
                        <td>{fmt(a.lastSeenAt)}</td>
                        <td>{fmt(a.updatedAt)}</td>
                        <td>{fmt(a.createdAt)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
