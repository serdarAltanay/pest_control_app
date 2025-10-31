import { useEffect, useMemo, useState } from "react";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import { getAvatarUrl } from "../../utils/getAssetUrl";
import "./Contacts.scss";

function cleanDigits(s = "") {
  return String(s).replace(/\D+/g, "");
}

/** TR numarayı WhatsApp formatına çevirir ( wa.me/905xx... ) */
function toWhatsAppLink(phone) {
  if (!phone) return null;
  let d = cleanDigits(phone);

  // 00 ile başlıyorsa (ör: 0090) → kırp
  if (d.startsWith("00")) d = d.slice(2);
  // 0 5xx xxx xx xx (11 hane) → 90 + 5xx...
  if (d.length === 11 && d.startsWith("0")) d = "9" + d;
  // 5xx xxx xx xx (10 hane) → 90 + 5xx...
  if (d.length === 10 && d.startsWith("5")) d = "90" + d;

  // artık 90 ile başlaması beklenir
  if (!d.startsWith("90")) return `https://wa.me/${d}`; // başka ülke kodları için ham ver
  const text = encodeURIComponent("Merhaba, destek için yazıyorum.");
  return `https://wa.me/${d}?text=${text}`;
}

function emailToGmail(email) {
  if (!email) return null;
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(email)}`;
}

function ContactCard({ c }) {
  const avatar = getAvatarUrl(c?.profileImage) || "/noavatar.jpg";
  const wa = toWhatsAppLink(c?.phone);
  const gmail = emailToGmail(c?.email);

  return (
    <div className="contact-card">
      <img
        className="avatar"
        src={avatar}
        alt={c?.name || "Kişi"}
        onError={(e) => {
          if (!e.currentTarget.src.endsWith("/noavatar.jpg")) {
            e.currentTarget.src = "/noavatar.jpg";
          }
        }}
      />
      <div className="meta">
        <div className="top">
          <div className="name">{c?.name || "—"}</div>
          <span className={`badge ${c?.role === "ADMIN" ? "admin" : "emp"}`}>
            {c?.role === "ADMIN" ? "Admin" : "Personel"}
          </span>
        </div>

        <div className="row">
          <span className="label">E-posta:</span>
          {gmail ? (
            <a className="link" href={gmail} target="_blank" rel="noreferrer">
              {c?.email}
            </a>
          ) : (
            <span className="muted">—</span>
          )}
        </div>

        <div className="row">
          <span className="label">Cep:</span>
          {wa ? (
            <a className="link" href={wa} target="_blank" rel="noreferrer">
              {c?.phone}
            </a>
          ) : (
            <span className="muted">—</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Contacts() {
  const [data, setData] = useState({ admins: [], employees: [] });
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/contacts");
      setData({
        admins: Array.isArray(data?.admins) ? data.admins : [],
        employees: Array.isArray(data?.employees) ? data.employees : [],
      });
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.error || "İletişim bilgileri alınamadı");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return data;
    const filt = (arr) =>
      arr.filter((c) =>
        [c?.name, c?.email, c?.phone].filter(Boolean).join(" ").toLowerCase().includes(t)
      );
    return { admins: filt(data.admins), employees: filt(data.employees) };
  }, [data, q]);

  return (
    <Layout title="İletişim Kanalları">
      <div className="contacts-page">
        <div className="topbar card">
          <h1>İletişim Kanalları</h1>
          <div className="hint">Admin ve personel iletişim bilgileri</div>
          <div className="actions">
            <input
              className="search"
              placeholder="Ara: isim, mail, cep…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button className="btn ghost" onClick={fetchData} disabled={loading}>
              {loading ? "Yükleniyor…" : "Yenile"}
            </button>
          </div>
        </div>

        <div className="grid">
          <div className="col">
            <div className="section-head">Adminler</div>
            {filtered.admins.length === 0 && <div className="empty">Kayıt yok</div>}
            {filtered.admins.map((c) => <ContactCard key={`a-${c.id}`} c={c} />)}
          </div>

          <div className="col">
            <div className="section-head">Personeller</div>
            {filtered.employees.length === 0 && <div className="empty">Kayıt yok</div>}
            {filtered.employees.map((c) => <ContactCard key={`e-${c.id}`} c={c} />)}
          </div>
        </div>
      </div>
    </Layout>
  );
}
