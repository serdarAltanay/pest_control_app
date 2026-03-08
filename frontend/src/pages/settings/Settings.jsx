import { useState, useContext, useEffect } from "react";
import { ProfileContext } from "../../context/ProfileContext";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./Settings.scss";

export default function Settings() {
    const { profile } = useContext(ProfileContext);
    const [downloading, setDownloading] = useState(false);

    const navigate = useNavigate();

    const isAdmin = profile?.role?.toLowerCase() === "admin";

    // --- Provider Profile (Firma Ayarları) ---
    const [providerProfile, setProviderProfile] = useState({
        companyName: "", address: "", responsibleTitle: "", responsibleName: "", phoneFax: "", certificateSerial: "", permissionNo: ""
    });
    const [savingProvider, setSavingProvider] = useState(false);

    useEffect(() => {
        if (isAdmin) {
            api.get("/admin/provider-profile")
                .then(res => setProviderProfile(res.data))
                .catch(err => console.error("Provider profile error:", err));
        }
    }, [isAdmin]);

    const handleProviderChange = (e) => {
        const { name, value } = e.target;
        setProviderProfile(prev => ({ ...prev, [name]: value }));
    };

    const handleProviderSave = async () => {
        setSavingProvider(true);
        try {
            await api.put("/admin/provider-profile", providerProfile);
            toast.success("Firma ayarları başarıyla güncellendi.");
        } catch (err) {
            toast.error("Firma ayarları kaydedilemedi.");
        } finally {
            setSavingProvider(false);
        }
    };
    // ------------------------------------------

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
            let msg = "Yedekleme dosyası indirilirken bir hata oluştu.";
            try {
                // blob responseType durumunda hata yanıtı da blob olarak gelir
                if (err?.response?.data instanceof Blob) {
                    const text = await err.response.data.text();
                    const json = JSON.parse(text);
                    if (json?.message) msg = json.message;
                } else if (err?.response?.data?.message) {
                    msg = err.response.data.message;
                }
            } catch { }
            toast.error(msg);
        } finally {
            setDownloading(false);
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
                    <>
                        <section className="settings-section admin-section">
                            <h2>Firma Ayarları (EK-1 Şablonu)</h2>
                            <p style={{ marginBottom: "1.5rem", color: "var(--text-light)" }}>
                                Buraya gireceğiniz bilgiler <strong>EK-1 Biyosidal Uygulama Formu'na</strong> (1. Bölüm) otomatik olarak yansıyacaktır.
                            </p>
                            <div className="provider-form">
                                <label className="settings-field">
                                    <span>Firma Adı:</span>
                                    <input type="text" name="companyName" value={providerProfile.companyName || ""} onChange={handleProviderChange} placeholder="Tura Çevre" />
                                </label>
                                <label className="settings-field">
                                    <span>Açık Adres:</span>
                                    <textarea name="address" value={providerProfile.address || ""} onChange={handleProviderChange} rows={2} placeholder="Firma açık adresi" />
                                </label>
                                <div className="settings-row">
                                    <label className="settings-field">
                                        <span>Mesul Müdür Ünvanı:</span>
                                        <input type="text" name="responsibleTitle" value={providerProfile.responsibleTitle || ""} onChange={handleProviderChange} placeholder="Örn: Ziraat Mühendisi" />
                                    </label>
                                    <label className="settings-field">
                                        <span>Mesul Müdür Adı:</span>
                                        <input type="text" name="responsibleName" value={providerProfile.responsibleName || ""} onChange={handleProviderChange} placeholder="Örn: Ahmet Yılmaz" />
                                    </label>
                                </div>
                                <div className="settings-row">
                                    <label className="settings-field">
                                        <span>Telefon / Faks Numarası:</span>
                                        <input type="text" name="phoneFax" value={providerProfile.phoneFax || ""} onChange={handleProviderChange} placeholder="Örn: 0312 123 45 67" />
                                    </label>
                                </div>
                                <div className="settings-row">
                                    <label className="settings-field">
                                        <span>Müdürlük İzin Tarih ve Sayısı:</span>
                                        <input type="text" name="permissionNo" value={providerProfile.permissionNo || ""} onChange={handleProviderChange} placeholder="Örn: 01.01.2024 / 98765" />
                                    </label>
                                </div>
                                <button className="btn-primary-settings" onClick={handleProviderSave} disabled={savingProvider}>
                                    {savingProvider ? "Kaydediliyor..." : "Firma Ayarlarını Kaydet"}
                                </button>
                            </div>
                        </section>

                        <section className="settings-section admin-section">
                            <h2>Sistem Yönetimi (Admin)</h2>
                            <div className="backup-controls">
                                <h3>Veri Yedekleme</h3>
                                <p>
                                    Veritabanı şemasını ve verilerini içeren SQL yedeğini bilgisayarınıza indirebilirsiniz.
                                </p>
                                <div className="button-group">
                                    <button
                                        className="btn-download"
                                        onClick={handleDownloadBackup}
                                        disabled={downloading}
                                    >
                                        {downloading ? "Yedek Hazırlanıyor..." : "Sistem Yedeğini İndir"}
                                    </button>
                                </div>
                            </div>
                        </section>
                    </>
                )}
            </div>
        </div>
    );
}
