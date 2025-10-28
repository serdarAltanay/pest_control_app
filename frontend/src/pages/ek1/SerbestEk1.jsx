import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./Ek1.scss";

/* ───────── Sabitler ───────── */
const VISIT_TYPE_TR = {
  TEK_SEFERLIK: "Tek Seferlik Ziyaret",
  PERIYODIK: "Periyodik",
  ACIL_CAGRI: "Acil Çağrı",
  ILK_ZIYARET: "İlk Ziyaret",
  DIGER: "Diğer",
};
const METHOD_TR = {
  PULVERIZE: "Pulverize",
  ULV: "ULV",
  ATOMIZER: "Atomizer",
  YENILEME: "Yenileme",
  SISLEME: "Sisleme",
  YEMLEME: "Yemleme",
};
const PEST_OPTIONS = [
  "Kemirgen","Hamamböceği","Karınca","Uçan Haşere","Pire",
  "Kene","Güve","Örümcek","Akar","Tahtakurusu"
];

/* ───────── Utils ───────── */
const timeOpts = (() => {
  const start = { h: 8, m: 0 }, end = { h: 20, m: 0 }, step = 15, out = [];
  for (let t = start.h * 60 + start.m; t <= end.h * 60 + end.m; t += step) {
    const h = String(Math.floor(t / 60)).padStart(2,"0");
    const m = String(t % 60).padStart(2,"0");
    out.push(`${h}:${m}`);
  }
  return out;
})();
const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
};

/* ───────── Data loaders ───────── */
async function loadBiocides() {
  try { const { data } = await api.get("/biocides"); return Array.isArray(data) ? data : []; }
  catch { return []; }
}
async function loadEmployees() {
  // BE: /api/employees (admin görünür—yetki yoksa uyarı düşer)
  const { data } = await api.get("/employees");
  const arr = Array.isArray(data) ? data : [];
  return arr
    .map((x) => ({ id: Number(x.id), label: String(x.fullName || "").trim() }))
    .filter(e => e.id && e.label);
}

