// src/pages/reports/TrendPDFReport.jsx
//
// ROUTE EKLEME (App.jsx / router dosyanıza):
//   import TrendPDFReport from "./pages/reports/TrendPDFReport";
//   <Route path="/customer/stores/:storeId/trend-pdf" element={<TrendPDFReport />} />
//   <Route path="/stores/:storeId/trend-pdf"          element={<TrendPDFReport />} />
//
// TrendAnalysis.jsx'e minimal ekleme (mevcut "Yazdır" butonunun yanına):
//   <Link className="btn primary" to={`/customer/stores/${storeId}/trend-pdf`}>
//     PDF Raporu
//   </Link>

import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./TrendAnalysis.scss";

let RC = null;
try { RC = require("recharts"); } catch { }

/* ─────────── sabitler ─────────── */
const MONTHS_SHORT = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haz.", "Tem.", "Ağu.", "Eyl.", "Eki.", "Kas.", "Ara."];
const MONTHS_FULL = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

// İstasyon tipi → grup eşlemesi
// "fly" tipler; station.location / station.subType ile indoor/outdoor ayrılır
const TYPE_TO_GROUP = {
  FARE_YEMLEME: "toxic",
  CANLI_YAKALAMA: "nontoxic",
  BOCEK_MONITOR: "nontoxic",
  ELEKTRIKLI_SINEK_TUTUCU: "fly",
  GUVE_TUZAGI: "fly",
  DIS_ALAN_SINEK_TUTUCU: "outdoor_fly",
  IC_ALAN_SINEK_TUTUCU: "indoor_fly",
};

const GROUP_LABEL = {
  toxic: "Zehirli İstasyon",
  nontoxic: "Zehirsiz İstasyon",
  indoor_fly: "İç Alan Uçkun İstasyon",
  outdoor_fly: "Dış Alan Uçkun İstasyon",
};

const PEST_SPECIES_LIST = [
  "Fare (mus domesticus)",
  "Sıçan (rattus rattus)",
  "Sıçan (rattus norvegicus)",
  "Hamam Böceği",
  "Karınca",
  "Örümcek",
  "Kene",
  "Diğer",
];

const SPECIES_COLORS = {
  "Fare (mus domesticus)": "#f97316",
  "Sıçan (rattus norvegicus)": "#8b5cf6",
  "Sıçan (rattus rattus)": "#ec4899",
  "Hamam Böceği": "#06b6d4",
  "Karınca": "#ef4444",
  "Örümcek": "#a3a3a3",
  "Kene": "#84cc16",
  "Diğer": "#d4d4d4",
};

const PIE_PALETTE = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#06b6d4"];
const TEAL = "#0d9488";
const RED = "#ef4444";
const GREEN = "#22c55e";
const BLUE = "#3b82f6";
const AMBER = "#f59e0b";

/* ─────────── yardımcı fonksiyonlar ─────────── */
function buildMonthRange(year, s, e) {
  const out = [];
  for (let m = s; m <= e; m++) {
    out.push({
      y: year, m,
      label: MONTHS_SHORT[m - 1],
      fullLabel: MONTHS_FULL[m - 1],
      start: new Date(year, m - 1, 1, 0, 0, 0),
      end: new Date(year, m, 1, 0, 0, 0),
    });
  }
  return out;
}

function inRange(d, start, end) {
  if (!d) return false;
  const t = new Date(d).getTime();
  return t >= start.getTime() && t < end.getTime();
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("tr-TR");
}

function groupStations(stations) {
  const g = { toxic: [], nontoxic: [], indoor_fly: [], outdoor_fly: [] };
  for (const s of stations) {
    const base = TYPE_TO_GROUP[s.type];
    if (!base) continue;
    if (base === "fly") {
      const loc = (s.location || s.subType || s.locationType || "").toLowerCase();
      const isOutdoor = loc.includes("dis") || loc.includes("dış") || loc.includes("out");
      g[isOutdoor ? "outdoor_fly" : "indoor_fly"].push(s);
    } else if (g[base]) {
      g[base].push(s);
    }
  }
  return g;
}

/* ─────────── küçük bileşenler ─────────── */
function KpiCard({ label, value, hint, accent }) {
  return (
    <div className={`tpdf-kpi ${accent ? "tpdf-kpi--accent" : ""}`}>
      <div className="tpdf-kpi__label">{label}</div>
      <div className="tpdf-kpi__value">{value}</div>
      {hint && <div className="tpdf-kpi__hint">{hint}</div>}
    </div>
  );
}

function InfoBox({ children, type = "neutral" }) {
  return <div className={`tpdf-infobox tpdf-infobox--${type}`}>{children}</div>;
}

function SubTitle({ children, color }) {
  return <h3 className="tpdf-sub-title" style={color ? { color } : {}}>{children}</h3>;
}

function Badge({ children, type = "default" }) {
  return <span className={`tpdf-badge tpdf-badge--${type}`}>{children}</span>;
}

