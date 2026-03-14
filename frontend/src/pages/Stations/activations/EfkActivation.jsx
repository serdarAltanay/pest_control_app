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
  sariBantDegisim: 0,
  arizaliEFK: 0,
  tamirdeEFK: 0,
  uvLambaDegisim: 0,
  uvLambaAriza: 0,
  ulasilamayanMonitor: 0,
  karasinek: 0,
  sivrisinek: 0,
  diger: 0,
  risk: "RISK_YOK",
};

export default function EFKActivation() {
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
    setForm(INITIAL_FORM);

    api.get(`/stations/${stationId}`)
      .then(r => {
        if (!m) return;
        setStation(r.data);
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
    () => (station ? `tura | Elektrikli Sinek Tutucu | ${station.name}` : "Yükleniyor…"),
    [station]
  );

  const save = async () => {
    try {
      setSaving(true);
      const url = visitId
        ? `/activations/visits/${visitId}/stations/${stationId}`
        : `/activations/stations/${stationId}`;
      await api.post(url, { type: "ELEKTRIKLI_SINEK_TUTUCU", ...form });
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
    const baseUrl = visitId 
      ? `/admin/stores/${storeId}/visits/${visitId}/stations/${id}/activation/efk`
      : `/admin/stores/${storeId}/stations/${id}/activation/efk`;
    navigate(baseUrl);
  };

  return (
    <Layout title={title}>
      <div className="ActivationPage">
        <div className="activation-card">
          <div className="activation-header">
            <button className="btn-close" onClick={() => navigate(-1)}>Bu Pencereyi Kapat</button>
          </div>

          {station && station.type !== "ELEKTRIKLI_SINEK_TUTUCU" && (
            <div className="warn">Uyarı: Bu sayfa EFK tipine özeldir (mevcut: <b>{station.type}</b>).</div>
          )}

          {groupStations.length > 1 && (
            <div className="group-selection">
              <div className="group-title">
                <span className="icon">📂</span>
                İstasyon Grubu Seçimi
              </div>
              <div className="station-list">
                {groupStations.map(s => (
                  <button
                    key={s.id}
                    className={`station-item ${s.id === Number(stationId) ? 'active' : ''}`}
                    onClick={() => switchStation(s.id)}
                  >
                    {s.code}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="activation-title">
            <div className="name">{station?.name} <span className="sep">|</span> {station?.code}</div>
            <div className="subtitle">Dikkat: <b>{station?.name}</b> isimli istasyonu için işlem yapıyorsunuz.</div>
          </div>

          {loading && <div className="skeleton">Yükleniyor…</div>}

          {!loading && (
            <>
              <div className="activation-grid">
                {[
                  ["Sarı Bant Değişimi", "sariBantDegisim"],
                  ["EFK Arızalı mı?", "arizaliEFK"],
                  ["EFK Tamirde mi?", "tamirdeEFK"],
                  ["UV Lamba Değişti mi?", "uvLambaDegisim"],
                  ["UV Lamba Arızalı mı?", "uvLambaAriza"],
                  ["Ulaşılamayan Monitör", "ulasilamayanMonitor"],
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
                  <div className="label">Uçkun Karasinek *</div>
                  <input className="input" type="number" min={0} value={form.karasinek}
                    onChange={e => set("karasinek", Number(e.target.value || 0))} />
                </div>
                <div className="field">
                  <div className="label">Uçkun Sivrisinek *</div>
                  <input className="input" type="number" min={0} value={form.sivrisinek}
                    onChange={e => set("sivrisinek", Number(e.target.value || 0))} />
                </div>
                <div className="field">
                  <div className="label">Uçkun Diğer *</div>
                  <input className="input" type="number" min={0} value={form.diger}
                    onChange={e => set("diger", Number(e.target.value || 0))} />
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
