import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import SignatureModal from "../../components/SignatureModal.jsx";
import "./Ek1.scss";

const PEST_OPTIONS = [
  "Kemirgen", "Hamamböceği", "Karınca", "Uçan Haşere", "Pire",
  "Kene", "Güve", "Örümcek", "Akar", "Tahtakurusu",
];

const METHOD_OPTIONS = [
  { value: "PULVERIZE", label: "Pulverize" },
  { value: "ULV", label: "ULV" },
  { value: "ATOMIZER", label: "Atomizer" },
  { value: "SISLEME", label: "Sisleme" },
  { value: "YEMLEME", label: "Yemleme" },
  { value: "YENILEME", label: "Yenileme" },
];

const VISIT_TYPE_OPTIONS = [
  { value: "PERIYODIK", label: "Periyodik" },
  { value: "ACIL_CAGRI", label: "Acil Çağrı" },
  { value: "ISTASYON_KURULUM", label: "İstasyon Kurulum" },
  { value: "ILK_ZIYARET", label: "İlk Ziyaret" },
  { value: "DIGER", label: "Diğer" },
];

const NCR_CATS = ["Hijyen Eksikliği", "Yalıtım Eksikliği", "Depolama Eksikliği", "Diğer"];

const timeOptions = (() => {
  const out = [];
  for (let t = 8 * 60; t <= 20 * 60; t += 15) {
    out.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  }
  return out;
})();

