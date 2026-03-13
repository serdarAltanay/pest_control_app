import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import StationModal from "../../components/StationModal.jsx";
import "./StationDetail.scss";

// recharts yoksa sayfa yine çalışsın
let Recharts;
try { Recharts = require("recharts"); } catch {}

const TYPE_TR = {
  FARE_YEMLEME: "Fare Yemleme",
  CANLI_YAKALAMA: "Canlı Yakalama",
  ELEKTRIKLI_SINEK_TUTUCU: "Elektrikli Sinek Tutucu",
  BOCEK_MONITOR: "Böcek Monitörü",
  GUVE_TUZAGI: "Güve Tuzağı",
};
const RISK_TR = { RISK_YOK:"Risk Yok", DUSUK:"Düşük", ORTA:"Orta", YUKSEK:"Yüksek" };
const ACT_PATH = {
  FARE_YEMLEME: "rodent-bait",
  CANLI_YAKALAMA: "live-catch",
  ELEKTRIKLI_SINEK_TUTUCU: "efk",
  BOCEK_MONITOR: "insect-monitor",
  GUVE_TUZAGI: "moth-trap",
};

// Tip bazlı “ikincil metrik” (yem/feromon/monitor vb.) anahtarı ve etiketi
const SECONDARY_BY_TYPE = {
  FARE_YEMLEME:            { key: "yemDegisti",         label: "Yem Değişimi" },
  ELEKTRIKLI_SINEK_TUTUCU: { key: "sariBantDegisim",    label: "Sarı Bant Değişimi" },
  GUVE_TUZAGI:             { key: "feromonDegisti",     label: "Feromon Değişimi" },
  CANLI_YAKALAMA:          { key: "yapiskanDegisti",    label: "Yapışkan Değişimi" },
  BOCEK_MONITOR:           { key: "monitorDegisti",     label: "Monitör Değişimi" },
};

const RISK_COLORS = {
  RISK_YOK: "#94a3b8", // slate-400
  DUSUK:    "#22c55e", // green-500
  ORTA:     "#f59e0b", // amber-500
  YUKSEK:   "#ef4444", // red-500
};

const BAR_COLORS = {
  countBar:      "#93c5fd", // blue-300
  countLine:     "#2563eb", // blue-600
  activityBar:   "#86efac", // green-300
  activityLine:  "#16a34a", // green-600
  secondaryBar:  "#fda4af", // rose-300
  secondaryLine: "#e11d48", // rose-600
};

// Yardımcılar
const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
const ymKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
const monthAdd = (d, n) => {
  const dt = new Date(d);
  dt.setMonth(dt.getMonth() + n);
  return dt;
};
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
const parseDate = (v) => (v ? new Date(v) : null);

