// src/pages/reports/TrendAnalysis.jsx
// Müşteri rotası örneği: <Route path="/customer/stores/:storeId/trend" element={<TrendAnalysis />} />

import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./TrendAnalysis.scss";

// recharts yoksa uygulama patlamasın
let Recharts = null;
try { Recharts = require("recharts"); } catch {}

// İstasyon tipleri (UI labels)
const TYPE_TR = {
  FARE_YEMLEME: "Fare Yemleme",
  CANLI_YAKALAMA: "Canlı Yakalama",
  ELEKTRIKLI_SINEK_TUTUCU: "Elektrikli Sinek Tutucu",
  BOCEK_MONITOR: "Böcek Monitörü",
  GUVE_TUZAGI: "Güve Tuzağı",
};

const MONTHS_TR = [
  "Ocak","Şubat","Mart","Nisan","Mayıs","Haz.","Tem.","Ağu.","Eyl.","Eki.","Kas.","Ara."
];

const COLORS = {
  bar: [
    "#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
    "#14b8a6", "#f97316", "#06b6d4", "#84cc16", "#e11d48", "#7c3aed", "#0ea5e9"
  ],
  line: "#111827",
  ncrBarReported: "#ef4444",
  ncrBarResolved: "#10b981",
  categoryA: "#60a5fa", // bildirilen
  categoryB: "#34d399", // çözülen
};

const LIMIT = 200; // istasyon başına aktivasyon sayfalama limiti

// ❗️ X ekseninde her zaman görünsün istediğin kategoriler:
const MASTER_NCR_CATEGORIES = [
  "Temizlik",
  "Depolama",
  "Hijyen",
  "Kapı/Pencere",
  "Atık Yönetimi",
  "Ekipman",
  "İstasyon Bakımı",
  "Yapısal",
  "Stok",
  "Diğer",
];

// Tarih aralığını aylara parçala
function buildMonthRange(year, startM, endM) {
  const m0 = Math.max(1, Math.min(12, startM));
  const m1 = Math.max(m0, Math.min(12, endM));
  const out = [];
  for (let m = m0; m <= m1; m++) {
    const label = MONTHS_TR[m-1];
    const start = new Date(year, m-1, 1, 0, 0, 0, 0);
    const end   = new Date(year, m,   1, 0, 0, 0, 0); // [start, end)
    out.push({ y: year, m, label, start, end });
  }
  return out;
}

// Bir tarih belirtilen [start, end) aralığında mı?
function inRange(dateStrOrDate, start, end) {
  if (!dateStrOrDate) return false;
  const t = new Date(dateStrOrDate).getTime();
  return t >= start.getTime() && t < end.getTime();
}

