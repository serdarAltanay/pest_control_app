// src/pages/access/AccessManageCustomer.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./Access.scss";

const ROLES = [
  "CALISAN",
  "MAGAZA_SORUMLUSU",
  "MAGAZA_MUDURU",
  "GENEL_MUDUR",
  "PATRON",
  "DIGER",
];

/* ───────── STORE PICKER (yalnızca bu müşterinin mağazaları) ───────── */
function useDebounce(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

function StorePicker({ stores = [], selectedId, onSelect }) {
  const [q, setQ] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const dq = useDebounce(q, 250);

  const filtered = useMemo(() => {
    const t = dq.trim().toLowerCase();
    if (!t) return stores;
    return stores.filter((s) =>
      [
        s.code || "",
        s.name || "",
        s.city || "",
        s.phone || "",
        s.manager || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(t)
    );
  }, [stores, dq]);

  useEffect(() => setPage(1), [dq, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(startIdx, startIdx + pageSize);

  return (
    <div className="picker-card">
      <div className="picker-toolbar">
        <input
          className="search"
          placeholder="Mağaza ara (ad/kod/şehir/yetkili)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="right-controls">
          <div className="page-size">
            <label>Show</label>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table className="picker-table">
          <thead>
            <tr>
              <th>Kod</th>
              <th>Mağaza</th>
              <th>Şehir</th>
              <th>Telefon</th>
              <th>Yetkili</th>
              <th>Seç</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center" }}>
                  Kayıt bulunamadı
                </td>
              </tr>
            ) : (
              pageItems.map((s) => (
                <tr
                  key={s.id}
                  className={selectedId === s.id ? "is-selected" : ""}
                >
                  <td>{s.code || "—"}</td>
                  <td>{s.name || "—"}</td>
                  <td>{s.city || "—"}</td>
                  <td>{s.phone || "—"}</td>
                  <td>{s.manager || "—"}</td>
                  <td className="actions">
                    <button
                      className={`btn ${selectedId === s.id ? "selected" : ""}`}
                      onClick={() => onSelect?.(s)}
                    >
                      {selectedId === s.id ? "Seçildi" : "Seç"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button
          className="page-btn"
          disabled={currentPage <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Prev
        </button>
        <span className="page-indicator">{currentPage}</span>
        <button
          className="page-btn"
          disabled={currentPage >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          Next
        </button>
        <div className="count-info">
          {filtered.length === 0
            ? "0"
            : `${startIdx + 1}-${Math.min(
                startIdx + pageSize,
                filtered.length
              )} / ${filtered.length}`}
        </div>
      </div>
    </div>
  );
}

/* ───────── ANA SAYFA ───────── */
export default function AccessManageCustomer() {
  const { customerId } = useParams();

  const [customer, setCustomer] = useState(null);
  const [rows, setRows] = useState([]);

  // owner/erişim formu
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("CALISAN");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [scopeType, setScopeType] = useState("CUSTOMER");

  // mağaza seçimi (yalnızca STORE kapsamı için)
  const [selectedStore, setSelectedStore] = useState(null);

  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      // Müşteri + mağazalar
      const { data: c } = await api.get(`/customers/${customerId}`);
      setCustomer(c);
    } catch (e) {
      // sessiz
    }
    try {
      // Bu müşteriye etkili tüm erişimler (CUSTOMER + STORE)
      const { data } = await api.get(`/access/customer/${customerId}`);
      const list = Array.isArray(data?.grants)
        ? data.grants
        : Array.isArray(data)
        ? data
        : [];
      setRows(list);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Liste alınamadı");
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const customerLevel = rows.filter((r) => r.scopeType === "CUSTOMER");
  const storeLevel = rows.filter((r) => r.scopeType === "STORE");

  const addGrant = async (e) => {
    e.preventDefault();
    if (!email.trim()) return toast.error("E-posta girin");
    if (scopeType === "STORE" && !selectedStore?.id)
      return toast.error("Bir mağaza seçin");

    try {
      setSaving(true);

      // 1) Owner’ı garanti et (varsa getirir, yoksa oluşturur)
      const ensureBody = {
        email: email.trim(),
        role,
        firstName,
        lastName,
        phone,
      };
      const { data: owner } = await api.post(
        "/access/owners/ensure",
        ensureBody
      );
      if (!owner?.id) throw new Error("Owner oluşturulamadı");

      // 2) Bu kapsamda zaten erişim var mı? (opsiyonel ama kullanıcı dostu)
      let params = `ownerId=${owner.id}&scopeType=${scopeType}`;
      if (scopeType === "CUSTOMER") params += `&customerId=${customerId}`;
      else params += `&storeId=${selectedStore.id}`;

      const { data: existing } = await api.get(`/access/grants?${params}`);
      if (Array.isArray(existing) && existing.length > 0) {
        toast.info("Zaten bu kapsamda erişimi var.");
        return;
      }

      // 3) Grant ver
      await api.post("/access/grant", {
        ownerId: Number(owner.id),
        scopeType,
        customerId: scopeType === "CUSTOMER" ? Number(customerId) : undefined,
        storeId: scopeType === "STORE" ? Number(selectedStore.id) : undefined,
      });

      toast.success("Erişim verildi");
      // temizle
      setEmail("");
      setFirstName("");
      setLastName("");
      setPhone("");
      setSelectedStore(null);

      await load();
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (id) => {
    if (!window.confirm("Bu erişimi kaldırmak istiyor musunuz?")) return;
    try {
      await api.delete(`/access/${id}`);
      setRows((rs) => rs.filter((r) => r.id !== id));
      toast.success("Erişim kaldırıldı");
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Silinemedi");
    }
  };

  return (
    <Layout>
      <div className="access-page">
        <div className="page-header">
          <h1>Müşteri Erişimi – {customer?.title || `#${customerId}`}</h1>
          <div className="header-actions">
            <Link className="btn" to={`/admin/customers/${customerId}`}>
              Müşteri
            </Link>
          </div>
        </div>

        {/* YENİ ERİŞİM VER */}
        <section className="card">
          <div className="card-title">Yeni Erişim Ver</div>
          <form onSubmit={addGrant} className="grid-3">
            <div>
              <label>E-posta *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="kisi@firma.com"
                required
              />
            </div>
            <div>
              <label>Rol *</label>
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Kapsam *</label>
              <select
                value={scopeType}
                onChange={(e) => setScopeType(e.target.value)}
              >
                <option value="CUSTOMER">
                  Müşteri-Genel (tüm mağazalar)
                </option>
                <option value="STORE">Tekil Mağaza</option>
              </select>
            </div>

            <div>
              <label>Ad</label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Opsiyonel"
              />
            </div>
            <div>
              <label>Soyad</label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Opsiyonel"
              />
            </div>
            <div>
              <label>Telefon</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Opsiyonel"
              />
            </div>

            <div className="full selected-target">
              {scopeType === "CUSTOMER" ? (
                <span className="muted">
                  Bu kullanıcıya <b>“{customer?.title || `#${customerId}`}”</b>{" "}
                  müşterisinin <b>tüm mağazalarına</b> erişim verilir.
                </span>
              ) : selectedStore ? (
                <>
                  <span className="badge">Seçilen Mağaza:</span>
                  <b>{selectedStore.name}</b>
                  <span className="muted">
                    {" "}
                    (#{selectedStore.id}
                    {selectedStore.code ? ` · ${selectedStore.code}` : ""})
                  </span>
                  <button
                    type="button"
                    className="link-clear"
                    onClick={() => setSelectedStore(null)}
                  >
                    Seçimi temizle
                  </button>
                </>
              ) : (
                <span className="muted">Bir mağaza seçin.</span>
              )}
            </div>

            <div className="full btn-row">
              <button
                className="btn primary"
                disabled={
                  saving ||
                  (scopeType === "STORE" && !selectedStore) ||
                  !email.trim()
                }
              >
                {saving ? "Kaydediliyor..." : "Erişim Ver"}
              </button>
              <span className="muted">
                Not: Owner yoksa e-posta + rol ile oluşturulur. Şifre, hoş geldin
                e-postasıyla iletilir.
              </span>
            </div>
          </form>
        </section>

        {/* Mağaza seçimi (yalnızca STORE kapsamı iken) */}
        {scopeType === "STORE" && (
          <section className="card">
            <div className="card-title">Mağaza Seç</div>
            <StorePicker
              stores={customer?.stores || []}
              selectedId={selectedStore?.id || null}
              onSelect={(s) => setSelectedStore(s)}
            />
          </section>
        )}

        {/* Müşteri-Genel erişimler */}
        <section className="card">
          <div className="card-title">Müşteri-Genel Erişimler</div>
          {customerLevel.length === 0 ? (
            <div className="empty">Kayıt yok.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Kişi</th>
                  <th>Rol</th>
                  <th>Veriliş</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {customerLevel.map((r) => (
                  <tr key={r.id}>
                    <td className="strong">
                      {(r.owner?.firstName || "") +
                        " " +
                        (r.owner?.lastName || "")}{" "}
                      <span className="muted">({r.owner?.email})</span>
                    </td>
                    <td>{r.owner?.role}</td>
                    <td className="muted">
                      {new Date(r.createdAt).toLocaleString("tr-TR")}
                    </td>
                    <td className="actions">
                      <button
                        className="btn danger"
                        onClick={() => revoke(r.id)}
                      >
                        Kaldır
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Tekil mağaza erişimleri */}
        <section className="card">
          <div className="card-title">Tekil Mağaza Erişimleri</div>
          {storeLevel.length === 0 ? (
            <div className="empty">Kayıt yok.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Kişi</th>
                  <th>Rol</th>
                  <th>Mağaza</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {storeLevel.map((r) => (
                  <tr key={r.id}>
                    <td className="strong">
                      {(r.owner?.firstName || "") +
                        " " +
                        (r.owner?.lastName || "")}{" "}
                      <span className="muted">({r.owner?.email})</span>
                    </td>
                    <td>{r.owner?.role}</td>
                    <td className="muted">{r.store?.name || r.storeId}</td>
                    <td className="actions">
                      <button
                        className="btn danger"
                        onClick={() => revoke(r.id)}
                      >
                        Kaldır
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </Layout>
  );
}
