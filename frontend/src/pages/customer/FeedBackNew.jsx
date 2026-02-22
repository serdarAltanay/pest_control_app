// src/pages/customer/FeedbackNew.jsx
import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./Feedback.scss";
import FeedbackList from "./FeedbackList.jsx";

export default function FeedbackNew() {
  const location = useLocation();
  const { initialStoreId, initialTitle } = location.state || {};

  const role = (localStorage.getItem("role") || "").toLowerCase();
  const [tab, setTab] = useState("complaint"); // complaint | suggestion
  const [stores, setStores] = useState([]);

  // Complaint form
  const [cType, setCType] = useState("PERSONEL");
  const [cStoreId, setCStoreId] = useState(initialStoreId ? String(initialStoreId) : "");
  const [cEmployeeName, setCEmployeeName] = useState("");
  const [cTitle, setCTitle] = useState(initialTitle || "");
  const [cMessage, setCMessage] = useState("");
  const [cImage, setCImage] = useState(null);

  // Disable/lock states (double submit önleme)
  const [cSending, setCSending] = useState(false);
  const [cDisabled, setCDisabled] = useState(false);
  const [sSending, setSSending] = useState(false);
  const [sDisabled, setSDisabled] = useState(false);

  // Drag & drop
  const [dzActive, setDzActive] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  // Suggestion form
  const [sTitle, setSTitle] = useState("");
  const [sMessage, setSMessage] = useState("");

  useEffect(() => {
    if (role !== "customer") return;
    api
      .get("/feedback/customer/my-stores")
      .then(({ data }) => {
        const list = Array.isArray(data) ? data : [];
        setStores(list);
        if (!initialStoreId && list[0]?.id) {
          setCStoreId(String(list[0].id));
        }
      })
      .catch(() => { });
  }, [role, initialStoreId]);

  // --- Drag & Drop helpers ---
  const acceptTypes = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
  const maxBytes = 5 * 1024 * 1024; // 5 MB

  const setFileWithValidation = (file) => {
    if (!file) return;
    if (!acceptTypes.has(file.type)) {
      toast.error("Sadece PNG, JPEG veya WEBP yükleyebilirsiniz.");
      return;
    }
    if (file.size > maxBytes) {
      toast.error("Dosya boyutu 5 MB'ı aşmamalı.");
      return;
    }
    setCImage(file);
  };

  useEffect(() => {
    if (cImage) {
      const url = URL.createObjectURL(cImage);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [cImage]);

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDzActive(false);
    const file = e.dataTransfer?.files?.[0];
    setFileWithValidation(file);
  };

  const handleBrowseChange = (e) => {
    const file = e.target.files?.[0];
    setFileWithValidation(file);
  };

  const clearFile = () => {
    setCImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const afterSuccessCooldown = (setter) => {
    // Toast gösterimi ardından 1.6 sn daha kilitli tut
    setter(true);
    setTimeout(() => setter(false), 1600);
  };

  const submitComplaint = async () => {
    if (cSending || cDisabled) return;
    try {
      if (!cStoreId || !cTitle || !cMessage) return toast.error("Zorunlu alanları doldurun");

      setCSending(true);
      const fd = new FormData();
      fd.append("type", cType);
      fd.append("storeId", cStoreId);
      fd.append("title", cTitle);
      fd.append("message", cMessage);
      if (cType === "PERSONEL" && cEmployeeName) fd.append("employeeName", cEmployeeName);
      if (cImage) fd.append("image", cImage);

      await api.post("/feedback/complaints", fd, { headers: { "Content-Type": "multipart/form-data" } });

      toast.success("Şikayet oluşturuldu");
      // reset
      setCTitle("");
      setCMessage("");
      setCImage(null);
      setCEmployeeName("");
      if (fileInputRef.current) fileInputRef.current.value = "";

      setCSending(false);
      afterSuccessCooldown(setCDisabled); // 1.6 sn daha disabled
    } catch (e) {
      setCSending(false);
      setCDisabled(false);
      toast.error(e?.response?.data?.message || "Kaydedilemedi");
    }
  };

  const submitSuggestion = async () => {
    if (sSending || sDisabled) return;
    try {
      if (!sTitle || !sMessage) return toast.error("Zorunlu alanları doldurun");

      setSSending(true);
      await api.post("/feedback/suggestions", { title: sTitle, message: sMessage });

      toast.success("Öneri gönderildi");
      setSTitle("");
      setSMessage("");

      setSSending(false);
      afterSuccessCooldown(setSDisabled);
    } catch (e) {
      setSSending(false);
      setSDisabled(false);
      toast.error(e?.response?.data?.message || "Kaydedilemedi");
    }
  };

  const complaintBtnDisabled = cSending || cDisabled;
  const suggestionBtnDisabled = sSending || sDisabled;

  return (
    <Layout title="Şikayet / Öneri">
      <div className="feedback-page">
        <div className="tabs">
          <button className={tab === "complaint" ? "active" : ""} onClick={() => setTab("complaint")}>
            Şikayet
          </button>
          <button className={tab === "suggestion" ? "active" : ""} onClick={() => setTab("suggestion")}>
            Öneri
          </button>
        </div>

        {tab === "complaint" && (
          <div className="card form">
            <div className="row">
              <label>Şikayet Türü</label>
              <select value={cType} onChange={(e) => setCType(e.target.value)}>
                <option value="PERSONEL">Personel</option>
                <option value="UYGULAMA">Uygulama</option>
                <option value="ISTASYONLAR">İstasyonlar</option>
                <option value="DIGER">Diğer</option>
              </select>
            </div>

            <div className="row">
              <label>Şikayet Mağazası</label>
              <select value={cStoreId} onChange={(e) => setCStoreId(e.target.value)}>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code ? `${s.code} – ` : ""}
                    {s.name} {s.city ? `(${s.city})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {cType === "PERSONEL" && (
              <div className="row">
                <label>Personel İsmi</label>
                <input value={cEmployeeName} onChange={(e) => setCEmployeeName(e.target.value)} placeholder="(opsiyonel)" />
              </div>
            )}

            <div className="row">
              <label>Başlık</label>
              <input value={cTitle} onChange={(e) => setCTitle(e.target.value)} />
            </div>

            <div className="row">
              <label>Şikayet Metni</label>
              <textarea value={cMessage} onChange={(e) => setCMessage(e.target.value)} rows={4} />
            </div>

            <div className="row">
              <label>Şikayet Görseli</label>

              <div
                className={`dropzone ${dzActive ? "is-drag" : ""} ${cImage ? "has-file" : ""}`}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDzActive(true); }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDzActive(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDzActive(false); }}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                {!cImage ? (
                  <div className="dz-inner">
                    <div className="dz-icon" aria-hidden>📎</div>
                    <div className="dz-text">
                      Görseli sürükleyip bırakın <span className="muted">ya da tıklayıp seçin</span>
                    </div>
                    <div className="dz-hint">PNG, JPG, WEBP — max 5 MB</div>
                  </div>
                ) : (
                  <div className="dz-preview">
                    {previewUrl && <img src={previewUrl} alt="Şikayet görseli önizleme" className="dz-thumb" />}
                    <div className="dz-meta">
                      <div className="dz-name" title={cImage.name}>{cImage.name}</div>
                      <div className="dz-size">{(cImage.size / 1024).toFixed(0)} KB</div>
                    </div>
                    <button
                      type="button"
                      className="dz-remove"
                      onClick={(e) => { e.stopPropagation(); clearFile(); }}
                    >
                      Kaldır
                    </button>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleBrowseChange}
                  aria-label="Görsel dosyası seç"
                />
              </div>
            </div>

            <div className="actions">
              <button
                onClick={submitComplaint}
                disabled={complaintBtnDisabled}
                aria-busy={complaintBtnDisabled}
              >
                {complaintBtnDisabled ? "Gönderiliyor..." : "Gönder"}
              </button>
            </div>
          </div>
        )}

        {tab === "suggestion" && (
          <div className="card form">
            <div className="row">
              <label>Öneri Başlığı</label>
              <input value={sTitle} onChange={(e) => setSTitle(e.target.value)} />
            </div>
            <div className="row">
              <label>Öneri Metni</label>
              <textarea value={sMessage} onChange={(e) => setSMessage(e.target.value)} rows={4} />
            </div>
            <div className="actions">
              <button
                onClick={submitSuggestion}
                disabled={suggestionBtnDisabled}
                aria-busy={suggestionBtnDisabled}
              >
                {suggestionBtnDisabled ? "Gönderiliyor..." : "Gönder"}
              </button>
            </div>
          </div>
        )}

        <FeedbackList />
      </div>
    </Layout>
  );
}
