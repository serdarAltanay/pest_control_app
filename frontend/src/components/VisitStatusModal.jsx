import React, { useState } from "react";
import "../styles/VisitStatusModal.scss";

const STATUS_OPTIONS = [
    { value: "PLANNED", label: "Planlandı", color: "blue", icon: "📅" },
    { value: "COMPLETED", label: "Yapıldı", color: "green", icon: "✅" },
    { value: "FAILED", label: "Yapılmadı", color: "red", icon: "❌" },
    { value: "CANCELLED", label: "İptal Edildi", color: "gray", icon: "🚫" },
    { value: "POSTPONED", label: "Ertelendi", color: "orange", icon: "⏳" },
];

export default function VisitStatusModal({ isOpen, onClose, onConfirm, initialStatus = "PLANNED", visitTitle = "Ziyaret" }) {
    const [selected, setSelected] = useState(initialStatus);

    if (!isOpen) return null;

    return (
        <div className="vsm-overlay" onClick={onClose}>
            <div className="vsm-modal" onClick={(e) => e.stopPropagation()}>
                <div className="vsm-header">
                    <h2>Ziyaret Durumu</h2>
                    <p>{visitTitle} için yeni durumu belirleyin.</p>
                </div>

                <div className="vsm-content">
                    <div className="status-grid">
                        {STATUS_OPTIONS.map((opt) => (
                            <button
                                key={opt.value}
                                className={`status-btn ${selected === opt.value ? `active active--${opt.value}` : ""}`}
                                onClick={() => setSelected(opt.value)}
                            >
                                <i>{opt.icon}</i>
                                <span>{opt.label}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="vsm-footer">
                    <button className="btn ghost" onClick={onClose}>
                        İptal
                    </button>
                    <button className="btn primary" onClick={() => onConfirm(selected)}>
                        Güncelle ve Devam Et
                    </button>
                </div>
            </div>
        </div>
    );
}
