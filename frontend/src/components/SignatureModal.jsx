import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import SignatureCanvas from 'react-signature-canvas';
import api from '../api/axios';
import '../styles/SignatureModal.scss';

/**
 * SignatureModal - Biyometrik İmza Modalı
 *
 * Props:
 *  isOpen     : boolean
 *  onClose    : () => void
 *  onConfirm  : (base64: string) => void
 *  title      : string
 *  subtitle   : string  (opsiyonel)
 *  signerName : string  (opsiyonel)
 */
export default function SignatureModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Dijital İmza",
  subtitle,
  signerName,
}) {
  const sigPad = useRef(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const [strokeCount, setStrokeCount] = useState(0);
  const [kvkkAccepted, setKvkkAccepted] = useState(false);

  /* Modal açılınca canvas'ı sıfırla */
  useEffect(() => {
    if (isOpen) {
      setIsEmpty(true);
      setStrokeCount(0);
      setKvkkAccepted(false);
      setTimeout(() => sigPad.current?.clear(), 50);
    }
  }, [isOpen]);

  /* Body scroll kilit */
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClear = () => {
    sigPad.current?.clear();
    setIsEmpty(true);
    setStrokeCount(0);
  };

  const handleEnd = () => {
    const empty = sigPad.current?.isEmpty() ?? true;
    setIsEmpty(empty);
    if (!empty) setStrokeCount((c) => c + 1);
  };

  const handleSave = async () => {
    if (!sigPad.current || sigPad.current.isEmpty()) {
      alert("Lütfen imzalamadan geçmeyiniz.");
      return;
    }

    try {
      // Biyometrik imza iznini arka planda logla (hata verse bile imzayı engelleme)
      await api.post("/auth/consent", { consentType: "BIOMETRIC_SIGNATURE" });
    } catch (e) { console.warn("KVKK consent loglanamadı:", e); }

    try {
      const canvas = sigPad.current.getCanvas();
      onConfirm(canvas.toDataURL('image/png'));
    } catch {
      onConfirm(sigPad.current.toDataURL('image/png'));
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  /* ── Portal ile body'ye mount ── */
  return createPortal(
    <div className="sigm-overlay" onClick={handleOverlayClick}>
      <div className="sigm-modal" role="dialog" aria-modal="true">

        {/* Header */}
        <div className="sigm-header">
          <div className="sigm-header-left">
            <div className="sigm-icon" aria-hidden="true">✍</div>
            <div>
              <h3 className="sigm-title">{title}</h3>
              {subtitle && <p className="sigm-subtitle">{subtitle}</p>}
              {signerName && (
                <p className="sigm-signer">
                  <span className="sigm-signer-dot" aria-hidden="true" />
                  {signerName}
                </p>
              )}
            </div>
          </div>
          <button className="sigm-close" onClick={onClose} aria-label="Kapat">✕</button>
        </div>

        {/* Bilgi bandı */}
        <div className="sigm-info-banner">
          IP adresi, GPS konumu ve zaman damgası otomatik olarak kayıt altına alınacaktır.
        </div>

        {/* Canvas */}
        <div className="sigm-canvas-wrapper">
          <div className={`sigm-canvas-frame${!isEmpty ? ' has-sig' : ''}`}>
            <SignatureCanvas
              ref={sigPad}
              penColor="#000"
              minWidth={1.5}
              maxWidth={3.5}
              velocityFilterWeight={0.7}
              canvasProps={{ className: 'sigm-canvas' }}
              onEnd={handleEnd}
            />
            {isEmpty && (
              <div className="sigm-placeholder" aria-hidden="true">
                <svg width="48" height="28" viewBox="0 0 48 28" fill="none">
                  <path
                    d="M3 22 Q10 6 18 14 Q26 22 34 6 Q38 1 44 10"
                    stroke="#b0b8c4" strokeWidth="2.5" strokeLinecap="round" fill="none"
                  />
                </svg>
                <span>Buraya imzalayınız</span>
              </div>
            )}
          </div>

          <div className="sigm-baseline">
            <div className="sigm-baseline-line" />
            <span className="sigm-baseline-label">İmza Alanı</span>
          </div>
        </div>

        {/* Çizgi sayacı */}
        {strokeCount > 0 && (
          <div className="sigm-stroke-info">
            <span className="sigm-dot-green" aria-hidden="true" />
            İmza alındı
          </div>
        )}

        {/* KVKK Onay */}
        <label className="sigm-kvkk">
          <input
            type="checkbox"
            checked={kvkkAccepted}
            onChange={(e) => setKvkkAccepted(e.target.checked)}
          />
          <span>
            Konum, IP adresi ve zaman damgası bilgilerimin yasal kayıt amacıyla
            işlenmesini okudum ve kabul ediyorum.
            <small> (6698 sayılı KVKK)</small>
          </span>
        </label>

        {/* Footer */}
        <div className="sigm-footer">
          <button className="sigm-btn sigm-btn-ghost" onClick={handleClear}>
            ↺ Temizle
          </button>
          <div className="sigm-footer-right">
            <button className="sigm-btn sigm-btn-cancel" onClick={onClose}>
              İptal
            </button>
            <button
              className={`sigm-btn sigm-btn-confirm${isEmpty || !kvkkAccepted ? ' disabled' : ''}`}
              onClick={handleSave}
              disabled={isEmpty || !kvkkAccepted}
            >
              ✓ İmzayı Onayla
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body   // ← stacking context'in dışına çıkar
  );
}