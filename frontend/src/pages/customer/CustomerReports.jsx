// src/pages/customer/CustomerReports.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./CustomerReports.scss";

/* ---------- helpers ---------- */
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString("tr-TR") : "—");

/** basit sıralama (koda ve ada göre) */
function rankStores(list, q) {
  if (!q) return list;
  const needle = q.toLowerCase();
  const score = (s) => {
    const t = (s || "").toLowerCase();
    if (t.startsWith(needle)) return 0;
    if (t.includes(needle)) return 1;
    return 2;
  };
  return [...list].sort((a, b) => {
    const as = Math.min(score(a.name), score(a.code));
    const bs = Math.min(score(b.name), score(b.code));
    if (as !== bs) return as - bs;
    return (a.name || "").localeCompare(b.name || "");
  });
}

/** erişilebilir mağazaları çek (müşteri portalında server zaten scope'lar) */
async function fetchAccessibleStores() {
  const tryList = [
    "/stores",
    "/customer/stores",
    "/stores/mine",
    "/customers/my-stores",
  ];
  for (const path of tryList) {
    try {
      const { data } = await api.get(path);
      if (Array.isArray(data)) return data;
    } catch {}
  }
  return [];
}

/** seçili mağazanın raporlarını çek */
async function fetchReportsByStore(storeId) {
  if (!storeId) return [];
  try {
    const { data } = await api.get(`/reports/store/${storeId}`);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    toast.error(e?.response?.data?.error || "Rapor listesi alınamadı");
    return [];
  }
}

