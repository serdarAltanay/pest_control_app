import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./Access.scss";

const ACCESS_ROLES = [
  { value: "CALISAN",          label: "Çalışan" },
  { value: "MAGAZA_SORUMLUSU", label: "Mağaza Sorumlusu" },
  { value: "MAGAZA_MUDURU",    label: "Mağaza Müdürü" },
  { value: "GENEL_MUDUR",      label: "Genel Müdür" },
  { value: "PATRON",           label: "Patron" },
  { value: "DIGER",            label: "Diğer" },
];

/* ---------------- presence helpers ---------------- */
const ONLINE_MS = 2 * 60 * 1000;
const IDLE_MS   = 10 * 60 * 1000;
const getPresence = (t) => {
  if (!t) return { cls: "status-offline", label: "Offline" };
  const diff = Date.now() - new Date(t).getTime();
  if (diff <= ONLINE_MS) return { cls: "status-online", label: "Online" };
  if (diff <= IDLE_MS)   return { cls: "status-idle", label: "Idle" };
  return { cls: "status-offline", label: "Offline" };
};
const relTime = (d) => {
  if (!d) return "—";
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
const fmt = (v) => (v ? new Date(v).toLocaleString("tr-TR") : "—");

/* ---------------- küçük yardımcılar ---------------- */
function useDebounce(value, delay=300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/* ---------------- STORE PICKER ---------------- */
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

/* ---------------- CUSTOMER PICKER ---------------- */
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

/* ---------------- MAIN DETAIL PAGE ---------------- */
export default function AccessOwnerDetail() {
  const { ownerId } = useParams();

  const [owner, setOwner]           = useState(null);
  const [grants, setGrants]         = useState([]);
  const [lastSeenAt, setLastSeenAt] = useState(null);
  const [, setTick]                 = useState(0);

  // yeni erişim UI
  const [scopeType, setScopeType] = useState("CUSTOMER");
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedStore, setSelectedStore]       = useState(null);
  const [savingGrant, setSavingGrant] = useState(false);

  const load = async () => {
    try {
      let o = null;
      let gs = [];

      // 1) /access/owner/:id
      const one = await api.get(`/access/owner/${ownerId}`).catch(() => null);
      if (one?.data) {
        o  = one.data.owner || null;
        gs = Array.isArray(one.data.grants) ? one.data.grants : [];
      }

      // 2) /access/owners/:id (fallback)
      if (!o) {
        const two = await api.get(`/access/owners/${ownerId}`).catch(() => null);
        if (two?.data) {
          o  = two.data.owner || two.data || null;
          gs = Array.isArray(two.data?.grants) ? two.data.grants : gs;
        }
      }

      // 3) /access/grants (tamamlayıcı fallback)
      if (!o) {
        const all = await api.get("/access/grants").catch(() => null);
        const list = Array.isArray(all?.data) ? all.data : [];
        const mine = list.filter(g => Number(g.ownerId || g.owner?.id) === Number(ownerId));
        if (mine.length) {
          gs = mine;
          const any = mine.find(Boolean);
          o = any?.owner || null;
        }
      }

      setOwner(o);
      setGrants(gs);
      setLastSeenAt(o?.lastSeenAt || null);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Detay alınamadı");
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [ownerId]);

  // relTime canlı akış
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const presence = useMemo(() => getPresence(lastSeenAt), [lastSeenAt]);

  // kapsam değişince seçimleri temizle
  useEffect(() => { setSelectedCustomer(null); setSelectedStore(null); }, [scopeType]);

  const addGrant = async (e) => {
    e.preventDefault();
    if (!owner?.id) return toast.error("Owner yüklenemedi");

    const customerId = scopeType === "CUSTOMER" ? selectedCustomer?.id : null;
    const storeId    = scopeType === "STORE"    ? selectedStore?.id    : null;
    if (scopeType === "CUSTOMER" && !customerId) return toast.error("Bir müşteri seçin");
    if (scopeType === "STORE"    && !storeId)    return toast.error("Bir mağaza seçin");

    // FE tarafında kopya grant kontrolü
    const hasDup = grants.some(g =>
      g.scopeType === scopeType &&
      (scopeType === "CUSTOMER" ? Number(g.customerId) === Number(customerId) : Number(g.storeId) === Number(storeId))
    );
    if (hasDup) {
      toast.info("Zaten bu kapsamda erişim var.");
      return;
    }

    try {
      setSavingGrant(true);

      // BE’de de duplicate engeli var (unique index) — ek olarak kibar mesaj
      await api.post("/access/grant", {
        ownerId: Number(owner.id),
        scopeType,
        customerId: customerId ? Number(customerId) : undefined,
        storeId:    storeId    ? Number(storeId)    : undefined,
      });

      toast.success("Erişim verildi. Bilgilendirme e-postası gönderildi.");
      await load();
      setSelectedCustomer(null); setSelectedStore(null);
    } catch (e2) {
      const msg = e2?.response?.data?.message || "Kaydedilemedi";
      toast.error(msg);
    } finally {
      setSavingGrant(false);
    }
  };

  return (
    <Layout>
      <div className="access-page">
        <div className="page-header">
          <h1>
            Erişim Sahibi – {((owner?.firstName || "") + " " + (owner?.lastName || "")).trim() || "—"}
            {" "}
            <span className="muted">({owner?.email || "—"} · {owner?.role || "—"})</span>
          </h1>
          <div className="header-actions">
            <Link className="btn" to="/admin/access">Liste</Link>
          </div>
        </div>

        {/* ÖZET */}
        <section className="card">
          <div className="card-title">Özet</div>
          <div className="kv" style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:12 }}>
            <div>
              <b>Durum</b>
              <span>
                <span className={`presence ${presence.cls}`}>
                  <span className="dot" /> <span className="presence-label">{presence.label}</span>
                </span>
              </span>
            </div>
            <div>
              <b>Son Görülme</b>
              <span>{lastSeenAt ? `${relTime(lastSeenAt)} (${fmt(lastSeenAt)})` : "—"}</span>
            </div>
            <div>
              <b>Son Giriş</b>
              <span>{fmt(owner?.lastLoginAt)}</span>
            </div>
            <div>
              <b>Güncelleme</b>
              <span>{fmt(owner?.updatedAt)}</span>
            </div>
            <div>
              <b>Oluşturulma</b>
              <span>{fmt(owner?.createdAt)}</span>
            </div>
            <div>
              <b>Aktif</b>
              <span>{owner?.isActive ? "Evet" : "Hayır"}</span>
            </div>
          </div>
        </section>

        {/* YENİ ERİŞİM VER (Picker'lı) */}
        <section className="card">
          <div className="card-title">Yeni Erişim Ver</div>

          <form onSubmit={addGrant} className="grid-3">
            <div>
              <label>Kapsam *</label>
              <select value={scopeType} onChange={e=>setScopeType(e.target.value)}>
                <option value="CUSTOMER">Müşteri (tüm mağazalar)</option>
                <option value="STORE">Mağaza (tekil)</option>
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

            <div className="full btn-row" style={{marginTop: 8}}>
              <button
                className="btn primary"
                disabled={
                  savingGrant ||
                  (scopeType==="CUSTOMER" && !selectedCustomer) ||
                  (scopeType==="STORE" && !selectedStore)
                }
              >
                {savingGrant ? "Kaydediliyor..." : "Erişim Ver"}
              </button>
              <span className="muted">Owner’a e-posta ile bilgilendirme gönderilir.</span>
            </div>
          </form>
        </section>

        {/* PICKER alanı */}
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

        {/* MEVCUT ERİŞİMLER */}
        <section className="card">
          <div className="card-title">Mevcut Erişimler</div>
          {grants.length === 0 ? (
            <div className="empty">Bu kullanıcıya tanımlı erişim yok.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Kapsam</th>
                  <th>Detay</th>
                  <th>Oluşturulma</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {grants.map(g => (
                  <tr key={g.id}>
                    <td>{g.scopeType === "CUSTOMER" ? "Müşteri-Genel" : "Mağaza"}</td>
                    <td>{g.scopeType === "CUSTOMER" ? (g.customer?.title || g.customerId) : (g.store?.name || g.storeId)}</td>
                    <td className="muted">{fmt(g.createdAt)}</td>
                    <td className="actions">
                      <button
                        className="btn danger"
                        onClick={async ()=>{
                          if (!window.confirm("Bu erişimi kaldırmak istiyor musunuz?")) return;
                          try {
                            await api.delete(`/access/${g.id}`);
                            toast.success("Erişim kaldırıldı");
                            setGrants(xs => xs.filter(x=>x.id !== g.id));
                          } catch (e) {
                            toast.error(e?.response?.data?.message || "Silinemedi");
                          }
                        }}
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