export default function TrendAnalysis() {
  const { storeId } = useParams();
  const navigate = useNavigate();

  // Meta
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);

  // Kaynak veriler
  const [stations, setStations] = useState([]);       // kurulu istasyonlar
  const [activations, setActivations] = useState([]); // tüm istasyonlardan toplanan aktivasyonlar
  const [noncons, setNoncons] = useState([]);         // uygunsuzluklar

  // Tarih seçimi
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [startMonth, setStartMonth] = useState(1);
  const [endMonth, setEndMonth] = useState(new Date().getMonth()+1);
  const [showPicker, setShowPicker] = useState(true);

  // Mağaza + istasyonlar + uygunsuzluklar (temel yükleme)
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        // Mağaza
        const { data: s } = await api.get(`/stores/${storeId}`);
        setStore(s);

        // İstasyonlar
        try {
          const { data } = await api.get(`/stations/store/${storeId}`);
          setStations(Array.isArray(data) ? data : []);
        } catch {
          // Eski fallback
          const { data } = await api.get(`/stores/${storeId}/stations`);
          setStations(Array.isArray(data) ? data : []);
        }

        // Uygunsuzluklar
        try {
          const { data } = await api.get(`/nonconformities/store/${storeId}`);
          setNoncons(Array.isArray(data) ? data : []);
        } catch {
          setNoncons([]);
        }
      } catch (e) {
        toast.error(e?.response?.data?.error || "Veriler alınamadı");
      } finally {
        setLoading(false);
      }
    })();
  }, [storeId]);

  // İstasyon id -> tip eşlemesi (aktivasyonlarda type eksikse buradan tamamlayacağız)
  const stationTypeById = useMemo(
    () => Object.fromEntries(stations.map(s => [s.id, s.type])),
    [stations]
  );

  // Tek istasyonun TÜM aktivasyonlarını sayfalı çeken yardımcı
  const fetchStationActivations = useCallback(
    async (stationId) => {
      let offset = 0;
      let total = Infinity;
      const acc = [];
      while (offset < total) {
        const params = new URLSearchParams({
          limit: String(LIMIT),
          offset: String(offset),
        });
        const { data } = await api.get(`/activations/stations/${stationId}?${params.toString()}`);
        const items = Array.isArray(data?.items) ? data.items : [];
        total = Number(data?.total ?? items.length);
        if (items.length === 0) break;
        acc.push(...items.map(x => ({ ...x, stationId })));
        offset += LIMIT;
      }
      return acc;
    },
    []
  );

  // Tüm istasyonlardan aktivasyonları topla
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!stations || stations.length === 0) {
        setActivations([]);
        return;
      }
      try {
        const all = [];
        for (const s of stations) {
          try {
            const list = await fetchStationActivations(s.id);
            all.push(...list);
          } catch (e) {
            console.warn("Aktivasyon çekilemedi (station:", s.id, ")", e);
          }
        }
        // normalize: type (fallback), time alanı
        const normalized = all.map(a => ({
          ...a,
          type: a.type || stationTypeById[a.stationId],
          when: a.observedAt || a.createdAt || a.updatedAt,
        }));
        if (alive) setActivations(normalized);
      } catch (e) {
        console.error(e);
        if (alive) setActivations([]);
      }
    })();
    return () => { alive = false; };
  }, [stations, fetchStationActivations, stationTypeById]);

  // Aylık zaman şeridi
  const months = useMemo(
    () => buildMonthRange(year, startMonth, Math.max(startMonth, endMonth)),
    [year, startMonth, endMonth]
  );

  // --- Aktivite grafik verisi (her tür için ayrı grafik) ---
  const perTypeSeries = useMemo(() => {
    // Taban (aylar)
    const base = months.map(({ label }) => ({ label, percent: 0, count: 0, total: 0 }));
    // Hiç aktivasyon yoksa tüm tipler için boş
    if (!Array.isArray(activations) || activations.length === 0) {
      return Object.keys(TYPE_TR).reduce((acc, k) => { acc[k] = [...base]; return acc; }, {});
    }

    const byType = {};
    for (const key of Object.keys(TYPE_TR)) {
      byType[key] = months.map(m => ({ label: m.label, percent: 0, count: 0, total: 0 }));
    }

    for (const a of activations) {
      const t = a.type;
      if (!byType[t]) continue;

      for (let i = 0; i < months.length; i++) {
        const { start, end } = months[i];
        if (inRange(a.when, start, end)) {
          byType[t][i].total += 1;
          const hit =
            a.aktiviteVar === true ||
            Number(a.hedefZararliSayisi) > 0 ||
            (Number(a.karasinek||0) + Number(a.sivrisinek||0) + Number(a.diger||0) + Number(a.guve||0)) > 0;
          if (hit) byType[t][i].count += 1;
          break;
        }
      }
    }

    // yüzde hesapla
    for (const t of Object.keys(byType)) {
      byType[t] = byType[t].map(row => ({
        ...row,
        percent: row.total ? Math.round((row.count / row.total) * 100) : 0,
      }));
    }
    return byType;
  }, [activations, months]);

  // --- Uygunsuzluk grafiği (Aylık) ---
  const ncrMonthly = useMemo(() => {
    return months.map(({ label, start, end }) => {
      const reported = noncons.filter(n => inRange(n.observedAt || n.createdAt, start, end)).length;
      const resolved = noncons.filter(n => n.resolved && inRange(n.resolvedAt || n.updatedAt, start, end)).length;
      return { label, reported, resolved };
    });
  }, [months, noncons]);

  // --- Uygunsuzluk: Kategori Bazlı Toplamlar (tüm kategoriler X ekseninde) ---
  const ALL_NCR_CATEGORIES = useMemo(() => {
    const fromMaster = Array.isArray(MASTER_NCR_CATEGORIES) ? MASTER_NCR_CATEGORIES : [];
    const fromGlobal = (typeof window !== "undefined" &&
      Array.isArray(window.__NCR_CATEGORIES__)) ? window.__NCR_CATEGORIES__ : [];
    const fromData = Array.from(new Set(
      noncons.map(n => n.category).filter(Boolean)
    ));
    const merged = Array.from(new Set([...fromMaster, ...fromGlobal, ...fromData]));
    return merged.sort((a,b) => a.localeCompare(b, "tr"));
  }, [noncons]);

  const ncrByCategory = useMemo(() => {
    if (!ALL_NCR_CATEGORIES.length) return [];
    return ALL_NCR_CATEGORIES.map(cat => {
      const reported = noncons.filter(n => (n.category || "") === cat).length;
      const resolved = noncons.filter(n => (n.category || "") === cat && n.resolved).length;
      return { category: cat, reported, resolved };
    });
  }, [ALL_NCR_CATEGORIES, noncons]);

  const fmtDT = (d) => (d ? new Date(d).toLocaleString("tr-TR") : "—");

  const handleCreate = (e) => {
    e?.preventDefault?.();
    if (endMonth < startMonth) setEndMonth(startMonth);
    setShowPicker(false);
  };

  const resetRange = () => setShowPicker(true);

  const PrintableHeader = (
    <header className="ta-print-head">
      <div className="brand">pestapp</div>
      <div className="report-meta">
        <div className="title">Trend Analiz Raporu</div>
        <div className="range">
          {MONTHS_TR[startMonth-1]} – {MONTHS_TR[endMonth-1]} {year}
        </div>
      </div>
      <div className="store-name">{store?.name || "Mağaza"}</div>
    </header>
  );

  return (
    <Layout>
      <div className="trend-analysis-page">
        {/* Tarih Seçimi (Modal) */}
        {showPicker && (
          <div className="ta-modal-backdrop">
            <div className="ta-modal">
              <div className="ta-modal-head">
                <h3>{store?.name ? `${store.name} için Trend Analizi` : "Trend Analizi"}</h3>
                <button className="close" onClick={()=>navigate(-1)}>×</button>
              </div>

              <form className="ta-modal-body" onSubmit={handleCreate}>
                <div className="form-row">
                  <label>Yıl</label>
                  <input
                    type="number"
                    value={year}
                    min="2000"
                    max="2100"
                    onChange={(e)=>setYear(Number(e.target.value||thisYear))}
                  />
                </div>

                <div className="form-row">
                  <label>Başlangıç Ayı</label>
                  <select value={startMonth} onChange={(e)=>setStartMonth(Number(e.target.value))}>
                    {MONTHS_TR.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
                  </select>
                </div>

                <div className="form-row">
                  <label>Bitiş Ayı</label>
                  <select value={endMonth} onChange={(e)=>setEndMonth(Number(e.target.value))}>
                    {MONTHS_TR.map((m,i)=><option key={i} value={i+1}>{m}</option>)}
                  </select>
                </div>

                <div className="actions">
                  <button type="button" className="btn ghost" onClick={()=>navigate(-1)}>Vazgeç</button>
                  <button type="submit" className="btn primary">Grafik Oluştur</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Rapor */}
        {!showPicker && (
          <>
            {PrintableHeader}

            <div className="ta-grid">
              {/* İstasyon Tipi Grafiklerinin her biri */}
              {Object.keys(TYPE_TR).map((key, idx) => {
                const series = perTypeSeries[key] || [];
                const title = TYPE_TR[key];
                const color = COLORS.bar[idx % COLORS.bar.length];

                return (
                  <section key={key} className="ta-card chart">
                    <div className="ta-card-title">{title} Aktivite Raporu</div>
                    {Recharts && series.length > 0 ? (
                      <Recharts.ResponsiveContainer width="100%" height={220}>
                        <Recharts.ComposedChart data={series}>
                          <Recharts.CartesianGrid strokeDasharray="3 3" />
                          <Recharts.XAxis dataKey="label" />
                          <Recharts.YAxis yAxisId="left"  domain={[0,100]} tickFormatter={(v)=>`${v}%`} />
                          <Recharts.YAxis yAxisId="right" orientation="right" />
                          <Recharts.Tooltip />
                          <Recharts.Legend />
                          <Recharts.Bar
                            yAxisId="right"
                            dataKey="count"
                            name="Aktivite Sayısı"
                            fill={color}
                            opacity={0.85}
                            radius={[4,4,0,0]}
                          />
                          <Recharts.Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="percent"
                            name="Aktivite Yüzdesi (%)"
                            stroke={COLORS.line}
                            strokeWidth={2}
                            dot={false}
                          />
                        </Recharts.ComposedChart>
                      </Recharts.ResponsiveContainer>
                    ) : (
                      <div className="empty">Veri yok.</div>
                    )}
                  </section>
                );
              })}

              {/* Uygunsuzluklar grafiği (Aylık) */}
              <section className="ta-card chart wide">
                <div className="ta-card-title">Uygunsuzluk Bildirimleri ve Çözüm Sayıları</div>
                {Recharts && ncrMonthly.length > 0 ? (
                  <Recharts.ResponsiveContainer width="100%" height={260}>
                    <Recharts.BarChart data={ncrMonthly}>
                      <Recharts.CartesianGrid strokeDasharray="3 3" />
                      <Recharts.XAxis dataKey="label" />
                      <Recharts.YAxis />
                      <Recharts.Tooltip />
                      <Recharts.Legend />
                      <Recharts.Bar dataKey="reported" name="Bildirilen" fill={COLORS.ncrBarReported} radius={[4,4,0,0]} />
                      <Recharts.Bar dataKey="resolved" name="Çözülen"   fill={COLORS.ncrBarResolved} radius={[4,4,0,0]} />
                    </Recharts.BarChart>
                  </Recharts.ResponsiveContainer>
                ) : (
                  <div className="empty">Veri yok.</div>
                )}
              </section>

              {/* Uygunsuzluk: Kategori Bazlı Toplamlar */}
              <section className="ta-card chart wide">
                <div className="ta-card-title">Uygunsuzluk: Kategori Bazlı Toplamlar</div>
                {Recharts && ncrByCategory.length > 0 ? (
                  <Recharts.ResponsiveContainer width="100%" height={280}>
                    <Recharts.BarChart data={ncrByCategory}>
                      <Recharts.CartesianGrid strokeDasharray="3 3" />
                      <Recharts.XAxis dataKey="category" />
                      <Recharts.YAxis />
                      <Recharts.Tooltip />
                      <Recharts.Legend />
                      <Recharts.Bar dataKey="reported" name="Bildirilen" fill={COLORS.categoryA} radius={[6,6,0,0]} />
                      <Recharts.Bar dataKey="resolved" name="Çözülen"   fill={COLORS.categoryB} radius={[6,6,0,0]} />
                    </Recharts.BarChart>
                  </Recharts.ResponsiveContainer>
                ) : (
                  <div className="empty">Veri yok.</div>
                )}
              </section>

              {/* Kurulu istasyonlar listesi */}
              <section className="ta-card">
                <div className="ta-card-title">Kurulu İstasyonlar</div>
                {stations.length === 0 ? (
                  <div className="empty">Kayıt yok.</div>
                ) : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Kod</th>
                          <th>Ad</th>
                          <th>Tür</th>
                          <th>Durum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stations.map((s) => (
                          <tr key={s.id}>
                            <td>{s.code || "—"}</td>
                            <td className="strong">{s.name}</td>
                            <td>{TYPE_TR[s.type] || s.type}</td>
                            <td>
                              <span className={`badge ${s.isActive ? "ok" : "no"}`}>
                                {s.isActive ? "Aktif" : "Pasif"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Uygunsuzluk listesi */}
              <section className="ta-card">
                <div className="ta-card-title">Uygunsuzluklar</div>
                {noncons.length === 0 ? (
                  <div className="empty">Kayıt yok.</div>
                ) : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Tarih</th>
                          <th>Başlık</th>
                          <th>Kategori</th>
                          <th>Durum</th>
                        </tr>
                      </thead>
                      <tbody>
                        {noncons.map(n => (
                          <tr key={n.id}>
                            <td>{fmtDT(n.observedAt || n.createdAt)}</td>
                            <td className="strong">{n.title || "—"}</td>
                            <td>{n.category || "—"}</td>
                            <td>
                              <span className={`badge ${n.resolved ? "ok" : "warn"}`}>
                                {n.resolved ? "Çözüldü" : "Çözülmedi"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>

            {/* Alt aksiyonlar */}
            <div className="ta-bottom-actions print-hide">
              <button className="btn ghost" onClick={resetRange}>Tarih Aralığını Değiştir</button>
              <button className="btn" onClick={()=>window.print()}>Yazdır</button>
              {/* ▼ Müşteri sayfasına geri dönüş */}
              <Link className="btn primary" to={`/customer/stores/${storeId}`}>Mağazaya Dön</Link>
            </div>
          </>
        )}

        {loading && <div className="card">Yükleniyor…</div>}
      </div>
    </Layout>
  );
}
