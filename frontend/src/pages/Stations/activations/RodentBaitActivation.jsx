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

export default function RodentBaitActivation() {
  const { visitId, stationId, storeId } = useParams();
  const navigate = useNavigate();

  const [station, setStation] = useState(null);
  const [groupStations, setGroupStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    let m = true;
    setLoading(true);
    // Her istasyon değişiminde formu sıfırla ki bir önceki istasyonun verileri kalmasın
    setForm(INITIAL_FORM);

    api.get(`/stations/${stationId}`)
      .then(r => {
        if (!m) return;
        setStation(r.data);
        // If part of a group, fetch sibling stations
        if (r.data.groupId) {
          api.get(`/stations/groupId/${r.data.groupId}`)
            .then(gr => m && setGroupStations(gr.data))
            .catch(e => console.error("Grup istasyonları alınamadı", e));
        } else {
          setGroupStations([]);
        }
      })
      .catch(e => { console.error(e); toast.error("İstasyon alınamadı"); })
      .finally(() => m && setLoading(false));
    return () => (m = false);
  }, [stationId]);

  const title = useMemo(
    () => (station ? `tura | Fare Yemleme | ${station.name}` : "Yükleniyor…"),
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

  const [selectedSubCode, setSelectedSubCode] = useState("");

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
        subCode: selectedSubCode // Optional: record which sub-unit if needed
      };

      await api.post(url, payload);
      toast.success("Aktivasyon kaydı başarıyla oluşturuldu.");
      navigate(-1);
    } catch (e) {
      console.error(e);
      toast.error("Kayıt başarısız");
    } finally {
      setSaving(false);
    }
  };

  const switchStation = (id) => {
    // URL'yi güncelleyerek useEffect'in tetiklenmesini sağla
    const baseUrl = visitId 
      ? `/admin/stores/${storeId}/visits/${visitId}/stations/${id}/activation/rodent-bait`
      : `/admin/stores/${storeId}/stations/${id}/activation/rodent-bait`;
    navigate(baseUrl);
  };

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

          {station?.isGroup && (
            <div className="group-selection">
              <div className="group-title">
                <span className="icon">📂</span>
                Grup İçi Ünite Seçimi
              </div>
              <div className="sub-station-selector">
                <select 
                  className="select" 
                  value={selectedSubCode} 
                  onChange={e => setSelectedSubCode(e.target.value)}
                >
                  {groupUnitCodes.map(code => (
                    <option key={code} value={code}>{code}</option>
                  ))}
                </select>
                <small className="help-text">Gruptaki hangi ünite için işlem yapıldığını seçin.</small>
              </div>
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
                    {station?.isGroup ? (
                      <input 
                        className="input" 
                        type="number" 
                        min={0} 
                        max={station.totalCount} 
                        value={form[key]} 
                        onChange={e => set(key, Number(e.target.value || 0))} 
                      />
                    ) : (
                      <label className="switch">
                        <input type="checkbox" checked={!!form[key]} onChange={e => set(key, e.target.checked ? 1 : 0)} />
                        <span className="slider" />
                      </label>
                    )}
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
