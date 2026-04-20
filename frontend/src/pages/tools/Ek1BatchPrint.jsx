import { useState } from "react";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import QRCode from "react-qr-code";
import trHealthLogo from "../../assets/saglıkb_logo.png";
import "./Ek1BatchPrint.scss";

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
    PULVERIZE: "Pulverize",
};

const fmtSerial = (n) => n ? String(n).padStart(6, '0') : null;
const fmtTRDate = (d) => (d ? new Date(d).toLocaleDateString("tr-TR") : "—");

function normalizeEmployees(e) {
    if (!e) return "—";
    if (typeof e === "string") return e;
    if (Array.isArray(e)) return e.map(x => (typeof x === "string" ? x : x?.fullName || x?.name || "")).filter(Boolean).join(", ");
    return "—";
}

function normalizeTargetPests(v) {
    if (!v) return "—";
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return v.join(", ");
    return "—";
}

function SignatureBox({ signedAt, signerName, signatureBase64, signLog, description, isProvider }) {
    let auditSentence = null;
    if (signedAt) {
        const d = new Date(signedAt);
        const tarih = d.toLocaleDateString("tr-TR");
        const saat = d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
        const parts = [`${tarih} ${saat}`];
        if (signLog?.coords?.lat && signLog?.coords?.lng) {
            parts.push(`${signLog.coords.lat.toFixed(5)}, ${signLog.coords.lng.toFixed(5)}`);
        }
        if (signLog?.ip) parts.push(signLog.ip);
        auditSentence = parts.join(" - ") + " imza alınmıştır.";
    }

    return (
        <div className="sig-box">
            <div className="sig-box__area">
                {isProvider && (
                    <div className="company-stamp">
                        <img src="/logo.png" alt="Tura Logo" className="company-stamp__img" />
                        <div className="company-stamp__text">
                            <strong>TURA ÇEVRE SAĞLIĞI VE İLAÇLAMA HİZ.LTD.ŞTİ.</strong>
                            <p>Zübeyde Hanım Mah. Turgut Özal 1 Blv.</p>
                            <p>Özgür İşhanı No: 72/33 Altındağ/ANKARA</p>
                            <p>KIZILBEY V.D. 8670943938</p>
                        </div>
                    </div>
                )}
                {signedAt && signatureBase64 ? (
                    <img src={signatureBase64} alt="imza" className="sig-box__img" />
                ) : null}
            </div>
            <div className="sig-box__name">{signedAt ? (signerName || "—") : ""}</div>
            <div className="sig-box__description">{description}</div>
            {auditSentence && <div className="sig-box__audit-sentence">{auditSentence}</div>}
        </div>
    );
}

