import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./Ek1.scss";

const VISIT_TYPE_TR = {
  PERIYODIK: "Periyodik Ziyaret",
  ACIL_CAGRI: "Acil Çağrı",
  ISTASYON_KURULUM: "İstasyon Kurulum",
  ILK_ZIYARET: "İlk Ziyaret",
};

const PEST_OPTIONS = [
  "Kemirgen","Hamamböceği","Karınca","Uçan Haşere","Pire",
  "Kene","Güve","Örümcek","Akar","Tahtakurusu",
];

export default function Ek1VisitPage() {
  const { storeId } = useParams();
  const navigate = useNavigate();

  const [store, setStore] = useState(null);
  const [visits, setVisits] = useState([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    startTime: "",
    endTime: "",
    visitType: "PERIYODIK",
    targetPests: [],
    notes: "",
    employees: [],
  });

  // 08:00 -> 15:00 arası 15 dk aralıklı slot üret
  const timeOptions = useMemo(() => {
    const start = { h: 8, m: 0 };
    const end = { h: 15, m: 0 };
    const step = 15; // minutes
    const res = [];
    let total = start.h * 60 + start.m;
    const endTotal = end.h * 60 + end.m;
    while (total <= endTotal) {
      const h = Math.floor(total / 60);
      const m = total % 60;
      const HH = String(h).padStart(2, "0");
      const MM = String(m).padStart(2, "0");
      res.push(`${HH}:${MM}`);
      total += step;
    }
    return res;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/stores/${storeId}`);
        setStore(data);
      } catch {}
      try {
       const {data} = await api.get(`/visists/store/${storeId}`);
       setVisits(Array.isArray(data) ? data : []);
      } catch {}
    })();
  }, [storeId]);

  const onChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const togglePest = (label) => {
    setForm((p) => {
      const exists = p.targetPests.includes(label);
      return { ...p, targetPests: exists ? p.targetPests.filter(x => x !== label) : [...p.targetPests, label] };
    });
  };

  const createVisit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        storeId: Number(storeId),
        date: new Date(form.date).toISOString(),
        startTime: form.startTime || null,
        endTime: form.endTime || null,
        visitType: form.visitType,
        targetPests: form.targetPests,
        notes: form.notes || null,
        employees: form.employees,
      };
      const { data } = await api.post("/visits", payload);
      toast.success("Ziyaret oluşturuldu");
      navigate(`/admin/stores/${storeId}/visits/${data.visit.id}/biocides`);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Ziyaret oluşturulamadı");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="ek1-page">
        <div className="page-header">
          <h1>{store?.name || "Mağaza"} – EK-1 / Ziyaret</h1>
          <div className="header-actions">
            <Link className="btn ghost" to={`/admin/stores/${storeId}`}>Mağaza Sayfası</Link>
          </div>
        </div>

        <form className="card form" onSubmit={createVisit}>
          <div className="grid-3">
            <div>
              <label>Tarih *</label>
              <input type="date" name="date" value={form.date} onChange={onChange} required />
            </div>

            {/* GİRİŞ SAATİ (select) */}
            <div>
              <label>Giriş Saati</label>
              <select name="startTime" value={form.startTime} onChange={onChange}>
                <option value="">Seçiniz…</option>
                {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* ÇIKIŞ SAATİ (select) */}
            <div>
              <label>Çıkış Saati</label>
              <select name="endTime" value={form.endTime} onChange={onChange}>
                <option value="">Seçiniz…</option>
                {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="col-span-3">
              <label>Ziyaret Türü *</label>
              <select name="visitType" value={form.visitType} onChange={onChange} required>
                {Object.entries(VISIT_TYPE_TR).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            {/* HEDEF ZARARLILAR */}
            <div className="col-span-3 group">
              <div className="group-title">Hedef Zararlı Türleri</div>
              <div className="pill-grid">
                {PEST_OPTIONS.map((label) => {
                  const on = form.targetPests.includes(label);
                  return (
                    <button
                      key={label}
                      type="button"
                      className={`chk-pill ${on ? "on" : ""}`}
                      onClick={() => togglePest(label)}
                      title={label}
                    >
                      <input type="checkbox" readOnly checked={on} />
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="col-span-3">
              <label>Notlar</label>
              <textarea name="notes" rows={3} value={form.notes} onChange={onChange} />
            </div>
          </div>

          <div className="actions">
            <button className="btn primary" disabled={saving}>
              {saving ? "Kaydediliyor..." : "Ziyaret Oluştur"}
            </button>
          </div>
        </form>

        <section className="card">
          <div className="card-title">Son Ziyaretler</div>
          {visits.length === 0 ? (
            <div className="empty">Kayıt yok.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Saat</th>
                  <th>Tür</th>
                  <th>Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((v) => (
                  <tr key={v.id}>
                    <td>{new Date(v.date).toLocaleDateString("tr-TR")}</td>
                    <td>{v.startTime || "—"} / {v.endTime || "—"}</td>
                    <td>{VISIT_TYPE_TR[v.visitType] || v.visitType}</td>
                    <td>
                      <Link className="btn primary" to={`/admin/stores/${storeId}/visits/${v.id}/biocides`}>
                        Biyosidal Ekle
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </Layout>
  );
}
