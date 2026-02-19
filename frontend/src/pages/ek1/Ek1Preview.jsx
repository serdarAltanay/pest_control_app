import { useEffect, useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import SignatureModal from "../../components/SignatureModal.jsx";
import "./Ek1Preview.scss";

import trHealthLogo from "../../assets/saglıkb_logo.png";
import QRCode from "react-qr-code";

const VISIT_TYPE_TR = {
  TEK_SEFERLIK: "Tek Seferlik Ziyaret",
  PERIYODIK: "Periyodik Ziyaret",
  ACIL_CAGRI: "Acil Çağrı",
  ISTASYON_KURULUM: "İstasyon Kurulum",
  ILK_ZIYARET: "İlk Ziyaret",
  DIGER: "Diğer",
};
const UNIT_TR = { ML: "ML", GR: "Gr", LT: "LT", KG: "KG", ADET: "Adet" };
const METHOD_TR = {
  ULV: "ULV",
  PUSKURTME: "Püskürtme",
  JEL: "Jel",
  SISLEME: "Sisleme",
  YENILEME: "Yenileme",
  ATOMIZER: "Atomizer",
  YEMLEME: "Yemleme",
  "PULVERİZE": "Pulverize",
  PULVERIZE: "Pulverize",
};

const role = (localStorage.getItem("role") || "").toLowerCase();
const isCustomerRole = role === "customer";
const isAdminRole = role === "admin";
const isEmployeeRole = role === "employee";

const fmtTRDate = (d) => (d ? new Date(d).toLocaleDateString("tr-TR") : "—");
const fmtTRDateTime = (d) =>
  d
    ? new Date(d).toLocaleString("tr-TR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    })
    : "—";

const joinSafe = (arr, sep = ", ") =>
  (Array.isArray(arr) ? arr : [])
    .map((x) => (typeof x === "string" ? x : x?.fullName || x?.name || x?.email || ""))
    .filter(Boolean)
    .join(sep) || "—";

function normalizeEmployees(e) {
  if (!e) return "—";
  if (typeof e === "string") return e;
  if (Array.isArray(e)) return joinSafe(e);
  if (typeof e === "object") {
    const list = e.names || e.list || e.employees || Object.values(e);
    return joinSafe(list);
  }
  return "—";
}

function normalizeTargetPests(v) {
  if (!v) return "—";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.join(", ");
  if (typeof v === "object") {
    const list = v.list || v.names || Object.values(v);
    return Array.isArray(list) ? list.join(", ") : "—";
  }
  return "—";
}

function getCurrentUserDisplayName() {
  return (
    localStorage.getItem("name") ||
    localStorage.getItem("fullName") ||
    localStorage.getItem("email") ||
    "Yetkili"
  );
}

/* ────────────────────────────────────────
   İmza Kutusu — sade, resmi, renksiz
   ──────────────────────────────────────── */
function SignatureBox({ signedAt, signerName, signatureBase64, signLog, description }) {
  // Audit cümlesini oluştur
  let auditSentence = null;
  if (signedAt) {
    const d = new Date(signedAt);
    const tarih = d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
    const saat = d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });

    const parts = [`${tarih} tarihinde ${saat} saatinde`];

    if (signLog?.coords?.lat && signLog?.coords?.lng) {
      parts.push(`${signLog.coords.lat.toFixed(5)}, ${signLog.coords.lng.toFixed(5)} konumunda`);
    }

    if (signLog?.ip) {
      parts.push(`${signLog.ip} IP'li cihazdan`);
    }

    auditSentence = parts.join(" ") + " imza alınmıştır.";
  }

  return (
    <div className="sig-box">
      {/* İmza alanı — kenarlıksız */}
      <div className="sig-box__area">
        {signedAt && signatureBase64 ? (
          <img src={signatureBase64} alt="imza" className="sig-box__img" />
        ) : null}
      </div>

      {/* İmzalayan adı — ortada */}
      <div className="sig-box__name">{signedAt ? (signerName || "—") : ""}</div>

      {/* Açıklama */}
      <div className="sig-box__description">{description}</div>

      {/* Audit cümlesi — silik yazı */}
      {auditSentence && (
        <div className="sig-box__audit-sentence">{auditSentence}</div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────
   Ana Bileşen
   ──────────────────────────────────────── */
export default function Ek1Preview() {
  const { visitId } = useParams();
  const navigate = useNavigate();
  const [bundle, setBundle] = useState(null);
  const [busy, setBusy] = useState(false);
  const docUrl = useMemo(() => window.location.href, [visitId]);

  const [isSigModalOpen, setIsSigModalOpen] = useState(false);
  const [sigKind, setSigKind] = useState(null);

  const loadAll = async () => {
    try {
      const { data } = await api.get(`/ek1/visit/${visitId}`);
      console.log("[EK1] loadAll report:", {
        providerSignedAt: data?.report?.providerSignedAt,
        customerSignedAt: data?.report?.customerSignedAt,
        status: data?.report?.status,
      });
      setBundle(data);
    } catch (e) {
      toast.error(e?.response?.data?.message || "EK-1 verisi alınamadı");
    }
  };

  useEffect(() => { loadAll(); }, [visitId]);

  const { visit, store, provider, lines = [], report } = bundle || {};

  const isFree = report?.freeMeta?.type === "FREE";
  const fm = report?.freeMeta || {};

  const displayStoreName = isFree ? fm.storeName || "—" : store?.name || "—";
  const displayAddress = isFree ? fm.address || "—" : store?.address || "—";
  const displayPlaceType = isFree ? fm.placeType || "—" : store?.placeType || "—";
  const displayAreaM2 = isFree ? fm.areaM2 ?? "—" : store?.areaM2 ?? "—";

  const visitTypeTR = isFree
    ? VISIT_TYPE_TR[fm.visitKind] || "Tek Seferlik Ziyaret"
    : VISIT_TYPE_TR[visit?.visitType] || visit?.visitType || "—";

  const dateTR = useMemo(() => fmtTRDate(visit?.date), [visit]);
  const employeesStr = useMemo(() => normalizeEmployees(visit?.employees), [visit]);
  const targetPestsStr = useMemo(() => normalizeTargetPests(visit?.targetPests), [visit]);

  const freeNcrs = (Array.isArray(fm.ncrs) ? fm.ncrs : []).filter((n) => n?.title || n?.notes);
  const ncrText = isFree
    ? freeNcrs.length === 0
      ? "—"
      : freeNcrs
        .map((n, i) => `${i + 1}) ${(n.title || "").trim()}${n.notes ? " – " + n.notes : ""}`)
        .join(" | ")
    : "—";

  const selfName = getCurrentUserDisplayName();
  const managerName = store?.manager || null;

  const [providerSigner, setProviderSigner] = useState("self");
  const [customerSigner, setCustomerSigner] = useState(isAdminRole ? "manager" : "self");

  const resolveProviderSignName = () =>
    providerSigner === "manager" && managerName ? managerName : selfName;
  const resolveCustomerSignName = () =>
    isCustomerRole
      ? selfName
      : customerSigner === "manager" && managerName
        ? managerName
        : selfName;

  const startSigning = (kind) => {
    setSigKind(kind);
    setIsSigModalOpen(true);
  };

  const onConfirmSignature = async (base64) => {
    const currentSigKind = sigKind; // capture at call time to prevent stale closure
    console.log("[EK1] onConfirmSignature called, sigKind:", currentSigKind);

    if (!currentSigKind || !["provider", "customer"].includes(currentSigKind)) {
      toast.error("İmza türü belirsiz, lütfen tekrar deneyin.");
      return;
    }

    setBusy(true);
    setIsSigModalOpen(false);

    let coords = null;
    try {
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 3000 })
      );
      coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch {
      console.warn("Konum alınamadı.");
    }

    try {
      const signerName =
        currentSigKind === "customer" ? resolveCustomerSignName() : resolveProviderSignName();

      console.log("[EK1] Posting to:", `/ek1/visit/${visitId}/sign/${currentSigKind}`, "signer:", signerName);

      await api.post(`/ek1/visit/${visitId}/sign/${currentSigKind}`, {
        name: signerName,
        signature: base64,
        coords,
        deviceInfo:
          navigator.userAgent.includes("Tablet") || navigator.userAgent.includes("iPad")
            ? "Şirket Tableti"
            : "Mobil Cihaz",
      });

      await loadAll();
      toast.success(
        currentSigKind === "customer"
          ? "Müşteri imzası kaydedildi."
          : "Personel imzası kaydedildi."
      );
    } catch (e) {
      console.error("[EK1] Sign error:", e);
      toast.error(e?.response?.data?.message || "İmza kaydedilemedi.");
    } finally {
      setBusy(false);
      setSigKind(null); // reset for next use
    }
  };

  const providerSigned = !!report?.providerSignedAt;
  const customerSigned = !!report?.customerSignedAt;

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(isCustomerRole ? "/customer/stores" : "/work");
    }
  };

  return (
    <Layout>
      <div className="ek1-print">

        {/* ── Araç Çubuğu ── */}
        <div className="toolbar no-print">
          <button className="btn ghost" onClick={handleBack}>Geri</button>

          <span className={`status-pill status-pill--${(report?.status || "draft").toLowerCase()}`}>
            {report?.status === "APPROVED" && "Onaylandı"}
            {report?.status === "SUBMITTED" && "Onay Bekliyor"}
            {(report?.status === "DRAFT" || !report?.status) && "Taslak"}
          </span>

          <button className="btn" onClick={() => window.print()}>Yazdır / PDF</button>

          {!providerSigned && (isAdminRole || isEmployeeRole) && (
            <div className="btn-group">
              {managerName && (
                <select className="btn ghost" value={providerSigner} onChange={(e) => setProviderSigner(e.target.value)}>
                  <option value="self">{selfName}</option>
                  <option value="manager">{managerName}</option>
                </select>
              )}
              <button className="btn primary" onClick={() => startSigning("provider")} disabled={busy}>
                {busy ? "İşleniyor…" : "Personel İmzası"}
              </button>
            </div>
          )}

          {!customerSigned && (isAdminRole || isEmployeeRole || isCustomerRole) && (
            <div className="btn-group">
              {isAdminRole && managerName && (
                <select className="btn ghost" value={customerSigner} onChange={(e) => setCustomerSigner(e.target.value)}>
                  <option value="manager">{managerName}</option>
                  <option value="self">{selfName}</option>
                </select>
              )}
              <button className="btn warn" onClick={() => startSigning("customer")} disabled={busy}>
                {busy ? "İşleniyor…" : "Müşteri Onayı Al"}
              </button>
            </div>
          )}
        </div>

        {/* ── A4 Belge ── */}
        <div className="page A4">

          {/* Başlık */}
          <header className="doc-head">
            <img src={trHealthLogo} alt="T.C. Sağlık Bakanlığı" className="doc-head__logo" />
            <div className="doc-head__center">
              <div className="doc-head__sup">T.C. SAĞLIK BAKANLIĞI</div>
              <h1 className="doc-head__title">EK-1 BİYOSİDAL UYGULAMA İŞLEM FORMU</h1>
              <div className="doc-head__meta">
                Belge No: EK1-{visitId}&nbsp;&nbsp;|&nbsp;&nbsp;Tarih: {dateTR}&nbsp;&nbsp;|&nbsp;&nbsp;Durum: {report?.status || "DRAFT"}
              </div>
            </div>
            <div className="doc-head__qr">
              <QRCode value={docUrl} size={60} level="M" />
              <div className="doc-head__qr-label">Doğrulama QR</div>
            </div>
          </header>

          {/* BÖLÜM 1 */}
          <section className="block">
            <div className="block-title">1. UYGULAMAYI YAPANA AİT BİLGİLER</div>
            <table className="kv">
              <colgroup><col style={{ width: "42%" }} /><col /></colgroup>
              <tbody>
                <tr><th>Belge Seri No</th><td>{provider?.certificateSerial || "—"}</td></tr>
                <tr><th>Uygulamayı Yapan Firma Adı</th><td>{provider?.companyName || "—"}</td></tr>
                <tr><th>Açık Adresi</th><td>{provider?.address || "—"}</td></tr>
                <tr><th>Mesul Müdür</th><td>{provider?.responsibleTitle || provider?.responsibleName || "—"}</td></tr>
                <tr><th>Uygulayıcı/lar Adı Soyadı</th><td>{employeesStr}</td></tr>
                <tr><th>Telefon / Faks Numarası</th><td>{provider?.phoneFax || "—"}</td></tr>
                <tr><th>Müdürlük İzin Tarih ve Sayısı</th><td>{provider?.permissionNo || "—"}</td></tr>
              </tbody>
            </table>
          </section>

          {/* BÖLÜM 2 */}
          <section className="block">
            <div className="block-title">2. KULLANILAN BİYOSİDAL ÜRÜNE AİT BİLGİLER</div>
            <table className="list">
              <thead>
                <tr>
                  <th style={{ width: "4%" }}>#</th>
                  <th>Ürün Adı</th>
                  <th>Aktif Madde</th>
                  <th>Ürün Antidotu</th>
                  <th>Uygulama Şekli</th>
                  <th style={{ width: "12%" }}>Miktar</th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr><td colSpan={6} className="center">—</td></tr>
                ) : (
                  lines.map((l, i) => (
                    <tr key={l.id ?? i}>
                      <td>{i + 1}</td>
                      <td>{l.biosidal?.name || "—"}</td>
                      <td>{l.biosidal?.activeIngredient || "—"}</td>
                      <td>{l.biosidal?.antidote || "—"}</td>
                      <td>{METHOD_TR[l.method] || l.method || "—"}</td>
                      <td>{l.amount} {UNIT_TR[l.biosidal?.unit] || l.biosidal?.unit || ""}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          {/* BÖLÜM 3 */}
          <section className="block">
            <div className="block-title">3. UYGULAMA YAPILAN YER HAKKINDA BİLGİLER</div>
            <table className="kv">
              <colgroup><col style={{ width: "42%" }} /><col /></colgroup>
              <tbody>
                <tr>
                  <th>Uygulama Yapılan Yerin Adı / Adresi</th>
                  <td>{displayStoreName} / {displayAddress}</td>
                </tr>
                <tr>
                  <th>Ziyaret Tipi / Hedef Zararlı</th>
                  <td>{visitTypeTR} / {targetPestsStr}</td>
                </tr>
                <tr>
                  <th>Gözlemlenen Uygunsuzluklar</th>
                  <td>{isFree ? ncrText || "—" : "—"}</td>
                </tr>
                <tr>
                  <th>Uygulama Zamanı</th>
                  <td>{dateTR} | {visit?.startTime || "—"} – {visit?.endTime || "—"}</td>
                </tr>
                <tr>
                  <th>Mesken / İşyeri – Alan (m²)</th>
                  <td>{displayPlaceType || "—"} / {displayAreaM2}</td>
                </tr>
                <tr>
                  <th>Uyarı ve Öneriler</th>
                  <td>{visit?.notes || "—"}</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* BÖLÜM 4 – İmzalar */}
          <section className="block">
            <div className="block-title">4. İMZALAR</div>
            <div className="sig-grid">

              <div className="sig-col">
                <div className="sig-col__header">Uygulamayı Yapan</div>
                <SignatureBox
                  signedAt={report?.providerSignedAt}
                  signerName={report?.providerSignerName}
                  signatureBase64={report?.providerSignature}
                  signLog={report?.providerSignLog}
                  description="Uygulayıcı firma yetkilisinin adı, soyadı ve imzası"
                />
              </div>

              <div className="sig-col">
                <div className="sig-col__header">Uygulama Yaptıran Yetkili</div>
                <SignatureBox
                  signedAt={report?.customerSignedAt}
                  signerName={report?.customerSignerName}
                  signatureBase64={report?.customerSignature}
                  signLog={report?.customerSignLog}
                  description="Hizmet alınan yerin sorumlusunun adı, soyadı ve imzası"
                />
              </div>

            </div>
          </section>

          {/* Dipnot */}
          <section className="note">
            <strong>Not:</strong> ZEHİRLENME DURUMLARINDA 114 UZEM VEYA 112'Yİ ARAYINIZ.
            Bu form 5 yıl süreyle muhafaza edilmek zorundadır.
            Dijital imza verileri elektronik kayıt olarak saklanmakta olup yasal geçerliliğe sahiptir.
          </section>

        </div>

        {/* İmza Modalı */}
        <SignatureModal
          isOpen={isSigModalOpen}
          onClose={() => setIsSigModalOpen(false)}
          onConfirm={onConfirmSignature}
          title={sigKind === "customer" ? "Müşteri Onay İmzası" : "Personel Dijital İmzası"}
          subtitle={
            sigKind === "customer"
              ? "İmzanız yasal belgeye işlenecektir"
              : "Uygulayıcı onay imzası"
          }
          signerName={
            sigKind === "customer"
              ? resolveCustomerSignName()
              : resolveProviderSignName()
          }
        />
      </div>
    </Layout>
  );
}