export default function Ek1BatchPrint() {
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [loading, setLoading] = useState(false);
    const [bundles, setBundles] = useState([]);

    const handleFetch = async () => {
        if (!startDate || !endDate) {
            toast.warn("Lütfen tarih aralığı seçin");
            return;
        }
        setLoading(true);
        setBundles([]);
        try {
            const { data } = await api.get(`/ek1/batch-print?from=${startDate}&to=${endDate}`);
            setBundles(data);
            if (data.length === 0) {
                toast.info("Bu tarih aralığında imzalı Ek-1 bulunamadı.");
            } else {
                toast.success(`${data.length} adet imzalı Ek-1 bulundu.`);
            }
        } catch (e) {
            toast.error(e?.response?.data?.message || "Veriler alınamadı");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout title="Ek-1 Toplu Yazdır">
            <div className="batch-print-container">
                <div className="toolbar no-print">
                    <div className="title">Ek-1 Toplu Yazdırma</div>
                    <div className="date-controls">
                        <div className="field">
                            <label>Başlangıç:</label>
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        </div>
                        <div className="field">
                            <label>Bitiş:</label>
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        </div>
                        <button className="btn primary" onClick={handleFetch} disabled={loading}>
                            {loading ? "Listeleniyor..." : "Listele"}
                        </button>
                    </div>

                    {bundles.length > 0 && (
                        <button className="btn success" onClick={() => window.print()}>
                            Hepsini Yazdır ({bundles.length})
                        </button>
                    )}
                </div>

                {loading && <div className="loading-state" style={{ padding: '40px', textAlign: 'center' }}>Signed Ek-1 verileri toplanıyor...</div>}

                <div className="print-area">
                    {bundles.map((bundle) => {
                        const { visit, store, provider, lines = [], report } = bundle;
                        const visitId = visit?.id;
                        const isFree = report?.freeMeta?.type === "FREE";
                        const fm = report?.freeMeta || {};
                        const dateTR = fmtTRDate(visit?.date);
                        const employeesStr = normalizeEmployees(visit?.employees);
                        const targetPestsStr = normalizeTargetPests(visit?.targetPests);

                        const freeNcrs = (Array.isArray(fm.ncrs) ? fm.ncrs : []).filter((n) => n?.title || n?.notes);
                        const ncrText = isFree
                            ? freeNcrs.length === 0
                                ? "Uygunsuzluk saptanmamıştır"
                                : freeNcrs.map((n, i) => `${i + 1}) ${(n.title || "").trim()}`).join(" | ")
                            : "Uygunsuzluk saptanmamıştır";

                        const displayStoreName = isFree ? fm.storeName || "—" : store?.name || "—";
                        const displayAddress = isFree ? fm.address || "—" : store?.address || "—";
                        const displayPlaceType = isFree ? fm.placeType || "—" : store?.placeType || "—";
                        const displayAreaM2 = isFree ? fm.areaM2 ?? "—" : store?.areaM2 ?? "—";
                        const docUrl = `${window.location.origin}/ek1/visit/${visitId}`;

                        return (
                            <div className="page A4" key={visitId}>
                                <header className="doc-head">
                                    <img src={trHealthLogo} alt="Logo" className="doc-head__logo" />
                                    <div className="doc-head__center">
                                        <div className="doc-head__sup">T.C. SAĞLIK BAKANLIĞI</div>
                                        <h1 className="doc-head__title">EK-1 BİYOSİDAL UYGULAMA İŞLEM FORMU</h1>
                                        <div className="doc-head__meta">
                                            Belge No: {fmtSerial(report?.serialNo) || `EK1-${visitId}`}&nbsp;&nbsp;|&nbsp;&nbsp;Tarih: {dateTR}
                                        </div>
                                    </div>
                                    <div className="doc-head__qr">
                                        <QRCode value={docUrl} size={60} level="M" />
                                    </div>
                                </header>

                                <section className="block">
                                    <div className="block-title">1. UYGULAMAYI YAPANA AİT BİLGİLER</div>
                                    <table className="kv">
                                        <colgroup><col style={{ width: "42%" }} /><col /></colgroup>
                                        <tbody>
                                            <tr><th>Belge Seri No</th><td>{fmtSerial(report?.serialNo) || provider?.certificateSerial || "—"}</td></tr>
                                            <tr><th>Uygulamayı Yapan Firma Adı</th><td>{provider?.companyName || "—"}</td></tr>
                                            <tr><th>Açık Adresi</th><td>{provider?.address || "—"}</td></tr>
                                            <tr><th>Mesul Müdür</th><td>{[provider?.responsibleTitle, provider?.responsibleName].filter(Boolean).join(" ")}</td></tr>
                                            <tr><th>Uygulayıcı/lar Adı Soyadı</th><td>{employeesStr}</td></tr>
                                            <tr><th>Telefon / Faks Numarası</th><td>{provider?.phoneFax || "—"}</td></tr>
                                            <tr><th>Müdürlük İzin Tarih ve Sayısı</th><td>{provider?.permissionNo || "—"}</td></tr>
                                        </tbody>
                                    </table>
                                </section>

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
                                                        <td>{l.amount} {UNIT_TR[l.biosidal?.unit] || ""}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </section>

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
                                                <td>{VISIT_TYPE_TR[visit?.visitType] || "—"} / {targetPestsStr}</td>
                                            </tr>
                                            <tr>
                                                <th>Gözlemlenen Uygunsuzluklar</th>
                                                <td>{ncrText}</td>
                                            </tr>
                                            <tr>
                                                <th>Uygulama Zamanı</th>
                                                <td>{dateTR} | {visit?.startTime || "—"} – {visit?.endTime || "—"}</td>
                                            </tr>
                                            <tr>
                                                <th>Mesken / İşyeri – Alan (m²)</th>
                                                <td>{displayPlaceType} / {displayAreaM2}</td>
                                            </tr>
                                            <tr>
                                                <th>Uyarı ve Öneriler</th>
                                                <td>{visit?.notes || "—"}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </section>

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
                                                description="Uygulayıcı İmzası"
                                                isProvider={true}
                                            />
                                        </div>
                                        <div className="sig-col">
                                            <div className="sig-col__header">Uygulama Yaptıran Yetkili</div>
                                            <SignatureBox
                                                signedAt={report?.customerSignedAt}
                                                signerName={report?.customerSignerName}
                                                signatureBase64={report?.customerSignature}
                                                signLog={report?.customerSignLog}
                                                description="Müşteri İmzası"
                                            />
                                        </div>
                                    </div>
                                </section>

                                <section className="note">
                                    <strong>Not:</strong> ZEHİRLENME DURUMLARINDA 114 UZEM VEYA 112'Yİ ARAYINIZ.
                                    Bu form 5 yıl süreyle muhafaza edilmek zorundadır.
                                    Dijital imza verileri elektronik kayıt olarak saklanmakta olup yasal geçerliliğe sahiptir.
                                </section>
                            </div>
                        );
                    })}
                </div>
            </div>
        </Layout>
    );
}