export default function StationDetail({ openEdit = false }) {
  const { stationId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [station, setStation] = useState(null);
  const [store, setStore] = useState(null);
  const [lastVisitId, setLastVisitId] = useState(null);

  // Aktivasyon listeleme (tablo)
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const LIMIT = 20;

  // Grafikler
  const [rangeMonths, setRangeMonths] = useState(9); // default 9 ay
  const [chartLoading, setChartLoading] = useState(false);
  const [trend, setTrend] = useState([]);         // [{bucket,count,activityCount}]
  const [riskByMonth, setRiskByMonth] = useState([]); // [{month, RISK_YOK, DUSUK, ORTA, YUKSEK}]
  const [secondaryByMonth, setSecondaryByMonth] = useState([]); // [{month, changed}]

  // /edit rotası veya ?edit=1 query’si gelirse modal aç
  const wantsEdit =
    openEdit || new URLSearchParams(location.search).get("edit") === "1";

  const fetchStation = useCallback(async () => {
    try {
      const { data: st } = await api.get(`/stations/${stationId}`);
      setStation(st);
      if (st?.storeId) {
        try {
          const { data: s } = await api.get(`/stores/${st.storeId}`);
          setStore(s);
        } catch {}
        // son ziyaret
        try {
          let visits = [];
          try {
            const { data } = await api.get(`/visits/store/${st.storeId}`);
            visits = data;
          } catch {
            const { data } = await api.get(`/stores/${st.storeId}/visits`);
            visits = data;
          }
          if (Array.isArray(visits) && visits.length) {
            visits.sort((a, b) => new Date(b.date) - new Date(a.date));
            setLastVisitId(visits[0].id);
          }
        } catch {}
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || "İstasyon alınamadı");
      navigate(-1);
    }
  }, [stationId, navigate]);

  const fetchActivations = useCallback(
    async ({ reset } = { reset: false }) => {
      if (!stationId) return;
      const params = new URLSearchParams({
        limit: String(LIMIT),
        offset: String(reset ? 0 : page * LIMIT),
      });
      try {
        if (reset) setLoading(true);
        else setLoadingMore(true);
        const { data } = await api.get(
          `/activations/stations/${stationId}?${params.toString()}`
        );
        const items = Array.isArray(data?.items) ? data.items : [];
        setTotal(Number(data?.total || 0));
        // 🔧 Flicker sebebini düzeltiyoruz:
        setList((prev) => (reset ? items : [...prev, ...items]));
      } catch (e) {
        toast.error(e?.response?.data?.message || "Aktivasyonlar alınamadı");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [stationId, page]
  );

  // Grafikleri çeken yardımcı (trend + risk + ikincil metrik)
  const fetchCharts = useCallback(async () => {
    if (!stationId) return;
    setChartLoading(true);
    const now = new Date();
    const to = endOfMonth(now);
    const from = startOfMonth(monthAdd(now, -rangeMonths + 1));

    // Trend (server aggregation)
    try {
      const qs = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
        bucket: "month",
      });
      const { data: tr } = await api.get(
        `/analytics/stations/${stationId}/trend?${qs.toString()}`
      );

      // Trend'te eksik ay varsa boşları dolduralım
      const months = [];
      for (let i = 0; i < rangeMonths; i++) {
        const d = monthAdd(from, i);
        months.push(ymKey(d));
      }
      const trIndex = Object.fromEntries(
        (Array.isArray(tr) ? tr : []).map((r) => [r.bucket.slice(0, 7), r])
      );
      const normTrend = months.map((m) => {
        const r = trIndex[m];
        return {
          bucket: m,
          count: Number(r?.count || 0),
          activityCount: Number(r?.activityCount || 0),
        };
      });
      setTrend(normTrend);
    } catch (e) {
      setTrend([]);
    }

    // Detay: risk ve ikincil metrik için aktivasyonları çek (sayfalayarak)
    try {
      // tüm sayfaları dolaş
      let all = [];
      let offset = 0;
      const take = 100;
      let totalCount = null;
      while (true) {
        const qs = new URLSearchParams({
          limit: String(take),
          offset: String(offset),
        });
        const { data } = await api.get(
          `/activations/stations/${stationId}?${qs.toString()}`
        );
        const items = Array.isArray(data?.items) ? data.items : [];
        all = all.concat(items);
        totalCount = Number(data?.total || 0);
        offset += take;
        if (!items.length || all.length >= totalCount) break;
      }

      // aralığa göre filtrele
      const inRange = all.filter((a) => {
        const d = parseDate(a.observedAt);
        return d && d >= from && d <= to;
      });

      // tüm ayları hazırlayalım
      const months = [];
      const monthKeys = [];
      for (let i = 0; i < rangeMonths; i++) {
        const d = monthAdd(from, i);
        const key = ymKey(d);
        months.push({ date: d, key });
        monthKeys.push(key);
      }

      // RISK dağılımı
      const RISK_KEYS = ["RISK_YOK", "DUSUK", "ORTA", "YUKSEK"];
      const riskMap = Object.fromEntries(
        monthKeys.map((m) => [m, { month: m, RISK_YOK: 0, DUSUK: 0, ORTA: 0, YUKSEK: 0 }])
      );
      inRange.forEach((a) => {
        const mk = ymKey(new Date(a.observedAt));
        const r = a.risk || "RISK_YOK";
        if (riskMap[mk] && RISK_KEYS.includes(r)) riskMap[mk][r] += 1;
      });
      setRiskByMonth(monthKeys.map((m) => riskMap[m]));

      // Tip bazlı ikincil metrik
      const sec = station ? SECONDARY_BY_TYPE[station.type] : null;
      if (sec?.key) {
        const secMap = Object.fromEntries(
          monthKeys.map((m) => [m, { month: m, changed: 0 }])
        );
        inRange.forEach((a) => {
          const mk = ymKey(new Date(a.observedAt));
          if (a[sec.key]) secMap[mk].changed += 1;
        });
        setSecondaryByMonth(monthKeys.map((m) => secMap[m]));
      } else {
        setSecondaryByMonth([]);
      }
    } catch (e) {
      setRiskByMonth([]);
      setSecondaryByMonth([]);
    } finally {
      setChartLoading(false);
    }
  }, [stationId, rangeMonths, station]);

  // İlk yükleme
  useEffect(() => { fetchStation(); }, [fetchStation]);
  useEffect(() => { setPage(0); fetchActivations({ reset: true }); }, [fetchActivations, stationId]);

  // /edit → modal aç
  useEffect(() => { if (wantsEdit && station) setEditOpen(true); }, [wantsEdit, station]);

  // Grafikler aralık değişince
  useEffect(() => { fetchCharts(); }, [fetchCharts]);

  const title = useMemo(() => {
    if (!station) return "İstasyon";
    return `${TYPE_TR[station.type] || station.type} – ${station.name || ""}`;
  }, [station]);

  const fmtDate = (val) => {
    if (!val) return "—";
    try { return new Date(val).toLocaleString("tr-TR"); }
    catch { return String(val); }
  };

  const slug = station ? ACT_PATH[station.type] : null;
  const activationHref = useMemo(() => {
    if (!slug || !station) return null;
    if (lastVisitId) {
      return `/admin/stores/${station.storeId}/visits/${lastVisitId}/stations/${station.id}/activation/${slug}`;
    }
    return `/admin/stores/${station.storeId}/stations/${station.id}/activation/${slug}`;
  }, [slug, station, lastVisitId]);

  const onDeleteStation = async () => {
    if (!station) return;
    if (!window.confirm("Bu istasyonu silmek istiyor musunuz?")) return;
    try {
      try { await api.delete(`/stations/${station.id}`); }
      catch { await api.delete(`/stores/${station.storeId}/stations/${station.id}`); }
      toast.success("İstasyon silindi");
      navigate(`/admin/stores/${station.storeId}/stations`);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Silinemedi");
    }
  };

  const deleteActivation = async (id) => {
    if (!window.confirm("Bu aktivasyonu silmek istiyor musunuz?")) return;
    const prev = list;
    setList((arr) => arr.filter((x) => x.id !== id));
    try {
      await api.delete(`/activations/${id}`);
      toast.success("Aktivasyon silindi");
      setTotal((t) => Math.max(0, t - 1));
    } catch (e) {
      setList(prev);
      toast.error(e?.response?.data?.message || "Silinemedi");
    }
  };

  const canLoadMore = list.length < total;

  const describe = (a) => {
    const t = a?.type;
    if (t === "ELEKTRIKLI_SINEK_TUTUCU") {
      const parts = [];
      if (Number(a.karasinek) > 0) parts.push(`Karasinek: ${a.karasinek}`);
      if (Number(a.sivrisinek) > 0) parts.push(`Sivrisinek: ${a.sivrisinek}`);
      if (Number(a.diger) > 0) parts.push(`Diğer: ${a.diger}`);
      if (a.sariBantDegisim) parts.push("Sarı bant değişti");
      if (a.uvLambaDegisim) parts.push("UV lamba değişti");
      if (a.uvLambaAriza) parts.push("UV arızalı");
      if (a.arizaliEFK) parts.push("EFK arızalı");
      if (a.tamirdeEFK) parts.push("EFK tamirde");
      return parts.join(" • ") || "—";
    }
    if (t === "GUVE_TUZAGI") {
      const parts = [];
      if (Number(a.guve) > 0) parts.push(`Güve: ${a.guve}`);
      if (Number(a.diger) > 0) parts.push(`Diğer: ${a.diger}`);
      if (a.feromonDegisti) parts.push("Feromon değişti");
      if (a.deformeTuzak) parts.push("Tuzak deforme");
      if (a.tuzakDegisti) parts.push("Tuzak değişti");
      return parts.join(" • ") || "—";
    }
    if (t === "BOCEK_MONITOR") {
      const parts = [];
      if (Number(a.hedefZararliSayisi) >= 0) parts.push(`Hedef Zararlı: ${a.hedefZararliSayisi}`);
      if (a.monitorDegisti) parts.push("Monitör değişti");
      return parts.join(" • ") || "—";
    }
    if (t === "CANLI_YAKALAMA") {
      const parts = [];
      if (a.deformeMonitor > 0) parts.push(`M. Deforme: ${a.deformeMonitor}`);
      if (a.yapiskanDegisti > 0) parts.push(`Yapışkan D.: ${a.yapiskanDegisti}`);
      if (a.monitorDegisti > 0) parts.push(`Monitör D.: ${a.monitorDegisti}`);
      if (a.ulasilamayanMonitor > 0) parts.push(`Ulaşılamayan: ${a.ulasilamayanMonitor}`);
      return parts.join(" • ") || "—";
    }
    if (t === "FARE_YEMLEME") {
      const parts = [];
      if (a.deformeYem > 0) parts.push(`Yem Def.: ${a.deformeYem}`);
      if (a.yemDegisti > 0) parts.push(`Yem Değ.: ${a.yemDegisti}`);
      if (a.deformeMonitor > 0) parts.push(`M. Deforme: ${a.deformeMonitor}`);
      if (a.monitorDegisti > 0) parts.push(`Monitör D.: ${a.monitorDegisti}`);
      if (a.ulasilamayanMonitor > 0) parts.push(`Ulaşılamayan: ${a.ulasilamayanMonitor}`);
      return parts.join(" • ") || "—";
    }
    return "—";
  };

  const monthsOptions = [
    1,2,3,4,5,6,7,8,9,10,11,12,18,24
  ];

  return (
    <Layout title={title}>
      <div className="station-detail-page">
        {/* Üst başlık */}
        <div className="head">
          <div className="title">
            <h1>{station?.name || "İstasyon"}</h1>
            <div className="sub">
              {store ? (
                <>
                  Mağaza: <Link to={`/admin/stores/${store.id}`} className="link">
                    {store?.code ? `${store.code} – ` : ""}{store?.name}
                  </Link>
                </>
              ) : "—"}
              {" • "}
              <span className="muted">{TYPE_TR[station?.type] || station?.type || "—"}</span>
              {" • "}
              <span className="mono">{station?.code || "—"}</span>
              {station?.isGroup && (
                <>
                  {" • "}
                  <span className="badge amber">Toplu Grup ({station.totalCount} Adet)</span>
                </>
              )}
            </div>
          </div>

          <div className="head-actions">
            {slug ? (
              <Link className="btn primary" to={activationHref || "#"} onClick={(e)=>{ if(!activationHref) e.preventDefault(); }}>
                + Aktivasyon Ekle
              </Link>
            ) : (
              <button className="btn" disabled>+ Aktivasyon Ekle</button>
            )}
            <button className="btn warn" onClick={() => setEditOpen(true)}>Düzenle</button>
            <button className="btn danger" onClick={onDeleteStation}>Sil</button>
            {store && (
              <Link className="btn ghost" to={`/admin/stores/${store.id}/stations`}>Tüm İstasyonlar</Link>
            )}
          </div>
        </div>

        {/* Özet kart */}
        <section className="card info-card">
          <div className="kv">
            <div><b>Tip</b><span>{TYPE_TR[station?.type] || "—"}</span></div>
            <div><b>Kod</b><span className="mono">{station?.code || "—"}</span></div>
            <div><b>Durum</b>
              <span>
                <span className={`badge ${station?.isActive ? "ok" : "no"}`}>
                  {station?.isActive ? "Aktif" : "Pasif"}
                </span>
                {station?.isGroup && <span className="badge amber" style={{ marginLeft: "5px" }}>Grup</span>}
              </span>
            </div>
            {station?.isGroup && <div><b>Grup Adedi</b><span>{station.totalCount}</span></div>}
            <div><b>Oluşturulma</b><span>{station?.createdAt ? new Date(station.createdAt).toLocaleString("tr-TR") : "—"}</span></div>
            <div><b>Güncelleme</b><span>{station?.updatedAt ? new Date(station.updatedAt).toLocaleString("tr-TR") : "—"}</span></div>
          </div>
        </section>

        {/* Aktivasyonlar (tablo) */}
        <section className="card">
          <div className="card-title">Geçmiş Aktivasyonlar {total ? `(${total})` : ""}</div>

          {loading ? (
            <div className="empty">Yükleniyor…</div>
          ) : list.length === 0 ? (
            <div className="empty">Kayıtlı aktivasyon bulunamadı.</div>
          ) : (
            <>
              <table className="table">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Tip</th>
                    <th>Aktivite</th>
                    <th>Risk</th>
                    <th>Özet</th>
                    <th>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((a) => (
                    <tr key={a.id}>
                      <td className="date">{fmtDate(a.observedAt)}</td>
                      <td>{TYPE_TR[a.type] || a.type}</td>
                      <td>
                        <span className={`badge ${a.aktiviteVar ? "ok" : "ghost"}`}>
                          {a.aktiviteVar ? "Var" : "Yok"}
                        </span>
                      </td>
                      <td>
                        <span className={`chip risk-${(a.risk || "RISK_YOK").toLowerCase()}`}>
                          {RISK_TR[a.risk] || a.risk || "—"}
                        </span>
                      </td>
                      <td className="summary">{describe(a)}</td>
                      <td className="row-actions">
                        <button className="btn danger" onClick={() => deleteActivation(a.id)}>Sil</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {canLoadMore && (
                <div className="loadmore">
                  <button
                    className="btn ghost"
                    disabled={loadingMore}
                    onClick={() => { setPage((p) => p + 1); fetchActivations(); }}
                  >
                    {loadingMore ? "Yükleniyor…" : "Daha Fazla Yükle"}
                  </button>
                </div>
              )}
            </>
          )}
        </section>

          {/* ---------- Grafikler ---------- */}
          <section className="card charts-card">
            <div className="card-title charts-head">
              İstasyon Aktivasyon Analizi
              <div className="toolbar">
                <label>
                  Dönem:
                  <select
                    value={rangeMonths}
                    onChange={(e)=>setRangeMonths(Number(e.target.value))}
                  >
                    {[1,2,3,4,5,6,7,8,8,9,10,11,12,18,24].map((m,i)=>(
                      <option key={`${m}-${i}`} value={m}>{m} Ay</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>

            {!Recharts ? (
              <div className="empty">Grafik kütüphanesi (recharts) yüklenemedi.</div>
            ) : chartLoading ? (
              <div className="empty">Grafikler hazırlanıyor…</div>
            ) : (
              <>
                {/* 1) Aktivasyon Varlığı (Aylık) — BAR + LINE overlay */}
                <div className="chart-block">
                  <h4>Aktivasyon Varlığı (Aylık)</h4>
                  {trend.length === 0 ? (
                    <div className="empty">Veri yok.</div>
                  ) : (
                    <Recharts.ResponsiveContainer width="100%" height={280}>
                      <Recharts.ComposedChart data={trend}>
                        <Recharts.CartesianGrid strokeDasharray="3 3" />
                        <Recharts.XAxis dataKey="bucket" />
                        <Recharts.YAxis allowDecimals={false} />
                        <Recharts.Tooltip />
                        <Recharts.Legend />

                        {/* Sütunlar */}
                        <Recharts.Bar
                          dataKey="count"
                          name="Toplam Kayıt"
                          fill={BAR_COLORS.countBar}
                          radius={[6,6,0,0]}
                          barSize={24}
                        />
                        <Recharts.Bar
                          dataKey="activityCount"
                          name="Aktivite"
                          fill={BAR_COLORS.activityBar}
                          radius={[6,6,0,0]}
                          barSize={24}
                        />

                        {/* Tepeleri bağlayan çizgiler */}
                        <Recharts.Line
                          type="monotone"
                          dataKey="count"
                          name="Toplam (çizgi)"
                          stroke={BAR_COLORS.countLine}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                        <Recharts.Line
                          type="monotone"
                          dataKey="activityCount"
                          name="Aktivite (çizgi)"
                          stroke={BAR_COLORS.activityLine}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      </Recharts.ComposedChart>
                    </Recharts.ResponsiveContainer>
                  )}
                </div>

                {/* 2) Tip Bazlı İkincil Metrik (örn. Yem/Monitör/Feromon Değişimi) — BAR + LINE */}
                {station && SECONDARY_BY_TYPE[station.type] && (
                  <div className="chart-block">
                    <h4>{SECONDARY_BY_TYPE[station.type].label} (Aylık)</h4>
                    {secondaryByMonth.length === 0 ? (
                      <div className="empty">Veri yok.</div>
                    ) : (
                      <Recharts.ResponsiveContainer width="100%" height={260}>
                        <Recharts.ComposedChart data={secondaryByMonth}>
                          <Recharts.CartesianGrid strokeDasharray="3 3" />
                          <Recharts.XAxis dataKey="month" />
                          <Recharts.YAxis allowDecimals={false} />
                          <Recharts.Tooltip />
                          <Recharts.Legend />

                          <Recharts.Bar
                            dataKey="changed"
                            name="Adet"
                            fill={BAR_COLORS.secondaryBar}
                            radius={[6,6,0,0]}
                            barSize={28}
                          />
                          <Recharts.Line
                            type="monotone"
                            dataKey="changed"
                            name="Adet (çizgi)"
                            stroke={BAR_COLORS.secondaryLine}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                          />
                        </Recharts.ComposedChart>
                      </Recharts.ResponsiveContainer>
                    )}
                  </div>
                )}

                {/* 3) Risk Dağılımı (Aylık – stacked BAR + toplam LINE) */}
                <div className="chart-block">
                  <h4>Risk Dağılımı (Aylık)</h4>
                  {riskByMonth.length === 0 ? (
                    <div className="empty">Veri yok.</div>
                  ) : (
                    <Recharts.ResponsiveContainer width="100%" height={300}>
                      <Recharts.ComposedChart
                        data={riskByMonth.map(r => ({
                          ...r,
                          total: Number(r.RISK_YOK||0)+Number(r.DUSUK||0)+Number(r.ORTA||0)+Number(r.YUKSEK||0)
                        }))}
                      >
                        <Recharts.CartesianGrid strokeDasharray="3 3" />
                        <Recharts.XAxis dataKey="month" />
                        <Recharts.YAxis allowDecimals={false} />
                        <Recharts.Tooltip />
                        <Recharts.Legend />

                        {/* stacked risk bar'ları */}
                        <Recharts.Bar stackId="r" dataKey="RISK_YOK" name="Risk Yok" fill={RISK_COLORS.RISK_YOK} radius={[6,6,0,0]} />
                        <Recharts.Bar stackId="r" dataKey="DUSUK"    name="Düşük"    fill={RISK_COLORS.DUSUK} />
                        <Recharts.Bar stackId="r" dataKey="ORTA"     name="Orta"     fill={RISK_COLORS.ORTA} />
                        <Recharts.Bar stackId="r" dataKey="YUKSEK"   name="Yüksek"   fill={RISK_COLORS.YUKSEK} />

                        {/* toplamı bağlayan çizgi */}
                        <Recharts.Line
                          type="monotone"
                          dataKey="total"
                          name="Toplam (çizgi)"
                          stroke="#111827"   /* slate-900 */
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      </Recharts.ComposedChart>
                    </Recharts.ResponsiveContainer>
                  )}
                </div>
              </>
            )}
          </section>


        {editOpen && station && (
          <StationModal
            storeId={Number(station.storeId)}
            initial={station}
            onClose={() => setEditOpen(false)}
            onSaved={async () => {
              setEditOpen(false);
              await fetchStation();
              // Detay değişmiş olabilir → grafikleri de tazele
              fetchCharts();
            }}
          />
        )}
      </div>
    </Layout>
  );
}
