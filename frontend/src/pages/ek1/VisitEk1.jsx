import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./Ek1.scss";

const METHOD_OPTIONS = [
  { value: "PULVERIZE", label: "Pulverize" },
  { value: "ULV", label: "ULV" },
  { value: "ATOMIZER", label: "Atomizer" },
  { value: "SISLEME", label: "Sisleme" },
  { value: "YEMLEME", label: "Yemleme" },
  { value: "YENILEME", label: "Yenileme" },
];

const METHOD_TR = {
  PULVERIZE: "Pulverize", ULV: "ULV", ATOMIZER: "Atomizer",
  SISLEME: "Sisleme", YEMLEME: "Yemleme", YENILEME: "Yenileme",
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
      const [resB, resL] = await Promise.all([
        api.get("/biocides"),
        api.get(`/ek1/visit/${visitId}/lines`),
      ]);
      setBiocides(Array.isArray(resB.data) ? resB.data : []);
      setLines(Array.isArray(resL.data) ? resL.data : []);
    } catch {
      toast.error("Veriler yüklenemedi.");
    }
  };

  useEffect(() => { loadAll(); }, [visitId]);

  /* Ürün Ekle */
  const addLine = async (e) => {
    e.preventDefault();
    if (!form.biosidalId) return toast.error("Ürün seçiniz.");
    if (!form.amount) return toast.error("Miktar giriniz.");
    setSaving(true);
    try {
      await api.post(`/ek1/visit/${visitId}/lines`, {
        ...form,
        biosidalId: Number(form.biosidalId),
        amount: Number(form.amount),
      });
      await loadAll();
      setForm({ biosidalId: "", method: "PULVERIZE", amount: "" });
      toast.success("Ürün eklendi.");
    } finally {
      setSaving(false);
    }
  };

  /* Ürün Sil */
  const removeLine = async (lineId) => {
    try {
      await api.delete(`/ek1/visit/${visitId}/lines/${lineId}`);
      setLines((prev) => prev.filter((l) => l.id !== lineId));
      toast.success("Ürün silindi.");
    } catch {
      toast.error("Silme başarısız.");
    }
  };

  /* Direkt Kaydet */
  const handleSubmitWithSignature = () => {
    if (lines.length === 0) return toast.error("Önce en az bir ürün eklemelisiniz.");
    onConfirmFinalSubmission();
  };

  /* Kaydet → Preview'a Yönlendir */
  const onConfirmFinalSubmission = async () => {
    setSubmitting(true);

    try {
      /* Onaya gönder */
      await api.post(`/ek1/visit/${visitId}/submit`);

      toast.success("Belge kaydedildi. Önizleme açılıyor…");
      navigate(`/admin/stores/${storeId}/visits/${visitId}/preview`);
    } catch {
      toast.error("Kayıt işlemi başarısız.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="ek1flow-page">
        <div className="page-header">
          <h1>EK-1 <span className="page-header-badge">Ürün Düzenleme</span></h1>
          <div className="header-actions">
            <Link className="btn ghost" to={`/admin/stores/${storeId}/visits/${visitId}/preview`}>
              Önizleme
            </Link>
          </div>
        </div>

        {/* Ürün Ekleme Formu */}
        <section className="card">
          <div className="card-title">
            <span className="card-num">1</span> Kullanılan Biyosidal Ürünler
          </div>
          <form onSubmit={addLine} className="line-form">
            <select
              value={form.biosidalId}
              onChange={(e) => setForm({ ...form, biosidalId: e.target.value })}
              required
            >
              <option value="">Ürün Seçiniz…</option>
              {biocides.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <select
              value={form.method}
              onChange={(e) => setForm({ ...form, method: e.target.value })}
            >
              {METHOD_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <input
              type="number"
              placeholder="Miktar"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
            />
            <button type="submit" className="btn primary" disabled={saving}>
              {saving ? "Ekleniyor…" : "+ Ürün Ekle"}
            </button>
          </form>

          {/* Ürün Listesi */}
          {lines.length === 0 ? (
            <div className="empty-state">
              <span></span>
              <p>Henüz ürün eklenmedi. Ürün ekleyerek başlayın.</p>
            </div>
          ) : (
            <table className="line-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Ürün Adı</th>
                  <th>Aktif Madde</th>
                  <th>Yöntem</th>
                  <th>Miktar</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={l.id}>
                    <td>{i + 1}</td>
                    <td>{l.biosidal?.name || "—"}</td>
                    <td>{l.biosidal?.activeIngredient || "—"}</td>
                    <td>{METHOD_TR[l.method] || l.method || "—"}</td>
                    <td>{l.amount} {l.biosidal?.unit || ""}</td>
                    <td>
                      <button
                        className="btn-icon btn-danger"
                        onClick={() => removeLine(l.id)}
                        title="Sil"
                      >X</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Final Butonu */}
        <div className="final-actions">
          <button
            className="btn primary xl"
            onClick={handleSubmitWithSignature}
            disabled={submitting || lines.length === 0}
          >
            {submitting ? "İŞLENİYOR…" : "KAYDET VE ÖNİZLE"}
          </button>
          {lines.length === 0 && (
            <div className="muted warn-text">Önce en az bir ürün ekleyin.</div>
          )}
          {lines.length > 0 && (
            <div className="muted">
              Kayıt sonrası önizlemede müşteri/personel imzası alınabilir.
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}