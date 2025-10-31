import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
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
  PULVERİZE: "Pulverize",
  PULVERIZE: "Pulverize",
};

const role = (localStorage.getItem("role") || "").toLowerCase();
const isCustomerRole = role === "customer";
const isAdminRole = role === "admin";
const isEmployeeRole = role === "employee";

const fmtTRDate = (d) => (d ? new Date(d).toLocaleDateString("tr-TR") : "—");
const joinSafe = (arr, sep = ", ") =>
  (Array.isArray(arr) ? arr : [])
    .map((x) =>
      typeof x === "string" ? x : x?.fullName || x?.name || x?.email || ""
    )
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

/* Oturumdaki görünen isim (imza sırasında backend'e gönderilecek) */
function getCurrentUserDisplayName() {
  return (
    localStorage.getItem("name") ||
    localStorage.getItem("fullName") ||
    localStorage.getItem("email") ||
    "Yetkili"
  );
}

export default function Ek1Preview() {
  const { visitId } = useParams();
  const [bundle, setBundle] = useState(null);
  const [busy, setBusy] = useState(false);
  const docUrl = useMemo(() => window.location.href, [visitId]);

  const loadAll = async () => {
    try {
      const { data } = await api.get(`/ek1/visit/${visitId}`);
      setBundle(data);
    } catch (e) {
      toast.error(e?.response?.data?.message || "EK-1 verisi alınamadı");
    }
  };
  useEffect(() => {
    loadAll(); // eslint-disable-next-line
  }, [visitId]);

  const visit = bundle?.visit;
  const store = bundle?.store;
  const customer = bundle?.customer;
  const provider = bundle?.provider;
  const lines = bundle?.lines || [];
  const report = bundle?.report;

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
  const targetPestsStr = useMemo(
    () => normalizeTargetPests(visit?.targetPests),
    [visit]
  );

  const freeNcrs = (Array.isArray(fm.ncrs) ? fm.ncrs : []).filter(
    (n) => n?.title || n?.notes
  );
  const ncrText = isFree
    ? freeNcrs.length === 0
      ? "—"
      : freeNcrs
          .map((n, i) => {
            const t = (n.title || "").trim();
            const s = (n.notes || "").trim();
            return `${i + 1}) ${t}${s ? " – " + s : ""}`;
          })
          .join("  |  ")
    : "—";

  const handleProviderSign = async () => {
    setBusy(true);
    try {
      // İmzalayan personelin adını backend’e gönder
      const signerName = getCurrentUserDisplayName();
      await api.post(`/ek1/visit/${visitId}/sign/provider`, { name: signerName });
      await loadAll();
      toast.success("Dijital imza eklendi");
    } catch (e) {
      toast.error(e?.response?.data?.message || "İmzalanamadı");
    } finally {
      setBusy(false);
    }
  };

  const handleCustomerSign = async () => {
    // Employee rolü müşteri onayı veremez (FE emniyet)
    if (isEmployeeRole) {
      toast.error("Employee rolü müşteri onayı veremez.");
      return;
    }

    setBusy(true);
    try {
      // Müşteri (AccessOwner) imzalarken kendi adını kullan
      const accessOwnerName = localStorage.getItem("name") || undefined;
      const fallbackOrgName =
        customer?.contactFullName ||
        customer?.title ||
        customer?.name ||
        undefined;

      const namePayload = isCustomerRole
        ? accessOwnerName || undefined
        : accessOwnerName || fallbackOrgName || undefined;

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

  // İmza görüntülemede, kaydedilmiş isim varsa onu göster
  const displayCustomerSignerName =
    report?.customerSignerName ||
    (isCustomerRole
      ? localStorage.getItem("name") || "Yetkili"
      : customer?.contactFullName ||
        customer?.title ||
        customer?.name ||
        localStorage.getItem("name") ||
        "Yetkili");

  // Listeye dönüş: müşteri için farklı bir path’in yoksa /ek1/visit listene dönersin.
  const backListHref = isCustomerRole ? "/customer/stores" : "/admin/ek1";

  return (
    <Layout>
      <div className="ek1-print">
        <div className="toolbar no-print">
          <Link className="btn ghost" to={backListHref}>
            Geri
          </Link>
          <button className="btn" onClick={() => window.print()}>
            YAZDIR
          </button>

          {/* Provider imzası: sadece admin/employee görsün */}
          {!report?.providerSignedAt && !isCustomerRole && (
            <button
              className="btn primary"
              onClick={handleProviderSign}
              disabled={busy}
            >
              {busy ? "İmzalanıyor..." : "Dijital İmzala (Admin/Personel)"}
            </button>
          )}

          {/* Müşteri onayı: sadece customer veya admin görsün */}
          {!report?.customerSignedAt && (isCustomerRole || isAdminRole) && (
            <button className="btn warn" onClick={handleCustomerSign} disabled={busy}>
              {busy
                ? "Onay Alınıyor..."
                : isCustomerRole
                ? "Onayla (Müşteri)"
                : "Müşteri Onayı Al"}
            </button>
          )}
        </div>

        <div className="page A4">
          <header className="doc-head">
            <img src={trHealthLogo} alt="T.C. Sağlık Bakanlığı" />
            <h1>EK-1 BİYOSİDAL UYGULAMA İŞLEM FORMU</h1>
            <div className="qr" aria-label="Belge QR">
              <QRCode value={docUrl} size={60} level="M" />
            </div>
          </header>

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
                  <td>
                    {provider?.responsibleTitle ||
                      provider?.responsibleName ||
                      "—"}
                  </td>
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
                    <td colSpan={6} className="center">—</td>
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
                    {displayAddress && displayAddress !== "—"
                      ? ` / ${displayAddress}`
                      : ""}
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
                  <td>{isFree ? ncrText || "—" : "—"}</td>
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

                {/* İmzalayan PERSONEL ismi görünsün */}
                <tr>
                  <th>Uygulamayı Yapan (İmzalayan Personel)</th>
                  <td>
                    {report?.providerSignedAt ? (
                      <>
                        {fmtTRDate(report.providerSignedAt)} tarihinde{" "}
                        <b>
                          {report?.providerSignerName ||
                            provider?.responsibleName ||
                            "Yetkili"}
                        </b>{" "}
                        tarafından dijital onay verilmiştir.
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>

                <tr>
                  <th>Uygulama Yapılan Yerin Yetkili / Sorumlusu</th>
                  <td>
                    {report?.customerSignedAt ? (
                      <>
                        {fmtTRDate(report.customerSignedAt)} tarihinde{" "}
                        <b>{displayCustomerSignerName}</b> tarafından dijital onay
                        verilmiştir.
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="note">
            <b>Not:</b> ZEHİRLENME DURUMLARINDA ULUSAL ZEHİR DANIŞMA MERKEZİ 114 VE
            ACİL SAĞLIK HİZMETLERİ 112 NOLU TELEFONU ARAYINIZ.
            <br />
            Bu belgede yer alan bilgiler {provider?.companyName || "uygulayıcı firma"}{" "}
            tarafından üretilmiştir.
          </section>

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