export default function Ek1Flow() {
  const { storeId } = useParams();
  const navigate = useNavigate();

  const [store, setStore] = useState(null);
  const [biocides, setBiocides] = useState([]);
  const [savingAll, setSavingAll] = useState(false);
  const [isSigModalOpen, setIsSigModalOpen] = useState(false);

  /* Visit Form */
  const [formVisit, setFormVisit] = useState({
    date: new Date().toISOString().slice(0, 10),
    startTime: "", endTime: "",
    visitType: "PERIYODIK",
    targetPests: [], notes: "", employees: [],
  });

  /* Staged Lines & NCR */
  const [stagedLines, setStagedLines] = useState([]);
  const [lineForm, setLineForm] = useState({ biosidalId: "", method: "PULVERIZE", amount: "" });

  const [stagedNcrs, setStagedNcrs] = useState([]);
  const [ncrForm, setNcrForm] = useState({
    category: NCR_CATS[0],
    title: "", notes: "",
    observedAt: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    (async () => {
      try {
        const [resS, resB] = await Promise.all([
          api.get(`/stores/${storeId}`),
          api.get("/biocides"),
        ]);
        setStore(resS.data);
        setBiocides(Array.isArray(resB.data) ? resB.data : []);
      } catch {
        toast.error("Mağaza/biyosidal verisi yüklenemedi.");
      }
    })();
  }, [storeId]);

  const onVisitChange = (e) =>
    setFormVisit((p) => ({ ...p, [e.target.name]: e.target.value }));

  const togglePest = (label) =>
    setFormVisit((p) => ({
      ...p,
      targetPests: p.targetPests.includes(label)
        ? p.targetPests.filter((x) => x !== label)
        : [...p.targetPests, label],
    }));

  /* Ürün Ekle */
  const addStagedLine = (e) => {
    e.preventDefault();
    if (!lineForm.biosidalId || !lineForm.amount) return toast.error("Ürün ve miktar gerekli.");
    const bio = biocides.find((b) => String(b.id) === String(lineForm.biosidalId));
    setStagedLines([
      ...stagedLines,
      {
        id: crypto.randomUUID(),
        biosidalId: Number(lineForm.biosidalId),
        biosidalName: bio?.name,
        method: lineForm.method,
        amount: Number(lineForm.amount),
      },
    ]);
    setLineForm({ biosidalId: "", method: "PULVERIZE", amount: "" });
  };

  /* NCR Ekle */
  const addStagedNcr = (e) => {
    e.preventDefault();
    if (!ncrForm.title.trim()) return toast.error("NCR başlığı zorunludur.");
    setStagedNcrs([...stagedNcrs, { ...ncrForm, id: crypto.randomUUID() }]);
    setNcrForm({ category: NCR_CATS[0], title: "", notes: "", observedAt: new Date().toISOString().slice(0, 10) });
  };

  /* Validasyon → Modal Aç */
  const handleStartSaveFlow = () => {
    if (!formVisit.date) return toast.error("Ziyaret tarihi zorunludur.");
    setIsSigModalOpen(true);
  };

  /* İmza + GPS → Kaydet */
  const onFinalConfirm = async (signatureBase64) => {
    setIsSigModalOpen(false);
    setSavingAll(true);

    let coords = null;
    try {
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
      );
      coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch {
      console.warn("GPS alınamadı.");
    }

    try {
      /* 1) Ziyaret Oluştur */
      const { data } = await api.post("/visits", {
        ...formVisit,
        storeId: Number(storeId),
      });
      const visitId = data?.visit?.id;
      if (!visitId) throw new Error("Ziyaret oluşturulamadı");

      /* 2) Biyosidal Satırları + NCR'lar Paralel */
      await Promise.all([
        ...stagedLines.map((l) => api.post(`/ek1/visit/${visitId}/lines`, l)),
        ...stagedNcrs.map((n) => {
          const fd = new FormData();
          fd.append("category", n.category);
          fd.append("observedAt", n.observedAt);
          if (n.title) fd.append("title", n.title);
          if (n.notes) fd.append("notes", n.notes);
          if (n.file) fd.append("image", n.file);
          return api.post(`/nonconformities/store/${storeId}`, fd);
        }),
      ]);

      /* 3) Biyometrik İmza Gönder */
      await api.post(`/ek1/visit/${visitId}/sign/customer`, {
        signature: signatureBase64,
        coords,
        deviceInfo:
          navigator.userAgent.includes("Tablet") || navigator.userAgent.includes("iPad")
            ? "Şirket Tableti"
            : "Mobil Cihaz",
      });

      toast.success("Ziyaret ve biyometrik onay kaydedildi.");
      navigate(`/admin/stores/${storeId}/visits/${visitId}/preview`);
    } catch {
      toast.error("Kayıt sırasında hata oluştu.");
    } finally {
      setSavingAll(false);
    }
  };

  return (
    <Layout>
      <div className="ek1flow-page">
        <div className="page-header">
          <h1>
            {store?.name || "Mağaza"}{" "}
            <span className="page-header-badge">EK-1 Akışı</span>
          </h1>
          <div className="header-actions">
            <Link className="btn ghost" to={`/admin/stores/${storeId}`}>Geri</Link>
          </div>
        </div>

        {/* 1 – Ziyaret Bilgileri */}
        <section className="card form">
          <div className="card-title">
            <span className="card-num">1</span> Ziyaret Bilgileri
          </div>
          <div className="grid-3">
            <div>
              <label>Tarih <span className="req">*</span></label>
              <input type="date" name="date" value={formVisit.date} onChange={onVisitChange} required />
            </div>
            <div>
              <label>Giriş Saati</label>
              <select name="startTime" value={formVisit.startTime} onChange={onVisitChange}>
                <option value="">Seçiniz</option>
                {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label>Çıkış Saati</label>
              <select name="endTime" value={formVisit.endTime} onChange={onVisitChange}>
                <option value="">Seçiniz</option>
                {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="group">
            <label>Ziyaret Türü</label>
            <select name="visitType" value={formVisit.visitType} onChange={onVisitChange}>
              {VISIT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="group">
            <label>Hedef Zararlılar</label>
            <div className="pill-grid">
              {PEST_OPTIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`chk-pill ${formVisit.targetPests.includes(p) ? "on" : ""}`}
                  onClick={() => togglePest(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="group">
            <label>Notlar / Öneriler</label>
            <textarea name="notes" rows={2} value={formVisit.notes} onChange={onVisitChange} placeholder="Varsa özel talimatlar…" />
          </div>
        </section>

        {/* 2 – Biyosidal Hazırlık */}
        <section className="card">
          <div className="card-title">
            <span className="card-num">2</span> Biyosidal Hazırlık
          </div>
          <form onSubmit={addStagedLine} className="line-form">
            <select
              value={lineForm.biosidalId}
              onChange={(e) => setLineForm({ ...lineForm, biosidalId: e.target.value })}
            >
              <option value="">Ürün Seçiniz…</option>
              {biocides.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select
              value={lineForm.method}
              onChange={(e) => setLineForm({ ...lineForm, method: e.target.value })}
            >
              {METHOD_OPTIONS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <input
              type="number"
              placeholder="Miktar"
              value={lineForm.amount}
              onChange={(e) => setLineForm({ ...lineForm, amount: e.target.value })}
            />
            <button type="submit" className="btn primary">+ Ekle</button>
          </form>
          {stagedLines.length > 0 && (
            <table className="line-table">
              <thead>
                <tr><th>Ürün</th><th>Yöntem</th><th>Miktar</th><th></th></tr>
              </thead>
              <tbody>
                {stagedLines.map((l) => (
                  <tr key={l.id}>
                    <td>{l.biosidalName}</td>
                    <td>{l.method}</td>
                    <td>{l.amount}</td>
                    <td>
                      <button
                        className="btn-icon btn-danger"
                        onClick={() => setStagedLines(stagedLines.filter((x) => x.id !== l.id))}
                      >X</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* 3 – NCR */}
        <section className="card">
          <div className="card-title">
            <span className="card-num">3</span> Uygunsuzluklar (NCR) <span className="optional">opsiyonel</span>
          </div>
          <form onSubmit={addStagedNcr} className="ncr-form-row">
            <select value={ncrForm.category} onChange={(e) => setNcrForm({ ...ncrForm, category: e.target.value })}>
              {NCR_CATS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              placeholder="Başlık *"
              value={ncrForm.title}
              onChange={(e) => setNcrForm({ ...ncrForm, title: e.target.value })}
            />
            <input
              placeholder="Açıklama"
              value={ncrForm.notes}
              onChange={(e) => setNcrForm({ ...ncrForm, notes: e.target.value })}
            />
            <button type="submit" className="btn">+ Ekle</button>
          </form>
          {stagedNcrs.length > 0 && (
            <ul className="ncr-list">
              {stagedNcrs.map((n) => (
                <li key={n.id}>
                  <span className="ncr-cat">{n.category}</span>
                  <strong>{n.title}</strong>
                  {n.notes && <span> – {n.notes}</span>}
                  <button
                    className="btn-icon btn-danger"
                    onClick={() => setStagedNcrs(stagedNcrs.filter((x) => x.id !== n.id))}
                  >X</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Final Butonu */}
        <div className="final-actions">
          <button
            className="btn primary xl"
            onClick={handleStartSaveFlow}
            disabled={savingAll}
          >
            {savingAll ? "İŞLENİYOR…" : "MÜŞTERİYE İMZALAT VE KAYDET"}
          </button>
          <div className="muted">
            İmza atıldığı anda GPS ve zaman damgası kaydedilecektir.
          </div>
        </div>

        <SignatureModal
          isOpen={isSigModalOpen}
          onClose={() => setIsSigModalOpen(false)}
          onConfirm={onFinalConfirm}
          title="Müşteri Onay İmzası (Tablet)"
          subtitle="Ziyaret belgesi için yasal onay"
          signerName={store?.managerName || store?.name || ""}
        />
      </div>
    </Layout>
  );
}