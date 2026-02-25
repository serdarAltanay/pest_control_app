import { useState, useContext } from "react";
import { ProfileContext } from "../../context/ProfileContext";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./Settings.scss";

export default function Settings() {
    const { profile } = useContext(ProfileContext);
    const [downloading, setDownloading] = useState(false);
    const [backingUp, setBackingUp] = useState(false);
    const navigate = useNavigate();

    const isAdmin = profile?.role?.toLowerCase() === "admin";

    const handleDownloadBackup = async () => {
        if (downloading) return;
        setDownloading(true);
        try {
            const response = await api.get("/admin/backup/download", {
                responseType: "blob",
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement("a");
            link.href = url;

            // Filename from header if possible, else default
            const contentDisposition = response.headers["content-disposition"];
            let filename = "pest_control_backup.zip";
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="(.+)"/);
                if (match) filename = match[1];
            }

            link.setAttribute("download", filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            toast.success("Yedekleme dosyası başarıyla indirildi.");
        } catch (err) {
            console.error("Backup download error:", err);
            toast.error("Yedekleme dosyası indirilirken bir hata oluştu.");
        } finally {
            setDownloading(false);
        }
    };

    const handleServerBackup = async () => {
        if (backingUp) return;
        setBackingUp(true);
        try {
            const { data } = await api.post("/admin/backup/server");
            toast.success(data.message || "Sunucu yedeği başarıyla oluşturuldu.");
        } catch (err) {
            console.error("Server backup error:", err);
            toast.error("Sunucu yedeklemesi sırasında bir hata oluştu.");
        } finally {
            setBackingUp(false);
        }
    };

    return (
        <div className="settings-page">
            <div className="settings-header">
                <div>
                    <h1>Ayarlar</h1>
                    <p>Hesap ve sistem tercihlerini buradan yönetebilirsiniz.</p>
                </div>
                <button className="btn-back" onClick={() => navigate(-1)} aria-label="Geri Dön">
                    ← Geri Dön
                </button>
            </div>

            <div className="settings-content">
                <section className="settings-section">
                    <h2>Profil Bilgileri</h2>
                    <div className="profile-summary">
                        <div className="info-item">
                            <span className="label">Ad Soyad:</span>
                            <span className="value">{profile?.fullName}</span>
                        </div>
                        <div className="info-item">
                            <span className="label">E-posta:</span>
                            <span className="value">{profile?.email}</span>
                        </div>
                        <div className="info-item">
                            <span className="label">Rol:</span>
                            <span className="value">{profile?.role?.toUpperCase()}</span>
                        </div>
                    </div>
                </section>

                {isAdmin && (
                    <section className="settings-section admin-section">
                        <h2>Sistem Yönetimi (Admin)</h2>
                        <div className="backup-controls">
                            <h3>Veri Yedekleme</h3>
                            <p>
                                Tüm veritabanı şemalarını ve <code>uploads</code> klasöründeki dosyaları
                                yedekleyebilirsiniz.
                            </p>
                            <div className="button-group">
                                <button
                                    className="btn-download"
                                    onClick={handleDownloadBackup}
                                    disabled={downloading}
                                >
                                    {downloading ? "Hazırlanıyor..." : "Yedeği Yerel PC'ye İndir"}
                                </button>
                                <button
                                    className="btn-server"
                                    onClick={handleServerBackup}
                                    disabled={backingUp}
                                >
                                    {backingUp ? "Yedekleniyor..." : "Sunucuda Yedek Oluştur"}
                                </button>
                            </div>
                            <p className="note">
                                * Sunucuda oluşturulan yedekler VPS üzerindeki <code>backups/</code> klasöründe saklanır.
                            </p>
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
