import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./Ek1Preview.scss";

// yerel bir logo koy: src/assets/health-ministry.png
import trHealthLogo from "../../assets/saglıkb_logo.png";
// sağ üstte QR yerine şimdilik logoyu tekrar kullanıyoruz istersen dinamik yap
import qrPlaceholder from "../../assets/qrcode_placeholder.png";

const VISIT_TYPE_TR = {
  PERIYODIK: "Periyodik Ziyaret",
  ACIL_CAGRI: "Acil Çağrı",
  ISTASYON_KURULUM: "İstasyon Kurulum",
  ILK_ZIYARET: "İlk Ziyaret",
  DIGER: "Diğer",
};
const UNIT_TR = { ML: "ML (Mililitre)", GR: "Gr (Gram)", LT: "LT (Litre)", KG: "KG (Kilogram)", ADET: "Adet" };
const METHOD_TR = {
  PULVERIZE: "Pulverize", ULV: "ULV", ATOMIZER: "Atomizer",
  YENILEME: "Yenileme", SISLEME: "Sisleme", YEMLEME: "Yemleme",
};

export default function Ek1Preview() {
  const { storeId, visitId } = useParams();
  const [data, setData] = useState(null);
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/ek1/visit/${visitId}`);
        setData(data);
      } catch (e) {
        toast.error(e?.response?.data?.message || "EK-1 verisi alınamadı");
      }
    })();
  }, [visitId]);

  const visit = data?.visit;
  const store = data?.store;
  const customer = data?.customer;
  const provider = data?.provider;
  const lines = data?.lines || [];
  const report = data?.report;

  const dateTR = useMemo(() => visit ? new Date(visit.date).toLocaleDateString("tr-TR") : "—", [visit]);

  const handleProviderSign = async () => {
    setSigning(true);
    try {
      await api.post(`/ek1/visit/${visitId}/sign/provider`);
      const { data } = await api.get(`/ek1/visit/${visitId}`);
      setData(data);
      toast.success("Dijital imza eklendi");
    } catch (e) {
      toast.error(e?.response?.data?.message || "İmzalanamadı");
    } finally { setSigning(false); }
  };

  const handleCustomerSign = async () => {
    setSigning(true);
    try {
      await api.post(`/ek1/visit/${visitId}/sign/customer`);
      const { data } = await api.get(`/ek1/visit/${visitId}`);
      setData(data);
      toast.success("Müşteri onayı eklendi");
    } catch (e) {
      toast.error(e?.response?.data?.message || "Onay alınamadı");
    } finally { setSigning(false); }
  };

  return (
    <Layout>
      <div className="ek1-print">
        <div className="toolbar no-print">
          <Link className="btn ghost" to={`/admin/stores/${storeId}/ek1`}>Ziyaretlere Dön</Link>
          <button className="btn" onClick={() => window.print()}>YAZDIR</button>
          {!report?.providerSignedAt && (
            <button className="btn primary" onClick={handleProviderSign} disabled={signing}>
              {signing ? "İmzalanıyor..." : "Dijital İmzala"}
            </button>
          )}
          {!report?.customerSignedAt && (
            <button className="btn warn" onClick={handleCustomerSign} disabled={signing}>
              {signing ? "Onay Alınıyor..." : "Müşteri Onayı Al"}
            </button>
          )}
        </div>

        <div className="page A4">
          <header className="doc-head">
            <img src={trHealthLogo} alt="T.C. Sağlık Bakanlığı" />
            <h1>EK-1 BİYOSİDAL UYGULAMA İŞLEM FORMU</h1>
            <img src={qrPlaceholder} alt="QR" className="qr" />
          </header>

          {/* UYGULAMAYI YAPANA AİT BİLGİLER */}
          <section className="block">
            <div className="block-title">UYGULAMAYI YAPANA AİT BİLGİLER</div>
            <table className="kv">
              <tbody>
                <tr><th>Belge Seri No</th><td>{provider?.certificateSerial || "—"}</td></tr>
                <tr><th>Uygulamayı Yapan Firma Adı</th><td>{provider?.companyName || "—"}</td></tr>
                <tr><th>Açık Adresi</th><td>{provider?.address || "—"}</td></tr>
                <tr><th>Mesul Müdür</th><td>{provider?.responsibleTitle || "—"}</td></tr>
                <tr><th>Uygulayıcı/lar Adı, Soyadı</th><td>{Array.isArray(visit?.employees) ? visit.employees.join(", ") : "—"}</td></tr>
                <tr><th>Telefon, Faks Numarası</th><td>{provider?.phoneFax || "—"}</td></tr>
                <tr><th>Müdürlük İzin Tarih ve Sayısı</th><td>{provider?.permissionNo || "—"}</td></tr>
              </tbody>
            </table>
          </section>

          {/* KULLANILAN BİYOSİDAL ÜRÜNE AİT BİLGİLER */}
          <section className="block">
            <div className="block-title">KULLANILAN BİYOSİDAL ÜRÜNE AİT BİLGİLER</div>
            <table className="list">
              <thead>
                <tr>
                  <th>#</th><th>Ürün Adı</th><th>Aktif Madde</th><th>Ürün Antidotu</th><th>Uygulama Şekli</th><th>Miktar</th>
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
                    <td>
                      {l.amount} {UNIT_TR[l.biosidal?.unit] || l.biosidal?.unit || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* UYGULAMA YAPILAN YER HAKKINDA BİLGİLER */}
          <section className="block">
            <div className="block-title">UYGULAMA YAPILAN YER HAKKINDA BİLGİLER</div>
            <table className="kv">
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
                  <td>{Array.isArray(visit?.targetPests) ? visit.targetPests.join(",") : "—"}</td>
                </tr>
                <tr>
                  <th>Uygulama Tarihi, Başlangıç ve Bitiş Saati</th>
                  <td>{dateTR} | {visit?.startTime || "—"} - {visit?.endTime || "—"}</td>
                </tr>
                <tr>
                  <th>Mesken &amp; İşyeri</th>
                  <td>{store?.placeType || customer?.placeType || "—"}</td>
                </tr>
                <tr>
                  <th>Uygulama Yapılan Yerin Alanı (m²)</th>
                  <td>{store?.areaM2 ?? customer?.areaM2 ?? "—"}</td>
                </tr>
                <tr>
                  <th>Alınan Güvenlik Önlemleri, yapılan uyarı ve öneriler</th>
                  <td>{visit?.notes || "—"}</td>
                </tr>
                <tr>
                  <th>Uygulamayı Yapan Yetkili / Sorumlu:</th>
                  <td>
                    {report?.providerSignedAt
                      ? `${new Date(report.providerSignedAt).toLocaleDateString("tr-TR")} tarihinde ${report.providerSignerName || provider?.responsibleName || "Yetkili"} tarafından dijital onay verilmiştir.`
                      : ""}
                  </td>
                </tr>
                <tr>
                  <th>Uygulama Yapılan Yerin Yetkili / Sorumlusu :</th>
                  <td>
                    {report?.customerSignedAt
                      ? `${new Date(report.customerSignedAt).toLocaleDateString("tr-TR")} tarihinde ${report.customerSignerName || (customer?.contactFullName ?? "Yetkili")} tarafından dijital onay verilmiştir.`
                      : ""}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="note">
            <b>Not :</b> ZEHİRLENME DURUMLARINDA ULUSAL ZEHİR DANIŞMA MERKEZİ 114 VE ACİL SAĞLIK HİZMETLERİ 112 NOLU TELEFONLU ARAYINIZ
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
