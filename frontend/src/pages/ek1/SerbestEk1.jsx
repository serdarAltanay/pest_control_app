import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import useAuth from "../../hooks/useAuth";
import "./Ek1.scss";

/* ───────── Sabitler ───────── */
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

/* ───────── Utils ───────── */
const timeOpts = (() => {
  const out = [];
  for (let t = 8 * 60; t <= 20 * 60; t += 15) {
    const h = String(Math.floor(t / 60)).padStart(2, "0");
    const m = String(t % 60).padStart(2, "0");
    out.push(`${h}:${m}`);
  }
  return out;
})();

const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/* ───────── Çoklu Dropdown ───────── */
function MultiSelectDropdown({ options, value, onChange, placeholder = "Seçiniz…" }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => options.filter((o) => value.includes(o.id)), [options, value]);

  useEffect(() => {
    const onDoc = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const toggleId = (id) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div ref={ref} className={`multi-dd ${open ? "open" : ""}`}>
      <button type="button" className="dropdown-toggle" onClick={() => setOpen((o) => !o)}>
        <div className="dropdown-value">
          {selected.length === 0 ? (
            <span className="placeholder">{placeholder}</span>
          ) : (
            selected.map((s) => (
              <span key={s.id} className="chip">{s.label}</span>
            ))
          )}
        </div>
        <span className="caret">▾</span>
      </button>
      {open && (
        <div className="dropdown-menu">
          <ul className="dropdown-list">
            {options.length === 0 && <li className="empty">Personel bulunamadı</li>}
            {options.map((opt) => (
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

/* ───────── Ana Bileşen ───────── */
export default function SerbestEk1() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isLevel2 = user?.role === "employee" && user?.level === 2;

  const [biocides, setBiocides] = useState([]);
  const [empOptions, setEmpOptions] = useState([]);
  const [saving, setSaving] = useState(false);

  /* Form State'leri */
  const [cForm, setCForm] = useState({ title: "", contactName: "", email: "", phone: "" });
  const [sForm, setSForm] = useState({ name: "", address: "", placeType: "", areaM2: "" });
  const [vForm, setVForm] = useState({
    date: todayStr(), startTime: "", endTime: "",
    visitType: "TEK_SEFERLIK", targetPests: [], notes: "",
  });
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [lines, setLines] = useState([]);
  const [ncrs, setNcrs] = useState([]);
  const [lineForm, setLineForm] = useState({ biosidalId: "", method: "PULVERIZE", amount: "" });
  const [ncrForm, setNcrForm] = useState({ title: "", notes: "", observedAt: todayStr() });

  /* Veri Yükleme */
  useEffect(() => {
    (async () => {
      try {
        const [resB, resE] = await Promise.all([
          api.get("/biocides"),
          api.get("/employees"),
        ]);
        setBiocides(Array.isArray(resB.data) ? resB.data : []);
        setEmpOptions((resE.data || []).map((x) => ({ id: x.id, label: x.fullName })));
      } catch {
        toast.error("Veriler yüklenemedi.");
      }
    })();
  }, []);

  const onChange = (setter) => (e) =>
    setter((p) => ({ ...p, [e.target.name]: e.target.value }));

  const togglePest = (label) =>
    setVForm((p) => ({
      ...p,
      targetPests: p.targetPests.includes(label)
        ? p.targetPests.filter((x) => x !== label)
        : [...p.targetPests, label],
    }));

  /* Ürün Ekle */
  const addLine = (e) => {
    e.preventDefault();
    if (!lineForm.biosidalId || !lineForm.amount) return toast.error("Ürün ve miktar gerekli.");
    const bio = biocides.find((b) => String(b.id) === String(lineForm.biosidalId));
    setLines([
      ...lines,
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
  const addNcr = () => {
    if (!ncrForm.title.trim()) return toast.error("Başlık gerekli");
    setNcrs([...ncrs, { ...ncrForm, id: crypto.randomUUID() }]);
    setNcrForm({ title: "", notes: "", observedAt: todayStr() });
  };

  /* Validasyon → Direkt Kaydet */
  const handleInitiateCreate = () => {
    if (!cForm.title.trim()) return toast.error("Müşteri ünvanı zorunludur.");
    if (!sForm.name.trim()) return toast.error("Lokasyon adı zorunludur.");
    if (!sForm.address.trim()) return toast.error("Adres zorunludur.");
    onFinalSave();
  };

  /* Kaydet → Preview'a Yönlendir */
  const onFinalSave = async () => {
    setSaving(true);

    try {
      const payload = {
        customerTitle: cForm.title,
        customerContactName: cForm.contactName,
        customerEmail: cForm.email,
        customerPhone: cForm.phone,
        storeName: sForm.name,
        address: sForm.address,
        placeType: sForm.placeType,
        areaM2: sForm.areaM2 ? Number(sForm.areaM2) : null,
        date: new Date(vForm.date).toISOString(),
        startTime: vForm.startTime,
        endTime: isLevel2
          ? (() => {
            const now = new Date();
            return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
          })()
          : vForm.endTime,
        visitType: vForm.visitType,
        targetPests: vForm.targetPests,
        notes: vForm.notes,
        employees: selectedEmployees,
        lines: lines.map((l) => ({ biosidalId: l.biosidalId, method: l.method, amount: l.amount })),
        ncrs: ncrs.map((n) => ({ title: n.title, notes: n.notes, observedAt: n.observedAt })),
      };

      const { data } = await api.post("/ek1/free", payload);
      toast.success("EK-1 kaydedildi. Önizleme açılıyor…");
      navigate(`/admin/stores/0/visits/${data.visitId}/preview`);
    } catch {
      toast.error("Kayıt başarısız.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="ek1flow-page">
        <div className="page-header">
          <h1>Serbest EK-1 <span className="page-header-badge">Form</span></h1>
          <div className="header-actions">
            <Link className="btn ghost" to="/admin">İptal</Link>
          </div>
        </div>

        {/* 1 + 2 – Müşteri & Lokasyon */}
        <div className="grid-2">
          <section className="card form">
            <div className="card-title">
              <span className="card-num">1</span> Müşteri Bilgileri
            </div>
            <label>Müşteri Ünvanı <span className="req">*</span></label>
            <input name="title" value={cForm.title} onChange={onChange(setCForm)} placeholder="Firma / Şahıs Adı" />
            <div className="grid-2" style={{ marginTop: 10 }}>
              <div>
                <label>Yetkili Kişi</label>
                <input name="contactName" value={cForm.contactName} onChange={onChange(setCForm)} placeholder="Ad Soyad" />
              </div>
              <div>
                <label>E-posta</label>
                <input type="email" name="email" value={cForm.email} onChange={onChange(setCForm)} placeholder="ornek@firma.com" />
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <label>Telefon</label>
              <input name="phone" value={cForm.phone} onChange={onChange(setCForm)} placeholder="05XX XXX XX XX" />
            </div>
          </section>

          <section className="card form">
            <div className="card-title">
              <span className="card-num">2</span> Uygulama Alanı
            </div>
            <label>Lokasyon Adı <span className="req">*</span></label>
            <input name="name" value={sForm.name} onChange={onChange(setSForm)} placeholder="Şube / Tesis Adı" />
            <label style={{ marginTop: 10 }}>Açık Adres <span className="req">*</span></label>
            <textarea name="address" rows={2} value={sForm.address} onChange={onChange(setSForm)} placeholder="İlçe, İl" />
            <div className="grid-2" style={{ marginTop: 10 }}>
              <div>
                <label>Alan Türü</label>
                <select name="placeType" value={sForm.placeType} onChange={onChange(setSForm)}>
                  <option value="">Seçiniz</option>
                  <option value="Mesken">Mesken</option>
                  <option value="İşyeri">İşyeri</option>
                  <option value="Gıda Tesisi">Gıda Tesisi</option>
                  <option value="Depo">Depo</option>
                  <option value="Diğer">Diğer</option>
                </select>
              </div>
              <div>
                <label>Alan (m²)</label>
                <input type="number" name="areaM2" value={sForm.areaM2} onChange={onChange(setSForm)} placeholder="m²" />
              </div>
            </div>
          </section>
        </div>

        {/* 3 – Ziyaret Detayları */}
        <section className="card form">
          <div className="card-title">
            <span className="card-num">3</span> İşlem Detayları
          </div>
          <div className="grid-3">
            <div>
              <label>Tarih</label>
              <input type="date" name="date" value={vForm.date} onChange={onChange(setVForm)} />
            </div>
            <div>
              <label>Giriş Saati</label>
              <select name="startTime" value={vForm.startTime} onChange={onChange(setVForm)}>
                <option value="">Seçiniz</option>
                {timeOpts.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label>Çıkış Saati {isLevel2 && <small style={{color:"#888"}}>(Kayıt anında dolacak)</small>}</label>
              <select name="endTime" value={vForm.endTime} onChange={onChange(setVForm)} disabled={isLevel2}>
                <option value="">{isLevel2 ? "Otomatik" : "Seçiniz"}</option>
                {!isLevel2 && timeOpts.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="group">
            <label>Uygulayıcı Personel</label>
            <MultiSelectDropdown
              options={empOptions}
              value={selectedEmployees.map(e => e.id)}
              onChange={(ids) => {
                const emps = ids.map(id => {
                  const opt = empOptions.find(o => o.id === id);
                  return { id: opt.id, fullName: opt.label };
                });
                setSelectedEmployees(emps);
              }}
              placeholder="Personel seçiniz…"
            />
          </div>
          <div className="group">
            <label>Hedef Zararlılar</label>
            <div className="pill-grid">
              {PEST_OPTIONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`chk-pill ${vForm.targetPests.includes(p) ? "on" : ""}`}
                  onClick={() => togglePest(p)}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="group">
            <label>Uyarı / Notlar</label>
            <textarea name="notes" rows={2} value={vForm.notes} onChange={onChange(setVForm)} placeholder="Varsa özel talimatlar…" />
          </div>
        </section>

        {/* 4 + 5 – Ürünler & NCR */}
        <div className="grid-2">
          <section className="card">
            <div className="card-title">
              <span className="card-num">4</span> Kullanılan Biyosidal Ürünler
            </div>
            <form onSubmit={addLine} className="line-form">
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
            {lines.length > 0 && (
              <table className="line-table">
                <thead>
                  <tr><th>Ürün</th><th>Yöntem</th><th>Miktar</th><th></th></tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.id}>
                      <td>{l.biosidalName}</td>
                      <td>{l.method}</td>
                      <td>{l.amount}</td>
                      <td>
                        <button
                          className="btn-icon btn-danger"
                          onClick={() => setLines(lines.filter((x) => x.id !== l.id))}
                        >X</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="card">
            <div className="card-title">
              <span className="card-num">5</span> Uygunsuzluklar (NCR)
            </div>
            <div className="ncr-form">
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
              <input
                type="date"
                value={ncrForm.observedAt}
                onChange={(e) => setNcrForm({ ...ncrForm, observedAt: e.target.value })}
              />
              <button className="btn" onClick={addNcr}>+ Ekle</button>
            </div>
            {ncrs.length > 0 && (
              <ul className="ncr-list">
                {ncrs.map((n) => (
                  <li key={n.id}>
                    <strong>{n.title}</strong>
                    {n.notes && <span> – {n.notes}</span>}
                    <button
                      className="btn-icon btn-danger"
                      onClick={() => setNcrs(ncrs.filter((x) => x.id !== n.id))}
                    >X</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Final Butonu */}
        <div className="final-actions">
          <button
            className="btn primary xl"
            onClick={handleInitiateCreate}
            disabled={saving}
          >
            {saving ? "KAYDEDİLİYOR…" : "KAYDET VE ÖNİZLE"}
          </button>
          <div className="muted">
            Kayıt sonrası önizlemede müşteri/personel imzası alınabilir.
          </div>
        </div>
      </div>
    </Layout>
  );
}