/* ───────── Çoklu Dropdown ───────── */
function MultiSelectDropdown({ options, value, onChange, placeholder = "Seçiniz…" }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);

  const selected = useMemo(
    () => options.filter(o => value.includes(o.id)),
    [options, value]
  );

  useEffect(() => {
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const toggleId = (id) => {
    onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id]);
  };
  const clearAll = (e) => { e?.stopPropagation?.(); onChange([]); };

  return (
    <div ref={ref} className={`multi-dd ${open ? "open" : ""}`}>
      <button type="button" className="dropdown-toggle" onClick={() => setOpen(o => !o)}>
        <div className="dropdown-value">
          {selected.length === 0 ? (
            <span className="placeholder">{placeholder}</span>
          ) : (
            selected.map(s => <span key={s.id} className="chip">{s.label}</span>)
          )}
        </div>
        <span className="caret" aria-hidden>▾</span>
      </button>

      {open && (
        <div className="dropdown-menu">
          <div className="dropdown-head">
            <strong>Uygulayıcı Seçin</strong>
            <button type="button" className="btn" onClick={clearAll}>Temizle</button>
          </div>
          <ul className="dropdown-list">
            {options.length === 0 && <li className="empty">Kayıt yok</li>}
            {options.map(opt => (
              <li key={opt.id} className="dropdown-item" onClick={() => toggleId(opt.id)}>
                <input type="checkbox" readOnly checked={value.includes(opt.id)} />
                <span>{opt.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ───────── Component ───────── */
export default function SerbestEk1() {
  const navigate = useNavigate();

  // listeler
  const [biocides, setBiocides] = useState([]);
  const [empOptions, setEmpOptions] = useState([]);

  useEffect(() => { loadBiocides().then(setBiocides); }, []);
  useEffect(() => {
    loadEmployees()
      .then(setEmpOptions)
      .catch(() => toast.error("Personel listesi alınamadı (yetki veya ağ)."));
  }, []);

  // müşteri (kayıtsız)
  const [cForm, setCForm] = useState({ title: "", contactName: "", email: "", phone: "" });

  // lokasyon (kayıtsız)
  const [sForm, setSForm] = useState({ name: "", address: "", placeType: "", areaM2: "" });

  // ziyaret
  const [vForm, setVForm] = useState({
    date: todayStr(), startTime: "", endTime: "", visitType: "TEK_SEFERLIK",
    targetPests: [], notes: ""
  });

  // seçilen uygulayıcılar (id listesi)
  const [selectedEmpIds, setSelectedEmpIds] = useState([]);
  const selectedEmpNames = useMemo(
    () => selectedEmpIds
      .map(id => empOptions.find(e => e.id === id)?.label)
      .filter(Boolean),
    [selectedEmpIds, empOptions]
  );

  // biyosidal satırları
  const [lineForm, setLineForm] = useState({ biosidalId: "", method: "PULVERIZE", amount: "" });
  const [lines, setLines] = useState([]);

  // uygunsuzluklar (görselsiz)
  const [ncrForm, setNcrForm] = useState({ title: "", notes: "", observedAt: todayStr() });
  const [ncrs, setNcrs] = useState([]);

  const [saving, setSaving] = useState(false);

  const onChange = (setter) => (e) => setter((p) => ({ ...p, [e.target.name]: e.target.value }));
  const togglePest = (label) =>
    setVForm((p) => ({
      ...p,
      targetPests: p.targetPests.includes(label)
        ? p.targetPests.filter((x) => x !== label)
        : [...p.targetPests, label],
    }));

  const addLine = (e) => {
    e.preventDefault();
    if (!lineForm.biosidalId || !lineForm.amount) return toast.error("Ürün ve miktar gerekli.");
    const bio = biocides.find((b) => String(b.id) === String(lineForm.biosidalId));
    setLines((arr) => [...arr, {
      id: crypto.randomUUID(),
      biosidalId: Number(lineForm.biosidalId),
      biosidalName: bio?.name || lineForm.biosidalId,
      method: lineForm.method,
      amount: Number(lineForm.amount),
    }]);
    setLineForm({ biosidalId: "", method: "PULVERIZE", amount: "" });
  };
  const removeLine = (id) => setLines((arr) => arr.filter((x) => x.id !== id));

  const addNcr = (e) => {
    e?.preventDefault?.();
    if (!ncrForm.title.trim() && !ncrForm.notes.trim()) return toast.error("Başlık veya açıklama girin");
    setNcrs((arr) => [...arr, {
      id: crypto.randomUUID(),
      title: ncrForm.title.trim(),
      notes: ncrForm.notes.trim(),
      observedAt: ncrForm.observedAt,
    }]);
    setNcrForm((s) => ({ ...s, title: "", notes: "" }));
  };
  const removeNcr = (id) => setNcrs((arr) => arr.filter((x) => x.id !== id));

  const saveAll = async () => {
    if (!cForm.title.trim())  return toast.error("Müşteri/Unvan girin");
    if (!sForm.name.trim())   return toast.error("Lokasyon adı girin");
    if (!sForm.address.trim())return toast.error("Adres girin");
    if (!vForm.date)          return toast.error("Tarih seçin");

    setSaving(true);
    try {
      const payload = {
        customerTitle: cForm.title.trim(),
        customerContactName: cForm.contactName.trim() || undefined,
        customerEmail: cForm.email.trim() || undefined,
        customerPhone: cForm.phone.trim() || undefined,

        storeName: sForm.name.trim(),
        address: sForm.address.trim(),
        placeType: sForm.placeType || undefined,
        areaM2: sForm.areaM2 ? Number(sForm.areaM2) : undefined,

        date: new Date(vForm.date).toISOString(),
        startTime: vForm.startTime || null,
        endTime: vForm.endTime || null,
        visitType: vForm.visitType || "TEK_SEFERLIK",
        targetPests: vForm.targetPests,
        notes: vForm.notes || null,

        // seçilen uygulayıcıların ad-soyad listesi
        employees: selectedEmpNames,

        // ek-1 satırları + uygunsuzluk başlık/açıklama (görselsiz)
        lines: lines.map(l => ({ biosidalId: l.biosidalId, method: l.method, amount: l.amount })),
        ncrs: ncrs.map(({ title, notes, observedAt }) => ({ title, notes, observedAt })),
      };

      const { data } = await api.post("/ek1/free", payload);
      const visitId = data?.visitId || data?.id || data?.visit?.id;
      if (!visitId) throw new Error("Oluşturma sonucu alınamadı");

      // (opsiyonel) müşteri onayı—BE zaten SUBMITTED + customerSignedAt basıyor ama ek garanti:
      try { await api.post(`/ek1/visit/${visitId}/sign/customer`, { name: cForm.contactName || "Yetkili" }); } catch {}

      toast.success("Serbest EK-1 oluşturuldu");
      navigate(`/ek1/visit/${visitId}`);
    } catch (e) {
      toast.error(e?.response?.data?.message || e.message || "Kayıt tamamlanamadı");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="ek1flow-page">
        <div className="page-header">
          <h1>Serbest EK-1 Oluştur (Tek Seferlik)</h1>
          <div className="header-actions">
            <Link className="btn ghost" to="/admin">Panele Dön</Link>
          </div>
        </div>

        <div className="hint">
          Bu akışta <b>müşteri/mağaza kaydı açılmaz</b>, <b>erişim verilmez</b>.
          Belge normal EK-1 gibi saklanır; ziyaret türü <b>Tek Seferlik</b> olarak işaretlenir.
        </div>

        {/* 1) Müşteri */}
        <section className="card form">
          <div className="card-title">1) Müşteri/Unvan Bilgileri</div>
          <div className="grid-3">
            <div className="col-span-3">
              <label>Müşteri/Unvan *</label>
              <input name="title" value={cForm.title} onChange={onChange(setCForm)} placeholder="Örn: ACME Gıda A.Ş." required />
            </div>
            <div>
              <label>Yetkili Ad Soyad</label>
              <input name="contactName" value={cForm.contactName} onChange={onChange(setCForm)} placeholder="Opsiyonel" />
            </div>
            <div>
              <label>E-posta</label>
              <input type="email" name="email" value={cForm.email} onChange={onChange(setCForm)} placeholder="opsiyonel@firma.com" />
            </div>
            <div>
              <label>Telefon</label>
              <input name="phone" value={cForm.phone} onChange={onChange(setCForm)} placeholder="Opsiyonel" />
            </div>
          </div>
        </section>

        {/* 2) Lokasyon */}
        <section className="card form">
          <div className="card-title">2) Uygulama Lokasyonu</div>
          <div className="grid-3">
            <div>
              <label>Lokasyon Adı *</label>
              <input name="name" value={sForm.name} onChange={onChange(setSForm)} placeholder="Örn: ACME - Merkez Depo" required />
            </div>
            <div>
              <label>Mesken / İşyeri</label>
              <select name="placeType" value={sForm.placeType} onChange={onChange(setSForm)}>
                <option value="">Seçiniz…</option>
                <option value="İşyeri">İşyeri</option>
                <option value="Mesken">Mesken</option>
              </select>
            </div>
            <div>
              <label>Alan (m²)</label>
              <input name="areaM2" value={sForm.areaM2} onChange={onChange(setSForm)} placeholder="Opsiyonel" />
            </div>
            <div className="col-span-3">
              <label>Adres *</label>
              <textarea name="address" rows={2} value={sForm.address} onChange={onChange(setSForm)} placeholder="Açık adres" required />
            </div>
          </div>
        </section>

        {/* 3) Ziyaret */}
        <section className="card form">
          <div className="card-title">3) Ziyaret Bilgileri</div>
          <div className="grid-3">
            <div>
              <label>Tarih *</label>
              <input type="date" name="date" value={vForm.date} onChange={onChange(setVForm)} required />
            </div>
            <div>
              <label>Giriş Saati</label>
              <select name="startTime" value={vForm.startTime} onChange={onChange(setVForm)}>
                <option value="">Seçiniz…</option>
                {timeOpts.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label>Çıkış Saati</label>
              <select name="endTime" value={vForm.endTime} onChange={onChange(setVForm)}>
                <option value="">Seçiniz…</option>
                {timeOpts.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="col-span-3">
              <label>Ziyaret Türü *</label>
              <select name="visitType" value={vForm.visitType} onChange={onChange(setVForm)} required>
                {Object.entries(VISIT_TYPE_TR).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            {/* Uygulayıcı(lar) – çoklu custom dropdown */}
            <div className="col-span-3">
              <label>Uygulayıcı(lar)</label>
              <MultiSelectDropdown
                options={empOptions}
                value={selectedEmpIds}
                onChange={setSelectedEmpIds}
                placeholder="Seçiniz…"
              />
              <div className="muted" style={{ marginTop: 6 }}>
                Çoklu seçim için kutucukları işaretleyin. Dışarı tıklayınca menü kapanır.
              </div>
            </div>

            <div className="col-span-3">
              <label>Hedef Zararlı Türleri</label>
              <div className="pill-grid">
                {PEST_OPTIONS.map((label) => {
                  const on = vForm.targetPests.includes(label);
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
              <textarea name="notes" rows={3} value={vForm.notes} onChange={onChange(setVForm)} />
            </div>
          </div>
        </section>

        {/* 4) Uygunsuzluklar (görselsiz) */}
        <section className="card form">
          <div className="card-title">4) Uygunsuzluklar (Opsiyonel)</div>
          <div className="grid-3">
            <div className="col-span-3">
              <label>Başlık</label>
              <input
                value={ncrForm.title}
                onChange={(e) => setNcrForm((s) => ({ ...s, title: e.target.value }))}
                placeholder="Örn: Depolama alanında düzensizlik"
              />
            </div>
            <div className="col-span-3">
              <label>Açıklama</label>
              <textarea
                rows={3}
                value={ncrForm.notes}
                onChange={(e) => setNcrForm((s) => ({ ...s, notes: e.target.value }))}
                placeholder="Kısa açıklama / tespit"
              />
            </div>
            <div>
              <label>Tarih</label>
              <input
                type="date"
                value={ncrForm.observedAt}
                onChange={(e) => setNcrForm((s) => ({ ...s, observedAt: e.target.value }))}
              />
            </div>
          </div>
          <div className="actions">
            <button className="btn" onClick={addNcr}>Listeye Ekle</button>
          </div>

          <div className="card-subtitle">Hazırlanan Uygunsuzluklar</div>
          {ncrs.length === 0 ? (
            <div className="empty">Henüz uygunsuzluk eklenmedi.</div>
          ) : (
            <table className="table">
              <thead><tr><th>Tarih</th><th>Başlık</th><th>Açıklama</th><th>İşlem</th></tr></thead>
              <tbody>
                {ncrs.map((n) => (
                  <tr key={n.id}>
                    <td>{new Date(n.observedAt).toLocaleDateString("tr-TR")}</td>
                    <td>{n.title || "—"}</td>
                    <td className="notes">{n.notes || "—"}</td>
                    <td><button type="button" className="btn danger" onClick={() => removeNcr(n.id)}>Sil</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* 5) Biyosidal Ürünler */}
        <form className="card form" onSubmit={addLine}>
          <div className="card-title">5) Biyosidal Ürünler</div>
          <div className="grid-3">
            <div>
              <label>Biyosidal Ürün *</label>
              <select
                value={lineForm.biosidalId}
                onChange={(e) => setLineForm((p) => ({ ...p, biosidalId: e.target.value }))}
                required
              >
                <option value="">Seçiniz…</option>
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

          <div className="card-subtitle">Hazırlanan Satırlar</div>
          {lines.length === 0 ? (
            <div className="empty">Henüz ürün eklenmedi.</div>
          ) : (
            <table className="table">
              <thead><tr><th>Ürün</th><th>Yöntem</th><th>Miktar</th><th>İşlem</th></tr></thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td>{l.biosidalName}</td>
                    <td>{METHOD_TR[l.method] || l.method}</td>
                    <td>{l.amount}</td>
                    <td><button type="button" className="btn danger" onClick={() => removeLine(l.id)}>Sil</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </form>

        {/* Final */}
        <div className="final-actions">
          <button className="btn primary xl" onClick={saveAll} disabled={saving}>
            {saving ? "Kaydediliyor..." : "SERBEST EK-1 OLUŞTUR"}
          </button>
          <div className="muted">
            Müşteri/mağaza kaydı açılmaz, erişim verilmez. Müşteri onayı otomatik işlenir.
          </div>
        </div>
      </div>
    </Layout>
  );
}
