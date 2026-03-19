import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import useAuth from "../../hooks/useAuth";
import VisitStatusModal from "../../components/VisitStatusModal";
import "./Ek1.scss";

const PEST_OPTIONS = [
  "Kemirgen", "Hamamböceği", "Karınca", "Uçan Haşere", "Yürüyen Haşere", "Pire",
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

export default function FastEk1() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isLevel1 = user?.role === "employee" && user?.level === 1;
  const isLevel2 = user?.role === "employee" && user?.level === 2;

  // Selection state
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");

  // Form Data state (same as StoreEk1)
  const [store, setStore] = useState(null);
  const [biocides, setBiocides] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [savingAll, setSavingAll] = useState(false);
  const [existingEvent, setExistingEvent] = useState(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  /* Weekly Plans */
  const [weeklyEvents, setWeeklyEvents] = useState([]);
  const [updatingEventId, setUpdatingEventId] = useState(null);

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

  // 1. Fetch Customers
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/customers");
        setCustomers(Array.isArray(data) ? data.filter(c => c.code !== "FREE") : []);
      } catch (err) {
        toast.error("Müşteri listesi yüklenemedi.");
      }
    })();
  }, []);

  // 2. Fetch Stores when Customer changes
  useEffect(() => {
    if (!selectedCustomerId) {
        setStores([]);
        setSelectedStoreId("");
        return;
    }
    (async () => {
        try {
            const { data } = await api.get(`/stores/customer/${selectedCustomerId}`);
            setStores(Array.isArray(data) ? data : []);
            setSelectedStoreId("");
            setStore(null);
        } catch (err) {
            toast.error("Mağaza listesi yüklenemedi.");
        }
    })();
  }, [selectedCustomerId]);

  // 3. Update store data when Store changes
  useEffect(() => {
    if (!selectedStoreId) {
        setStore(null);
        setWeeklyEvents([]);
        return;
    }
    (async () => {
        try {
            const resS = await api.get(`/stores/${selectedStoreId}`);
            setStore(resS.data);
            
            // Biyosidal ve Personel listelerini ayırarak alıyoruz ki biri hata verirse diğeri yüklenmeye devam etsin
            api.get("/biocides")
                .then(res => setBiocides(Array.isArray(res.data) ? res.data : []))
                .catch(err => console.error("Biocides fetch error:", err));

            api.get("/employees")
                .then(res => setAllEmployees(Array.isArray(res.data) ? res.data : []))
                .catch(err => console.error("Employees fetch error:", err));

            // Fetch Weekly Plans
            fetchWeeklyPlans(selectedStoreId);

        } catch (err) {
            console.error("Store fetch error:", err);
            toast.error("Mağaza verisi yüklenemedi.");
        }
    })();
  }, [selectedStoreId]);

  const fetchWeeklyPlans = async (storeId) => {
    try {
        const now = new Date();
        const firstDay = new Date(now.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1))); // Pazartesi
        firstDay.setHours(0, 0, 0, 0);
        const lastDay = new Date(firstDay);
        lastDay.setDate(firstDay.getDate() + 6); // Pazar
        lastDay.setHours(23, 59, 59, 999);

        const { data } = await api.get("/schedule/events", {
            params: { storeId: Number(storeId), from: firstDay.toISOString(), to: lastDay.toISOString() }
        });
        setWeeklyEvents(Array.isArray(data) ? data : []);
    } catch (err) {
        console.error("Weekly plans fetch error:", err);
    }
  };

  const updateEventStatus = async (eventId, newStatus) => {
    try {
        setUpdatingEventId(eventId);
        await api.put(`/schedule/events/${eventId}`, { status: newStatus });
        toast.success("Ziyaret durumu güncellendi.");
        fetchWeeklyPlans(selectedStoreId);
    } catch (err) {
        toast.error("Durum güncellenemedi.");
    } finally {
        setUpdatingEventId(null);
    }
  };

  // Existing Event check (from StoreEk1)
  useEffect(() => {
    if (!selectedStoreId || !formVisit.date) return;
    (async () => {
      try {
        const d = new Date(formVisit.date);
        const from = new Date(d.setHours(0, 0, 0, 0)).toISOString();
        const to = new Date(d.setHours(23, 59, 59, 999)).toISOString();

        const resEv = await api.get("/schedule/events", {
          params: { storeId: Number(selectedStoreId), from, to }
        });
        if (resEv.data?.length > 0) {
          const ev = resEv.data[0];
          setExistingEvent(ev);
          setFormVisit(prev => {
            const updates = {};
            if (!prev.startTime && ev.start) {
              const sd = new Date(ev.start);
              updates.startTime = `${String(sd.getHours()).padStart(2, "0")}:${String(sd.getMinutes()).padStart(2, "0")}`;
            }
            if (!prev.endTime && ev.end) {
              const ed = new Date(ev.end);
              updates.endTime = `${String(ed.getHours()).padStart(2, "0")}:${String(ed.getMinutes()).padStart(2, "0")}`;
            }
            if (prev.employees.length === 0 && ev.employee) {
              updates.employees = [ev.employee];
            }
            if (Object.keys(updates).length > 0) return { ...prev, ...updates };
            return prev;
          });
        } else {
          setExistingEvent(null);
        }
      } catch (err) {
        console.warn("Event check error", err);
      }
    })();
  }, [selectedStoreId, formVisit.date]);

  const onVisitChange = (e) =>
    setFormVisit((p) => ({ ...p, [e.target.name]: e.target.value }));

  const togglePest = (label) =>
    setFormVisit((p) => ({
      ...p,
      targetPests: p.targetPests.includes(label)
        ? p.targetPests.filter((x) => x !== label)
        : [...p.targetPests, label],
    }));

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

  const addStagedNcr = (e) => {
    e.preventDefault();
    if (!ncrForm.title.trim()) return toast.error("NCR başlığı zorunludur.");
    setStagedNcrs([...stagedNcrs, { ...ncrForm, id: crypto.randomUUID() }]);
    setNcrForm({ category: NCR_CATS[0], title: "", notes: "", observedAt: new Date().toISOString().slice(0, 10) });
  };

  const handleStartSaveFlow = () => {
    if (!selectedStoreId) return toast.error("Lütfen bir mağaza seçin.");
    if (!formVisit.date) return toast.error("Ziyaret tarihi zorunludur.");
    if (existingEvent) {
      setIsStatusModalOpen(true);
    } else {
      onFinalConfirm();
    }
  };

  const handleStatusConfirm = async (newStatus) => {
    try {
      setSavingAll(true);
      if (existingEvent?.id) {
        await api.put(`/schedule/events/${existingEvent.id}`, { status: newStatus });
      }
      setIsStatusModalOpen(false);
      await onFinalConfirm();
    } catch {
      setSavingAll(false);
      toast.error("Ziyaret durumu güncellenemedi.");
    }
  };

  const onFinalConfirm = async () => {
    setSavingAll(true);
    try {
      let finalEndTime = formVisit.endTime;
      if (isLevel2) {
        const now = new Date();
        finalEndTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      }

      const { data } = await api.post("/visits", {
        ...formVisit,
        endTime: finalEndTime,
        storeId: Number(selectedStoreId),
      });
      const visitId = data?.visit?.id;
      if (!visitId) throw new Error("Ziyaret oluşturulamadı");

      await Promise.all([
        ...stagedLines.map((l) => api.post(`/ek1/visit/${visitId}/lines`, l)),
        ...stagedNcrs.map((n) => {
          const fd = new FormData();
          fd.append("category", n.category);
          fd.append("observedAt", n.observedAt);
          if (n.title) fd.append("title", n.title);
          if (n.notes) fd.append("notes", n.notes);
          if (n.file) fd.append("image", n.file);
          return api.post(`/nonconformities/store/${selectedStoreId}`, fd);
        }),
      ]);

      await api.post(`/ek1/visit/${visitId}/submit`);
      toast.success("Ziyaret kaydedildi. Önizleme açılıyor…");
      navigate(`/admin/stores/${selectedStoreId}/visits/${visitId}/preview`);
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
            Hızlı EK-1 Doldur
          </h1>
          <div className="header-actions">
            <Link className="btn ghost" to="/work">İptal</Link>
          </div>
        </div>

        {/* 0 - Selection Section */}
        <section className="card form" style={{ border: "2px solid var(--primary)", background: "var(--light-bg)" }}>
            <div className="card-title">
                Müşteri ve Mağaza Seçimi
            </div>
            <div className="grid-2">
                <div>
                    <label>Müşteri <span className="req">*</span></label>
                    <select value={selectedCustomerId} onChange={(e) => setSelectedCustomerId(e.target.value)}>
                        <option value="">Müşteri Seçiniz...</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                </div>
                <div>
                    <label>Mağaza <span className="req">*</span></label>
                    <select 
                        value={selectedStoreId} 
                        onChange={(e) => setSelectedStoreId(e.target.value)}
                        disabled={!selectedCustomerId}
                    >
                        <option value="">Mağaza Seçiniz...</option>
                        {stores.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code || 'Kodsüz'})</option>)}
                    </select>
                </div>
            </div>
        </section>

        {selectedStoreId && weeklyEvents.length > 0 && (
            <section className="card weekly-plans">
                <div className="card-title">
                    <span className="card-num" style={{background: "#3b82f6"}}>?</span> Bu Haftaki Planlı Ziyaretler
                </div>
                <div className="plans-list">
                    {weeklyEvents.map(ev => {
                        const dateStr = new Date(ev.start).toLocaleDateString("tr-TR", { weekday: 'long', day: 'numeric', month: 'long' });
                        return (
                            <div key={ev.id} className={`plan-item status-${ev.status?.toLowerCase()}`}>
                                <div className="plan-info">
                                    <div className="plan-date">{dateStr}</div>
                                    <div className="plan-title">{ev.title || "Planlı Ziyaret"}</div>
                                    <div className={`plan-status-badge ${ev.status?.toLowerCase()}`}>{ev.status}</div>
                                </div>
                                <div className="plan-actions">
                                    <button 
                                        className="btn ghost sm" 
                                        onClick={() => updateEventStatus(ev.id, "COMPLETED")}
                                        disabled={updatingEventId === ev.id}
                                    >
                                        Tamamlandı
                                    </button>
                                    <button 
                                        className="btn ghost sm danger-text" 
                                        onClick={() => updateEventStatus(ev.id, "CANCELLED")}
                                        disabled={updatingEventId === ev.id}
                                    >
                                        İptal
                                    </button>
                                    <button 
                                        className="btn ghost sm" 
                                        onClick={() => updateEventStatus(ev.id, "PENDING")}
                                        disabled={updatingEventId === ev.id}
                                    >
                                        Beklemede
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>
        )}

        {selectedStoreId && store && (
            <>
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
                    <label>Çıkış Saati {isLevel2 && <small style={{color:"#888"}}>(Kayıt anında dolacak)</small>}</label>
                    <select name="endTime" value={formVisit.endTime} onChange={onVisitChange} disabled={isLevel2}>
                        <option value="">{isLevel2 ? "Kayıt anında belirlenir" : "Seçiniz"}</option>
                        {!isLevel2 && timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    </div>
                    <div>
                    <label>Uygulayıcı Personel</label>
                    <select
                        name="employees"
                        value={formVisit.employees?.[0]?.id || ""}
                        onChange={(e) => {
                        const emp = allEmployees.find(x => String(x.id) === e.target.value);
                        setFormVisit(p => ({ ...p, employees: emp ? [emp] : [] }));
                        }}
                    >
                        <option value="">Seçiniz</option>
                        {allEmployees.map((e) => (
                        <option key={e.id} value={e.id}>{e.fullName || e.name || e.email}</option>
                        ))}
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
                    {savingAll ? "İŞLENİYOR…" : "KAYDET VE ÖNİZLE"}
                </button>
                <div className="muted">
                    Kayıt sonrası önizlemede müşteri/personel imzası alınabilir.
                </div>
                </div>
            </>
        )}

        <VisitStatusModal
          isOpen={isStatusModalOpen}
          onClose={() => setIsStatusModalOpen(false)}
          onConfirm={handleStatusConfirm}
          initialStatus={existingEvent?.status}
          visitTitle={existingEvent?.title || "Ziyaret"}
        />
      </div>
    </Layout>
  );
}
