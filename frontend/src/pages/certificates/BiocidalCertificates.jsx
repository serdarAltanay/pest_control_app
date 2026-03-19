import { useState, useEffect, useContext } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { toast } from "react-toastify";
import { FiTrash2, FiPlus } from "react-icons/fi";
import { ProfileContext } from "../../context/ProfileContext";
import { toAbsoluteUrl } from "../../utils/getAssetUrl";
import Layout from "../../components/Layout";
import "./BiocidalCertificates.scss";

// BiocidalCertificates.jsx

export default function BiocidalCertificates() {
    const { profile } = useContext(ProfileContext);
    const navigate = useNavigate();
    const isEmployee = profile?.role?.toLowerCase() === "employee";

    useEffect(() => {
        if (isEmployee) {
            navigate("/work");
        }
    }, [isEmployee, navigate]);

    if (isEmployee) return null;

    const [certificates, setCertificates] = useState([]);
    const [biocides, setBiocides] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [viewerDoc, setViewerDoc] = useState(null);

    // Upload state
    const [uploading, setUploading] = useState(false);
    const [title, setTitle] = useState("");
    const [biocideId, setBiocideId] = useState("");
    const [notes, setNotes] = useState("");
    const [file, setFile] = useState(null);

    // Müşteriler (accessOwner/customer) ekleme/silme yapamaz, sadece görebilir
    const canManageCerts = ["admin", "employee"].includes(profile?.role?.toLowerCase()) && profile?.level !== 2;
    const userToken = localStorage.getItem("accessToken");



    useEffect(() => {
        fetchData();
    }, [profile]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Paralel veri çekimi
            const [certsRes, biocidesRes] = await Promise.all([
                api.get("/biocidal-certificates"),
                api.get("/biocides").catch(() => ({ data: [] }))
            ]);

            setCertificates(certsRes.data);
            setBiocides(Array.isArray(biocidesRes.data) ? biocidesRes.data : []);

        } catch (error) {
            console.error("SDS Formları yüklenirken hata:", error);
            toast.error("SDS ilaç güvenlik formları yüklenirken bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!title || !biocideId || !file) {
            toast.warn("Lütfen zorunlu alanları doldurun.");
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append("title", title);
        formData.append("biocideId", biocideId);
        formData.append("file", file);
        if (notes) formData.append("notes", notes);

        try {
            await api.post("/biocidal-certificates", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            toast.success("SDS Formu başarıyla eklendi.");
            setShowModal(false);

            // Formu temizle
            setTitle("");
            setBiocideId("");
            setNotes("");
            setFile(null);

            // Listeyi güncelle
            fetchData();
        } catch (error) {
            console.error("Upload error:", error);
            toast.error(error.response?.data?.message || "Sertifika yüklenirken hata oluştu.");
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Bu sertifikayı silmek istediğinize emin misiniz?")) return;

        try {
            await api.delete(`/biocidal-certificates/${id}`);
            toast.success("SDS Formu silindi.");
            setCertificates((prev) => prev.filter((c) => c.id !== id));
        } catch (error) {
            console.error("Delete error:", error);
            toast.error("Silme işlemi başarısız oldu.");
        }
    };

    // URL helper removed in favor of toAbsoluteUrl

    const handleDownload = async (item) => {
        try {
            const resp = await api.get(`/biocidal-certificates/${item.id}/download`, { responseType: "blob" });
            const url = window.URL.createObjectURL(new Blob([resp.data]));
            const link = document.createElement("a");
            link.href = url;

            let ext = "";
            if (item.mime) {
                if (item.mime.includes("pdf")) ext = ".pdf";
                else if (item.mime.includes("png")) ext = ".png";
                else if (item.mime.includes("jpeg") || item.mime.includes("jpg")) ext = ".jpg";
            }
            if (!ext && item.title.toLowerCase().includes(".pdf")) ext = ".pdf";

            const filename = `${item.title.replace(/[^a-z0-9\ı\ö\ü\ş\ğ\ç]/gi, '_').toLowerCase()}${ext || '.pdf'}`;

            link.setAttribute("download", filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch {
            toast.error("Dosya indirilemedi");
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString("tr-TR", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    };

    return (
        <Layout title="SDS İlaç Güvenlik Formları">
            <div className="company-certs">
                <div className="head">
                    <h2>SDS İlaç Güvenlik Formları</h2>
                    {canManageCerts && (
                        <button className="btn primary" onClick={() => setShowModal(true)}>
                            <FiPlus /> Yeni Form Ekle
                        </button>
                    )}
                </div>

                <div className="certs-grid">
                    {loading ? (
                        <div className="empty">Yükleniyor...</div>
                    ) : certificates.length === 0 ? (
                        <div className="empty">Henüz hiçbir SDS formu eklenmemiş.</div>
                    ) : (
                        certificates.map((cert) => (
                            <div key={cert.id} className="cert-card" onClick={() => setViewerDoc(cert)} style={{ cursor: 'pointer' }}>
                                <div className="c-info">
                                    <span style={{
                                        display: "inline-block",
                                        background: "rgba(33, 150, 243, 0.1)",
                                        color: "var(--primary)",
                                        padding: "2px 6px",
                                        borderRadius: "4px",
                                        fontSize: "11px",
                                        fontWeight: "600",
                                        marginBottom: "6px"
                                    }}>
                                        {cert.biocide?.name || "Bilinmeyen Biyosidal"}
                                    </span>
                                    <h3>{cert.title}</h3>
                                    {cert.notes && <p className="notes">{cert.notes}</p>}
                                    <div className="meta">
                                        Yüklenme: {formatDate(cert.uploadedAt)}
                                    </div>
                                </div>
                                <div className="c-preview">
                                    {cert.file ? (
                                        cert.mime?.startsWith("image/") ? (
                                            <img
                                                src={`${toAbsoluteUrl(`api/biocidal-certificates/${cert.id}/view`, { forceApi: true })}?token=${userToken}`}
                                                alt={cert.title}
                                                className="preview-frame"
                                                style={{ objectFit: "contain" }}
                                            />
                                        ) : (
                                            <iframe
                                                src={`${toAbsoluteUrl(`api/biocidal-certificates/${cert.id}/view`, { forceApi: true })}?token=${userToken}#toolbar=0&navpanes=0`}
                                                className="preview-frame"
                                                title={cert.title}
                                                style={{ pointerEvents: 'none' }}
                                            />
                                        )
                                    ) : (
                                        <div className="empty">Dosya yok.</div>
                                    )}
                                </div>
                                <div className="c-actions">
                                    <button className="btn ghost" onClick={(e) => { e.stopPropagation(); handleDownload(cert); }}>
                                        İndir
                                    </button>
                                    {canManageCerts && (
                                        <button
                                            className="btn danger"
                                            onClick={(e) => { e.stopPropagation(); handleDelete(cert.id); }}
                                        >
                                            <FiTrash2 /> Sil
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Ekleme Modalı */}
                {showModal && canManageCerts && (
                    <div className="modal-backdrop" onClick={() => setShowModal(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>SDS Formu Yükle</h3>
                                <button type="button" className="close-btn" onClick={() => setShowModal(false)}>&times;</button>
                            </div>
                            <form className="modal-body" onSubmit={handleUpload}>
                                <div className="form-group">
                                    <label>İlgili Biyosidal *</label>
                                    <select
                                        value={biocideId}
                                        onChange={(e) => setBiocideId(e.target.value)}
                                        required
                                    >
                                        <option value="" disabled>Seçiniz</option>
                                        {biocides.map((b) => (
                                            <option key={b.id} value={b.id}>{b.name} ({b.activeIngredient})</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>Belge Başlığı *</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="Örn: Ruhsatname belgesi"
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Açıklama / Notlar (Opsiyonel)</label>
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="İsteğe bağlı ek bilgiler..."
                                        rows="2"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Dosya (PDF, JPG, PNG) *</label>
                                    <input
                                        type="file"
                                        onChange={handleFileChange}
                                        accept=".pdf,image/jpeg,image/png,image/jpg"
                                        required
                                    />
                                </div>

                                <div className="form-actions" style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                                    <button
                                        type="button"
                                        className="btn ghost"
                                        onClick={() => setShowModal(false)}
                                        disabled={uploading}
                                    >
                                        İptal
                                    </button>
                                    <button type="submit" className="btn primary" disabled={uploading}>
                                        {uploading ? "Yükleniyor..." : "Yükle"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Görüntüleme Modalı */}
                {viewerDoc && (
                    <div className="modal-backdrop viewer-backdrop" onClick={() => setViewerDoc(null)}>
                        <div className="viewer-modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="viewer-header">
                                <h3>{viewerDoc.title}</h3>
                                <button className="close-btn" onClick={() => setViewerDoc(null)}>&times;</button>
                            </div>
                            <div className="viewer-body">
                                {viewerDoc.mime?.startsWith("image/") ? (
                                    <img
                                        src={`${toAbsoluteUrl(`api/biocidal-certificates/${viewerDoc.id}/view`, { forceApi: true })}?token=${userToken}`}
                                        alt={viewerDoc.title}
                                    />
                                ) : (
                                    <iframe
                                        src={`${toAbsoluteUrl(`api/biocidal-certificates/${viewerDoc.id}/view`, { forceApi: true })}?token=${userToken}#toolbar=0&navpanes=0`}
                                        title={viewerDoc.title}
                                    />
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}
