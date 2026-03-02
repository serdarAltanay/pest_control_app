import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import VisitStatusModal from "../../components/VisitStatusModal";
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

const VISIT_TYPE_TR = {
  TEK_SEFERLIK: "Tek Seferlik Ziyaret",
  PERIYODIK: "Periyodik Ziyaret",
  ACIL_CAGRI: "Acil Çağrı",
  ISTASYON_KURULUM: "İstasyon Kurulum",
  ILK_ZIYARET: "İlk Ziyaret",
  DIGER: "Diğer",
};

const timeOptions = (() => {
  const out = [];
  for (let t = 8 * 60; t <= 20 * 60; t += 15) {
    out.push(`${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
  }
  return out;
})();

export default function VisitEk1() {
  const { storeId, visitId } = useParams();
  const navigate = useNavigate();

  const [biocides, setBiocides] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [lines, setLines] = useState([]);
  const [bundle, setBundle] = useState(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [existingEvent, setExistingEvent] = useState(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [autoFilled, setAutoFilled] = useState({});

  /* Visit Info Form */
  const [formVisit, setFormVisit] = useState({
    startTime: "", endTime: "",
    employees: [],
  });

  const [form, setForm] = useState({ biosidalId: "", method: "PULVERIZE", amount: "" });

  const loadAll = async () => {
    try {
      const [resB, resL, resBundle, resE] = await Promise.all([
        api.get("/biocides"),
        api.get(`/ek1/visit/${visitId}/lines`),
        api.get(`/ek1/visit/${visitId}`),
        api.get("/employees").catch(() => api.get("/admin/employees")),
      ]);
      setBiocides(Array.isArray(resB.data) ? resB.data : []);
      setLines(Array.isArray(resL.data) ? resL.data : []);
      setAllEmployees(Array.isArray(resE.data) ? resE.data : []);
      const bData = resBundle.data;
      setBundle(bData);

      // Metada doldur
      if (bData?.visit) {
        setFormVisit({
          startTime: bData.visit.startTime || "",
          endTime: bData.visit.endTime || "",
          employees: Array.isArray(bData.visit.employees) ? bData.visit.employees :
            (typeof bData.visit.employees === 'string' ? [bData.visit.employees] : [])
        });
      }

      // Mevcut ziyarete bağlı bir takvim kaydı (ScheduleEvent) var mı?
      // Not: visit.date ve storeId ile sorgulayalım.
      if (bData?.visit?.date && bData?.visit?.storeId) {
        const d = new Date(bData.visit.date);
        const from = new Date(d.setHours(0, 0, 0, 0)).toISOString();
        const to = new Date(d.setHours(23, 59, 59, 999)).toISOString();

        const resEv = await api.get("/schedule/events", {
          params: { storeId: bData.visit.storeId, from, to }
        });
        if (resEv.data?.length > 0) {
          const ev = resEv.data[0];
          setExistingEvent(ev);

          // OTOMATIK DOLDURMA (Eğer visit verisi eksikse)
          setFormVisit(prev => {
            const updates = {};
            const filledFields = {};
            if (!prev.startTime && ev.start) {
              const sd = new Date(ev.start);
              updates.startTime = `${String(sd.getHours()).padStart(2, "0")}:${String(sd.getMinutes()).padStart(2, "0")}`;
              filledFields.startTime = true;
            }
            if (!prev.endTime && ev.end) {
              const ed = new Date(ev.end);
              updates.endTime = `${String(ed.getHours()).padStart(2, "0")}:${String(ed.getMinutes()).padStart(2, "0")}`;
              filledFields.endTime = true;
            }
            if (prev.employees.length === 0 && ev.employeeId) {
              const emp = (resE.data || []).find(e => e.id === ev.employeeId);
              if (emp) {
                updates.employees = [emp];
                filledFields.employees = true;
              } else {
                // If ev.employee happens to be an object instead of string ID
                const empObj = ev.employee && typeof ev.employee === 'object' ? ev.employee : null;
                if (empObj && empObj.id) {
                  updates.employees = [empObj];
                  filledFields.employees = true;
                }
              }
            }
            if (Object.keys(filledFields).length > 0) {
              setAutoFilled(filledFields);
            }
            if (Object.keys(updates).length > 0) return { ...prev, ...updates };
            return prev;
          });
        }
      }
    } catch {
      toast.error("Veriler yüklenemedi.");
    }
  };

  useEffect(() => { loadAll(); }, [visitId]);

  /* Store bilgileri (bundle'dan) */
  const storeName = bundle?.store?.name || "";
  const storeAddress = bundle?.store?.address || "";
  const storeManager = bundle?.store?.manager || "";
  const visitDate = bundle?.visit?.date
    ? new Date(bundle.visit.date).toLocaleDateString("tr-TR", {
      day: "2-digit", month: "2-digit", year: "numeric"
    })
    : "";
  const visitTypeStr = bundle?.visit?.visitType ? (VISIT_TYPE_TR[bundle.visit.visitType] || bundle.visit.visitType) : "";

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

    // Eğer takvimde planlı bir kayıt varsa modalı aç
    if (existingEvent) {
      setIsStatusModalOpen(true);
    } else {
      onConfirmFinalSubmission();
    }
  };

  /* Modal Onayı */
  const handleStatusConfirm = async (newStatus) => {
    try {
      setSubmitting(true);
      if (existingEvent?.id) {
        await api.put(`/schedule/events/${existingEvent.id}`, { status: newStatus });
      }
      setIsStatusModalOpen(false);
      await onConfirmFinalSubmission();
    } catch {
      setSubmitting(false);
      toast.error("Ziyaret durumu güncellenemedi.");
    }
  };

  /* Kaydet → Preview'a Yönlendir */
  const onConfirmFinalSubmission = async () => {
    setSubmitting(true);

    try {
      /* Meta Güncelle */
      await api.put(`/visits/${visitId}`, {
        startTime: formVisit.startTime,
        endTime: formVisit.endTime,
        employees: formVisit.employees,
      });

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

        {/* Planlı Ziyaret Bilgi Kartı */}
        {bundle && (storeName || storeAddress || storeManager || visitDate) && (
          <section className="card visit-info-card">
            <div className="card-title">
              <span className="card-num" style={{ background: '#3b82f6' }}>ℹ</span> Planlı Ziyaret Bilgileri
              <span className="auto-badge-header">otomatik dolduruldu</span>
            </div>
            <div className="visit-info-grid">
              {storeName && (
                <div className="visit-info-item">
                  <span className="visit-info-icon">🏪</span>
                  <div>
                    <div className="visit-info-label">Mağaza Adı</div>
                    <div className="visit-info-value">{storeName}</div>
                  </div>
                </div>
              )}
              {storeAddress && (
                <div className="visit-info-item">
                  <span className="visit-info-icon">📍</span>
                  <div>
                    <div className="visit-info-label">Mağaza Adresi</div>
                    <div className="visit-info-value">{storeAddress}</div>
                  </div>
                </div>
              )}
              {storeManager && (
                <div className="visit-info-item">
                  <span className="visit-info-icon">👤</span>
                  <div>
                    <div className="visit-info-label">Mağaza Sorumlusu</div>
                    <div className="visit-info-value">{storeManager}</div>
                  </div>
                </div>
              )}
              {visitDate && (
                <div className="visit-info-item">
                  <span className="visit-info-icon">📅</span>
                  <div>
                    <div className="visit-info-label">Ziyaret Tarihi</div>
                    <div className="visit-info-value">{visitDate}</div>
                  </div>
                </div>
              )}
              {visitTypeStr && (
                <div className="visit-info-item">
                  <span className="visit-info-icon">🏷️</span>
                  <div>
                    <div className="visit-info-label">Ziyaret Türü</div>
                    <div className="visit-info-value">{visitTypeStr}</div>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Ziyaret Bilgileri (Zaman ve Personel) */}
        <section className="card form">
          <div className="card-title">
            <span className="card-num">1</span> Ziyaret Detayları
          </div>
          <div className="grid-3">
            <div>
              <label>
                Giriş Saati
                {autoFilled.startTime && <span className="auto-badge">otomatik</span>}
              </label>
              <select
                value={formVisit.startTime}
                onChange={(e) => setFormVisit({ ...formVisit, startTime: e.target.value })}
              >
                <option value="">Seçiniz</option>
                {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label>
                Çıkış Saati
                {autoFilled.endTime && <span className="auto-badge">otomatik</span>}
              </label>
              <select
                value={formVisit.endTime}
                onChange={(e) => setFormVisit({ ...formVisit, endTime: e.target.value })}
              >
                <option value="">Seçiniz</option>
                {timeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label>
                Uygulayıcı Personel
                {autoFilled.employees && <span className="auto-badge">otomatik</span>}
              </label>
              <select
                value={formVisit.employees?.[0]?.id || ""}
                onChange={(e) => {
                  const emp = allEmployees.find(x => String(x.id) === e.target.value);
                  setFormVisit({ ...formVisit, employees: emp ? [emp] : [] });
                }}
              >
                <option value="">Seçiniz</option>
                {allEmployees.map((e) => (
                  <option key={e.id} value={e.id}>{e.fullName || e.name || e.email}</option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Ürün Ekleme Formu */}
        <section className="card">
          <div className="card-title">
            <span className="card-num">2</span> Kullanılan Biyosidal Ürünler
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