import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./CustomerStationDetail.scss"; // istersen StationDetail.scss'i kopyala/yeniden kullan

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

// Tip bazlı “ikincil metrik” anahtarı ve etiketi
const SECONDARY_BY_TYPE = {
  FARE_YEMLEME:            { key: "yemDegisti",         label: "Yem Değişimi" },
  ELEKTRIKLI_SINEK_TUTUCU: { key: "sariBantDegisim",    label: "Sarı Bant Değişimi" },
  GUVE_TUZAGI:             { key: "feromonDegisti",     label: "Feromon Değişimi" },
  CANLI_YAKALAMA:          { key: "yapiskanDegisti",    label: "Yapışkan Değişimi" },
  BOCEK_MONITOR:           { key: "monitorDegisti",     label: "Monitör Değişimi" },
};

const RISK_COLORS = {
  RISK_YOK: "#94a3b8",
  DUSUK:    "#22c55e",
  ORTA:     "#f59e0b",
  YUKSEK:   "#ef4444",
};
const BAR_COLORS = {
  countBar:      "#93c5fd",
  countLine:     "#2563eb",
  activityBar:   "#86efac",
  activityLine:  "#16a34a",
  secondaryBar:  "#fda4af",
  secondaryLine: "#e11d48",
};

// Yardımcılar
const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
const ymKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
const monthAdd = (d, n) => { const dt = new Date(d); dt.setMonth(dt.getMonth() + n); return dt; };
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
const parseDate = (v) => (v ? new Date(v) : null);

