// src/pages/ek1/VisitEk1.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./Ek1.scss";

const METHOD_TR = {
  PULVERIZE: "Pulverize",
  ULV: "ULV",
  ATOMIZER: "Atomizer",
  YENILEME: "Yenileme",
  SISLEME: "Sisleme",
  YEMLEME: "Yemleme",
};

export default function VisitEk1() {
  const { storeId, visitId } = useParams();
  const navigate = useNavigate();

  const [biocides, setBiocides] = useState([]);
  const [lines, setLines] = useState([]);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({ biosidalId: "", method: "PULVERIZE", amount: "" });

  const loadAll = async () => {
    try {
      const { data } = await api.get("/biocides");
      setBiocides(Array.isArray(data) ? data : []);
    } catch {}
    try {
  const { data } = await api.get(`/ek1/visit/${visitId}/lines`);
  setLines(Array.isArray(data) ? data : []);
  } catch {
}
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [visitId]);

  const addLine = async (e) => {
    e.preventDefault();
    if (!form.biosidalId || !form.amount) return toast.error("Ürün ve miktar gerekli.");
    setSaving(true);
    try {
      await api.post(`/ek1/visit/${visitId}/ek1/lines`, {
        biosidalId: Number(form.biosidalId),
        method: form.method,
        amount: Number(form.amount),
      });
      await loadAll();
      setForm({ biosidalId: "", method: "PULVERIZE", amount: "" });
      toast.success("Biyosidal eklendi");
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Eklenemedi");
    } finally {
      setSaving(false);
    }
  };

  const removeLine = async (lineId) => {
    if (!window.confirm("Bu satırı silmek istiyor musunuz?")) return;
    try {
      await api.delete(`ek1/visit/${visitId}/ek1/lines/${lineId}`);
      setLines((l) => l.filter((x) => x.id !== lineId));
      toast.success("Silindi");
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Silinemedi");
    }
  };

  const submitForApproval = async () => {
    setSubmitting(true);
    try {
      await api.post(`/visits/${visitId}/ek1/submit`);
      toast.success("Onaya gönderildi");
      navigate(`/admin/stores/${storeId}/visits/${visitId}/preview`);
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Gönderilemedi");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="ek1-page">
        <div className="page-header">
          <h1>EK-1 – Biyosidal Ekle</h1>
          <div className="header-actions">
            <Link className="btn ghost" to={`/admin/stores/${storeId}/ek1`}>Ziyaretler</Link>
            <button
              className="btn"
              onClick={() => navigate(`/admin/stores/${storeId}/visits/${visitId}/preview`)}
            >
              Önizle / PDF
            </button>
          </div>
        </div>

        <form className="card form" onSubmit={addLine}>
          <div className="grid-3">
            <div>
              <label>Biyosidal Ürün *</label>
              <select
                value={form.biosidalId}
                onChange={(e)=>setForm(p=>({...p, biosidalId:e.target.value}))}
                required
              >
                <option value="">Seçiniz..</option>
                {biocides.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label>Uygulama Şekli *</label>
              <select
                value={form.method}
                onChange={(e)=>setForm(p=>({...p, method:e.target.value}))}
                required
              >
                {Object.entries(METHOD_TR).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label>Miktar *</label>
              <input
                value={form.amount}
                onChange={(e)=>setForm(p=>({...p, amount:e.target.value}))}
                placeholder="Örn: 100"
                required
              />
            </div>
          </div>
          <div className="actions">
            <button className="btn primary" disabled={saving}>
              {saving ? "Ekleniyor..." : "Biyosidal Ekle"}
            </button>
            <button
              type="button"
              className="btn warn"
              onClick={submitForApproval}
              disabled={submitting || lines.length === 0}
              title={lines.length === 0 ? "Önce en az bir ürün ekleyin" : "Onaya gönder"}
            >
              {submitting ? "Gönderiliyor..." : "Onaya Gönder"}
            </button>
          </div>
        </form>

        <section className="card">
          <div className="card-title">Ziyarette Kullanılanlar</div>
          {lines.length === 0 ? (
            <div className="empty">Henüz ürün eklenmedi.</div>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Ürün</th><th>Yöntem</th><th>Miktar</th><th>İşlem</th></tr>
              </thead>
              <tbody>
                {lines.map(l => (
                  <tr key={l.id}>
                    <td>{l.biocide?.name || l.biocideName || l.biosidal?.name || l.biosidalId}</td>
                    <td>{METHOD_TR[l.method] || l.method}</td>
                    <td>{l.amount}</td>
                    <td>
                      <button className="btn danger" onClick={() => removeLine(l.id)}>Sil</button>
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
