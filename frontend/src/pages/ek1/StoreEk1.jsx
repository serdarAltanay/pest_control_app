import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./Ek1.scss";

/* ---- Sabitler ---- */
const VISIT_TYPE_TR = {
  PERIYODIK: "Periyodik Ziyaret",
  ACIL_CAGRI: "Acil Çağrı",
  ISTASYON_KURULUM: "İstasyon Kurulum",
  ILK_ZIYARET: "İlk Ziyaret",
};
const METHOD_TR = {
  PULVERIZE: "Pulverize",
  ULV: "ULV",
  ATOMIZER: "Atomizer",
  YENILEME: "Yenileme",
  SISLEME: "Sisleme",
  YEMLEME: "Yemleme",
};
const CATS = ["Hijyen Eksikliği","Yalıtım Eksikliği","Depolama Eksikliği","Diğer"];
const PEST_OPTIONS = ["Kemirgen","Hamamböceği","Karınca","Uçan Haşere","Pire","Kene","Güve","Örümcek","Akar","Tahtakurusu"];
const acceptTypes = ["image/png","image/jpeg","image/jpg","image/webp"];

/* küçük yardımcılar */
const fmtD = (d) => (d ? new Date(d).toLocaleDateString("tr-TR") : "—");

export default function Ek1Flow() {
  const { storeId } = useParams();
  const navigate = useNavigate();

  const [store, setStore] = useState(null);

  /* 1) Ziyaret formu (sadece state; ziyaret henüz yaratılmıyor) */
  const [savingAll, setSavingAll] = useState(false);
  const [formVisit, setFormVisit] = useState({
    date: new Date().toISOString().slice(0, 10),
    startTime: "",
    endTime: "",
    visitType: "PERIYODIK",
    targetPests: [],
    notes: "",
    employees: [],
  });

  /* Saat seçenekleri */
  const timeOptions = useMemo(() => {
    const start = { h: 8, m: 0 }, end = { h: 15, m: 0 }, step = 15, out = [];
    for (let t = start.h * 60 + start.m; t <= end.h * 60 + end.m; t += step) {
      const h = String(Math.floor(t / 60)).padStart(2,"0");
      const m = String(t % 60).padStart(2,"0");
      out.push(`${h}:${m}`);
    }
    return out;
  }, []);

  /* 2) Biyosidal (STAGED) — ziyaret yaratılmadan sadece ön liste */
  const [biocides, setBiocides] = useState([]);
  const [stagedLines, setStagedLines] = useState([]);
  const [lineForm, setLineForm] = useState({ biosidalId: "", method: "PULVERIZE", amount: "" });

  /* 3) Uygunsuzluk (opsiyonel, STAGED) */
  const [ncrToggle, setNcrToggle] = useState(false);
  const [stagedNcrs, setStagedNcrs] = useState([]); // {category,title,notes,observedAt,file}
  const [ncrForm, setNcrForm] = useState({
    category: "",
    title: "",
    notes: "",
    observedAt: new Date().toISOString().slice(0, 10),
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/stores/${storeId}`);
        setStore(data);
      } catch {}
      try {
        const { data } = await api.get(`/biocides`);
        setBiocides(Array.isArray(data) ? data : []);
      } catch {}
    })();
    return () => { if (preview) URL.revokeObjectURL(preview); };
    // eslint-disable-next-line
  }, [storeId]);

  /* --- visit form helpers --- */
  const onVisitChange = (e) => setFormVisit((p) => ({ ...p, [e.target.name]: e.target.value }));
  const togglePest = (label) =>
    setFormVisit((p) => ({
      ...p,
      targetPests: p.targetPests.includes(label)
        ? p.targetPests.filter((x) => x !== label)
        : [...p.targetPests, label],
    }));

  /* --- staged line add/remove --- */
  const addStagedLine = (e) => {
    e.preventDefault();
    if (!lineForm.biosidalId || !lineForm.amount) return toast.error("Ürün ve miktar gerekli.");
    const bio = biocides.find((b) => String(b.id) === String(lineForm.biosidalId));
    setStagedLines((arr) => [...arr, {
      id: crypto.randomUUID(),
      biosidalId: Number(lineForm.biosidalId),
      biosidalName: bio?.name || lineForm.biosidalId,
      method: lineForm.method,
      amount: Number(lineForm.amount),
    }]);
    setLineForm({ biosidalId: "", method: "PULVERIZE", amount: "" });
  };
  const removeStagedLine = (id) =>
    setStagedLines((arr) => arr.filter((x) => x.id !== id));

  /* --- NCR upload helpers (staged) --- */
  const pickFile = (f) => {
    if (!f) return;
    if (!acceptTypes.includes(f.type)) { toast.error("Sadece png / jpg / jpeg / webp"); return; }
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview((old) => { if (old) URL.revokeObjectURL(old); return url; });
  };
  const onInputFile = (e) => pickFile(e.target.files?.[0]);
  const onDrop = (e) => { e.preventDefault(); pickFile(e.dataTransfer.files?.[0]); };
  const clearFile = (e) => { e?.stopPropagation?.(); setFile(null); if (preview) URL.revokeObjectURL(preview); setPreview(null); };

  const addStagedNcr = () => {
    if (!ncrForm.category) return toast.error("Kategori seçin");
    setStagedNcrs((arr) => [...arr, {
      id: crypto.randomUUID(),
      category: ncrForm.category,
      title: ncrForm.title || "",
      notes: ncrForm.notes || "",
      observedAt: ncrForm.observedAt,
      file,
    }]);
    setNcrForm((s) => ({ ...s, category: "", title: "", notes: "" }));
    clearFile();
  };
  const removeStagedNcr = (id) =>
    setStagedNcrs((arr) => arr.filter((x) => x.id !== id));

  /* --- FINAL: hepsini kaydet --- */
  const saveAll = async () => {
    setSavingAll(true);
    try {
      // 1) Visit oluştur
      const payload = {
        storeId: Number(storeId),
        date: new Date(formVisit.date).toISOString(),
        startTime: formVisit.startTime || null,
        endTime: formVisit.endTime || null,
        visitType: formVisit.visitType,
        targetPests: formVisit.targetPests,
        notes: formVisit.notes || null,
        employees: formVisit.employees,
      };
      const { data } = await api.post("/visits", payload);
      const visitId = data?.visit?.id;
      if (!visitId) throw new Error("Ziyaret oluşturulamadı");

      // 2) EK-1 satırları (parallel)
      if (stagedLines.length > 0) {
        await Promise.allSettled(
          stagedLines.map((l) =>
            api.post(`/ek1/visit/${visitId}/lines`, {
              biosidalId: l.biosidalId,
              method: l.method,
              amount: l.amount,
            })
          )
        );
      }

      // 3) Uygunsuzluklar (store bazlı)
      if (stagedNcrs.length > 0) {
        await Promise.allSettled(
          stagedNcrs.map(async (n) => {
            const fd = new FormData();
            fd.append("category", n.category);
            fd.append("observedAt", n.observedAt);
            if (n.title) fd.append("title", n.title);
            if (n.notes) fd.append("notes", n.notes);
            if (n.file) fd.append("image", n.file);
            return api.post(`/nonconformities/store/${storeId}`, fd, {
              headers: { "Content-Type": "multipart/form-data" },
            });
          })
        );
      }

      toast.success("Ziyaret oluşturuldu");
      navigate(`/admin/stores/${storeId}/visits/${visitId}/preview`);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Kayıt tamamlanamadı");
    } finally {
      setSavingAll(false);
    }
  };

  return (
    <Layout>
      <div className="ek1flow-page">
        <div className="page-header">
          <h1>{store?.name || "Mağaza"} – EK-1 Akışı</h1>
          <div className="header-actions">
            <Link className="btn ghost" to={`/admin/stores/${storeId}`}>Mağaza</Link>
          </div>
        </div>

        {/* 1) Ziyaret (henüz kaydetmiyoruz) */}
        <section className="card form">
          <div className="card-title">1) Ziyaret (EK-1) Bilgileri</div>

          <div className="grid-3">
            <div>
              <label>Tarih *</label>
              <input type="date" name="date" value={formVisit.date} onChange={onVisitChange} required />
            </div>
            <div>
              <label>Giriş Saati</label>
              <select name="startTime" value={formVisit.startTime} onChange={onVisitChange}>
                <option value="">Seçiniz…</option>
                {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label>Çıkış Saati</label>
              <select name="endTime" value={formVisit.endTime} onChange={onVisitChange}>
                <option value="">Seçiniz…</option>
                {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="col-span-3">
              <label>Ziyaret Türü *</label>
              <select name="visitType" value={formVisit.visitType} onChange={onVisitChange} required>
                {Object.entries(VISIT_TYPE_TR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            <div className="col-span-3 group">
              <div className="group-title">Hedef Zararlı Türleri</div>
              <div className="pill-grid">
                {PEST_OPTIONS.map((label) => {
                  const on = formVisit.targetPests.includes(label);
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
              <textarea name="notes" rows={3} value={formVisit.notes} onChange={onVisitChange} />
            </div>
          </div>
        </section>

        {/* 2) Biyosidal (staged) */}
        <form className="card form" onSubmit={addStagedLine}>
          <div className="card-title">2) Biyosidal Ekle (Hazırlık)</div>

          <div className="grid-3">
            <div>
              <label>Biyosidal Ürün *</label>
              <select
                value={lineForm.biosidalId}
                onChange={(e) => setLineForm((p) => ({ ...p, biosidalId: e.target.value }))}
                required
              >
                <option value="">Seçiniz..</option>
                {biocides.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label>Uygulama Şekli *</label>
              <select
                value={lineForm.method}
                onChange={(e) => setLineForm((p) => ({ ...p, method: e.target.value }))}
                required
              >
                {Object.entries(METHOD_TR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label>Miktar *</label>
              <input
                value={lineForm.amount}
                onChange={(e) => setLineForm((p) => ({ ...p, amount: e.target.value }))}
                placeholder="Örn: 100"
                required
              />
            </div>
          </div>

          <div className="actions">
            <button className="btn primary">Listeye Ekle</button>
          </div>

          <div className="card-subtitle">Hazırlanan Biyosidaller</div>
          {stagedLines.length === 0 ? (
            <div className="empty">Henüz ürün eklenmedi.</div>
          ) : (
            <table className="table">
              <thead><tr><th>Ürün</th><th>Yöntem</th><th>Miktar</th><th>İşlem</th></tr></thead>
              <tbody>
                {stagedLines.map((l) => (
                  <tr key={l.id}>
                    <td>{l.biosidalName}</td>
                    <td>{METHOD_TR[l.method] || l.method}</td>
                    <td>{l.amount}</td>
                    <td><button type="button" className="btn danger" onClick={() => removeStagedLine(l.id)}>Sil</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </form>

        {/* 3) Uygunsuzluk (toggle + staged) */}
        <section className="card">
          <div className="card-title flex-between">
            <span>3) Uygunsuzluk</span>
            <label className={`switch ${ncrToggle ? "on" : ""}`} title="Uygunsuzluk gözlendi">
              <input type="checkbox" checked={ncrToggle} onChange={(e) => setNcrToggle(e.target.checked)} />
              <span className="track"><span className="knob" /></span>
              <span className="lbl">Uygunsuzluk gözlendi</span>
            </label>
          </div>

          <div className={`ncr-area ${ncrToggle ? "active" : "disabled"}`}>
            <div className="grid-2">
              <div className="field">
                <label>Kategori *</label>
                <select
                  value={ncrForm.category}
                  onChange={(e) => setNcrForm((s) => ({ ...s, category: e.target.value }))}
                  disabled={!ncrToggle}
                >
                  <option value="">Seçiniz…</option>
                  {CATS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Tarih</label>
                <input
                  type="date"
                  value={ncrForm.observedAt}
                  onChange={(e) => setNcrForm((s) => ({ ...s, observedAt: e.target.value }))}
                  disabled={!ncrToggle}
                />
              </div>

              <div className="field full">
                <label>Başlık</label>
                <input
                  type="text"
                  placeholder="Uygunsuzluk başlığı"
                  value={ncrForm.title}
                  onChange={(e) => setNcrForm((s) => ({ ...s, title: e.target.value }))}
                  disabled={!ncrToggle}
                />
              </div>

              <div className="field full">
                <label>Notlar</label>
                <textarea
                  rows={3}
                  value={ncrForm.notes}
                  onChange={(e) => setNcrForm((s) => ({ ...s, notes: e.target.value }))}
                  disabled={!ncrToggle}
                />
              </div>

              <div className="field full">
                <label>Görsel (sürükle-bırak / sadece görsel)</label>
                <div
                  className={`dropzone ${!ncrToggle ? "off" : ""}`}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={onDrop}
                  onClick={() => ncrToggle && document.getElementById("ncr-file").click()}
                >
                  {preview ? (
                    <>
                      <img src={preview} alt="preview" />
                      <button className="clear" onClick={clearFile} title="Görseli kaldır">✕</button>
                    </>
                  ) : (
                    <span>{ncrToggle ? "Görseli buraya sürükleyin ya da tıklayın" : "Önce toggler'ı açın"}</span>
                  )}
                  <input id="ncr-file" type="file" accept={acceptTypes.join(",")} onChange={onInputFile} hidden />
                </div>
              </div>

              <div className="actions full">
                <button
                  className="btn primary"
                  onClick={addStagedNcr}
                  disabled={!ncrToggle || !ncrForm.category}
                  type="button"
                >
                  Listeye Ekle
                </button>
              </div>
            </div>

            <div className="card-subtitle">Hazırlanan Uygunsuzluklar</div>
            {stagedNcrs.length === 0 ? (
              <div className="empty">Kayıt yok.</div>
            ) : (
              <table className="table">
                <thead><tr><th>Tarih</th><th>Kategori</th><th>Başlık</th><th>Not</th><th>İşlem</th></tr></thead>
                <tbody>
                  {stagedNcrs.map((r) => (
                    <tr key={r.id}>
                      <td>{fmtD(r.observedAt)}</td>
                      <td>{r.category}</td>
                      <td>{r.title || "—"}</td>
                      <td className="notes">{r.notes || "—"}</td>
                      <td><button className="btn danger" onClick={() => removeStagedNcr(r.id)}>Sil</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* SON TUŞ — ORTADA */}
        <div className="final-actions">
          <button className="btn primary xl" onClick={saveAll} disabled={savingAll}>
            {savingAll ? "Kaydediliyor..." : "ZİYARETİ OLUŞTUR VE KAYDET"}
          </button>
          <div className="muted">
            Biyosidal eklenmemiş veya uygunsuzluk gözlenmemiş olsa da ziyaret oluşturulur.
          </div>
        </div>
      </div>
    </Layout>
  );
}
