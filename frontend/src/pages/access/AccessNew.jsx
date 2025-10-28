// src/pages/access/AccessNew.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./Access.scss";

const ROLES = ["CALISAN","MAGAZA_SORUMLUSU","MAGAZA_MUDURU","GENEL_MUDUR","PATRON","DIGER"];

function useDebounce(value, delay=300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/* -------------------- STORE PICKER -------------------- */
function StorePicker({ onSelect, selectedId }) {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQ = useDebounce(query, 300);

  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const fetchStores = async (q) => {
    try {
      setLoading(true);
      const url = q ? `/stores/search?q=${encodeURIComponent(q)}` : "/stores/search";
      const { data } = await api.get(url);
      setStores(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Mağaza listesi alınamadı");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStores(debouncedQ); }, [debouncedQ]);
  useEffect(() => { setPage(1); }, [debouncedQ, pageSize]);

  const totalPages = Math.max(1, Math.ceil(stores.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * pageSize;
  const pageItems = useMemo(
    () => stores.slice(startIdx, startIdx + pageSize),
    [stores, startIdx, pageSize]
  );

  return (
    <div className="picker-card">
      <div className="picker-toolbar">
        <input
          className="search"
          placeholder="Mağaza ara (ad/kod)"
          value={query}
          onChange={(e)=>setQuery(e.target.value)}
        />
        <div className="right-controls">
          <div className="page-size">
            <label>Show</label>
            <select value={pageSize} onChange={(e)=>setPageSize(Number(e.target.value))}>
              <option value={10}>10</option><option value={25}>25</option>
              <option value={50}>50</option><option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table className="picker-table">
          <thead>
            <tr>
              <th>Kod</th><th>Mağaza</th><th>Şehir</th><th>Telefon</th><th>Yetkili</th><th>Seç</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{textAlign:"center"}}>Yükleniyor...</td></tr>
            ) : pageItems.length === 0 ? (
              <tr><td colSpan={6} style={{textAlign:"center"}}>Kayıt bulunamadı</td></tr>
            ) : (
              pageItems.map((s)=>(
                <tr key={s.id} className={selectedId===s.id ? "is-selected" : ""}>
                  <td>{s.code || "—"}</td>
                  <td>{s.name || "—"}</td>
                  <td>{s.city || "—"}</td>
                  <td>{s.phone || "—"}</td>
                  <td>{s.manager || "—"}</td>
                  <td className="actions">
                    <button
                      className={`btn ${selectedId===s.id ? "selected" : ""}`}
                      onClick={()=>onSelect(s)}
                    >
                      {selectedId===s.id ? "Seçildi" : "Seç"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button className="page-btn" disabled={currentPage<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Prev</button>
        <span className="page-indicator">{currentPage}</span>
        <button className="page-btn" disabled={currentPage>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Next</button>
        <div className="count-info">
          {stores.length===0 ? "0" : `${startIdx+1}-${Math.min(startIdx+pageSize, stores.length)} / ${stores.length}`}
        </div>
      </div>
    </div>
  );
}

/* -------------------- CUSTOMER PICKER -------------------- */
const PERIOD_TR = {
  BELIRTILMEDI: "Belirtilmedi",
  HAFTALIK: "1 Haftalık",
  IKIHAFTALIK: "2 Haftalık",
  AYLIK: "1 Aylık",
  IKIAYLIK: "2 Aylık",
  UCAYLIK: "3 Aylık",
};
function CustomerPicker({ onSelect, selectedId }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [query, setQuery] = useState("");
  const debouncedQ = useDebounce(query, 300);

  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/customers");
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Müşteri listesi alınamadı");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchCustomers(); }, []);

  const filtered = useMemo(() => {
    const q = debouncedQ.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => {
      const responsible = c.employee?.fullName || "";
      return (
        (c.code || "").toLowerCase().includes(q) ||
        (c.title || "").toLowerCase().includes(q) ||
        (c.city || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        responsible.toLowerCase().includes(q)
      );
    });
  }, [customers, debouncedQ]);

  useEffect(() => { setPage(1); }, [debouncedQ, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(startIdx, startIdx + pageSize);

  const fmtPeriod = (p) => PERIOD_TR[p] || "Belirtilmedi";

  return (
    <div className="picker-card">
      <div className="picker-toolbar">
        <input
          className="search"
          placeholder="Müşteri ara (ad/kod/şehir/e-posta/sorumlu)"
          value={query}
          onChange={(e)=>setQuery(e.target.value)}
        />
        <div className="right-controls">
          <div className="page-size">
            <label>Show</label>
            <select value={pageSize} onChange={(e)=>setPageSize(Number(e.target.value))}>
              <option value={10}>10</option><option value={25}>25</option>
              <option value={50}>50</option><option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table className="picker-table">
          <thead>
            <tr>
              <th>Müşteri Kod</th><th>Müşteri</th><th>Şehir</th><th>Email</th><th>Periyot</th><th>Sorumlu</th><th>Seç</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{textAlign:"center"}}>Yükleniyor...</td></tr>
            ) : pageItems.length === 0 ? (
              <tr><td colSpan={7} style={{textAlign:"center"}}>Kayıt bulunamadı</td></tr>
            ) : (
              pageItems.map((c)=>(
                <tr key={c.id} className={selectedId===c.id ? "is-selected" : ""}>
                  <td>{c.code || "—"}</td>
                  <td>{c.title || "—"}</td>
                  <td>{c.city || "—"}</td>
                  <td className="email-cell">{c.email || "—"}</td>
                  <td>{fmtPeriod(c.visitPeriod)}</td>
                  <td>{c.employee?.fullName || "—"}</td>
                  <td className="actions">
                    <button
                      className={`btn ${selectedId===c.id ? "selected" : ""}`}
                      onClick={()=>onSelect(c)}
                    >
                      {selectedId===c.id ? "Seçildi" : "Seç"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button className="page-btn" disabled={currentPage<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Prev</button>
        <span className="page-indicator">{currentPage}</span>
        <button className="page-btn" disabled={currentPage>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>Next</button>
        <div className="count-info">
          {filtered.length===0 ? "0" : `${startIdx+1}-${Math.min(startIdx+pageSize, filtered.length)} / ${filtered.length}`}
        </div>
      </div>
    </div>
  );
}

/* -------------------- MAIN PAGE -------------------- */
export default function AccessNew() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("CALISAN");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");

  const [scopeType, setScopeType] = useState("CUSTOMER");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedStore, setSelectedStore] = useState(null);

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // kapsam değişince diğer seçimi temizle
    setSelectedCustomer(null);
    setSelectedStore(null);
  }, [scopeType]);

  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return toast.error("E-posta girin");
    if (scopeType === "CUSTOMER" && !selectedCustomer?.id) return toast.error("Bir müşteri seçin");
    if (scopeType === "STORE" && !selectedStore?.id) return toast.error("Bir mağaza seçin");

    try {
      setSaving(true);
      // 1) owner’ı garanti et (şifre maille üretilir/gönderilir)
      const ensureBody = { email: email.trim(), role, firstName, lastName, phone };
      const { data: owner } = await api.post("/access/owners/ensure", ensureBody);
      if (!owner?.id) throw new Error("Owner oluşturulamadı");

      // 2) zaten bu kapsamda erişim var mı?
      const params =
        scopeType === "CUSTOMER"
          ? `ownerId=${owner.id}&scopeType=CUSTOMER&customerId=${selectedCustomer.id}`
          : `ownerId=${owner.id}&scopeType=STORE&storeId=${selectedStore.id}`;
      const { data: existing } = await api.get(`/access/grants?${params}`);
      if (Array.isArray(existing) && existing.length > 0) {
        toast.info("Zaten bu kapsamda erişimi var.");
        return;
      }

      // 3) grant ver
      await api.post("/access/grant", {
        ownerId: Number(owner.id),
        scopeType,
        customerId: scopeType === "CUSTOMER" ? Number(selectedCustomer.id) : undefined,
        storeId: scopeType === "STORE" ? Number(selectedStore.id) : undefined,
      });

      toast.success("Erişim verildi");
      // temizle
      setEmail(""); setFirstName(""); setLastName(""); setPhone("");
      setSelectedCustomer(null); setSelectedStore(null);
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Kaydedilemedi");
    } finally { setSaving(false); }
  };

  return (
    <Layout>
      <div className="access-page">
        <div className="page-header">
          <h1>Yeni Erişim</h1>
          <div className="header-actions">
            <Link className="btn" to="/admin/access">Listeye Dön</Link>
          </div>
        </div>

        <section className="card">
          <div className="card-title">Erişim Sahibi</div>
          <form onSubmit={submit} className="grid-3">
            <div>
              <label>E-posta *</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
            </div>
            <div>
              <label>Rol *</label>
              <select value={role} onChange={e=>setRole(e.target.value)}>
                {ROLES.map(r=> <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label>Telefon</label>
              <input value={phone} onChange={e=>setPhone(e.target.value)} />
            </div>
            <div>
              <label>Ad</label>
              <input value={firstName} onChange={e=>setFirstName(e.target.value)} />
            </div>
            <div>
              <label>Soyad</label>
              <input value={lastName} onChange={e=>setLastName(e.target.value)} />
            </div>
            <div>
              <label>Kapsam *</label>
              <select value={scopeType} onChange={e=>setScopeType(e.target.value)}>
                <option value="CUSTOMER">Müşteri-Genel</option>
                <option value="STORE">Mağaza</option>
              </select>
            </div>

            <div className="full selected-target">
              {scopeType === "CUSTOMER" && selectedCustomer ? (
                <>
                  <span className="badge">Seçilen Müşteri:</span>
                  <b>{selectedCustomer.title}</b>
                  <span className="muted"> (#{selectedCustomer.id}{selectedCustomer.code ? ` · ${selectedCustomer.code}` : ""})</span>
                  <button type="button" className="link-clear" onClick={()=>setSelectedCustomer(null)}>Seçimi temizle</button>
                </>
              ) : scopeType === "STORE" && selectedStore ? (
                <>
                  <span className="badge">Seçilen Mağaza:</span>
                  <b>{selectedStore.name}</b>
                  <span className="muted"> (#{selectedStore.id}{selectedStore.code ? ` · ${selectedStore.code}` : ""})</span>
                  <button type="button" className="link-clear" onClick={()=>setSelectedStore(null)}>Seçimi temizle</button>
                </>
              ) : (
                <span className="muted">Bir {scopeType === "CUSTOMER" ? "müşteri" : "mağaza"} seçin.</span>
              )}
            </div>

            <div className="full btn-row">
              <button
                className="btn primary"
                disabled={saving || (scopeType==="CUSTOMER" && !selectedCustomer) || (scopeType==="STORE" && !selectedStore)}
              >
                {saving ? "Kaydediliyor..." : "Erişim Ver"}
              </button>
              <span className="muted">Owner yoksa oluşturulur. Şifre e-posta ile gönderilir.</span>
            </div>
          </form>
        </section>

        <section className="card">
          <div className="card-title">
            {scopeType === "CUSTOMER" ? "Müşteri Seç" : "Mağaza Seç"}
          </div>

          {scopeType === "CUSTOMER" ? (
            <CustomerPicker
              onSelect={(c)=>setSelectedCustomer(c)}
              selectedId={selectedCustomer?.id || null}
            />
          ) : (
            <StorePicker
              onSelect={(s)=>setSelectedStore(s)}
              selectedId={selectedStore?.id || null}
            />
          )}
        </section>
      </div>
    </Layout>
  );
}
