// frontend/src/pages/reports/StoreReports.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import { toAbsoluteUrl } from "../../utils/getAssetUrl";
import "./StoreReports.scss";

export default function StoreReports() {
  const { storeId } = useParams();
  const navigate = useNavigate();

  const [list, setList] = useState([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    title: "",
    notes: "",
    uploadedAt: new Date().toISOString().slice(0,10),
  });
  const [file, setFile] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get(`/reports/store/${storeId}`);
      setList(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Raporlar alınamadı");
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [storeId]);

  const onPick = (f) => setFile(f || null);
  const onFileChange = (e) => onPick(e.target.files?.[0]);

  const submit = async () => {
    if (!form.title) return toast.error("Başlık zorunlu");
    if (!file) return toast.error("Dosya seçin");

    const fd = new FormData();
    fd.append("title", form.title);
    if (form.notes) fd.append("notes", form.notes);
    if (form.uploadedAt) fd.append("uploadedAt", form.uploadedAt);
    fd.append("file", file);

    try {
      setSaving(true);
      await api.post(`/reports/store/${storeId}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Rapor yüklendi");
      setForm({ title: "", notes: "", uploadedAt: new Date().toISOString().slice(0,10) });
      setFile(null);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Yüklenemedi");
    } finally {
      setSaving(false);
    }
  };

  const fmt = (d) => d ? new Date(d).toLocaleString("tr-TR") : "—";

  return (
    <Layout title="Raporlar">
      <div className="reports-page">
        <section className="card">
          <div className="card-title">Yeni Rapor Yükle</div>
          <div className="form-grid">
            <div className="field">
              <label>Başlık *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e)=>setForm(s=>({...s, title:e.target.value}))}
                placeholder="Rapor başlığı"
              />
            </div>

            <div className="field">
              <label>Yüklenme Tarihi</label>
              <input
                type="date"
                value={form.uploadedAt}
                onChange={(e)=>setForm(s=>({...s, uploadedAt:e.target.value}))}
              />
            </div>

            <div className="field full">
              <label>Notlar</label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e)=>setForm(s=>({...s, notes:e.target.value}))}
              />
            </div>

            <div className="field full">
              <label>Dosya (PDF/Office/Görsel)</label>
              <input type="file" onChange={onFileChange} />
              {file && <div className="muted small">Seçilen: {file.name}</div>}
            </div>

            <div className="actions full">
              <button className="btn primary" onClick={submit} disabled={saving}>
                {saving ? "Yükleniyor…" : "Yükle"}
              </button>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-title">Raporlar</div>
          {list.length === 0 ? (
            <div className="empty">Henüz rapor yok.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Başlık</th>
                  <th>Yüklenme</th>
                  <th>Not</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r, i) => (
                  <tr key={r.id}>
                    <td>{i+1}</td>
                    <td className="strong">
                      <Link to={`/admin/stores/${storeId}/reports/${r.id}`}>{r.title}</Link>
                    </td>
                    <td>{fmt(r.uploadedAt)}</td>
                    <td className="notes">{r.notes || "—"}</td>
                    <td className="row-actions">
                      <button className="btn" onClick={()=>navigate(`/admin/stores/${storeId}/reports/${r.id}`)}>
                        Aç
                      </button>
                      <a
                        className="btn ghost"
                        href={toAbsoluteUrl(`api/reports/${r.id}/download`, { forceApi: true })}
                        target="_blank"
                        rel="noreferrer"
                      >
                        İndir
                      </a>
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
