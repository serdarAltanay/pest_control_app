import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./Ek1Preview.scss";

import trHealthLogo from "../../assets/saglıkb_logo.png";
import QRCode from "react-qr-code";

/* ---- Sabitler ---- */
const VISIT_TYPE_TR = {
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
  PULVERİZE: "Pulverize",
  PULVERIZE: "Pulverize",
};

/* ---- küçük yardımcılar ---- */
const fmtTRDate = (d) => (d ? new Date(d).toLocaleDateString("tr-TR") : "—");
const joinSafe = (arr, sep = ", ") =>
  (Array.isArray(arr) ? arr : [])
    .map((x) => (typeof x === "string" ? x : x?.fullName || x?.name || x?.email || ""))
    .filter(Boolean).join(sep) || "—";

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

export default function Ek1Preview() {
  const { storeId, visitId } = useParams();
  const [bundle, setBundle] = useState(null);
  const [busy, setBusy] = useState(false);
  const [ncrToday, setNcrToday] = useState([]);
  const docUrl = useMemo(() => window.location.href, [visitId]);

  /* Bundle + aynı gün NCR */
  const loadAll = async () => {
    try {
      const { data } = await api.get(`/ek1/visit/${visitId}`);
      setBundle(data);

      const dayKey = data?.visit?.date ? new Date(data.visit.date).toISOString().slice(0, 10) : null;
      const stId = data?.store?.id;
      if (stId && dayKey) {
        const { data: ncrAll } = await api.get(`/nonconformities/store/${stId}`);
        const sameDay = (Array.isArray(ncrAll) ? ncrAll : []).filter((n) => {
          const k = n?.observedAt ? new Date(n.observedAt).toISOString().slice(0, 10) : "";
          return k === dayKey;
        });
        setNcrToday(sameDay);
      } else {
        setNcrToday([]);
      }
    } catch (e) {
      toast.error(e?.response?.data?.message || "EK-1 verisi alınamadı");
    }
  };

  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [visitId]);

  const visit = bundle?.visit;
  const store = bundle?.store;
  const customer = bundle?.customer;
  const provider = bundle?.provider;
  const lines = bundle?.lines || [];
  const report = bundle?.report;

  const dateTR = useMemo(() => fmtTRDate(visit?.date), [visit]);
  const employeesStr = useMemo(() => normalizeEmployees(visit?.employees), [visit]);
  const targetPestsStr = useMemo(() => normalizeTargetPests(visit?.targetPests), [visit]);

  const handleProviderSign = async () => {
    setBusy(true);
    try {
      await api.post(`/ek1/visit/${visitId}/sign/provider`);
      await loadAll();
      toast.success("Dijital imza eklendi");
    } catch (e) {
      toast.error(e?.response?.data?.message || "İmzalanamadı");
    } finally { setBusy(false); }
  };
  const handleCustomerSign = async () => {
    setBusy(true);
    try {
      await api.post(`/ek1/visit/${visitId}/sign/customer`);
      await loadAll();
      toast.success("Müşteri onayı eklendi");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Onay alınamadı");
    } finally { setBusy(false); }
  };

  const handlePrintOnlyPage = () => {
    const root = document.querySelector(".ek1-print");
    const page = root?.querySelector(".page");
    if (!page) { window.print(); return; }
    const w = window.open("", "_blank", "width=900,height=1200");
    if (!w) return;
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style')).map((el) => el.outerHTML).join("\n");
    w.document.open();
    w.document.write(`
      <!doctype html><html><head>
        <meta charset="utf-8" />
        <title>EK-1 — ${store?.name ?? ""} — ${dateTR}</title>
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
          .kv th, .kv td, .list thead th, .list tbody td { border:0.2mm solid #000; padding:6px 8px; line-height:1.25; }
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
    w.onload = () => { w.focus(); w.print(); setTimeout(() => w.close(), 300); };
  };

  return (
    <Layout>
      <div className="ek1-print">
        <div className="toolbar no-print">
          <Link className="btn ghost" to={`/admin/stores/${storeId}/ek1`}>Ziyaretlere Dön</Link>
          <button className="btn" onClick={handlePrintOnlyPage}>YAZDIR</button>
          {!report?.providerSignedAt && (
            <button className="btn primary" onClick={handleProviderSign} disabled={busy}>
              {busy ? "İmzalanıyor..." : "Dijital İmzala"}
            </button>
          )}
          {!report?.customerSignedAt && (
            <button className="btn warn" onClick={handleCustomerSign} disabled={busy}>
              {busy ? "Onay Alınıyor..." : "Müşteri Onayı Al"}
            </button>
          )}
        </div>

        <div className="page A4">
          {/* ---- Başlık ---- */}
          <header className="doc-head">
            <img src={trHealthLogo} alt="T.C. Sağlık Bakanlığı" />
            <h1>EK-1 BİYOSİDAL UYGULAMA İŞLEM FORMU</h1>
            <div className="qr" aria-label="Belge QR">
              <QRCode value={docUrl} size={60} level="M" />
            </div>
          </header>

          {/* ---- Uygulayıcı Bilgileri ---- */}
          <section className="block">
            <div className="block-title">UYGULAMAYI YAPANA AİT BİLGİLER</div>
            <table className="kv">
              <colgroup><col style={{ width: "42%" }} /><col /></colgroup>
              <tbody>
                <tr><th>Belge Seri No</th><td>{provider?.certificateSerial || "—"}</td></tr>
                <tr><th>Uygulamayı Yapan Firma Adı</th><td>{provider?.companyName || "—"}</td></tr>
                <tr><th>Açık Adresi</th><td>{provider?.address || "—"}</td></tr>
                <tr><th>Mesul Müdür</th><td>{provider?.responsibleTitle || provider?.responsibleName || "—"}</td></tr>
                <tr><th>Uygulayıcı/lar Adı, Soyadı</th><td>{employeesStr}</td></tr>
                <tr><th>Telefon, Faks Numarası</th><td>{provider?.phoneFax || "—"}</td></tr>
                <tr><th>Müdürlük İzin Tarih ve Sayısı</th><td>{provider?.permissionNo || "—"}</td></tr>
              </tbody>
            </table>
          </section>

          {/* ---- Biyosidal Ürün Bilgileri ---- */}
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
                  <tr><td colSpan={6} className="center">—</td></tr>
                ) : lines.map((l, i) => (
                  <tr key={l.id}>
                    <td>{i + 1}</td>
                    <td>{l.biosidal?.name || "—"}</td>
                    <td>{l.biosidal?.activeIngredient || "—"}</td>
                    <td>{l.biosidal?.antidote || "—"}</td>
                    <td>{METHOD_TR[l.method] || l.method || "—"}</td>
                    <td>{l.amount} {UNIT_TR[l.biosidal?.unit] || l.biosidal?.unit || ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* ---- Uygulama Yapılan Yer ---- */}
          <section className="block">
            <div className="block-title">UYGULAMA YAPILAN YER HAKKINDA BİLGİLER</div>
            <table className="kv">
              <colgroup><col style={{ width: "42%" }} /><col /></colgroup>
              <tbody>
                <tr>
                  <th>Uygulama Yapılan Yerin Adı ve Açık Adresi</th>
                  <td>{store?.name || "—"}{store?.address ? ` / ${store.address}` : ""}</td>
                </tr>
                <tr>
                  <th>Ziyaret Tipi</th>
                  <td>{VISIT_TYPE_TR[visit?.visitType] || visit?.visitType || "—"}</td>
                </tr>
                <tr>
                  <th>Uygulamaya Yapılan Hedef Zararlı Türü / Adı</th>
                  <td>{normalizeTargetPests(visit?.targetPests)}</td>
                </tr>

                {/* === Gözlemlenen uygunsuzluklar === */}
                <tr>
                  <th>Gözlemlenen Uygunsuzluk(lar)</th>
                  <td>
                    {ncrToday.length === 0
                      ? "—"
                      : ncrToday.map((n, i) =>
                          `${i + 1}) ${n.category}${n.title ? " – " + n.title : ""}`
                        ).join("  |  ")}
                  </td>
                </tr>

                <tr>
                  <th>Uygulama Tarihi, Başlangıç ve Bitiş Saati</th>
                  <td>{dateTR} | {visit?.startTime || "—"} - {visit?.endTime || "—"}</td>
                </tr>
                <tr><th>Mesken &amp; İşyeri</th><td>{store?.placeType || "—"}</td></tr>
                <tr><th>Uygulama Yapılan Yerin Alanı (m²)</th><td>{store?.areaM2 ?? "—"}</td></tr>
                <tr><th>Alınan Güvenlik Önlemleri, yapılan uyarı ve öneriler</th><td>{visit?.notes || "—"}</td></tr>
                <tr>
                  <th>Uygulamayı Yapan Yetkili / Sorumlu</th>
                  <td>{report?.providerSignedAt
                    ? `${fmtTRDate(report.providerSignedAt)} tarihinde ${report.providerSignerName || provider?.responsibleName || "Yetkili"} tarafından dijital onay verilmiştir.`
                    : "—"}</td>
                </tr>
                <tr>
                  <th>Uygulama Yapılan Yerin Yetkili / Sorumlusu</th>
                  <td>{report?.customerSignedAt
                    ? `${fmtTRDate(report.customerSignedAt)} tarihinde ${report.customerSignerName || (customer?.contactFullName ?? "Yetkili")} tarafından dijital onay verilmiştir.`
                    : "—"}</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="note">
            <b>Not:</b> ZEHİRLENME DURUMLARINDA ULUSAL ZEHİR DANIŞMA MERKEZİ 114 VE ACİL SAĞLIK HİZMETLERİ 112 NOLU TELEFONU ARAYINIZ.
            <br />
            Bu belgede yer alan bilgiler {provider?.companyName || "uygulayıcı firma"} tarafından üretilmiştir.
          </section>

          <div className="footer no-print">
            <button className="btn" onClick={() => window.print()}>YAZDIR</button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
