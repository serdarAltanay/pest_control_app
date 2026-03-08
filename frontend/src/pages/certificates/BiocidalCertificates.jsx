import { useState, useEffect, useContext } from "react";
import api from "../../api/axios";
import { toast } from "react-toastify";
import { FiDownload, FiTrash2, FiPlus } from "react-icons/fi";
import { ProfileContext } from "../../context/ProfileContext";
import "./BiocidalCertificates.scss";

// Render statik URL veya API baseURL
const isLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
const API_URL = isLocal ? "http://localhost:5000" : "https://pest-control-app.onrender.com";

export default function BiocidalCertificates() {
    const { profile } = useContext(ProfileContext);
    const [certificates, setCertificates] = useState([]);
    const [biocides, setBiocides] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Upload state
    const [uploading, setUploading] = useState(false);
    const [title, setTitle] = useState("");
    const [biocideId, setBiocideId] = useState("");
    const [notes, setNotes] = useState("");
    const [file, setFile] = useState(null);

    // Müşteriler (accessOwner/customer) ekleme/silme yapamaz, sadece görebilir
    const canManageCerts = ["admin", "employee"].includes(profile?.role?.toLowerCase());

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            // Paralel veri çekimi
            const [certsRes, biocidesRes] = await Promise.all([
                api.get("/biocidal-certificates"),
                // Müşterilerin biyosidalları çekmesine gerek yok eğer sadece listeyi göreceklerse,
                // ama eğer API kısıtlamadıysa ve dropdown için lazımsa çekebiliriz.
                // Biz sadece canManageCerts olanlar için Biyosidal listesini çekelim modal içi:
                canManageCerts ? api.get("/biocides") : Promise.resolve({ data: [] })
            ]);

            setCertificates(certsRes.data);
            if (canManageCerts) {
                setBiocides(biocidesRes.data);
            }
        } catch (error) {
            console.error("Sertifikalar yüklenirken hata:", error);
            toast.error("Biyosidal sertifikaları yüklenirken bir hata oluştu.");
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
            toast.success("Sertifika başarıyla eklendi.");
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
            toast.success("Sertifika silindi.");
            setCertificates((prev) => prev.filter((c) => c.id !== id));
        } catch (error) {
            console.error("Delete error:", error);
            toast.error("Silme işlemi başarısız oldu.");
        }
    };

    const getFullUrl = (filePath) => {
        if (!filePath) return "#";
        // filePath örn: "uploads/certificates/abc.pdf"
        return `${API_URL}/${filePath}`;
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString("tr-TR", {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    };

    return (
        <div className="certificates-page-container">
            <header className="page-header">
                <div className="header-left">
                    <h1>Biyosidal Sertifikaları</h1>
                    <p>Sistemde kayıtlı biyosidal ürünlere ait ruhsat ve sertifikalar</p>
                </div>
                {canManageCerts && (
                    <div className="header-actions">
                        <button className="btn-add" onClick={() => setShowModal(true)}>
                            <FiPlus /> Sertifika Ekle
                        </button>
                    </div>
                )}
            </header>

            {loading ? (
                <div className="loading-state">Yükleniyor...</div>
            ) : certificates.length === 0 ? (
                <div className="empty-state">
                    <p>Henüz hiçbir biyosidal sertifikası eklenmemiş.</p>
                    {canManageCerts && <small>"Sertifika Ekle" butonunu kullanarak yeni belge yükleyebilirsiniz.</small>}
                </div>
            ) : (
                <div className="certificates-grid">
                    {certificates.map((cert) => (
                        <div key={cert.id} className="certificate-card">
                            <div className="cert-info">
                                <span className="biocide-name">
                                    {cert.biocide?.name || "Bilinmeyen Biyosidal"}
                                </span>
                                <h3>{cert.title}</h3>
                                {cert.notes && <p className="cert-notes">{cert.notes}</p>}
                                <span className="cert-date">Yüklenme: {formatDate(cert.uploadedAt)}</span>
                            </div>
                            <div className="cert-actions">
                                <a
                                    href={getFullUrl(cert.file)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn-view"
                                    download
                                >
                                    <FiDownload /> İndir
                                </a>
                                {canManageCerts && (
                                    <button
                                        className="btn-delete"
                                        onClick={() => handleDelete(cert.id)}
                                    >
                                        <FiTrash2 /> Sil
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal - Ekleme Formu */}
            {showModal && canManageCerts && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>Biyosidal Sertifikası Ekle</h2>
                        <form onSubmit={handleUpload}>
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
                                <label>Sertifika Adı / Başlığı *</label>
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
                                <span className="file-hint">Maksimum dosya boyutu: 10MB</span>
                            </div>

                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="btn-cancel"
                                    onClick={() => setShowModal(false)}
                                    disabled={uploading}
                                >
                                    İptal
                                </button>
                                <button type="submit" className="btn-submit" disabled={uploading}>
                                    {uploading ? "Yükleniyor..." : "Kaydet ve Yükle"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
