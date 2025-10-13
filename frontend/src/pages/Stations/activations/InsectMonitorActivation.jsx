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

export default function InsectMonitorActivation() {
  const { visitId, stationId } = useParams();
  const navigate = useNavigate();

  const [station, setStation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    aktiviteVar: false,
    monitorDegisti: false,
    hedefZararliSayisi: 0,
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

  const title = useMemo(
    () => (station ? `tura | Böcek Monitörü | ${station.name}` : "Yükleniyor…"),
    [station]
  );

  const save = async () => {
    try {
      setSaving(true);
      const url = visitId
        ? `/activations/visits/${visitId}/stations/${stationId}`
        : `/activations/stations/${stationId}`;
      await api.post(url, { type: "BOCEK_MONITOR", ...form });
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

          {station && station.type !== "BOCEK_MONITOR" && (
            <div className="warn">Uyarı: Bu sayfa Böcek Monitörü tipine özeldir (mevcut: <b>{station.type}</b>).</div>
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
                  ["Aktivite Var mı ?", "aktiviteVar"],
                  ["Monitör Değişti mi ?", "monitorDegisti"],
                ].map(([lbl, key]) => (
                  <div key={key} className="field">
                    <div className="label">{lbl}</div>
                    <label className="switch">
                      <input type="checkbox" checked={!!form[key]} onChange={e=>set(key, e.target.checked)} />
                      <span className="slider" />
                    </label>
                  </div>
                ))}

                <div className="field">
                  <div className="label">Hedef Zararlı Sayısı *</div>
                  <input className="input" type="number" min={0} value={form.hedefZararliSayisi}
                         onChange={e=>set("hedefZararliSayisi", Number(e.target.value||0))} />
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
