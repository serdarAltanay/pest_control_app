// src/pages/mailer/VisitMailCompose.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./VisitMailCompose.scss";

const TYPE_REMINDER = "REMINDER"; // Onay hatırlatma
const TYPE_SUMMARY  = "SUMMARY";  // Ziyaret özeti

/* ───────── helpers ───────── */
const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
const fmtDate = (d) =>
  `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`;
const fmtTime = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const fmtDateTime = (d) => `${fmtDate(d)} ${fmtTime(d)}`;

/** "HH:mm" | ISO | Date -> {h,m} ya da null */
function parseHhMm(v) {
  if (!v) return null;
  if (v instanceof Date && !Number.isNaN(v)) {
    return { h: v.getHours(), m: v.getMinutes() };
  }
  if (typeof v === "string") {
    const m = v.match(/^(\d{1,2}):(\d{2})/);
    if (m) return { h: Number(m[1]), m: Number(m[2]) };
    const d = new Date(v);
    if (!Number.isNaN(d)) return { h: d.getHours(), m: d.getMinutes() };
  }
  return null;
}

/** tarih + "HH:mm" → Date (saat yoksa sadece tarih döner) */
function combineDateTime(dateLike, timeLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d)) return null;
  const t = parseHhMm(timeLike);
  if (!t) return d; // saat yoksa tarih
  const out = new Date(d);
  out.setHours(t.h, t.m, 0, 0);
  return out;
}

/** Çeşitli biçimlerde gelebilen employees alanını tek satır string yap */
function employeesToText(employees, visit) {
  if (!employees && visit) {
    const fallbacks =
      visit.employeeFullName ||
      visit.employeeName ||
      [visit.employeeFirstName, visit.employeeLastName].filter(Boolean).join(" ");
    if (fallbacks && String(fallbacks).trim()) return fallbacks;
  }
  if (!employees) return "";
  if (typeof employees === "string") return employees;
  if (Array.isArray(employees)) {
    const names = employees
      .map((e) => {
        if (!e) return "";
        if (typeof e === "string") return e;
        return (
          e.fullName ||
          [e.firstName, e.lastName].filter(Boolean).join(" ") ||
          e.name ||
          ""
        );
      })
      .filter(Boolean);
    return names.join(", ");
  }
  // object vs.
  return "";
}

/** Başlıkta ve gövdede gösterilecek akıllı "ne zaman" metni */
function computeWhen(dateObj, startObj) {
  if (startObj) return fmtDateTime(startObj);
  if (dateObj)  return fmtDate(dateObj);
  return "—";
}

