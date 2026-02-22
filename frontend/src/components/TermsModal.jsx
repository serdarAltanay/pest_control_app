import React, { useState } from "react";
import api from "../api/axios";
import { toast } from "react-toastify";
import "./TermsModal.scss";

export default function TermsModal({ onComplete }) {
    const [loading, setLoading] = useState(false);
    const [accepted, setAccepted] = useState(false);

    const handleAccept = async () => {
        if (!accepted) return;
        setLoading(true);
        try {
            const { data } = await api.post("/auth/consent", { consentType: "COMBINED_TOS_PRIVACY" });
            if (data?.accessToken) {
                // Token'ı localStorage ve axios'ta güncelleyelim ki PrivateRoute hemen görsün.
                localStorage.setItem("accessToken", data.accessToken);
                api.defaults.headers.common.Authorization = `Bearer ${data.accessToken}`;
            }
            toast.success("Kullanım Koşulları ve KVKK Metni onaylandı.");
            onComplete(); // PrivateRoute'a onay verildiğini bildir
        } catch (err) {
            console.error(err);
            toast.error("Onay kaydedilirken bir hata oluştu.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="terms-modal-overlay">
            <div className="terms-modal-content">
                <h2>Sisteme Hoş Geldiniz</h2>
                <p className="terms-intro">
                    Uygulamamızı kullanmaya başlamadan önce lütfen Kullanım Koşulları ve KVKK Aydınlatma Metnini okuyup onaylayınız.
                </p>

                <div className="terms-scroll-area">
                    <h3>Kişisel Verilerin İşlenmesine Dair Aydınlatma Metni (Özet)</h3>
                    <p>
                        6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca, Haşere Kontrol süreçlerinizin yürütülebilmesi
                        amacıyla sistem yöneticileriniz tarafından platforma tanımlanan <strong>Ad, Soyad, E-posta ve Telefon numarası</strong> gibi
                        iletişim verileriniz, hizmet sözleşmesinin ifası ve yasal yükümlülüklerin yerine getirilmesi hukuki sebeplerine
                        dayanarak sistemimizde güvenli bir şekilde işlenmektedir.
                    </p>
                    <p>
                        Platformu kullanırken IP adresiniz, giriş çıkış loglarınız ve sistem içi aktiviteleriniz, bilgi güvenliğinin
                        sağlanması amacıyla kaydedilmektedir. İlgili kanunun 11. maddesi kapsamındaki "unutulma" (hesap silme) veya başvuru
                        haklarınızı "Profil" sayfasından veya sistem yöneticinize ulaşarak dilediğiniz zaman kullanabilirsiniz.
                    </p>

                    <h3>Kullanım Koşulları</h3>
                    <p>
                        Sisteme giriş yaptığınız andan itibaren platformun güvenliğinden kendiniz sorumlusunuz. Şifrenizi 3. şahıslarla
                        paylaşmamanız ve güvenli oturum kapatma kurallarına riayet etmeniz gerekmektedir. İşbu KVKK metnini ve koşulları
                        okuyup anladığınızı beyan etmektesiniz.
                    </p>
                </div>

                <label className="terms-checkbox-label">
                    <input
                        type="checkbox"
                        checked={accepted}
                        onChange={(e) => setAccepted(e.target.checked)}
                        disabled={loading}
                    />
                    <span>Kullanım Koşulları ve KVKK Aydınlatma Metnini okudum, anladım ve kabul ediyorum.</span>
                </label>

                <div className="terms-actions">
                    <button
                        className="terms-btn-accept"
                        onClick={handleAccept}
                        disabled={!accepted || loading}
                    >
                        {loading ? "Onaylanıyor..." : "Onaylıyorum (Devam Et)"}
                    </button>
                </div>
            </div>
        </div>
    );
}
