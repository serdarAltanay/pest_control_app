import React, { useEffect, useState } from "react";
import "./InitialLoader.scss";

const InitialLoader = ({ message = "Sistem hazırlanıyor..." }) => {
  const [showSlowMessage, setShowSlowMessage] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSlowMessage(true);
    }, 5000); // 5 saniye sonra "uyandırılıyor" mesajı ekle
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="initial-loader-overlay">
      <div className="initial-loader-content">
        <img src="/logo.png" alt="Logo" className="loader-logo" />
        <div className="spinner-dots">
          <div className="dot"></div>
          <div className="dot"></div>
          <div className="dot"></div>
        </div>
        <p className="loader-message">{message}</p>
        {showSlowMessage && (
          <div className="slow-server-hint">
            <p>Sistem açılıyor, lütfen bekleyin...</p>
            <div className="circular-spinner"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InitialLoader;