export default function VisitMailCompose() {
  const { visitId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [visit, setVisit] = useState(null);           // /visits/:id
  const [recipients, setRecipients] = useState([]);   // access/store/:storeId → owners

  const [type, setType] = useState(TYPE_REMINDER);
  const [toOwnerId, setToOwnerId] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [sending, setSending] = useState(false);

  // 1) Ziyaret detayını getir (storeId ve alanlar için)
  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/visits/${visitId}`);

        // tarih-saatleri düzgün kur
        const dateObj  = data?.date ? new Date(data.date) : null;
        const startObj = data?.date ? combineDateTime(data.date, data.startTime) : null;
        const endObj   = data?.date ? combineDateTime(data.date, data.endTime)   : null;

        const v = { ...data, dateObj, startObj, endObj };
        setVisit(v);

        // 2) Alıcılar: Bu mağazaya erişebilen accessOwner'lar
        if (v.storeId) {
          const g = await api.get(`/access/store/${v.storeId}`);
          const grants = Array.isArray(g.data?.grants)
            ? g.data.grants
            : (Array.isArray(g.data) ? g.data : []);
          const owners = [];
          const seen = new Set();
          grants.forEach((gr) => {
            const o = gr.owner;
            if (!o) return;
            const id = Number(o.id);
            if (seen.has(id)) return;
            seen.add(id);
            if (!o.email) return;
            owners.push({
              id,
              email: o.email,
              name: [o.firstName, o.lastName].filter(Boolean).join(" ") || o.email,
              role: o.role,
            });
          });
          setRecipients(owners);
        }
      } catch (e) {
        toast.error(e?.response?.data?.message || "Ziyaret/Alıcı bilgisi alınamadı");
      } finally {
        setLoading(false);
      }
    })();
  }, [visitId]);

  const employeesText = useMemo(() => {
    const txt = employeesToText(visit?.employees, visit);
    return (txt && String(txt).trim()) ? txt : "—";
  }, [visit]);

  const whenText = useMemo(() => {
    if (!visit) return "";
    return computeWhen(visit.dateObj, visit.startObj);
  }, [visit]);

  // default konu/gövde üreticiler
  const defaultSubject = useMemo(() => {
    if (!visit) return "";
    const storeName = visit.store?.name || visit.storeName || "";
    if (type === TYPE_REMINDER) {
      return `Onay Hatırlatma: ${visit.title || "Ziyaret"} – ${storeName} (${whenText})`;
    }
    return `Ziyaret Özeti: ${visit.title || "Ziyaret"} – ${storeName} (${whenText})`;
  }, [visit, type, whenText]);

  const ek1Url = useMemo(() => {
    // pdf/public url varsa onu kullan; yoksa ziyaret detayı
    const pdf = visit?.ek1?.publicUrl || visit?.ek1?.pdfUrl;
    return pdf || `${window.location.origin}/calendar/visit/${visitId}`;
  }, [visit, visitId]);

  const defaultHtml = useMemo(() => {
    if (!visit) return "";
    const storeName = visit.store?.name || visit.storeName || "Mağaza";
    const uygunsuz =
      visit?.notes ||
      visit?.nonconformities ||
      ""; // sen hangi alanda tutuyorsan

    if (type === TYPE_REMINDER) {
      return `
        <p>Merhaba,</p>
        <p>${storeName} lokasyonunda <b>${whenText}</b> tarihinde planlanan <b>${visit.title || "ziyaret"}</b> için onayınızı rica ederiz.</p>
        <ul>
          <li><b>Personel:</b> ${employeesText}</li>
          <li><b>Lokasyon:</b> ${storeName}</li>
        </ul>
        <p>Onay ve detaylar için: <a href="${window.location.origin}/calendar/visit/${visitId}" target="_blank">Ziyaret sayfası</a></p>
        <p>Teşekkür ederiz.</p>
      `;
    }
    // SUMMARY
    return `
      <p>Merhaba,</p>
      <p>${storeName} lokasyonunda <b>${whenText}</b> tarihinde gerçekleştirilen <b>${visit.title || "ziyaret"}</b> ile ilgili özet aşağıdadır.</p>
      <ul>
        <li><b>Personel:</b> ${employeesText}</li>
        <li><b>Lokasyon:</b> ${storeName}</li>
        <li><b>Uygunsuzluk/Gözlemler:</b> ${uygunsuz ? uygunsuz : "—"}</li>
      </ul>
      <p>Ek-1 raporu: <a href="${ek1Url}" target="_blank">Görüntüle</a></p>
      <p>İyi çalışmalar.</p>
    `;
  }, [type, visit, employeesText, ek1Url, whenText, visitId]);

  // ilk yüklemede ve type değiştiğinde konu/gövdeyi doldur (kullanıcı elle yazmışsa koru)
  useEffect(() => {
    setSubject((s) => (s ? s : defaultSubject));
    setBodyHtml((b) => (b ? b : defaultHtml));
  }, [defaultSubject, defaultHtml]);

  const send = async (e) => {
    e.preventDefault();
    if (!toOwnerId) return toast.error("Alıcı seçin");
    if (!subject.trim()) return toast.error("Konu girin");
    if (!bodyHtml.trim()) return toast.error("İçerik girin");

    try {
      setSending(true);
      await api.post(`/mail/visit/${visitId}/send`, {
        type,
        toOwnerId: Number(toOwnerId),
        subject,
        html: bodyHtml,
      });
      toast.success("E-posta gönderildi");
      navigate(-1);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Mail gönderilemedi");
    } finally {
      setSending(false);
    }
  };

  return (
    <Layout>
      <div className="mail-compose-page">
        <div className="page-header">
          <h1>Mail Düzenle</h1>
          <div className="actions">
            <Link className="btn" to={visit ? `/calendar/visit/${visitId}` : "/"}>Ziyarete Dön</Link>
          </div>
        </div>

        {loading ? (
          <div className="card card-body">Yükleniyor…</div>
        ) : !visit ? (
          <div className="card card-body">Ziyaret bulunamadı.</div>
        ) : (
          <div className="grid-2">
            {/* SOL: form */}
            <section className="mc-section">
              <div className="sec-head">
                <div>Alıcı & Şablon</div>
                <div className="right">
                  <div className="type-tabs">
                    <button
                      type="button"
                      className={`tab ${type === TYPE_REMINDER ? "active" : ""}`}
                      onClick={() => { setType(TYPE_REMINDER); setSubject(""); setBodyHtml(""); }}
                    >
                      Onay Hatırlatma
                    </button>
                    <button
                      type="button"
                      className={`tab ${type === TYPE_SUMMARY ? "active" : ""}`}
                      onClick={() => { setType(TYPE_SUMMARY); setSubject(""); setBodyHtml(""); }}
                    >
                      Ziyaret Özeti
                    </button>
                  </div>
                </div>
              </div>

              <div className="sec-body">
                <form onSubmit={send}>
                  <div className="row">
                    <div>
                      <label>Alıcı (bu mağazaya erişebilen)</label>
                      <select value={toOwnerId} onChange={(e)=>setToOwnerId(e.target.value)} required>
                        <option value="">Seçin…</option>
                        {recipients.map(r=>(
                          <option key={r.id} value={r.id}>
                            {r.name} ({r.email}) – {r.role}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label>Mail Türü</label>
                      <select value={type} onChange={(e)=>{ setType(e.target.value); setSubject(""); setBodyHtml(""); }}>
                        <option value={TYPE_REMINDER}>Onay Hatırlatma</option>
                        <option value={TYPE_SUMMARY}>Ziyaret Bilgilendirme</option>
                      </select>
                    </div>
                  </div>

                  <label>Konu</label>
                  <input className="subject-input" value={subject} onChange={(e)=>setSubject(e.target.value)} />

                  <label>İçerik (HTML)</label>
                  <textarea rows={16} value={bodyHtml} onChange={(e)=>setBodyHtml(e.target.value)} />

                  <div className="btn-row" style={{ marginTop: 10 }}>
                    <button className="btn primary" disabled={sending}>
                      {sending ? "Gönderiliyor…" : "Gönder"}
                    </button>
                    <span className="muted">Konu ve içerik düzenlenebilir. Gönder’e bastığınız anda mail gönderilir.</span>
                  </div>
                </form>
              </div>
            </section>

            {/* SAĞ: özet & önizleme */}
            <section className="mc-section preview-card">
              <div className="sec-head">
                <div>Ziyaret Özeti</div>
              </div>
              <div className="sec-body">
                <div className="grid" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
                  <div><label>Başlık</label><div><b>{visit.title || "—"}</b></div></div>
                  <div><label>Mağaza</label><div>{visit.store?.name || visit.storeName || "—"}</div></div>
                  <div><label>Tarih</label><div>{whenText}</div></div>
                  <div><label>Personel</label><div>{employeesText}</div></div>
                </div>

                <div className="hr" />

                <div className="preview-head">
                  <div className="subline"><span className="dot" />Canlı Önizleme</div>
                </div>
                <div className="preview-body">
                  <div className="mail-frame">
                    <div className="mail-subject">{subject || "(Konu yok)"}</div>
                    <div className="mail-html">
                      {/* editöre HTML yazıldığı için burada düz text gösterimi */}
                      <pre>{bodyHtml || "(İçerik boş)"}</pre>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </Layout>
  );
}
