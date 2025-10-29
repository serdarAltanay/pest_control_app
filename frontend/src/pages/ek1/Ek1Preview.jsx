// src/pages/ek1/Ek1Preview.jsx
import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./Ek1Preview.scss";

import trHealthLogo from "../../assets/saglıkb_logo.png";
import QRCode from "react-qr-code";

/* ===================== Sabitler ===================== */
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
  PULVERİZE: "Pulverize", // veritabanında İ’li gelebilir
  PULVERIZE: "Pulverize", // bazı yerlerde I’lı gelebilir → normalize
};

/* ===================== Yardımcılar ===================== */
const fmtTRDate = (d) => (d ? new Date(d).toLocaleDateString("tr-TR") : "—");

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

/* ===================== Sayfa ===================== */
export default function Ek1Preview() {
  const { visitId } = useParams();
  const [bundle, setBundle] = useState(null);
  const [busy, setBusy] = useState(false);

  // Aktif kullanıcı rolü (login’de localStorage’a yazılıyor)
  const role = useMemo(() => (localStorage.getItem("role") || "").toLowerCase(), []);
  const isCustomerRole = role === "customer";

  // QR için mevcut URL
  const docUrl = useMemo(() => window.location.href, [visitId]);

  /* ---- Veriyi çek ---- */
  const loadAll = async () => {
    try {
      const { data } = await api.get(`/ek1/visit/${visitId}`);
      setBundle(data);
    } catch (e) {
      toast.error(e?.response?.data?.message || "EK-1 verisi alınamadı");
    }
  };
  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visitId]);

  /* ---- Bundle parçaları ---- */
  const visit = bundle?.visit;
  const store = bundle?.store;
  const customer = bundle?.customer;
  const provider = bundle?.provider;
  const lines = bundle?.lines || [];
  const report = bundle?.report;

  // FREE (serbest) form mu?
  const isFree = report?.freeMeta?.type === "FREE";
  const fm = report?.freeMeta || {};

  // Görünür alanlar
  const displayStoreName = isFree ? (fm.storeName || "—") : (store?.name || "—");
  const displayAddress   = isFree ? (fm.address   || "—") : (store?.address || "—");
  const displayPlaceType = isFree ? (fm.placeType || "—") : (store?.placeType || "—");
  const displayAreaM2    = isFree ? (fm.areaM2 ?? "—")     : (store?.areaM2 ?? "—");

  // Ziyaret tipi
  const visitTypeTR = isFree
    ? (VISIT_TYPE_TR[fm.visitKind] || "Tek Seferlik Ziyaret")
    : (VISIT_TYPE_TR[visit?.visitType] || visit?.visitType || "—");

  // Tarih/ekip/hedef zararlı
  const dateTR = useMemo(() => fmtTRDate(visit?.date), [visit]);
  const employeesStr = useMemo(() => normalizeEmployees(visit?.employees), [visit]);
  const targetPestsStr = useMemo(() => normalizeTargetPests(visit?.targetPests), [visit]);

  // Uygunsuzluklar (FREE’de meta’dan gelir)
  const freeNcrs = (Array.isArray(fm.ncrs) ? fm.ncrs : []).filter((n) => (n?.title || n?.notes));
  const ncrText = isFree
    ? (freeNcrs.length === 0
        ? "—"
        : freeNcrs
            .map((n, i) => {
              const t = (n.title || "").trim();
              const s = (n.notes || "").trim();
              return `${i + 1}) ${t}${s ? " – " + s : ""}`;
            })
            .join("  |  "))
    : "—";

  /* ---- İmzalar ---- */
  const handleProviderSign = async () => {
    setBusy(true);
    try {
      await api.post(`/ek1/visit/${visitId}/sign/provider`);
      await loadAll();
      toast.success("Dijital imza eklendi");
    } catch (e) {
      toast.error(e?.response?.data?.message || "İmzalanamadı");
    } finally {
      setBusy(false);
    }
  };

  const handleCustomerSign = async () => {
    setBusy(true);
    try {
      // Müşteri imzasını "sistemde kayıtlı isim" ile at (öncelik sırası):
      // contactFullName → title → name → localStorage.name
      const namePayload =
        customer?.contactFullName ||
        customer?.title ||
        customer?.name ||
        localStorage.getItem("name") ||
        undefined;

      await api.post(
        `/ek1/visit/${visitId}/sign/customer`,
        namePayload ? { name: namePayload } : {}
      );
      await loadAll();
      toast.success("Müşteri onayı eklendi");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Onay alınamadı");
    } finally {
      setBusy(false);
    }
  };

  // Metinde gösterilecek müşteri adı (imza sonrası)
  const displayCustomerSignerName =
    report?.customerSignerName ||
    customer?.contactFullName ||
    customer?.title ||
    customer?.name ||
    localStorage.getItem("name") ||
    "Yetkili";

  /* ---- Yazdır (tek sayfa) ---- */
  const handlePrintOnlyPage = () => {
    const root = document.querySelector(".ek1-print");
    const page = root?.querySelector(".page");
    if (!page) {
      window.print();
      return;
    }
    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) return;

    const styles = Array.from(
      document.querySelectorAll('link[rel="stylesheet"], style')
    )
      .map((el) => el.outerHTML)
      .join("\n");

    w.document.open();
    w.document.write(`
      <!doctype html><html><head>
        <meta charset="utf-8" />
        <title>EK-1 — ${displayStoreName ?? ""} — ${dateTR}</title>
        ${styles}
        <style>
          @page { size: A4; margin: 10mm; }
          html, body { background:#fff !important; }
          .page.A4 { box-shadow:none !important; border:0 !important; margin:0 !important; width:auto !important; min-height:auto !important; box-sizing:border-box; }
          .no-print { display:none !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          table { width:100%; border-collapse:collapse; }
          table.kv { table-layout:auto; }
          table.list { table-layout:fixed; }
          .kv th, .kv td, .list thead th, .list tbody td { border:0.2mm solid #000; padding:6px 8px; line-height:1.25; text-align:left; }
          .kv th { background:#f9fafb; word-break:keep-all; }
          .kv td { word-break:break-word; overflow-wrap:anywhere; }
          .list thead { display:table-header-group; }
          .list tr, .kv tr { break-inside:avoid; page-break-inside:avoid; }
          .ek1-print .doc-head { display:grid; grid-template-columns:60px 1fr 60px; align-items:center; }
          .ek1-print .doc-head img { width:60px !important; height:60px !important; object-fit:contain; }
          .ek1-print .doc-head .qr { justify-self:end; }
        </style>
      </head><body>
        <div class="ek1-print">${page.outerHTML}</div>
      </body></html>
    `);
    w.document.close();
    w.onload = () => {
      w.focus();
      w.print();
      setTimeout(() => w.close(), 300);
    };
  };

  /* ---- Render ---- */
  return (
    <Layout>
      <div className="ek1-print">
        {/* Toolbar */}
        <div className="toolbar no-print">
          <Link className="btn ghost" to="/admin/ek1">
            Ziyaretlere Dön
          </Link>

          <button className="btn" onClick={handlePrintOnlyPage}>
            YAZDIR
          </button>

          {/* Provider (admin/employee) imza butonu — CUSTOMER rolünde GİZLE */}
          {!report?.providerSignedAt && !isCustomerRole && (
            <button className="btn primary" onClick={handleProviderSign} disabled={busy}>
              {busy ? "İmzalanıyor..." : "Dijital İmzala"}
            </button>
          )}

          {/* Müşteri onayı: imza yoksa göster */}
          {!report?.customerSignedAt && (
            <button className="btn warn" onClick={handleCustomerSign} disabled={busy}>
              {busy ? "Onay Alınıyor..." : "Müşteri Onayı Al"}
            </button>
          )}
        </div>

        {/* Sayfa */}
        <div className="page A4">
          {/* Başlık */}
          <header className="doc-head">
            <img src={trHealthLogo} alt="T.C. Sağlık Bakanlığı" />
            <h1>EK-1 BİYOSİDAL UYGULAMA İŞLEM FORMU</h1>
            <div className="qr" aria-label="Belge QR">
              <QRCode value={docUrl} size={60} level="M" />
            </div>
          </header>

          {/* Uygulayıcı Bilgileri */}
          <section className="block">
            <div className="block-title">UYGULAMAYI YAPANA AİT BİLGİLER</div>
            <table className="kv">
              <colgroup>
                <col style={{ width: "42%" }} />
                <col />
              </colgroup>
              <tbody>
                <tr>
                  <th>Belge Seri No</th>
                  <td>{provider?.certificateSerial || "—"}</td>
                </tr>
                <tr>
                  <th>Uygulamayı Yapan Firma Adı</th>
                  <td>{provider?.companyName || "—"}</td>
                </tr>
                <tr>
                  <th>Açık Adresi</th>
                  <td>{provider?.address || "—"}</td>
                </tr>
                <tr>
                  <th>Mesul Müdür</th>
                  <td>{provider?.responsibleTitle || provider?.responsibleName || "—"}</td>
                </tr>
                <tr>
                  <th>Uygulayıcı/lar Adı, Soyadı</th>
                  <td>{employeesStr}</td>
                </tr>
                <tr>
                  <th>Telefon, Faks Numarası</th>
                  <td>{provider?.phoneFax || "—"}</td>
                </tr>
                <tr>
                  <th>Müdürlük İzin Tarih ve Sayısı</th>
                  <td>{provider?.permissionNo || "—"}</td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Biyosidal Ürün Bilgileri */}
          <section className="block">
            <div className="block-title">KULLANILAN BİYOSİDAL ÜRÜNE AİT BİLGİLER</div>
            <table className="list">
              <colgroup>
                <col style={{ width: "6%" }} />
                <col style={{ width: "26%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "14%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Ürün Adı</th>
                  <th>Aktif Madde</th>
                  <th>Ürün Antidotu</th>
                  <th>Uygulama Şekli</th>
                  <th>Miktar</th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="center">
                      —
                    </td>
                  </tr>
                ) : (
                  lines.map((l, i) => (
                    <tr key={l.id ?? i}>
                      <td>{i + 1}</td>
                      <td>{l.biosidal?.name || "—"}</td>
                      <td>{l.biosidal?.activeIngredient || "—"}</td>
                      <td>{l.biosidal?.antidote || "—"}</td>
                      <td>{METHOD_TR[l.method] || l.method || "—"}</td>
                      <td>
                        {l.amount} {UNIT_TR[l.biosidal?.unit] || l.biosidal?.unit || ""}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          {/* Uygulama Yapılan Yer */}
          <section className="block">
            <div className="block-title">UYGULAMA YAPILAN YER HAKKINDA BİLGİLER</div>
            <table className="kv">
              <colgroup>
                <col style={{ width: "42%" }} />
                <col />
              </colgroup>
              <tbody>
                <tr>
                  <th>Uygulama Yapılan Yerin Adı ve Açık Adresi</th>
                  <td>
                    {displayStoreName}
                    {displayAddress && displayAddress !== "—" ? ` / ${displayAddress}` : ""}
                  </td>
                </tr>
                <tr>
                  <th>Ziyaret Tipi</th>
                  <td>{visitTypeTR}</td>
                </tr>
                <tr>
                  <th>Uygulamaya Yapılan Hedef Zararlı Türü / Adı</th>
                  <td>{targetPestsStr}</td>
                </tr>
                <tr>
                  <th>Gözlemlenen Uygunsuzluk(lar)</th>
                  <td>{ncrText}</td>
                </tr>
                <tr>
                  <th>Uygulama Tarihi, Başlangıç ve Bitiş Saati</th>
                  <td>
                    {dateTR} | {visit?.startTime || "—"} - {visit?.endTime || "—"}
                  </td>
                </tr>
                <tr>
                  <th>Mesken &amp; İşyeri</th>
                  <td>{displayPlaceType || "—"}</td>
                </tr>
                <tr>
                  <th>Uygulama Yapılan Yerin Alanı (m²)</th>
                  <td>{displayAreaM2}</td>
                </tr>
                <tr>
                  <th>Alınan Güvenlik Önlemleri, yapılan uyarı ve öneriler</th>
                  <td>{visit?.notes || "—"}</td>
                </tr>
                <tr>
                  <th>Uygulamayı Yapan Yetkili / Sorumlu</th>
                  <td>
                    {report?.providerSignedAt
                      ? `${fmtTRDate(report.providerSignedAt)} tarihinde ${
                          report?.providerSignerName || provider?.responsibleName || "Yetkili"
                        } tarafından dijital onay verilmiştir.`
                      : "—"}
                  </td>
                </tr>
                <tr>
                  <th>Uygulama Yapılan Yerin Yetkili / Sorumlusu</th>
                  <td>
                    {report?.customerSignedAt
                      ? `${fmtTRDate(report.customerSignedAt)} tarihinde ${displayCustomerSignerName} tarafından dijital onay verilmiştir.`
                      : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Not */}
          <section className="note">
            <b>Not:</b> ZEHİRLENME DURUMLARINDA ULUSAL ZEHİR DANIŞMA MERKEZİ 114 VE ACİL SAĞLIK
            HİZMETLERİ 112 NOLU TELEFONU ARAYINIZ.
            <br />
            Bu belgede yer alan bilgiler {provider?.companyName || "uygulayıcı firma"} tarafından
            üretilmiştir.
          </section>

          {/* Footer (opsiyonel ikinci yazdır) */}
          <div className="footer no-print">
            <button className="btn" onClick={() => window.print()}>
              YAZDIR
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
