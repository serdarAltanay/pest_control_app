import { useEffect, useState, useMemo } from "react";
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

export default function RodentBaitActivation() {
  const { visitId, stationId } = useParams();
  const navigate = useNavigate();

  const [station, setStation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    aktiviteVar: false,
    deformeYem: false,
    yemDegisti: false,
    deformeMonitor: false,
    monitorDegisti: false,
    ulasilamayanMonitor: false,
    risk: "RISK_YOK",
  });

  const set = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    let m = true;
    api.get(`/stations/${stationId}`)
      .then(r => m && setStation(r.data))
      .catch(e => { console.error(e); toast.error("İstasyon alınamadı"); })
      .finally(() => m && setLoading(false));
    return () => (m = false);
  }, [stationId]);

  const title = useMemo(() => {
    if (!station) return "Yükleniyor…";
    return `tura | Fare Yemleme İstasyonu | ${station.name}`;
  }, [station]);

  const save = async () => {
    try {
      setSaving(true);
      const url = visitId
        ? `/activations/visits/${visitId}/stations/${stationId}`
        : `/activations/stations/${stationId}`;
      await api.post(url, { type: "FARE_YEMLEME", ...form });
      toast.success("Kaydedildi");
      navigate(-1);
    } catch (e) {
      console.error(e);
      toast.error("Kayıt başarısız");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout title={title}>
      <div className="ActivationPage">
        <div className="activation-card">
          <div className="activation-header">
            <button className="btn-close" onClick={() => navigate(-1)}>Bu Pencereyi Kapat</button>
          </div>

          {station && station.type !== "FARE_YEMLEME" && (
            <div className="warn">Uyarı: Bu sayfa Fare Yemleme tipine özeldir, istasyon tipi: <b>{station.type}</b>.</div>
          )}

          <div className="activation-title">
            <div className="name">{station?.name} <span className="sep">|</span> {station?.code}</div>
            <div className="subtitle">Dikkat: <b>{station?.name}</b> isimli istasyonu için işlem yapıyorsunuz.</div>
          </div>

          {loading && <div className="skeleton">Yükleniyor…</div>}

          {!loading && (
            <>
              <div className="activation-grid">
                <div className="field">
                  <div className="label">Aktivite Var mı ?</div>
                  <label className="switch">
                    <input type="checkbox" checked={form.aktiviteVar} onChange={e=>set("aktiviteVar", e.target.checked)} />
                    <span className="slider" />
                  </label>
                </div>

                <div className="field">
                  <div className="label">Deforme Yem</div>
                  <label className="switch">
                    <input type="checkbox" checked={form.deformeYem} onChange={e=>set("deformeYem", e.target.checked)} />
                    <span className="slider" />
                  </label>
                </div>

                <div className="field">
                  <div className="label">Yem Değişti mi ?</div>
                  <label className="switch">
                    <input type="checkbox" checked={form.yemDegisti} onChange={e=>set("yemDegisti", e.target.checked)} />
                    <span className="slider" />
                  </label>
                </div>

                <div className="field">
                  <div className="label">Monitör Deforme mi ?</div>
                  <label className="switch">
                    <input type="checkbox" checked={form.deformeMonitor} onChange={e=>set("deformeMonitor", e.target.checked)} />
                    <span className="slider" />
                  </label>
                </div>

                <div className="field">
                  <div className="label">Monitör Değişti mi ?</div>
                  <label className="switch">
                    <input type="checkbox" checked={form.monitorDegisti} onChange={e=>set("monitorDegisti", e.target.checked)} />
                    <span className="slider" />
                  </label>
                </div>

                <div className="field">
                  <div className="label">Ulaşılamayan Monitör</div>
                  <label className="switch">
                    <input type="checkbox" checked={form.ulasilamayanMonitor} onChange={e=>set("ulasilamayanMonitor", e.target.checked)} />
                    <span className="slider" />
                  </label>
                </div>

                <div className="field">
                  <div className="label">Risk Değeri</div>
                  <select className="select" value={form.risk} onChange={e=>set("risk", e.target.value)}>
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
