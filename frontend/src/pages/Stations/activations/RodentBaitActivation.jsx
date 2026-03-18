import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../../../components/Layout";
import api from "../../../api/axios";
import { toast } from "react-toastify";
import "./activations.scss";

const RISK = [
  { value: "RISK_YOK", label: "RİSK YOK" },
  { value: "DUSUK", label: "DÜŞÜK" },
  { value: "ORTA", label: "ORTA" },
  { value: "YUKSEK", label: "YÜKSEK" },
];

const INITIAL_FORM = {
  yemDurumu: "YOK",
  yemTaze: 0,
  yemTuketim: 0,
  deformeYem: 0,
  yemDegisti: 0,
  risk: "RISK_YOK",
};

// Aktivasyon yok değerleri — otomatik doldurma için
const NO_ACTIVITY_PAYLOAD = {
  type: "FARE_YEMLEME",
  yemDurumu: "YOK",
  yemTaze: 0,
  yemTuketim: 0,
  deformeYem: 0,
  yemDegisti: 0,
  risk: "RISK_YOK",
  aktiviteVar: 0,
};

export default function RodentBaitActivation() {
  const { visitId, stationId, storeId } = useParams();
  const navigate = useNavigate();

  const [station, setStation] = useState(null);
  const [selectedSubCode, setSelectedSubCode] = useState("");
  const [groupActivationStatus, setGroupActivationStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fillingRemaining, setFillingRemaining] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  // İstasyon ve grup bilgisi yükle
  useEffect(() => {
    let m = true;
    setLoading(true);
    setForm(INITIAL_FORM);

    api.get(`/stations/${stationId}`)
      .then(async r => {
        if (!m) return;
        setStation(r.data);
        
        if (r.data.isGroup && r.data.totalCount) {
          try {
            const url = visitId 
              ? `/activations/visits/${visitId}/stations/${stationId}?limit=500`
              : `/activations/stations/${stationId}?limit=500`;
            const actRes = await api.get(url);
            const items = Array.isArray(actRes.data?.items) ? actRes.data.items : [];
            
            // Eğer visitId yoksa, sadece bugünün aktivasyonlarına bak
            let relevantItems = items;
            if (!visitId) {
                const today = new Date().toDateString();
                relevantItems = items.filter(a => new Date(a.createdAt).toDateString() === today);
            }
            
            const statusMap = {};
            relevantItems.forEach(a => {
              if (a.subCode) statusMap[a.subCode] = true;
            });
            if (m) setGroupActivationStatus(statusMap);
          } catch (e) {
            console.error("Aktivasyon durumları alınamadı", e);
          }
        }
      })
      .catch(e => { console.error(e); toast.error("İstasyon alınamadı"); })
      .finally(() => m && setLoading(false));
    return () => (m = false);
  }, [stationId, visitId]);

  const title = useMemo(
    () => (station ? `Fare Yemleme İstasyonu | ${station.name}` : "Yükleniyor…"),
    [station]
  );

  const groupUnitCodes = useMemo(() => {
    if (!station || !station.isGroup || !station.totalCount) return [];
    const codes = [];
    const baseCode = station.code || "ST";
    const prefixMatch = baseCode.match(/^(.*?)(\d+)$/);
    if (prefixMatch) {
      const prefix = prefixMatch[1];
      const startNum = parseInt(prefixMatch[2], 10);
      for (let i = 0; i < station.totalCount; i++) {
        const num = startNum + i;
        const suffix = String(num).padStart(prefixMatch[2].length, '0');
        codes.push(`${prefix}${suffix}`);
      }
    } else {
      for (let i = 1; i <= station.totalCount; i++) {
        codes.push(`${baseCode}-${String(i).padStart(3, '0')}`);
      }
    }
    return codes;
  }, [station]);

  useEffect(() => {
    if (groupUnitCodes.length > 0 && !selectedSubCode) {
      setSelectedSubCode(groupUnitCodes[0]);
    }
  }, [groupUnitCodes, selectedSubCode]);

  const save = async () => {
    try {
      setSaving(true);
      const url = visitId
        ? `/activations/visits/${visitId}/stations/${stationId}`
        : `/activations/stations/${stationId}`;
      
      const payload = { 
        type: "FARE_YEMLEME", 
        ...form,
        aktiviteVar: Number(form.yemTuketim) || 0,
        subCode: station?.isGroup ? selectedSubCode : undefined,
      };

      await api.post(url, payload);
      
      if (station?.isGroup) {
        setGroupActivationStatus(prev => ({ ...prev, [selectedSubCode]: true }));
        toast.success(`${selectedSubCode} aktivasyon kaydı başarıyla oluşturuldu.`);
        
        // Bir sonraki doldurulmamış istasyona geç
        const nextPending = groupUnitCodes.find(c => c !== selectedSubCode && !groupActivationStatus[c]);
        if (nextPending) {
          switchStation(nextPending);
        } else {
          toast.info("Gruptaki tüm istasyonlar tamamlandı.");
        }
      } else {
        toast.success("Aktivasyon kaydı başarıyla oluşturuldu.");
        navigate(-1);
      }
    } catch (e) {
      console.error(e);
      toast.error("Kayıt başarısız");
    } finally {
      setSaving(false);
    }
  };

  const switchStation = (code) => {
    setSelectedSubCode(code);
    setForm(INITIAL_FORM); // Her geçişte formu sıfırla
  };

  // Aktivasyon girilmemiş istasyonlara otomatik "aktivasyon yok" gir
  const fillRemainingNoActivity = async () => {
    const remaining = groupUnitCodes.filter(c => !groupActivationStatus[c]);
    if (remaining.length === 0) {
      toast.info("Tüm istasyonlara zaten aktivasyon girilmiş.");
      return;
    }
    if (!window.confirm(`${remaining.length} istasyona "Aktivasyon Yok" kaydı girilecek. Devam?`)) return;

    setFillingRemaining(true);
    let success = 0;
    let fail = 0;
    for (const code of remaining) {
      try {
        const url = visitId
          ? `/activations/visits/${visitId}/stations/${stationId}`
          : `/activations/stations/${stationId}`;
        await api.post(url, { ...NO_ACTIVITY_PAYLOAD, subCode: code });
        success++;
        setGroupActivationStatus(prev => ({ ...prev, [code]: true }));
      } catch {
        fail++;
      }
    }
    setFillingRemaining(false);
    if (success > 0) toast.success(`${success} istasyona "Aktivasyon Yok" girildi.`);
    if (fail > 0) toast.error(`${fail} istasyonda hata oluştu.`);
  };

  const filledCount = groupUnitCodes.filter(c => groupActivationStatus[c]).length;
  const activeCount = groupUnitCodes.length;

  return (
    <Layout title={title}>
      <div className="ActivationPage">
        <div className="activation-card">
          <div className="activation-header">
            <button className="btn-close" onClick={() => navigate(-1)}>Bu Pencereyi Kapat</button>
          </div>

          {station && station.type !== "FARE_YEMLEME" && (
            <div className="warn">Uyarı: Bu sayfa Fare Yemleme tipine özeldir (mevcut: <b>{station.type}</b>).</div>
          )}

          {/* Grup istasyon navigasyonu */}
          {station?.isGroup && groupUnitCodes.length > 0 && (
            <div className="group-navigation">
              <div className="group-nav-header">
                <span className="icon">📂</span>
                Grup İstasyonları (Alt Üniteler)
                <span className="group-progress">({filledCount}/{activeCount} tamamlandı)</span>
              </div>
              <div className="group-dropdown">
                <select 
                  className="select" 
                  value={selectedSubCode} 
                  onChange={e => switchStation(e.target.value)}
                >
                  {groupUnitCodes.map(code => (
                    <option key={code} value={code}>
                      {code} {groupActivationStatus[code] ? "✓" : ""}
                    </option>
                  ))}
                </select>
                <small className="help-text">Gruptaki diğer ünitelere geçiş yapabilirsiniz.</small>
              </div>
              <div className="group-station-list">
                {groupUnitCodes.map(code => (
                  <button
                    key={code}
                    className={`group-station-btn ${code === selectedSubCode ? "active" : ""} ${groupActivationStatus[code] ? "done" : ""}`}
                    onClick={() => switchStation(code)}
                    title={groupActivationStatus[code] ? "Aktivasyon girildi ✓" : "Henüz aktivasyon girilmedi"}
                  >
                    <span className="st-name">{code}</span>
                    <span className={`st-status ${groupActivationStatus[code] ? "ok" : "pending"}`}>
                      {groupActivationStatus[code] ? "✓" : "○"}
                    </span>
                  </button>
                ))}
              </div>
              {activeCount > filledCount && (
                <button 
                  className="btn-fill-remaining" 
                  disabled={fillingRemaining}
                  onClick={fillRemainingNoActivity}
                >
                  {fillingRemaining ? "İşleniyor…" : `Geri Kalanlara "Aktivasyon Yok" Gir (${activeCount - filledCount} adet)`}
                </button>
              )}
            </div>
          )}

          <div className="activation-title">
            <div className="name">
              {station?.name} 
              <span className="sep">|</span> 
              {station?.isGroup ? selectedSubCode : station?.code}
            </div>
            <div className="subtitle">
              Dikkat: <b>{station?.name}</b> {station?.isGroup ? `(${selectedSubCode})` : ""} isimli istasyonu için işlem yapıyorsunuz.
            </div>
          </div>

          {loading && <div className="skeleton">Yükleniyor…</div>}

          {!loading && (
            <>
              <div className="activation-grid">
                <div className="field">
                  <div className="label">Düzenek Yem Durumu</div>
                  <select className="select" value={form.yemDurumu} onChange={e => set("yemDurumu", e.target.value)}>
                    <option value="YOK">YOK</option>
                    <option value="VAR">VAR</option>
                    <option value="KIRLI">KİRLİ / KÜFLÜ</option>
                    <option value="YENMIS">YENMİŞ</option>
                  </select>
                </div>

                {[
                  ["Yem Taze mi ?", "yemTaze"],
                  ["Yem Tüketimi var mı ?", "yemTuketim"],
                  ["Yem Deforme mi ?", "deformeYem"],
                  ["Yem Değişti mi ?", "yemDegisti"],
                ].map(([lbl, key]) => (
                  <div key={key} className="field">
                    <div className="label">{lbl}</div>
                    <label className="switch">
                      <input type="checkbox" checked={!!form[key]} onChange={e => set(key, e.target.checked ? 1 : 0)} />
                      <span className="slider" />
                    </label>
                  </div>
                ))}

                <div className="field">
                  <div className="label">Risk Değeri</div>
                  <select className="select" value={form.risk} onChange={e => set("risk", e.target.value)}>
                    {RISK.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="savebar">
                <button className="btn-primary" disabled={saving} onClick={save}>
                  {saving ? "Kaydediliyor…" : "Veri Girişini Kaydet"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
