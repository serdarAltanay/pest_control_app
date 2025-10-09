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

export default function Ek1BiocidesPage() {
  const { storeId, visitId } = useParams();
  const navigate = useNavigate();

  const [biocides, setBiocides] = useState([]);
  const [lines, setLines] = useState([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ biosidalId: "", method: "PULVERIZE", amount: "" });

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/biocides");
        setBiocides(data || []);
      } catch {}
      try {
        const { data } = await api.get(`/visits/${visitId}/ek1/lines`);
        setLines(Array.isArray(data) ? data : []);
      } catch {}
    })();
  }, [visitId]);

  const addLine = async (e) => {
    e.preventDefault();
    if (!form.biosidalId || !form.amount) return toast.error("Ürün ve miktar gerekli.");
    setSaving(true);
    try {
      await api.post(`/visits/${visitId}/ek1/lines`, {
        biosidalId: Number(form.biosidalId),
        method: form.method,
        amount: Number(form.amount),
      });
      const { data } = await api.get(`/visits/${visitId}/ek1/lines`);
      setLines(Array.isArray(data) ? data : []);
      setForm({ biosidalId: "", method: "PULVERIZE", amount: "" });
      toast.success("Eklendi");
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Eklenemedi");
    } finally {
      setSaving(false);
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
                className="btn primary"
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
              <select value={form.biosidalId} onChange={(e)=>setForm(p=>({...p, biosidalId:e.target.value}))} required>
                <option value="">Seçiniz..</option>
                {biocides.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label>Uygulama Şekli *</label>
              <select value={form.method} onChange={(e)=>setForm(p=>({...p, method:e.target.value}))} required>
                {Object.entries(METHOD_TR).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label>Miktar *</label>
              <input value={form.amount} onChange={(e)=>setForm(p=>({...p, amount:e.target.value}))} placeholder="Örn: 100" required />
            </div>
          </div>
          <div className="actions">
            <button className="btn primary" disabled={saving}>{saving ? "Ekleniyor..." : "Biyosidal Ekle"}</button>
          </div>
        </form>

        <section className="card">
          <div className="card-title">Ziyarette Kullanılanlar</div>
          {lines.length === 0 ? (
            <div className="empty">Henüz ürün eklenmedi.</div>
          ) : (
            <table className="table">
              <thead>
                <tr><th>Ürün</th><th>Yöntem</th><th>Miktar</th></tr>
              </thead>
              <tbody>
                {lines.map(l => (
                  <tr key={l.id}>
                    <td>{l.biocide?.name || l.biocideName || l.biosidal?.name || l.biosidalId}</td>
                    <td>{METHOD_TR[l.method] || l.method}</td>
                    <td>{l.amount}</td>
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
