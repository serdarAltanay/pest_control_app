// src/pages/shared/CompanyCertificates.jsx
import { useState, useEffect } from "react";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./CompanyCertificates.scss";

export default function CompanyCertificates() {
    const [items, setItems] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [role, setRole] = useState("");

    const [form, setForm] = useState({ title: "", file: null, notes: "" });

    const [blobUrls, setBlobUrls] = useState({});

    useEffect(() => {
        const roleStr = localStorage.getItem("role");
        if (roleStr) {
            setRole(roleStr.toLowerCase());
        }
        load();
        return () => {
            // Cleanup blob URLs on unmount
            Object.values(blobUrls).forEach(url => window.URL.revokeObjectURL(url));
        };
    }, []);

    const fetchBlob = async (certId) => {
        try {
            const resp = await api.get(`/certificates/${certId}/view`, { responseType: "blob" });
            const url = window.URL.createObjectURL(new Blob([resp.data], { type: resp.headers['content-type'] }));
            setBlobUrls(prev => ({ ...prev, [certId]: url }));
        } catch (err) {
            console.error(`Blob fetch error for ${certId}:`, err);
        }
    };

    const load = async () => {
        try {
            const { data } = await api.get("/certificates");
            const certs = Array.isArray(data) ? data : [];
            setItems(certs);
            // Fetch blobs for all items
            certs.forEach(c => fetchBlob(c.id));
        } catch {
            toast.error("Sertifikalar yüklenemedi");
        }
    };

    const isCustomer = role === "customer";
    const isAdmin = role === "admin";

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!form.title || !form.file) {
            return toast.warning("Lütfen başlık ve dosya seçin");
        }

        const fd = new FormData();
        fd.append("title", form.title);
        fd.append("file", form.file);
        if (form.notes) fd.append("notes", form.notes);

        setLoading(true);
        try {
            await api.post("/certificates", fd, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            toast.success("Sertifika başarıyla eklendi");
            setShowModal(false);
            setForm({ title: "", file: null, notes: "" });
            load();
        } catch (err) {
            toast.error(err.response?.data?.error || "Yükleme hatası");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id, title) => {
        if (!window.confirm(`"${title}" silinecek, emin misiniz?`)) return;
        try {
            await api.delete(`/certificates/${id}`);
            toast.success("Sertifika silindi");
            // Cleanup blob
            if (blobUrls[id]) {
                window.URL.revokeObjectURL(blobUrls[id]);
                setBlobUrls(prev => {
                    const next = { ...prev };
                    delete next[id];
                    return next;
                });
            }
            load();
        } catch {
            toast.error("Silinemedi");
        }
    };

    const handleDownload = async (item) => {
        try {
            const resp = await api.get(`/certificates/${item.id}/download`, { responseType: "blob" });
            const url = window.URL.createObjectURL(new Blob([resp.data]));
            const link = document.createElement("a");
            link.href = url;

            const extMatch = item.file.match(/\.[0-9a-z]+$/i);
            const ext = extMatch ? extMatch[0] : "";
            const filename = `${item.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}${ext}`;

            link.setAttribute("download", filename);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch {
            toast.error("Dosya indirilemedi");
        }
    };

    return (
        <Layout title="Şirket Sertifikaları">
            <div className="company-certs">
                <div className="head">
                    <h2>Şirket Sertifikaları</h2>
                    {isAdmin && (
                        <button className="btn primary" onClick={() => setShowModal(true)}>
                            + Yeni Sertifika
                        </button>
                    )}
                </div>

                <div className="certs-grid">
                    {items.length === 0 && <div className="empty">Henüz yüklenmiş sertifika yok.</div>}

                    {items.map((it) => (
                        <div key={it.id} className="cert-card">
                            <div className="c-info">
                                <h3>{it.title}</h3>
                                {it.notes && <p className="notes">{it.notes}</p>}
                                {!isCustomer && (
                                    <div className="meta">
                                        {new Date(it.uploadedAt).toLocaleString("tr-TR")}
                                    </div>
                                )}
                            </div>
                            <div className="c-preview">
                                {blobUrls[it.id] ? (
                                    it.mime?.startsWith("image/") ? (
                                        <img
                                            src={blobUrls[it.id]}
                                            alt={it.title}
                                            className="preview-frame"
                                            style={{ objectFit: "contain" }}
                                        />
                                    ) : (
                                        <iframe
                                            src={`${blobUrls[it.id]}#toolbar=0&navpanes=0`}
                                            className="preview-frame"
                                            title={it.title}
                                        />
                                    )
                                ) : (
                                    <div className="preview-loading">Önizleme yükleniyor...</div>
                                )}
                            </div>
                            <div className="c-actions">
                                <button className="btn ghost" onClick={() => handleDownload(it)}>
                                    İndir / Tam Ekran Aç
                                </button>
                                {isAdmin && (
                                    <button className="btn danger" onClick={() => handleDelete(it.id, it.title)}>
                                        Sil
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Ekleme Modalı */}
                {showModal && isAdmin && (
                    <div className="modal-backdrop" onClick={() => setShowModal(false)}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3>Sertifika Yükle</h3>
                                <button className="close-btn" onClick={() => setShowModal(false)}>&times;</button>
                            </div>
                            <form className="modal-body" onSubmit={handleUpload}>
                                <div className="form-group">
                                    <label>Belge Başlığı *</label>
                                    <input
                                        type="text"
                                        required
                                        value={form.title}
                                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Notlar (Opsiyonel)</label>
                                    <textarea
                                        rows={2}
                                        value={form.notes}
                                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Dosya (PDF, JPG, PNG, DOCX) *</label>
                                    <input
                                        type="file"
                                        required
                                        onChange={(e) => setForm({ ...form, file: e.target.files[0] })}
                                    />
                                </div>
                                <div className="form-actions" style={{ marginTop: "1rem", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                                    <button type="button" className="btn ghost" onClick={() => setShowModal(false)}>İptal</button>
                                    <button type="submit" className="btn primary" disabled={loading}>
                                        {loading ? "Yükleniyor..." : "Yükle"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}