/* ─────────── ana bileşen ─────────── */
export default function TrendPDFReport() {
  const { storeId } = useParams();
  const navigate = useNavigate();

  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [startMonth, setStartMonth] = useState(1);
  const [endMonth, setEndMonth] = useState(new Date().getMonth() + 1);
  const [showPicker, setShowPicker] = useState(true);

  const [store, setStore] = useState(null);
  const [company, setCompany] = useState(null);
  const [stations, setStations] = useState([]);
  const [activations, setActivations] = useState([]);
  const [chemicals, setChemicals] = useState([]);
  const [loading, setLoading] = useState(true);

  /* ── veri çekme ── */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        const { data: s } = await api.get(`/stores/${storeId}`);
        setStore(s);

        try { const { data: c } = await api.get(`/company`); setCompany(c); } catch { }

        try {
          let stList = [];
          const { data } = await api.get(`/stations/store/${storeId}`);
          stList = Array.isArray(data) ? data : [];
          if (!stList.length) {
            const { data: d2 } = await api.get(`/stores/${storeId}/stations`);
            stList = Array.isArray(d2) ? d2 : [];
          }
          
          // Expand group stations into individual units so all math works perfectly.
          const expanded = [];
          for (const st of stList) {
            if (st.isGroup && st.totalCount > 1) {
              const codes = [];
              const baseCode = st.code || "ST";
              const prefixMatch = baseCode.match(/^(.*?)(\d+)$/);
              if (prefixMatch) {
                const prefix = prefixMatch[1];
                const startNum = parseInt(prefixMatch[2], 10);
                for (let i = 0; i < st.totalCount; i++) {
                  codes.push(`${prefix}${String(startNum + i).padStart(prefixMatch[2].length, '0')}`);
                }
              } else {
                for (let i = 1; i <= st.totalCount; i++) {
                  codes.push(`${baseCode}-${String(i).padStart(3, '0')}`);
                }
              }
              codes.forEach(c => {
                expanded.push({ ...st, originalId: st.id, id: `${st.id}-${c}`, code: c });
              });
            } else {
              expanded.push({ ...st, originalId: st.id, id: st.id });
            }
          }
          setStations(expanded);
        } catch {
          setStations([]);
        }

        // Kimyasal uygulama verisi – endpoint adı farklı olabilir
        for (const ep of [
          `/chemical-applications/store/${storeId}`,
          `/applications/store/${storeId}`,
          `/chemicals/store/${storeId}`,
        ]) {
          try {
            const { data } = await api.get(ep);
            if (Array.isArray(data) && data.length >= 0) { setChemicals(data); break; }
          } catch { }
        }
      } catch (e) {
        toast.error(e?.response?.data?.error || "Veriler alınamadı");
      } finally {
        setLoading(false);
      }
    })();
  }, [storeId]);

  /* ── aktivasyon çekme (sayfalı) ── */
  const fetchStationActs = useCallback(async (sid) => {
    let offset = 0, total = Infinity;
    const acc = [];
    while (offset < total) {
      const { data } = await api.get(`/activations/stations/${sid}?limit=200&offset=${offset}`);
      const items = Array.isArray(data?.items) ? data.items : [];
      total = Number(data?.total ?? items.length);
      if (!items.length) break;
      acc.push(...items.map(x => ({ ...x, stationId: sid })));
      offset += 200;
    }
    return acc;
  }, []);

  useEffect(() => {
    if (!stations.length) return;
    let alive = true;
    (async () => {
      const typeById = Object.fromEntries(stations.map(s => [s.id, s.type]));
      const all = [];
      
      const uniqueOriginalIds = [...new Set(stations.map(s => s.originalId))];
      for (const originalId of uniqueOriginalIds) {
        try { all.push(...(await fetchStationActs(originalId))); } catch { }
      }
      
      const norm = all.map(a => {
        const expandedId = a.subCode ? `${a.stationId}-${a.subCode}` : a.stationId;
        return {
          ...a,
          type: a.type || typeById[expandedId],
          when: a.observedAt || a.createdAt || a.updatedAt,
          stationId: expandedId,
        };
      });
      if (alive) setActivations(norm);
    })();
    return () => { alive = false; };
  }, [stations, fetchStationActs]);

  /* ── zaman aralıkları ── */
  const months = useMemo(
    () => buildMonthRange(year, startMonth, Math.max(startMonth, endMonth)),
    [year, startMonth, endMonth]
  );

  const prevMonths = useMemo(() => {
    const count = endMonth - startMonth + 1;
    const pe = startMonth - 1;
    if (pe < 1) return buildMonthRange(year - 1, 12 - count + 1, 12);
    return buildMonthRange(year, Math.max(1, pe - count + 1), pe);
  }, [year, startMonth, endMonth]);

  /* ── istasyon grupları ── */
  const grps = useMemo(() => groupStations(stations), [stations]);

  /* ── dönem aktivasyonları ── */
  const actsInPeriod = useMemo(() => {
    if (!months.length) return [];
    const s = months[0].start, e = months[months.length - 1].end;
    return activations.filter(a => inRange(a.when, s, e));
  }, [activations, months]);

  const actsInPrev = useMemo(() => {
    if (!prevMonths.length) return [];
    const s = prevMonths[0].start, e = prevMonths[prevMonths.length - 1].end;
    return activations.filter(a => inRange(a.when, s, e));
  }, [activations, prevMonths]);

  /* ── genel özet KPI'ları ── */
  const summary = useMemo(() => {
    const total = stations.length;
    const activeIds = new Set(actsInPeriod.map(a => a.stationId));
    const activeRate = total ? Math.round((activeIds.size / total) * 100) : 0;

    const calcRate = (sts, prevActs, field) => {
      if (!sts.length) return 0;
      const active = sts.filter(s => prevActs.some(a =>
        a.stationId === s.id && (Number(a[field]) > 0 || Number(a.aktiviteVar) > 0)
      )).length;
      return Math.round((active / sts.length) * 100);
    };

    const toxicRate = calcRate(grps.toxic, actsInPeriod, "yemTuketim");
    const ntRate = calcRate(grps.nontoxic, actsInPeriod, "aktiviteVar");
    const avgRate = grps.toxic.length && grps.nontoxic.length
      ? Math.round((toxicRate + ntRate) / 2) : (toxicRate || ntRate || activeRate);

    const prevToxicRate = calcRate(grps.toxic, actsInPrev, "yemTuketim");
    const prevNtRate = calcRate(grps.nontoxic, actsInPrev, "aktiviteVar");
    const prevAvg = grps.toxic.length && grps.nontoxic.length
      ? Math.round((prevToxicRate + prevNtRate) / 2) : (prevToxicRate || prevNtRate);

    const diff = avgRate - prevAvg;
    const diffText = diff > 0
      ? `Önceki dönem ortalamasına göre aktiflik oranı ${diff} puan arttı.`
      : diff < 0
        ? `Önceki ay ortalamasına göre aktiflik oranı ${Math.abs(diff)} puan azaldı.`
        : "Önceki dönem ortalamasına göre değişim gözlemlenmedi.";

    const flyCount = actsInPeriod.reduce((s, a) =>
      s + (Number(a.karasinek) || 0) + (Number(a.sivrisinek) || 0) + (Number(a.guve) || 0) + (Number(a.diger) || 0), 0);
    const rodentCount = actsInPeriod.reduce((s, a) =>
      s + (Number(a.yemTuketim) || 0) + (Number(a.hedefZararliSayisi) || 0), 0);
    const dominantGroup = flyCount >= rodentCount ? "Uçkun" : "Kemirgen";
    const dominantSpecies = flyCount >= rodentCount ? "Karasinek" : "Fare";

    return { total, activeRate: avgRate, toxicRate, ntRate, prevToxicRate, prevNtRate, diff, diffText, dominantGroup, dominantSpecies };
  }, [stations, grps, actsInPeriod, actsInPrev]);

  /* ── kırık/kayıp istasyonlar ── */
  const brokenMap = useMemo(() => {
    const res = {};
    for (const [grp, sts] of Object.entries(grps)) {
      res[grp] = actsInPeriod
        .filter(a => sts.some(s => s.id === a.stationId) && (a.durum === "KIRIK_KAYIP" || a.isKirikKayip || a.kirikKayip))
        .map(a => ({
          code: sts.find(s => s.id === a.stationId)?.code || `#${a.stationId}`,
          date: fmtDate(a.when),
        }));
    }
    return res;
  }, [grps, actsInPeriod]);

  /* ── riskli istasyonlar (2+ dönem aktivite) ── */
  const riskyMap = useMemo(() => {
    const res = {};
    for (const [grp, sts] of Object.entries(grps)) {
      res[grp] = sts.reduce((acc, s) => {
        const activeMs = months.filter(m =>
          actsInPeriod.some(a =>
            a.stationId === s.id && inRange(a.when, m.start, m.end) &&
            (Number(a.aktiviteVar) > 0 || Number(a.yemTuketim) > 0)
          )
        );
        if (activeMs.length >= 2) acc.push({
          code: s.code || `#${s.id}`,
          firstDate: fmtDate(activeMs[0].start),
          lastDate: fmtDate(activeMs[activeMs.length - 1].start),
          count: activeMs.length,
        });
        return acc;
      }, []);
    }
    return res;
  }, [grps, months, actsInPeriod]);

  /* ── zehirli istasyon zaman serisi ── */
  const toxicSeries = useMemo(() => months.map(m => {
    const acts = actsInPeriod.filter(a =>
      grps.toxic.some(s => s.id === a.stationId) && inRange(a.when, m.start, m.end)
    );
    return {
      label: m.label,
      "Yem Tüketimi Var": acts.filter(a => Number(a.yemTuketim) > 0 || Number(a.aktiviteVar) > 0).length,
      "Yem Tüketimi Yok": acts.filter(a => !(Number(a.yemTuketim) > 0 || Number(a.aktiviteVar) > 0)).length,
      "Kırık/Kayıp": acts.filter(a => a.durum === "KIRIK_KAYIP" || a.isKirikKayip).length,
    };
  }), [months, grps, actsInPeriod]);

  /* ── zehirsiz istasyon zaman serisi ── */
  const nontoxicSeries = useMemo(() => months.map(m => {
    const acts = actsInPeriod.filter(a =>
      grps.nontoxic.some(s => s.id === a.stationId) && inRange(a.when, m.start, m.end)
    );
    const row = { label: m.label, "Hareket Yok": 0 };
    PEST_SPECIES_LIST.forEach(sp => { row[sp] = 0; });
    acts.forEach(a => {
      if (!Number(a.aktiviteVar)) { row["Hareket Yok"]++; return; }
      const sp = a.pestSpecies || a.species || a.zararlıTuru || "Diğer";
      row[PEST_SPECIES_LIST.includes(sp) ? sp : "Diğer"]++;
    });
    return row;
  }), [months, grps, actsInPeriod]);

  /* ── son ay tür pasta dilimi ── */
  const speciesPie = useMemo(() => {
    const last = months[months.length - 1];
    if (!last) return [];
    const map = {};
    actsInPeriod
      .filter(a => grps.nontoxic.some(s => s.id === a.stationId) && inRange(a.when, last.start, last.end) && Number(a.aktiviteVar) > 0)
      .forEach(a => {
        const sp = a.pestSpecies || a.species || a.zararlıTuru || "Diğer";
        map[sp] = (map[sp] || 0) + 1;
      });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [months, grps, actsInPeriod]);

  /* ── iç alan uçkun serisi ── */
  const indoorFlySeries = useMemo(() => months.map(m => {
    const acts = actsInPeriod.filter(a =>
      grps.indoor_fly.some(s => s.id === a.stationId) && inRange(a.when, m.start, m.end)
    );
    return {
      label: m.label,
      Karasinek: acts.reduce((s, a) => s + (Number(a.karasinek) || 0), 0),
      "Küçük Sinek": acts.reduce((s, a) => s + (Number(a.sivrisinek) || 0) + (Number(a.diger) || 0), 0),
    };
  }), [months, grps, actsInPeriod]);

  /* ── uçkun trend (iç + dış) ── */
  const flyTrend = useMemo(() => months.map(m => {
    const flyCount = (sts) => actsInPeriod
      .filter(a => sts.some(s => s.id === a.stationId) && inRange(a.when, m.start, m.end))
      .reduce((s, a) => s + (Number(a.karasinek) || 0) + (Number(a.sivrisinek) || 0) + (Number(a.guve) || 0) + (Number(a.diger) || 0), 0);
    return { label: m.label, "İç Sayım": flyCount(grps.indoor_fly), "Dış Sayım": flyCount(grps.outdoor_fly) };
  }), [months, grps, actsInPeriod]);

  /* ── top 5 uçkun ── */
  const top5 = useMemo(() => {
    const rank = (sts, type) => sts
      .map(s => ({
        code: s.code || `#${s.id}`, type,
        count: actsInPeriod.filter(a => a.stationId === s.id)
          .reduce((sum, a) => sum + (Number(a.karasinek) || 0) + (Number(a.sivrisinek) || 0) + (Number(a.guve) || 0) + (Number(a.diger) || 0), 0),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    return { indoor: rank(grps.indoor_fly, "İç Alan"), outdoor: rank(grps.outdoor_fly, "Dış Alan") };
  }, [grps, actsInPeriod]);

  /* ── floresan değişim ── */
  const floresanDates = useMemo(() =>
    grps.indoor_fly.map(s => {
      const last = actsInPeriod
        .filter(a => a.stationId === s.id && (a.floresanDegistirildi || a.floresan === "DEGISTIRILDI" || a.lampChanged))
        .sort((a, b) => new Date(b.when) - new Date(a.when))[0];
      const dateStr = last ? fmtDate(last.when) : "—";
      const daysAgo = last ? Math.round((Date.now() - new Date(last.when)) / 86400000) : null;
      return { code: s.code || `#${s.id}`, dateStr, daysAgo };
    }),
    [grps, actsInPeriod]);

  /* ── kimyasal grupları ── */
  const chemGroups = useMemo(() => {
    const inPeriod = chemicals.filter(c => {
      if (!months.length) return true;
      return inRange(c.applicationDate || c.date || c.createdAt, months[0].start, months[months.length - 1].end);
    });
    const classify = (c) => {
      const t = (c.pestType || c.type || c.targetPest || "").toLowerCase();
      if (t.includes("kemirgen") || t.includes("rodent")) return "kemirgen";
      if (t.includes("ucun") || t.includes("uçkun") || t.includes("fly") || t.includes("insect")) return "ucukun";
      if (t.includes("yuruy") || t.includes("yürüy") || t.includes("crawl") || t.includes("bocek") || t.includes("böcek")) return "yuruyen";
      return "diger";
    };
    const g = { kemirgen: [], ucukun: [], yuruyen: [], diger: [] };
    inPeriod.forEach(c => g[classify(c)].push(c));
    return g;
  }, [chemicals, months]);

  /* ── yıllık kimyasal verisi ── */
  const annualChemData = useMemo(() => MONTHS_FULL.map((label, i) => {
    const s = new Date(year, i, 1), e = new Date(year, i + 1, 1);
    const mc = chemicals.filter(c => inRange(c.applicationDate || c.date || c.createdAt, s, e));
    const sum = (pred) => mc.filter(pred).reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
    const isInsekt = c => { const t = (c.pestType || "").toLowerCase(); return t.includes("ucun") || t.includes("fly") || t.includes("yuruy") || t.includes("insect"); };
    const isRodent = c => { const t = (c.pestType || "").toLowerCase(); return t.includes("kemirgen") || t.includes("rodent"); };
    return { label, "İnsektisit (ml)": sum(isInsekt), "Rodentisit (g)": sum(isRodent) };
  }), [chemicals, year]);

  /* ── handlers ── */
  const handleCreate = (e) => { e?.preventDefault?.(); setShowPicker(false); };
  const periodLabel = `${MONTHS_FULL[startMonth - 1]}${startMonth !== endMonth ? " – " + MONTHS_FULL[endMonth - 1] : ""} ${year}`;
  const reportNo = new Date().toISOString().replace(/\D/g, "").slice(0, 14);

  if (loading && !showPicker) {
    return <Layout><div className="tpdf-loading">Yükleniyor…</div></Layout>;
  }

  return (
    <Layout>
      <div className="tpdf-page">

        {/* ═══════════ TARİH SEÇİCİ MODAL ═══════════ */}
        {showPicker && (
          <div className="tpdf-modal-backdrop">
            <div className="tpdf-modal">
              <div className="tpdf-modal__head">
                <h3>{store?.name ? `${store.name} – PDF Raporu` : "Trend PDF Raporu"}</h3>
                <button className="tpdf-modal__close" onClick={() => navigate(-1)}>×</button>
              </div>
              <form className="tpdf-modal__body" onSubmit={handleCreate}>
                <div className="tpdf-form-row">
                  <label>Yıl</label>
                  <input type="number" value={year} min="2000" max="2100"
                    onChange={e => setYear(Number(e.target.value || thisYear))} />
                </div>
                <div className="tpdf-form-row">
                  <label>Başlangıç Ayı</label>
                  <select value={startMonth} onChange={e => setStartMonth(Number(e.target.value))}>
                    {MONTHS_FULL.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div className="tpdf-form-row">
                  <label>Bitiş Ayı</label>
                  <select value={endMonth} onChange={e => setEndMonth(Number(e.target.value))}>
                    {MONTHS_FULL.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div className="tpdf-modal__actions">
                  <button type="button" className="btn ghost" onClick={() => navigate(-1)}>Vazgeç</button>
                  <button type="submit" className="btn primary">PDF Raporu Oluştur</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {!showPicker && (
          <>
            {/* ═══════════ KAPAK SAYFASI ═══════════ */}
            <div className="tpdf-cover">
              <div className="tpdf-cover__logo">Tura<span>çevre</span></div>
              <div className="tpdf-cover__title-block">
                <h1 className="tpdf-cover__h1">Trend Analizi Raporu</h1>
                <div className="tpdf-cover__period">{periodLabel}</div>
              </div>
              <div className="tpdf-cover__info-row">
                <div className="tpdf-cover__info-card">
                  <div className="tpdf-cover__info-badge">FİRMA</div>
                  <div className="tpdf-cover__info-name">Turaçevre</div>
                  {company?.city && <div>{company.city}</div>}
                  {company?.address && <div>{company.address}</div>}
                  {company?.phone && <div>{company.phone}</div>}
                </div>
                <div className="tpdf-cover__info-card">
                  <div className="tpdf-cover__info-badge">MAĞAZA</div>
                  <div className="tpdf-cover__info-name">
                    {store?.name || "—"}
                  </div>
                  <div>Müşteri: {store?.customerName || store?.customer?.name || "—"}</div>
                  {store?.address && <div>{store.address}</div>}
                  {store?.phone && <div>{store.phone}</div>}
                </div>
              </div>
            </div>

            {/* ═══════════ RAPOR GÖVDESİ ═══════════ */}
            <div className="tpdf-body">

              {/* ── üst meta şeridi ── */}
              <div className="tpdf-meta-bar">
                <span>Rapor No: {reportNo}</span>
                <span>Periyot Aralığı: {year}-{String(startMonth).padStart(2, "0")}</span>
                <span>Oluşturma Tarihi: {new Date().toLocaleString("tr-TR")}</span>
              </div>

              {/* ── teal başlık bandı ── */}
              <div className="tpdf-banner">
                <div className="tpdf-banner__title">Trend Analizi Raporu</div>
                <div className="tpdf-banner__sub">Dönem: {periodLabel}</div>
              </div>

              {/* ════ GENEL ÖZET ════ */}
              <div className="tpdf-card">
                <h2 className="tpdf-card__h2">Trend Analizi - Genel Özet</h2>
                <p className="tpdf-card__intro">
                  İncelenen dönemde toplam <strong>{summary.total}</strong> istasyonda izleme
                  yapılmıştır. İstasyonların <strong>%{summary.activeRate}</strong>'inde aktivite
                  tespit edilmiştir. Aktivitenin baskın grubu <strong>{summary.dominantGroup}</strong>{" "}
                  ({summary.dominantSpecies}) olarak görülmüştür.
                </p>

                <div className="tpdf-tag-row">
                  <span className="tpdf-tag tpdf-tag--teal">En Sık Görülen Grup: {summary.dominantGroup}</span>
                  <span className="tpdf-tag tpdf-tag--blue">Baskın Tür: {summary.dominantSpecies}</span>
                </div>

                <div className="tpdf-kpi-grid">
                  <KpiCard label="Toplam İstasyon" value={summary.total} />
                  <KpiCard label="Aktif İstasyon Oranı" value={`%${summary.activeRate}`} />
                  <KpiCard label="En Sık Görülen Grup" value={summary.dominantGroup} />
                  <KpiCard label="Baskın Tür" value={summary.dominantSpecies} />
                </div>

                <InfoBox type="neutral">
                  <strong>Önceki Periyot Kıyas</strong><br />
                  {summary.diffText}
                </InfoBox>

                <table className="tpdf-table">
                  <thead>
                    <tr>
                      <th>Ay/Periyot</th>
                      <th>Aktif Zehirsiz (%)</th>
                      <th>Aktif Zehirli (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prevMonths.length > 0 && (
                      <tr>
                        <td>{MONTHS_FULL[prevMonths[0].m - 1]} {prevMonths[0].y}</td>
                        <td>{summary.prevNtRate}</td>
                        <td>{summary.prevToxicRate}</td>
                      </tr>
                    )}
                    <tr>
                      <td>{MONTHS_FULL[startMonth - 1]} {year}</td>
                      <td>{summary.ntRate}</td>
                      <td>{summary.toxicRate}</td>
                    </tr>
                  </tbody>
                </table>

                <div className="tpdf-kpi-grid tpdf-kpi-grid--2col">
                  <KpiCard accent label="Aktif Zehirsiz İstasyon Oranı" value={`%${summary.ntRate}`} hint="Hareketlilik var / toplam zehirsiz" />
                  <KpiCard accent label="Aktif Zehirli İstasyon Oranı" value={`%${summary.toxicRate}`} hint="Tüketim var / toplam zehirli" />
                </div>

                <InfoBox type="info">
                  <strong>Tanım ve Hesaplama Notu</strong><br />
                  • <strong>Aktif Zehirsiz İstasyon Oranı:</strong> Hareketlilik var olarak işaretlenen zehirsiz istasyonların, toplam zehirsiz istasyonlara oranı.<br />
                  • <strong>Aktif Zehirli İstasyon Oranı:</strong> Tüketim var olarak işaretlenen zehirli istasyonların, toplam zehirli istasyonlara oranı.<br />
                  • <strong>Aktiflik Oranı:</strong> Bu iki oranın ortalaması.<br />
                  • <strong>Önceki Periyot Kıyas:</strong> Aylık ortalamalara göre aktiflik oranındaki artış/azalış.
                </InfoBox>
              </div>

              {/* ════ DENETÇİ ÖZETİ ════ */}
              <div className="tpdf-card">
                <h2 className="tpdf-card__h2">Denetçi Özeti</h2>
                <ul className="tpdf-list">
                  <li>Trend analizi yapıldı.</li>
                  <li>Önceki periyotla kıyaslandı.</li>
                  <li>Düzeltici/önleyici faaliyet tanımlandı.</li>
                  <li>Biyosidal Ürün Uygulaması değerlendirmesi planlandı.</li>
                  <li>Kayıtların izlenebilirliği sağlandı.</li>
                </ul>
              </div>

              {/* ════ RİSK SEVİYELERİ ════ */}
              <div className="tpdf-card">
                <h2 className="tpdf-card__h2">Risk Seviyesi / Eşik Değerler</h2>
                <table className="tpdf-table">
                  <thead>
                    <tr><th>İstasyon Tipi</th><th>Normal</th><th>Uyarı</th><th>Kritik</th><th>Eşik Notu</th></tr>
                  </thead>
                  <tbody>
                    {[
                      "Zehirli İstasyon (Kemirgen)",
                      "Zehirsiz İstasyon",
                      "İç Alan Uçkun",
                      "Dış Alan Uçkun",
                    ].map(t => (
                      <tr key={t}>
                        <td>{t}</td>
                        <td className="tpdf-td-center">___</td>
                        <td className="tpdf-td-center">___</td>
                        <td className="tpdf-td-center">___</td>
                        <td>Eşik değerler işletme risk değerlendirmesi ile belirlenecektir.</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ════ ZEHİRLİ İSTASYON ════ */}
              {grps.toxic.length > 0 && (
                <div className="tpdf-card">
                  <h2 className="tpdf-card__h2">Zehirli İstasyon ({grps.toxic.length} Adet)</h2>
                  <p className="tpdf-card__intro">Zaman serisi (ay) bazında tür ve hareketlilik dağılımı.</p>

                  {RC && toxicSeries.length > 0 && (
                    <RC.ResponsiveContainer width="100%" height={230}>
                      <RC.BarChart data={toxicSeries}>
                        <RC.CartesianGrid strokeDasharray="3 3" />
                        <RC.XAxis dataKey="label" />
                        <RC.YAxis allowDecimals={false} />
                        <RC.Tooltip />
                        <RC.Legend />
                        <RC.Bar isAnimationActive={false} stackId="a" dataKey="Yem Tüketimi Yok" fill="#d1d5db" radius={[0, 0, 0, 0]} />
                        <RC.Bar isAnimationActive={false} stackId="a" dataKey="Kırık/Kayıp" fill={RED} radius={[0, 0, 0, 0]} />
                        <RC.Bar isAnimationActive={false} stackId="a" dataKey="Yem Tüketimi Var" fill={GREEN} radius={[3, 3, 0, 0]} />
                      </RC.BarChart>
                    </RC.ResponsiveContainer>
                  )}

                  <InfoBox type="neutral">
                    Son periyottaki aktif zehirli istasyon oranı önceki periyoda göre{" "}
                    {summary.toxicRate > summary.prevToxicRate
                      ? `%${(summary.toxicRate - summary.prevToxicRate).toFixed(2)} puan artmıştır. En artan tür: Farklı tür gözlenmedi.`
                      : summary.toxicRate < summary.prevToxicRate
                        ? `%${(summary.prevToxicRate - summary.toxicRate).toFixed(2)} puan azalmıştır.`
                        : "değişmemiştir."}
                  </InfoBox>

                  {brokenMap.toxic?.length > 0 && (
                    <>
                      <SubTitle color={AMBER}>Zehirli İstasyon Kayıp/Kırık Listesi</SubTitle>
                      <table className="tpdf-table">
                        <thead><tr><th>İstasyon No</th><th>Tespit Tarihi</th><th>Durum</th></tr></thead>
                        <tbody>
                          {brokenMap.toxic.map((r, i) => (
                            <tr key={i}>
                              <td><strong>{r.code}</strong></td>
                              <td>{r.date}</td>
                              <td><Badge type="amber">Kırık/Kayıp</Badge></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  {riskyMap.toxic?.length > 0 && (
                    <>
                      <SubTitle color={RED}>Zehirli İstasyon Riskli Noktalar</SubTitle>
                      <table className="tpdf-table">
                        <thead><tr><th>İstasyon No</th><th>Önceki Tarih</th><th>Son Tarih</th><th>Durum</th></tr></thead>
                        <tbody>
                          {riskyMap.toxic.map((r, i) => (
                            <tr key={i}>
                              <td><strong>{r.code}</strong></td>
                              <td>{r.firstDate}</td>
                              <td>{r.lastDate}</td>
                              <td><Badge type="red">Riskli ({r.count} Periyot Aktivite)</Badge></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              )}

              {/* ════ ZEHİRSİZ İSTASYON ════ */}
              {grps.nontoxic.length > 0 && (
                <div className="tpdf-card">
                  <h2 className="tpdf-card__h2">Zehirsiz İstasyon ({grps.nontoxic.length} Adet)</h2>
                  <p className="tpdf-card__intro">Hareket var/yok ve tür dağılımı.</p>

                  {RC && nontoxicSeries.length > 0 && (
                    <RC.ResponsiveContainer width="100%" height={250}>
                      <RC.BarChart data={nontoxicSeries}>
                        <RC.CartesianGrid strokeDasharray="3 3" />
                        <RC.XAxis dataKey="label" />
                        <RC.YAxis allowDecimals={false} />
                        <RC.Tooltip />
                        <RC.Legend />
                        <RC.Bar isAnimationActive={false} stackId="a" dataKey="Hareket Yok" fill="#e5e7eb" />
                        {PEST_SPECIES_LIST.map(sp => (
                          <RC.Bar key={sp} isAnimationActive={false} stackId="a" dataKey={sp}
                            fill={SPECIES_COLORS[sp] || "#9ca3af"} />
                        ))}
                      </RC.BarChart>
                    </RC.ResponsiveContainer>
                  )}

                  {RC && speciesPie.length > 0 && (
                    <div className="tpdf-pie-wrap">
                      <SubTitle>{months[months.length - 1]?.fullLabel} Ayı - Zararlı Tür Dağılımı</SubTitle>
                      <RC.ResponsiveContainer width="100%" height={220}>
                        <RC.PieChart>
                          <RC.Pie data={speciesPie} dataKey="value" nameKey="name"
                            cx="50%" cy="50%" outerRadius={85}
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                            labelLine={false}>
                            {speciesPie.map((e, i) => (
                              <RC.Cell key={i} fill={SPECIES_COLORS[e.name] || `hsl(${i * 45},65%,55%)`} />
                            ))}
                          </RC.Pie>
                          <RC.Tooltip /><RC.Legend />
                        </RC.PieChart>
                      </RC.ResponsiveContainer>
                    </div>
                  )}

                  <InfoBox type="neutral">
                    Son periyottaki aktif zehirsiz istasyon oranı önceki periyoda göre{" "}
                    {summary.ntRate > summary.prevNtRate
                      ? `%${summary.ntRate - summary.prevNtRate} puan artmıştır.`
                      : summary.ntRate < summary.prevNtRate
                        ? `%${summary.prevNtRate - summary.ntRate} puan azalmıştır.`
                        : "değişmemiştir."}
                  </InfoBox>

                  {brokenMap.nontoxic?.length > 0 && (
                    <>
                      <SubTitle color={AMBER}>Zehirsiz İstasyon Kayıp/Kırık Listesi</SubTitle>
                      <table className="tpdf-table">
                        <thead><tr><th>İstasyon No</th><th>Tespit Tarihi</th><th>Durum</th></tr></thead>
                        <tbody>
                          {brokenMap.nontoxic.map((r, i) => (
                            <tr key={i}>
                              <td><strong>{r.code}</strong></td><td>{r.date}</td>
                              <td><Badge type="amber">Kırık/Kayıp</Badge></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  {riskyMap.nontoxic?.length > 0 && (
                    <>
                      <SubTitle color={RED}>Zehirsiz İstasyon Riskli Noktalar</SubTitle>
                      <table className="tpdf-table">
                        <thead><tr><th>İstasyon No</th><th>Önceki Tarih</th><th>Son Tarih</th><th>Durum</th></tr></thead>
                        <tbody>
                          {riskyMap.nontoxic.map((r, i) => (
                            <tr key={i}>
                              <td><strong>{r.code}</strong></td><td>{r.firstDate}</td><td>{r.lastDate}</td>
                              <td><Badge type="red">Riskli ({r.count} Periyot Aktivite)</Badge></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              )}

              {/* ════ İÇ ALAN UÇKUN ════ */}
              {grps.indoor_fly.length > 0 && (
                <div className="tpdf-card">
                  <h2 className="tpdf-card__h2">İç Alan Uçkun İstasyon ({grps.indoor_fly.length} Adet)</h2>
                  <p className="tpdf-card__intro">Tür bazlı sayım (stacked) ve genel sayım.</p>

                  {RC && indoorFlySeries.length > 0 && (
                    <RC.ResponsiveContainer width="100%" height={230}>
                      <RC.BarChart data={indoorFlySeries}>
                        <RC.CartesianGrid strokeDasharray="3 3" />
                        <RC.XAxis dataKey="label" />
                        <RC.YAxis allowDecimals={false} />
                        <RC.Tooltip /><RC.Legend />
                        <RC.Bar isAnimationActive={false} stackId="a" dataKey="Karasinek" fill="#93c5fd" />
                        <RC.Bar isAnimationActive={false} stackId="a" dataKey="Küçük Sinek" fill="#fda4af" radius={[3, 3, 0, 0]} />
                      </RC.BarChart>
                    </RC.ResponsiveContainer>
                  )}

                  <InfoBox type="neutral">
                    {(() => {
                      const cur = indoorFlySeries.reduce((s, m) => s + m.Karasinek + (m["Küçük Sinek"] || 0), 0);
                      const prev = actsInPrev.filter(a => grps.indoor_fly.some(s => s.id === a.stationId))
                        .reduce((s, a) => s + (Number(a.karasinek) || 0) + (Number(a.sivrisinek) || 0) + (Number(a.diger) || 0), 0);
                      const diff = cur - prev;
                      return `Son periyottaki toplam iç alan uçkun sayımı ${cur}, önceki periyotta ${prev}; ${Math.abs(diff)} adet ${diff >= 0 ? "artış" : "azalış"} vardır.`;
                    })()}
                  </InfoBox>

                  {floresanDates.length > 0 && (
                    <>
                      <SubTitle>İç Alan Uçkun İstasyonları Son Floresan Değişim Tarihi</SubTitle>
                      <table className="tpdf-table">
                        <thead>
                          <tr>
                            <th>İstasyon No</th>
                            <th>Son Değişim Tarihi</th>
                            <th>Kaç Gün Önce</th>
                          </tr>
                        </thead>
                        <tbody>
                          {floresanDates.map((r, i) => (
                            <tr key={i}>
                              <td style={{ color: TEAL }}><strong>{r.code}</strong></td>
                              <td>{r.dateStr}</td>
                              <td style={{ color: TEAL }}><strong>{r.daysAgo ?? "—"}</strong></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              )}

              {/* ════ UÇKUN AKTİVİTE TREND ════ */}
              {(grps.indoor_fly.length > 0 || grps.outdoor_fly.length > 0) && (
                <div className="tpdf-card">
                  <h2 className="tpdf-card__h2">Uçkun Aktivitesi Trend Analizi (Dış Alan / İç Alan)</h2>
                  <p className="tpdf-card__intro">Ay/Periyot bazında uçkun sayımı (adet) ve kritik eşik karşılaştırması.</p>

                  {RC && flyTrend.length > 0 && (
                    <RC.ResponsiveContainer width="100%" height={260}>
                      <RC.LineChart data={flyTrend}>
                        <RC.CartesianGrid strokeDasharray="3 3" />
                        <RC.XAxis dataKey="label" />
                        <RC.YAxis />
                        <RC.Tooltip /><RC.Legend />
                        <RC.Line isAnimationActive={false} type="monotone" dataKey="Dış Sayım"
                          stroke={RED} strokeWidth={2} dot={{ r: 4, fill: RED }} />
                        <RC.Line isAnimationActive={false} type="monotone" dataKey="İç Sayım"
                          stroke={GREEN} strokeWidth={2} dot={{ r: 4, fill: GREEN }} />
                        <RC.ReferenceLine y={150} stroke={AMBER} strokeDasharray="6 4"
                          label={{ value: "Kritik Eşik", fill: AMBER, fontSize: 11, position: "right" }} />
                      </RC.LineChart>
                    </RC.ResponsiveContainer>
                  )}

                  <InfoBox type="warning">
                    Dış alan uçkun istasyonlarında gözlemlenen artışlar, iç alan uçkun riskinin erken göstergesi
                    olarak değerlendirilmekte ve bu doğrultuda önleyici tedbirler planlanmaktadır. Kritik eşik
                    değerinin aşıldığı dönemler aksiyon planı ile ilişkilendirilir.
                  </InfoBox>
                </div>
              )}

              {/* ════ RİSK HARİTASI / TOP 5 ════ */}
              {(top5.indoor.length > 0 || top5.outdoor.length > 0) && (
                <div className="tpdf-card">
                  <h2 className="tpdf-card__h2">Risk Haritası / Önceliklendirme (Top 5 Uçkun)</h2>

                  {top5.indoor.length > 0 && (
                    <>
                      <SubTitle>İç Alan (Top 5)</SubTitle>
                      <table className="tpdf-table">
                        <thead><tr><th>Periyot Tarihi</th><th>İstasyon No</th><th>İstasyon Türü</th><th>Sayım (Adet)</th></tr></thead>
                        <tbody>
                          {top5.indoor.map((r, i) => (
                            <tr key={i}>
                              <td>{months.length ? fmtDate(months[months.length - 1].start) : "—"}</td>
                              <td>{r.code}</td><td>{r.type}</td><td>{r.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}

                  {top5.outdoor.length > 0 && (
                    <>
                      <SubTitle>Dış Alan (Top 5)</SubTitle>
                      <table className="tpdf-table">
                        <thead><tr><th>Periyot Tarihi</th><th>İstasyon No</th><th>İstasyon Türü</th><th>Sayım (Adet)</th></tr></thead>
                        <tbody>
                          {top5.outdoor.map((r, i) => (
                            <tr key={i}>
                              <td>{months.length ? fmtDate(months[months.length - 1].start) : "—"}</td>
                              <td>{r.code}</td><td>{r.type}</td><td>{r.count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              )}

              {/* ════ DETAYLI KARŞILAŞTIRMA (her grup için) ════ */}
              {Object.entries(grps).map(([grp, sts]) => {
                if (!sts.length || !months.length) return null;
                return (
                  <div className="tpdf-card tpdf-card--overflow" key={grp}>
                    <h2 className="tpdf-card__h2">{GROUP_LABEL[grp]} - Detaylı Karşılaştırma</h2>
                    <div className="tpdf-scroll-x">
                      <table className="tpdf-table tpdf-table--comparison">
                        <thead>
                          <tr>
                            <th>İstasyon No</th>
                            {months.map(m => <th key={m.label}>{m.fullLabel} {year}</th>)}
                          </tr>
                        </thead>
                        <tbody>
                          {sts.map(s => (
                            <tr key={s.id}>
                              <td className="tpdf-td-bold">{s.code || `#${s.id}`}</td>
                              {months.map(m => {
                                const acts = actsInPeriod.filter(a =>
                                  a.stationId === s.id && inRange(a.when, m.start, m.end)
                                );
                                if (!acts.length) return <td key={m.label} className="tpdf-td-empty">—</td>;
                                const a = acts.sort((x, y) => new Date(y.when) - new Date(x.when))[0];
                                const isBroken = a.durum === "KIRIK_KAYIP" || a.isKirikKayip || a.kirikKayip;
                                const hasAct = Number(a.aktiviteVar) > 0 || Number(a.yemTuketim) > 0;
                                const flyTotal = (Number(a.karasinek) || 0) + (Number(a.sivrisinek) || 0);
                                const lampChanged = a.floresanDegistirildi || a.lampChanged;
                                return (
                                  <td key={m.label}>
                                    <div className="tpdf-cmp-date">{fmtDate(a.when)}</div>
                                    {isBroken && <div className="tpdf-cmp-chip tpdf-cmp-chip--broken">Kırık/Kayıp</div>}
                                    {!isBroken && grp === "toxic" && (
                                      <div className={`tpdf-cmp-chip ${hasAct ? "tpdf-cmp-chip--active" : "tpdf-cmp-chip--inactive"}`}>
                                        {hasAct ? "Tüketim Var" : "Temiz/Yok"}
                                      </div>
                                    )}
                                    {!isBroken && grp === "nontoxic" && (
                                      <>
                                        <div className={`tpdf-cmp-chip ${hasAct ? "tpdf-cmp-chip--active" : "tpdf-cmp-chip--inactive"}`}>
                                          {hasAct ? "Aktivite (+)" : "Temiz (-)"}
                                        </div>
                                        {a.pestSpecies && <div className="tpdf-cmp-species">{a.pestSpecies}</div>}
                                      </>
                                    )}
                                    {!isBroken && (grp === "indoor_fly" || grp === "outdoor_fly") && (
                                      <>
                                        <div className="tpdf-cmp-count">Sayım: <strong>{flyTotal}</strong></div>
                                        {lampChanged && <div className="tpdf-cmp-note">Flor: Değişti</div>}
                                        {!lampChanged && grp === "indoor_fly" && <div className="tpdf-cmp-note tpdf-cmp-note--warn">Flor: Aynı</div>}
                                      </>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}

              {/* ════ KİMYASAL KULLANIM RAPORLARI ════ */}
              <div className="tpdf-card tpdf-card--teal-banner">
                <div className="tpdf-teal-header">
                  <div>
                    <div className="tpdf-teal-header__title">Kimyasal Kullanım Raporları</div>
                    <div className="tpdf-teal-header__sub">Dönem: {year}-{String(startMonth).padStart(2, "0")}</div>
                  </div>
                </div>

                {[
                  { key: "kemirgen", label: "1. Kemirgen Mücadelesi", unit: "g" },
                  { key: "ucukun", label: "2. Uçkun Mücadelesi", unit: "ml" },
                  { key: "yuruyen", label: "3. Yürüyen Mücadelesi", unit: "ml" },
                  { key: "diger", label: "4. Diğer Uygulamalar", unit: "ml" },
                ].map(({ key, label, unit }) => {
                  const items = chemGroups[key] || [];
                  if (!items.length) return null;
                  const total = items.reduce((s, c) => s + (Number(c.amount) || 0), 0);
                  const pieData = Object.entries(
                    items.reduce((acc, c) => {
                      const nm = c.activeIngredient || c.productName || c.name || "Bilinmiyor";
                      acc[nm] = (acc[nm] || 0) + (Number(c.amount) || 0);
                      return acc;
                    }, {})
                  ).map(([name, value]) => ({ name, value }));

                  return (
                    <div key={key} className="tpdf-chem-section">
                      <SubTitle>{label}</SubTitle>
                      <table className="tpdf-table">
                        <thead><tr><th>Periyot Tarihi</th><th>Etken Madde</th><th>Miktar ({unit})</th></tr></thead>
                        <tbody>
                          {items.map((c, i) => (
                            <tr key={i}>
                              <td>{fmtDate(c.applicationDate || c.date || c.createdAt)}</td>
                              <td>{c.activeIngredient || c.productName || c.name || "—"}</td>
                              <td>{c.amount}</td>
                            </tr>
                          ))}
                          <tr className="tpdf-table__total-row">
                            <td colSpan={2}><strong>Toplam</strong></td>
                            <td><strong>{total}</strong></td>
                          </tr>
                        </tbody>
                      </table>

                      {RC && pieData.length > 0 && (
                        <RC.ResponsiveContainer width="100%" height={160}>
                          <RC.PieChart>
                            <RC.Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={65}
                              label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                              {pieData.map((_, i) => (
                                <RC.Cell key={i} fill={PIE_PALETTE[i % PIE_PALETTE.length]} />
                              ))}
                            </RC.Pie>
                            <RC.Legend /><RC.Tooltip />
                          </RC.PieChart>
                        </RC.ResponsiveContainer>
                      )}
                    </div>
                  );
                })}

                {/* Aylık karşılaştırma tablosu */}
                <SubTitle>Kimyasal &amp; Hareketlilik Karşılaştırma Raporları</SubTitle>
                <table className="tpdf-table">
                  <thead>
                    <tr>
                      <th>Ay</th>
                      <th>İnsektisit Kullanımı</th>
                      <th>Rodentisit Kullanımı</th>
                      <th>Haşere Aktivasyonu</th>
                      <th>Uçkun Aktivasyonu</th>
                      <th>Kemirgen Aktivasyonu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MONTHS_FULL.map((m, i) => {
                      const s = new Date(year, i, 1), e = new Date(year, i + 1, 1);
                      const ma = activations.filter(a => inRange(a.when, s, e));
                      const flyIds = new Set([...grps.indoor_fly, ...grps.outdoor_fly].map(st => st.id));
                      const rodIds = new Set([...grps.toxic, ...grps.nontoxic].map(st => st.id));
                      const uckunAkt = ma.filter(a => flyIds.has(a.stationId)).length;
                      const kemirgenAkt = ma.filter(a => rodIds.has(a.stationId)).length;
                      const isInsekt = c => { const t = (c.pestType || "").toLowerCase(); return t.includes("ucun") || t.includes("fly") || t.includes("yuruy"); };
                      const isRodent = c => { const t = (c.pestType || "").toLowerCase(); return t.includes("kemirgen") || t.includes("rodent"); };
                      const mc = chemicals.filter(c => inRange(c.applicationDate || c.date || c.createdAt, s, e));
                      const insektisit = mc.filter(isInsekt).reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
                      const rodentisit = mc.filter(isRodent).reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
                      return (
                        <tr key={m}>
                          <td><strong>{m}</strong></td>
                          <td>{insektisit || 0}</td>
                          <td>{rodentisit || 0}</td>
                          <td>{ma.length || 0}</td>
                          <td>{uckunAkt || 0}</td>
                          <td>{kemirgenAkt || 0}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ════ YILLIK KİMYASAL GRAFİK ════ */}
              <div className="tpdf-card">
                <h2 className="tpdf-card__h2">5. Yıllık Kimyasal Kullanım Grafiği</h2>
                {RC && (
                  <RC.ResponsiveContainer width="100%" height={250}>
                    <RC.LineChart data={annualChemData}>
                      <RC.CartesianGrid strokeDasharray="3 3" />
                      <RC.XAxis dataKey="label" />
                      <RC.YAxis />
                      <RC.Tooltip /><RC.Legend />
                      <RC.Line isAnimationActive={false} type="monotone" dataKey="İnsektisit (ml)"
                        stroke={BLUE} strokeWidth={2} dot={{ r: 3, fill: BLUE }} />
                      <RC.Line isAnimationActive={false} type="monotone" dataKey="Rodentisit (g)"
                        stroke={RED} strokeWidth={2} dot={{ r: 3, fill: RED }} />
                    </RC.LineChart>
                  </RC.ResponsiveContainer>
                )}
              </div>

            </div>{/* /tpdf-body */}

            {/* ════ ALT AKSİYONLAR ════ */}
            <div className="tpdf-actions print-hide">
              <button className="btn ghost" onClick={() => setShowPicker(true)}>Tarih Değiştir</button>
              <button className="btn" onClick={() => window.print()}>Yazdır / PDF İndir</button>
              <Link className="btn primary" to={`/customer/stores/${storeId}`}>Mağazaya Dön</Link>
            </div>

          </>
        )}
      </div>
    </Layout>
  );
}