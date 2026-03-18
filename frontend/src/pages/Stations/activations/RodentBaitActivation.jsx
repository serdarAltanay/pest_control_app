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
  const [groupStations, setGroupStations] = useState([]);
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
      .then(r => {
        if (!m) return;
        setStation(r.data);
        if (r.data.groupId) {
          api.get(`/stations/groupId/${r.data.groupId}`)
            .then(gr => {
              if (!m) return;
              const siblings = Array.isArray(gr.data) ? gr.data : [];
              setGroupStations(siblings);
              // Her istasyonun aktivasyon durumunu kontrol et
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

  // Gruptaki istasyonların aktivasyon durumunu kontrol et
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
    () => (station ? `Fare Yemleme İstasyonu | ${station.name}` : "Yükleniyor…"),
    [station]
  );

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
      };

      await api.post(url, payload);
      toast.success("Aktivasyon kaydı başarıyla oluşturuldu.");
      // Grup durumunu güncelle
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
      ? `/admin/stores/${storeId}/visits/${visitId}/stations/${id}/activation/rodent-bait`
      : `/admin/stores/${storeId}/stations/${id}/activation/rodent-bait`;
    navigate(baseUrl);
  };

  // Aktivasyon girilmemiş istasyonlara otomatik "aktivasyon yok" gir
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

          {station && station.type !== "FARE_YEMLEME" && (
            <div className="warn">Uyarı: Bu sayfa Fare Yemleme tipine özeldir (mevcut: <b>{station.type}</b>).</div>
          )}

          {/* Grup istasyon navigasyonu */}
          {groupStations.length > 1 && (
            <div className="group-navigation">
              <div className="group-nav-header">
                <span className="icon">📂</span>
                Grup İstasyonları
                <span className="group-progress">({filledCount}/{activeCount} tamamlandı)</span>
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
            <div className="subtitle">
              Dikkat: <b>{station?.name}</b> isimli istasyonu için işlem yapıyorsunuz.
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
