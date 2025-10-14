import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./StoreNonconformities.scss";

const CATS = [
  "Hijyen Eksikliği",
  "Yalıtım Eksikliği",
  "Depolama Eksikliği",
  "Diğer",
];

export default function StoreNonconformities() {
  const { storeId } = useParams();
  const navigate = useNavigate();

  const [list, setList] = useState([]);
  const [togglingId, setTogglingId] = useState(null);
  const [form, setForm] = useState({
    category: "",
    title: "",
    notes: "",
    observedAt: new Date().toISOString().slice(0, 10),
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get(`/nonconformities/store/${storeId}`);
      setList(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Uygunsuzluklar alınamadı");
    }
  };
  // Tarih/saat formatlayıcı
  const fmt = (d, withTime = true) => {
    if (!d) return "—";
    const dt = (d instanceof Date) ? d : new Date(d);
    try {
      return withTime ? dt.toLocaleString("tr-TR") : dt.toLocaleDateString("tr-TR");
    } catch {
      return String(d);
    }
  };


  useEffect(() => {
    load();
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  // Drag & Drop (sadece görsel)
  const acceptTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
  const pickFile = (f) => {
    if (!f) return;
    if (!acceptTypes.includes(f.type)) {
      toast.error("Sadece png / jpg / jpeg / webp yükleyebilirsiniz");
      return;
    }
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return url;
    });
  };

  const onInputFile = (e) => pickFile(e.target.files?.[0]);
  const onDrop = (e) => {
    e.preventDefault();
    pickFile(e.dataTransfer.files?.[0]);
  };

  const clearFile = (e) => {
    e.stopPropagation();
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  };

  const submit = async () => {
    if (!form.category) return toast.error("Kategori seçin");

    const fd = new FormData();
    fd.append("category", form.category);          // ✅ eksikti
    fd.append("observedAt", form.observedAt);      // olay tarihi
    if (form.title) fd.append("title", form.title);
    if (form.notes) fd.append("notes", form.notes);
    if (file) fd.append("image", file);            // sadece görsel

    try {
      setSaving(true);
      await api.post(`/nonconformities/store/${storeId}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Uygunsuzluk oluşturuldu");
      setForm({
        category: "",
        title: "",
        notes: "",
        observedAt: new Date().toISOString().slice(0, 10),
      });
      clearFile(new Event("noop"));
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.error || "Kayıt başarısız");
    } finally {
      setSaving(false);
    }
  };

 const toggleResolved = async (id) => {
   try {
     setTogglingId(id);
     const { data } = await api.patch(`/nonconformities/${id}/toggle`);
     setList((arr) => arr.map((x) => (x.id === id ? data : x)));
   } catch {
     toast.error("Durum güncellenemedi");
   } finally {
     setTogglingId(null);
   }
};

  const del = async (id) => {
    if (!window.confirm("Silinsin mi?")) return;
    const prev = list;
    setList((arr) => arr.filter((x) => x.id !== id));
    try {
      await api.delete(`/nonconformities/${id}`);
      toast.success("Silindi");
    } catch {
      setList(prev);
      toast.error("Silinemedi");
    }
  };

  const fmtDT = (d) => (d ? new Date(d).toLocaleString("tr-TR") : "—");
  const fmtD = (d) => (d ? new Date(d).toLocaleDateString("tr-TR") : "—");

  return (
    <Layout title="Uygunsuzluklar">
      <div className="ncr-page">
        <section className="card">
          <div className="card-title">Uygunsuzluk Kaydet</div>

          <div className="form-grid">
            <div className="field">
              <label>Kategori *</label>
              <select
                value={form.category}
                onChange={(e) => setForm((s) => ({ ...s, category: e.target.value }))}
              >
                <option value="">Seçiniz…</option>
                {CATS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Tarih</label>
              <input
                type="date"
                value={form.observedAt}
                onChange={(e) => setForm((s) => ({ ...s, observedAt: e.target.value }))}
              />
            </div>

            <div className="field">
              <label>Başlık</label>
              <input
                type="text"
                placeholder="Uygunsuzluk başlığı"
                value={form.title}
                onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
              />
            </div>

            <div className="field full">
              <label>Notlar</label>
              <textarea
                rows={4}
                value={form.notes}
                onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
              />
            </div>

            <div className="field full">
              <label>Görsel (sürükle-bırak / sadece görsel)</label>
              <div
                className="dropzone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                onClick={() => document.getElementById("ncr-file").click()}
              >
                {preview ? (
                  <>
                    <img src={preview} alt="preview" />
                    <button className="clear" onClick={clearFile} title="Görseli kaldır">
                      ✕
                    </button>
                  </>
                ) : (
                  <span>Görseli buraya sürükleyin ya da tıklayın</span>
                )}
                <input
                  id="ncr-file"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={onInputFile}
                  hidden
                />
              </div>
            </div>

            <div className="actions full">
              <button className="btn primary" disabled={saving} onClick={submit}>
                {saving ? "Kaydediliyor…" : "Uygunsuzluk Oluştur"}
              </button>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-title">Kayıtlı Uygunsuzluklar</div>

          {list.length === 0 ? (
            <div className="empty">Henüz kayıt yok.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Tarih (Olay)</th>
                  <th>Yüklendi</th>
                  <th>Kategori</th>
                  <th>Başlık</th>
                  <th>Açıklama</th>
                  <th>Görsel</th>
                  <th>Durum</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {list.map((r, i) => {
                  const to = `/admin/stores/${storeId}/nonconformities/${r.id}`;
                  return (
                    <tr
                      key={r.id}
                      className="row-link"
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(to)}
                      onKeyDown={(e) => { if (e.key === "Enter") navigate(to); }}
                      title="Detayı aç"
                    >
                      <td>{i + 1}</td>
                      <td>{fmtD(r.observedAt)}</td>   {/* olay tarihi */}
                      <td>{fmtDT(r.createdAt)}</td>   {/* yüklenme zamanı */}
                      <td>{r.category}</td>
                      <td>{r.title || "—"}</td>
                      <td className="notes">{r.notes || "—"}</td>

                      {/* Görsel/Detay hücresi: link yerine düz metin (satır zaten tıklanabilir) */}
                      <td>
                        <span className="link-like">{r.image ? "Görsel / Detay" : "Detay"}</span>
                      </td>

                      <td>
                        <span className={`badge ${r.resolved ? "ok" : "no"}`}>
                          {r.resolved ? "Çözüldü" : "Çözülmedi"}
                        </span>
                        {r.resolved && r.resolvedAt ? (
                          <div className="muted small">{fmt(r.resolvedAt)}</div>
                        ) : null}
                      </td>

                      <td className="row-actions">
                        <button
                          className="btn warn"
                          disabled={togglingId === r.id}
                          onClick={(e) => { e.stopPropagation(); toggleResolved(r.id); }}
                        >
                          {togglingId === r.id ? "Güncelleniyor…" : (r.resolved ? "Geri Al" : "Çözüldü")}
                        </button>
                        <button
                          className="btn danger"
                          onClick={(e) => { e.stopPropagation(); del(r.id); }}
                        >
                          Sil
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

            </table>
          )}
        </section>
      </div>
    </Layout>
  );
}
