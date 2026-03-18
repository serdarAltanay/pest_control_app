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
  aktiviteVar: 0,
  monitorDegisti: 0,
  hedefZararliSayisi: 0,
  risk: "RISK_YOK",
};

// Aktivasyon yok değerleri — otomatik doldurma için
const NO_ACTIVITY_PAYLOAD = {
  type: "BOCEK_MONITOR",
  aktiviteVar: 0,
  monitorDegisti: 0,
  hedefZararliSayisi: 0,
  risk: "RISK_YOK",
};

export default function InsectMonitorActivation() {
  const { visitId, stationId, storeId } = useParams();
  const navigate = useNavigate();

  const [station, setStation] = useState(null);
  const [groupStations, setGroupStations] = useState([]);
  const [groupActivationStatus, setGroupActivationStatus] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fillingRemaining, setFillingRemaining] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    let m = true;
    setLoading(true);
    setForm(INITIAL_FORM);

    api.get(`/stations/${stationId}`)
      .then(r => {
        if (!m) return;
        setStation(r.data);
        if (r.data.groupId) {
          api.get(`/stations/groupId/${r.data.groupId}`)
            .then(gr => {
              if (!m) return;
              const siblings = Array.isArray(gr.data) ? gr.data : [];
              setGroupStations(siblings);
              checkGroupActivationStatus(siblings);
            })
            .catch(e => console.error("Grup istasyonları alınamadı", e));
        } else {
          setGroupStations([]);
        }
      })
      .catch(e => { console.error(e); toast.error("İstasyon alınamadı"); })
      .finally(() => m && setLoading(false));
    return () => (m = false);
  }, [stationId]);

  const checkGroupActivationStatus = async (stations) => {
    const statusMap = {};
    for (const st of stations) {
      try {
        const { data } = await api.get(`/activations/stations/${st.id}?limit=1&offset=0`);
        const items = Array.isArray(data?.items) ? data.items : [];
        statusMap[st.id] = items.length > 0;
      } catch {
        statusMap[st.id] = false;
      }
    }
    setGroupActivationStatus(statusMap);
  };

  const title = useMemo(
    () => (station ? `Böcek Monitörü | ${station.name}` : "Yükleniyor…"),
    [station]
  );

  const save = async () => {
    try {
      setSaving(true);
      const url = visitId
        ? `/activations/visits/${visitId}/stations/${stationId}`
        : `/activations/stations/${stationId}`;
      const payload = { 
        type: "BOCEK_MONITOR", 
        ...form, 
        aktiviteVar: Number(form.hedefZararliSayisi) || 0,
      };
      await api.post(url, payload);
      toast.success("Aktivasyon kaydı başarıyla oluşturuldu.");
      if (groupStations.length > 0) {
        setGroupActivationStatus(prev => ({ ...prev, [stationId]: true }));
      }
      navigate(-1);
    } catch (e) {
      console.error(e);
      toast.error("Kayıt başarısız");
    } finally {
      setSaving(false);
    }
  };

  const switchStation = (id) => {
    const baseUrl = visitId 
      ? `/admin/stores/${storeId}/visits/${visitId}/stations/${id}/activation/insect-monitor`
      : `/admin/stores/${storeId}/stations/${id}/activation/insect-monitor`;
    navigate(baseUrl);
  };

  const fillRemainingNoActivity = async () => {
    const remaining = groupStations.filter(st => 
      st.isActive && !groupActivationStatus[st.id]
    );
    if (remaining.length === 0) {
      toast.info("Tüm istasyonlara zaten aktivasyon girilmiş.");
      return;
    }
    if (!window.confirm(`${remaining.length} istasyona "Aktivasyon Yok" kaydı girilecek. Devam?`)) return;

    setFillingRemaining(true);
    let success = 0;
    let fail = 0;
    for (const st of remaining) {
      try {
        const url = visitId
          ? `/activations/visits/${visitId}/stations/${st.id}`
          : `/activations/stations/${st.id}`;
        await api.post(url, NO_ACTIVITY_PAYLOAD);
        success++;
        setGroupActivationStatus(prev => ({ ...prev, [st.id]: true }));
      } catch {
        fail++;
      }
    }
    setFillingRemaining(false);
    if (success > 0) toast.success(`${success} istasyona "Aktivasyon Yok" girildi.`);
    if (fail > 0) toast.error(`${fail} istasyonda hata oluştu.`);
  };

  const filledCount = groupStations.filter(st => groupActivationStatus[st.id]).length;
  const activeCount = groupStations.filter(st => st.isActive).length;

  return (
    <Layout title={title}>
      <div className="ActivationPage">
        <div className="activation-card">
          <div className="activation-header">
            <button className="btn-close" onClick={() => navigate(-1)}>Bu Pencereyi Kapat</button>
          </div>

          {station && station.type !== "BOCEK_MONITOR" && (
            <div className="warn">Uyarı: Bu sayfa Böcek Monitörü tipine özeldir (mevcut: <b>{station.type}</b>).</div>
          )}

          {/* Grup istasyon navigasyonu */}
          {groupStations.length > 1 && (
            <div className="group-navigation">
              <div className="group-nav-header">
                <span className="icon">📂</span>
                Grup İstasyonları
                <span className="group-progress">({filledCount}/{activeCount} tamamlandı)</span>
              </div>
              <div className="group-dropdown">
                <select 
                  className="select" 
                  value={stationId} 
                  onChange={e => switchStation(e.target.value)}
                >
                  {groupStations.filter(st => st.isActive).map(st => (
                    <option key={st.id} value={st.id}>
                      {st.name || st.code} {groupActivationStatus[st.id] ? "✓" : ""}
                    </option>
                  ))}
                </select>
                <small className="help-text">Gruptaki diğer istasyonlara geçiş yapabilirsiniz.</small>
              </div>
              <div className="group-station-list">
                {groupStations.filter(st => st.isActive).map(st => (
                  <button
                    key={st.id}
                    className={`group-station-btn ${st.id === Number(stationId) ? "active" : ""} ${groupActivationStatus[st.id] ? "done" : ""}`}
                    onClick={() => switchStation(st.id)}
                    title={groupActivationStatus[st.id] ? "Aktivasyon girildi ✓" : "Henüz aktivasyon girilmedi"}
                  >
                    <span className="st-name">{st.name || st.code}</span>
                    <span className={`st-status ${groupActivationStatus[st.id] ? "ok" : "pending"}`}>
                      {groupActivationStatus[st.id] ? "✓" : "○"}
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
              {station?.code}
            </div>
            <div className="subtitle">Dikkat: <b>{station?.name}</b> isimli istasyonu için işlem yapıyorsunuz.</div>
          </div>

          {loading && <div className="skeleton">Yükleniyor…</div>}

          {!loading && (
            <>
              <div className="activation-grid">
                {[
                  ["Aktivite Var mı ?", "aktiviteVar"],
                  ["Monitör Değişti mi ?", "monitorDegisti"],
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
                  <div className="label">Hedef Zararlı Sayısı *</div>
                  <input className="input" type="number" min={0} value={form.hedefZararliSayisi}
                    onChange={e => set("hedefZararliSayisi", Number(e.target.value || 0))} />
                </div>

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