export default function CustomerStationDetail() {
  const { stationId } = useParams();

  const [station, setStation] = useState(null);
  const [store, setStore] = useState(null);

  // Aktivasyon listeleme
  const [list, setList] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(0);
  const LIMIT = 20;

  // Grafikler
  const [rangeMonths, setRangeMonths] = useState(9);
  const [chartLoading, setChartLoading] = useState(false);
  const [trend, setTrend] = useState([]);               // [{bucket,count,activityCount}]
  const [riskByMonth, setRiskByMonth] = useState([]);   // [{month, RISK_YOK, DUSUK, ORTA, YUKSEK}]
  const [secondaryByMonth, setSecondaryByMonth] = useState([]); // [{month, changed}]

  const fetchStation = useCallback(async () => {
    try {
      const { data: st } = await api.get(`/stations/${stationId}`);
      setStation(st);
      if (st?.storeId) {
        try {
          const { data: s } = await api.get(`/stores/${st.storeId}`);
          setStore(s);
        } catch {}
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || "İstasyon alınamadı");
    }
  }, [stationId]);

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
        const { data } = await api.get(`/activations/stations/${stationId}?${params.toString()}`);
        const items = Array.isArray(data?.items) ? data.items : [];
        setTotal(Number(data?.total || 0));
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

  const fetchCharts = useCallback(async () => {
    if (!stationId) return;
    setChartLoading(true);
    const now = new Date();
    const to = endOfMonth(now);
    const from = startOfMonth(monthAdd(now, -rangeMonths + 1));

    // Trend
    try {
      const qs = new URLSearchParams({ from: from.toISOString(), to: to.toISOString(), bucket: "month" });
      const { data: tr } = await api.get(`/analytics/stations/${stationId}/trend?${qs.toString()}`);
      const months = Array.from({ length: rangeMonths }, (_, i) => ymKey(monthAdd(from, i)));
      const idx = Object.fromEntries((Array.isArray(tr) ? tr : []).map((r) => [r.bucket.slice(0, 7), r]));
      setTrend(months.map((m) => ({ bucket: m, count: Number(idx[m]?.count || 0), activityCount: Number(idx[m]?.activityCount || 0) })));
    } catch { setTrend([]); }

    // Ayrıntılı veriden risk & ikincil metrik
    try {
      let all = [];
      let offset = 0;
      const take = 100;
      let totalCount = null;
      while (true) {
        const qs = new URLSearchParams({ limit: String(take), offset: String(offset) });
        const { data } = await api.get(`/activations/stations/${stationId}?${qs.toString()}`);
        const items = Array.isArray(data?.items) ? data.items : [];
        all = all.concat(items);
        totalCount = Number(data?.total || 0);
        offset += take;
        if (!items.length || all.length >= totalCount) break;
      }

      const inRange = all.filter((a) => {
        const d = parseDate(a.observedAt);
        return d && d >= from && d <= to;
      });

      const months = Array.from({ length: rangeMonths }, (_, i) => ymKey(monthAdd(from, i)));
      const RISK_KEYS = ["RISK_YOK", "DUSUK", "ORTA", "YUKSEK"];
      const rmap = Object.fromEntries(months.map((m) => [m, { month: m, RISK_YOK: 0, DUSUK: 0, ORTA: 0, YUKSEK: 0 }]));
      inRange.forEach((a) => {
        const mk = ymKey(new Date(a.observedAt));
        const r = a.risk || "RISK_YOK";
        if (rmap[mk] && RISK_KEYS.includes(r)) rmap[mk][r] += 1;
      });
      setRiskByMonth(months.map((m) => rmap[m]));

      const sec = station ? SECONDARY_BY_TYPE[station.type] : null;
      if (sec?.key) {
        const smap = Object.fromEntries(months.map((m) => [m, { month: m, changed: 0 }]));
        inRange.forEach((a) => { const mk = ymKey(new Date(a.observedAt)); if (a[sec.key]) smap[mk].changed += 1; });
        setSecondaryByMonth(months.map((m) => smap[m]));
      } else {
        setSecondaryByMonth([]);
      }
    } catch {
      setRiskByMonth([]);
      setSecondaryByMonth([]);
    } finally {
      setChartLoading(false);
    }
  }, [stationId, rangeMonths, station]);

  // İlk yükleme
  useEffect(() => { fetchStation(); }, [fetchStation]);
  useEffect(() => { setPage(0); fetchActivations({ reset: true }); }, [fetchActivations, stationId]);
  useEffect(() => { fetchCharts(); }, [fetchCharts]);

  const title = useMemo(() => {
    if (!station) return "İstasyon";
    return `${TYPE_TR[station.type] || station.type} – ${station.name || ""}`;
  }, [station]);

  const fmtDate = (val) => {
    if (!val) return "—";
    try { return new Date(val).toLocaleString("tr-TR"); } catch { return String(val); }
  };

  const canLoadMore = list.length < total;

  const describe = (a) => {
    const t = a?.type;
    if (t === "ELEKTRIKLI_SINEK_TUTUCU") {
      const p = [];
      if (Number(a.karasinek) > 0) p.push(`Karasinek: ${a.karasinek}`);
      if (Number(a.sivrisinek) > 0) p.push(`Sivrisinek: ${a.sivrisinek}`);
      if (Number(a.diger) > 0) p.push(`Diğer: ${a.diger}`);
      if (a.sariBantDegisim) p.push("Sarı bant değişti");
      if (a.uvLambaDegisim) p.push("UV lamba değişti");
      if (a.uvLambaAriza) p.push("UV arızalı");
      if (a.arizaliEFK) p.push("EFK arızalı");
      if (a.tamirdeEFK) p.push("EFK tamirde");
      return p.join(" • ") || "—";
    }
    if (t === "GUVE_TUZAGI") {
      const p = [];
      if (Number(a.guve) > 0) p.push(`Güve: ${a.guve}`);
      if (Number(a.diger) > 0) p.push(`Diğer: ${a.diger}`);
      if (a.feromonDegisti) p.push("Feromon değişti");
      if (a.deformeTuzak) p.push("Tuzak deforme");
      if (a.tuzakDegisti) p.push("Tuzak değişti");
      return p.join(" • ") || "—";
    }
    if (t === "BOCEK_MONITOR") {
      const p = [];
      if (Number(a.hedefZararliSayisi) >= 0) p.push(`Hedef Zararlı: ${a.hedefZararliSayisi}`);
      if (a.monitorDegisti) p.push("Monitör değişti");
      return p.join(" • ") || "—";
    }
    if (t === "CANLI_YAKALAMA") {
      const p = [];
      if (a.deformeMonitor) p.push("Monitör deforme");
      if (a.yapiskanDegisti) p.push("Yapışkan değişti");
      if (a.monitorDegisti) p.push("Monitör değişti");
      if (a.ulasilamayanMonitor) p.push("Ulaşılamayan monitör");
      return p.join(" • ") || "—";
    }
    if (t === "FARE_YEMLEME") {
      const p = [];
      if (a.deformeYem) p.push("Yem deforme");
      if (a.yemDegisti) p.push("Yem değişti");
      if (a.deformeMonitor) p.push("Monitör deforme");
      if (a.monitorDegisti) p.push("Monitör değişti");
      if (a.ulasilamayanMonitor) p.push("Ulaşılamayan monitör");
      return p.join(" • ") || "—";
    }
    return "—";
  };

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
                  Mağaza:{" "}
                  <Link to={`/customer/stores/${store.id}`} className="link">
                    {store?.code ? `${store.code} – ` : ""}{store?.name}
                  </Link>
                </>
              ) : "—"}
              {" • "}
              <span className="muted">{TYPE_TR[station?.type] || station?.type || "—"}</span>
              {" • "}
              <span className="mono">{station?.code || "—"}</span>
            </div>
          </div>

          <div className="head-actions">
            {store && (
              <Link className="btn ghost" to={`/customer/stores/${store.id}`}>
                Mağazaya Dön
              </Link>
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
              </span>
            </div>
            <div><b>Oluşturulma</b><span>{station?.createdAt ? new Date(station.createdAt).toLocaleString("tr-TR") : "—"}</span></div>
            <div><b>Güncelleme</b><span>{station?.updatedAt ? new Date(station.updatedAt).toLocaleString("tr-TR") : "—"}</span></div>
          </div>
        </section>

        {/* Aktivasyonlar (tablo) — sadece görüntüleme */}
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

        {/* Grafikler (salt okunur) */}
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
                  {[1,2,3,4,5,6,7,8,9,10,11,12,18,24].map((m)=>(<option key={m} value={m}>{m} Ay</option>))}
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
              {/* 1) Aktivasyon Varlığı (Aylık) */}
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
                      <Recharts.Bar dataKey="count" name="Toplam Kayıt" fill={BAR_COLORS.countBar} radius={[6,6,0,0]} barSize={24} />
                      <Recharts.Bar dataKey="activityCount" name="Aktivite" fill={BAR_COLORS.activityBar} radius={[6,6,0,0]} barSize={24} />
                      <Recharts.Line type="monotone" dataKey="count" name="Toplam (çizgi)" stroke={BAR_COLORS.countLine} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      <Recharts.Line type="monotone" dataKey="activityCount" name="Aktivite (çizgi)" stroke={BAR_COLORS.activityLine} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    </Recharts.ComposedChart>
                  </Recharts.ResponsiveContainer>
                )}
              </div>

              {/* 2) Tip Bazlı İkincil Metrik */}
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
                        <Recharts.Bar dataKey="changed" name="Adet" fill={BAR_COLORS.secondaryBar} radius={[6,6,0,0]} barSize={28} />
                        <Recharts.Line type="monotone" dataKey="changed" name="Adet (çizgi)" stroke={BAR_COLORS.secondaryLine} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      </Recharts.ComposedChart>
                    </Recharts.ResponsiveContainer>
                  )}
                </div>
              )}

              {/* 3) Risk Dağılımı */}
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
                      <Recharts.Bar stackId="r" dataKey="RISK_YOK" name="Risk Yok" fill={RISK_COLORS.RISK_YOK} radius={[6,6,0,0]} />
                      <Recharts.Bar stackId="r" dataKey="DUSUK"    name="Düşük"    fill={RISK_COLORS.DUSUK} />
                      <Recharts.Bar stackId="r" dataKey="ORTA"     name="Orta"     fill={RISK_COLORS.ORTA} />
                      <Recharts.Bar stackId="r" dataKey="YUKSEK"   name="Yüksek"   fill={RISK_COLORS.YUKSEK} />
                      <Recharts.Line type="monotone" dataKey="total" name="Toplam (çizgi)" stroke="#111827" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    </Recharts.ComposedChart>
                  </Recharts.ResponsiveContainer>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </Layout>
  );
}