export default function CustomerReports() {
  const navigate = useNavigate();
  const location = useLocation();
  const { storeId: pathStoreId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const [storesAll, setStoresAll] = useState([]);
  const [storeQ, setStoreQ] = useState("");
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState(null);

  const [reports, setReports] = useState([]);
  const [loadingStores, setLoadingStores] = useState(true);
  const [loadingReports, setLoadingReports] = useState(false);

  // 🔹 İlk gelişte: path (/customer/stores/:storeId/reports) → query (?storeId=) → location.state sırasıyla ön-seçim yap
  useEffect(() => {
    const sidFromQuery = Number(searchParams.get("storeId"));
    const sidFromPath = Number(pathStoreId);
    const sidFromState = Number(location.state?.storeId);

    const firstValid =
      (Number.isFinite(sidFromPath) && sidFromPath > 0 && sidFromPath) ||
      (Number.isFinite(sidFromQuery) && sidFromQuery > 0 && sidFromQuery) ||
      (Number.isFinite(sidFromState) && sidFromState > 0 && sidFromState) ||
      null;

    if (firstValid) {
      setSelectedStoreId(firstValid);
      // Path varyantından geldiysek, query’i de senkronlayalım (yenilemede seçim kaybolmasın)
      if (!sidFromQuery) {
        const next = new URLSearchParams(searchParams);
        next.set("storeId", String(firstValid));
        setSearchParams(next, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // sadece ilk yüklemede çalışsın

  // mağazaları yükle
  useEffect(() => {
    (async () => {
      setLoadingStores(true);
      const list = await fetchAccessibleStores();
      const normalized = list.map((s) => ({
        id: s.id,
        code: s.code || "",
        name: s.name || s.title || `Mağaza #${s.id}`,
        city: s.city || "",
      }));
      setStoresAll(normalized);
      setLoadingStores(false);

      // Eğer URL ile gelen seçim erişilebilir listede varsa, seçimi koru
      const sid = Number(searchParams.get("storeId"));
      if (Number.isFinite(sid) && normalized.some((x) => x.id === sid)) {
        setSelectedStoreId(sid);
      }
    })();
  }, [searchParams]);

  // arama/sıralama
  useEffect(() => {
    const q = storeQ.trim();
    const ranked = rankStores(storesAll, q).slice(0, 12);
    setStores(ranked);
  }, [storeQ, storesAll]);

  // mağaza seçilince raporları getir
  useEffect(() => {
    (async () => {
      if (!selectedStoreId) { setReports([]); return; }
      setLoadingReports(true);
      const list = await fetchReportsByStore(selectedStoreId);
      list.sort((a, b) => {
        const ta = new Date(a.uploadedAt || a.createdAt || 0).getTime();
        const tb = new Date(b.uploadedAt || b.createdAt || 0).getTime();
        return tb - ta;
      });
      setReports(list);
      setLoadingReports(false);
    })();
  }, [selectedStoreId]);

  const selectedStore = useMemo(
    () => storesAll.find((s) => s.id === selectedStoreId) || null,
    [storesAll, selectedStoreId]
  );

  // seçince URL’i de güncelle (path varyantındaysak path’i değiştir; değilsek query’yi)
  const onPickStore = (sid) => {
    setSelectedStoreId(sid);
    const isPathVariant =
      location.pathname.startsWith("/customer/stores/") &&
      location.pathname.endsWith("/reports");

    if (isPathVariant) {
      navigate(`/customer/stores/${sid}/reports`, { replace: true });
    } else {
      const next = new URLSearchParams(searchParams);
      next.set("storeId", String(sid));
      setSearchParams(next, { replace: true });
    }
  };

  return (
    <Layout title="Raporlar">
      <div className="customer-reports-page">
        {/* STORE PICKER */}
        <section className="card picker-card">
          <div className="picker-head">
            <div className="left">
              <div className="title">Mağaza Seç</div>
              {selectedStore ? (
                <div className="sub">
                  Seçili: <b>{selectedStore.code ? `${selectedStore.code} – ` : ""}{selectedStore.name}</b>
                  {selectedStore.city ? ` • ${selectedStore.city}` : ""}
                </div>
              ) : (
                <div className="sub">Erişebildiğiniz mağazalardan birini seçin</div>
              )}
            </div>
          </div>

          <div className="picker-grid">
            <div className="search">
              <input
                type="text"
                placeholder="Mağaza ara (kod/ad)…"
                value={storeQ}
                onChange={(e) => setStoreQ(e.target.value)}
                disabled={loadingStores}
              />
            </div>

            <div className="store-list">
              {loadingStores ? (
                <div className="muted">Mağazalar yükleniyor…</div>
              ) : stores.length === 0 ? (
                <div className="muted">Sonuç yok.</div>
              ) : (
                stores.map((s) => (
                  <label
                    key={s.id}
                    className={`store-item ${selectedStoreId === s.id ? "on" : ""}`}
                    title={`${s.code ? `${s.code} – ` : ""}${s.name}`}
                  >
                    <input
                      type="radio"
                      name="storeId"
                      value={s.id}
                      checked={selectedStoreId === s.id}
                      onChange={() => onPickStore(s.id)}
                    />
                    <div className="info">
                      <div className="name">
                        {s.code ? <span className="code">{s.code}</span> : null}
                        <span className="label">{s.name}</span>
                      </div>
                      <div className="meta">{s.city || "—"}</div>
                    </div>
                  </label>
                ))
              )}
            </div>
          </div>
        </section>

        {/* REPORT LIST */}
        <section className="card">
          <div className="card-title with-actions">
            <span className="title-text">Rapor Listesi</span>
            {selectedStoreId && (
              <div className="title-actions">
                <Link className="btn ghost small" to={`/customer/stores/${selectedStoreId}`}>
                  Mağaza Detayı
                </Link>
              </div>
            )}
          </div>

          {!selectedStoreId ? (
            <div className="empty">Önce bir mağaza seçin.</div>
          ) : loadingReports ? (
            <div className="empty">Raporlar yükleniyor…</div>
          ) : reports.length === 0 ? (
            <div className="empty">Bu mağaza için yüklenmiş rapor bulunamadı.</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Başlık</th>
                    <th>Yüklendi</th>
                    <th>Notlar</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr
                      key={r.id}
                      className="row-click"
                      onClick={() => navigate(`/customer/reports/${selectedStoreId}/${r.id}`)}
                      title="Rapor detayını aç"
                    >
                      <td className="strong">{r.title || "—"}</td>
                      <td>{fmtDateTime(r.uploadedAt || r.createdAt)}</td>
                      <td className="notes">{r.notes || "—"}</td>
                      <td>
                        <Link
                          className="btn primary"
                          to={`/customer/reports/${selectedStoreId}/${r.id}`}
                          onClick={(e)=>e.stopPropagation()}
                        >
                          Detay
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
