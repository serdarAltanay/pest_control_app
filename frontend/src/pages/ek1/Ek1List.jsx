// src/pages/ek1/Ek1List.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { toast } from "react-toastify";
import SignatureModal from "../../components/SignatureModal.jsx";
import "./Ek1List.scss";

/* ───────── Helpers ───────── */
const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
const fmtDT = (d) => {
  if (!(d instanceof Date)) d = d ? new Date(d) : null;
  if (!d || isNaN(d)) return "—";
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

const COLORS = [
  "#60a5fa", "#34d399", "#fbbf24", "#f87171", "#a78bfa",
  "#22d3ee", "#f472b6", "#f97316", "#84cc16", "#e879f9", "#38bdf8",
];
const colorFromId = (id) =>
  COLORS[
  String(id ?? "x")
    .split("")
    .reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length
  ];

const VISIT_TYPE_LABEL = {
  PERIYODIK: "Periyodik",
  ACIL_CAGRI: "Acil Çağrı",
  ISTASYON_KURULUM: "İstasyon Kurulum",
  ILK_ZIYARET: "İlk Ziyaret",
  DIGER: "Diğer",
};
const visitTypeLabel = (v) => VISIT_TYPE_LABEL[v] || "Diğer";

const role = (localStorage.getItem("role") || "").toLowerCase();
const isCustomer = role === "customer";

const joinSafe = (arr, sep = ", ") =>
  (Array.isArray(arr) ? arr : [])
    .map((x) => (typeof x === "string" ? x : x?.fullName || x?.name || x?.email || ""))
    .filter(Boolean)
    .join(sep);

function normalizeEmployees(e) {
  if (!e) return "";
  if (typeof e === "string") return e;
  if (Array.isArray(e)) return joinSafe(e);
  if (typeof e === "object") {
    const list = e.names || e.list || e.employees || Object.values(e);
    return joinSafe(Array.isArray(list) ? list : []);
  }
  return "";
}

const isFreeToken = (s) =>
  typeof s === "string" && s.trim().toUpperCase().replace(/\[|\]/g, "") === "FREE";

const pickCustomerName = (customerObj, storeObj, fallback) => {
  const candidates = [
    customerObj?.title, customerObj?.fullName, customerObj?.name,
    customerObj?.companyName, customerObj?.legalName, customerObj?.displayName, fallback,
  ].filter(Boolean);
  const picked = candidates.find((v) => v && !isFreeToken(v) && v !== "—");
  return picked || storeObj?.name || fallback || "—";
};

/* ───────── API ───────── */
async function listEk1() {
  const { data } = await api.get("/ek1", { params: { scope: "mine" } });
  return Array.isArray(data) ? data : [];
}
async function getBundle(visitId) {
  const { data } = await api.get(`/ek1/visit/${visitId}`);
  return data;
}
async function deleteEk1(visitId) {
  try {
    const { data } = await api.delete(`/visits/${visitId}`);
    return data;
  } catch (e) {
    throw new Error(e?.response?.data?.message || "Silinemedi");
  }
}

/* ───────── Badge ───────── */
const Badge = ({ ok, textOk = "Onaylandı", textNo = "Bekliyor" }) => (
  <span className={`appr-badge ${ok ? "ok" : "pending"}`}>
    {ok ? textOk : textNo}
  </span>
);

/* ───────── Component ───────── */
export default function Ek1List() {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  const [sortKey, setSortKey] = useState("updatedAt");
  const [sortDir, setSortDir] = useState("desc");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  /* İmza Modal State'leri */
  const [sigModalOpen, setSigModalOpen] = useState(false);
  const [sigTarget, setSigTarget] = useState(null); // { row, kind }
  const [sigBusy, setSigBusy] = useState(false);

  /* ─ Yükleme ─ */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const base = await listEk1();

      const withVisit = await Promise.all(
        base.map(async (r) => {
          const visitId = r.visitId ?? r.id ?? r?.visit?.id ?? null;

          let createdAt = r.createdAt || r?.visit?.createdAt || null;
          let start = r.start || r?.visit?.date || null;
          let providerSignedAt = r.providerSignedAt || r?.report?.providerSignedAt || null;
          let customerSignedAt = r.customerSignedAt || r?.report?.customerSignedAt || null;
          let visitType = r.visitType || r?.visit?.visitType || "DIGER";
          let employeeName = r.employeeName || "";
          let storeName = r.storeName ?? r?.visit?.store?.name ?? (r.storeId ? `Mağaza #${r.storeId}` : "-");
          let customerNameRaw = r.customerName ?? r?.visit?.store?.customer?.title ?? "-";
          let storeObj = r?.visit?.store || null;
          let customerObj = r?.visit?.store?.customer || null;

          if (visitId) {
            try {
              const b = await getBundle(visitId);
              const rep = b?.report || {};
              const vis = b?.visit || {};
              const st = vis?.store || {};
              const cu = st?.customer || {};

              if (vis?.date) start = vis.date;
              if (vis?.createdAt) createdAt = vis.createdAt;
              if (vis?.visitType) visitType = vis.visitType;
              if (!employeeName) employeeName = normalizeEmployees(vis?.employees);

              providerSignedAt = providerSignedAt || rep.providerSignedAt || null;
              customerSignedAt = customerSignedAt || rep.customerSignedAt || null;

              storeObj = st || storeObj;
              customerObj = cu || customerObj;
              storeName = st?.name || storeName;
              customerNameRaw = cu?.title ?? customerNameRaw;
            } catch { }
          }

          const customerName = pickCustomerName(customerObj, storeObj, customerNameRaw);
          const updatedAt =
            r.updatedAt || r?.visit?.updatedAt ||
            providerSignedAt || customerSignedAt || createdAt || start || null;

          return {
            visitId,
            storeId: r.storeId ?? r?.visit?.storeId ?? null,
            storeName,
            customerName,
            visitType,
            visitDate: start ? new Date(start) : null,
            createdAt: createdAt ? new Date(createdAt) : null,
            updatedAt: updatedAt ? new Date(updatedAt) : null,
            pdfUrl: r.pdfUrl || r.fileUrl || null,
            providerSignedAt: providerSignedAt ? new Date(providerSignedAt) : null,
            customerSignedAt: customerSignedAt ? new Date(customerSignedAt) : null,
            employeeName: employeeName || "-",
            employeeKey: employeeName || r.storeId || r.visitId || 0,
          };
        })
      );

      withVisit.sort((a, b) => {
        const A = a.updatedAt?.getTime?.() ?? a.visitDate?.getTime?.() ?? 0;
        const B = b.updatedAt?.getTime?.() ?? b.visitDate?.getTime?.() ?? 0;
        return B - A;
      });

      setRows(withVisit);
      setPage(1);
    } catch (e) {
      toast.error(e?.response?.data?.message || "EK-1 listesi yüklenemedi");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /* ─ Filtre + Sıralama ─ */
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = rows;
    if (needle) {
      list = list.filter((r) =>
        [r.customerName, r.storeName, r.employeeName, visitTypeLabel(r.visitType)]
          .join(" ").toLowerCase().includes(needle)
      );
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return [...list].sort((a, b) => {
      const A = a[sortKey], B = b[sortKey];
      if (A instanceof Date && B instanceof Date) return (A - B) * dir;
      return String(A ?? "").localeCompare(String(B ?? "")) * dir;
    });
  }, [rows, q, sortKey, sortDir]);

  /* ─ Sayfalama ─ */
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(startIdx, startIdx + pageSize);
  useEffect(() => { setPage(1); }, [q, pageSize]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  /* ─ Görüntüle ─ */
  const onView = (row) => {
    if (row.pdfUrl) return window.open(row.pdfUrl, "_blank", "noopener,noreferrer");
    if (!row.visitId) return toast.info("visitId yok");
    if (isCustomer) return navigate(`/ek1/visit/${row.visitId}`);
    if (row.storeId) return navigate(`/admin/stores/${row.storeId}/visits/${row.visitId}/preview`);
    return toast.info("Önizleme için mağaza/ziyaret bilgisi eksik");
  };

  /* ─ İmzalama: Modal Aç ─ */
  const startSign = (row, kind) => {
    if (!row.visitId) return toast.error("visitId yok");
    setSigTarget({ row, kind });
    setSigModalOpen(true);
  };

  /* ─ İmzalama: Biyometrik Onay ─ */
  const onConfirmSign = async (signatureBase64) => {
    setSigModalOpen(false);
    if (!sigTarget) return;
    const { row, kind } = sigTarget;
    setSigBusy(true);

    let coords = null;
    try {
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 })
      );
      coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    } catch { /* GPS opsiyonel */ }

    try {
      const signerName =
        kind === "customer"
          ? localStorage.getItem("name") || undefined
          : localStorage.getItem("name") || undefined;

      await api.post(`/ek1/visit/${row.visitId}/sign/${kind}`, {
        name: signerName,
        signature: signatureBase64,
        coords,
        deviceInfo:
          navigator.userAgent.includes("Tablet") || navigator.userAgent.includes("iPad")
            ? "Şirket Tableti"
            : "Masaüstü / Web",
      });

      toast.success(
        kind === "customer"
          ? "Müşteri biyometrik onayı verildi."
          : "Admin/personel imzası kaydedildi."
      );

      setRows((prev) =>
        prev.map((r) =>
          r.visitId === row.visitId
            ? {
              ...r,
              providerSignedAt: kind === "provider" ? new Date() : r.providerSignedAt,
              customerSignedAt: kind === "customer" ? new Date() : r.customerSignedAt,
            }
            : r
        )
      );
    } catch (e) {
      toast.error(e?.response?.data?.message || "İmza kaydedilemedi.");
    } finally {
      setSigBusy(false);
      setSigTarget(null);
    }
  };

  /* ─ Sil ─ */
  const onDelete = async (row) => {
    if (!row.visitId) return toast.error("visitId yok");
    if (!window.confirm("Bu EK-1 kaydını silmek istiyor musunuz?")) return;
    try {
      await deleteEk1(row.visitId);
      toast.success("Kayıt silindi.");
      setRows((prev) => prev.filter((r) => r.visitId !== row.visitId));
    } catch (e) {
      toast.error(e.message);
    }
  };

  /* ─ Render ─ */
  return (
    <div className="ek1-list card">
      {/* Header */}
      <div className="ek1-head">
        <div className="title">Ziyaret Kayıtları (EK-1)</div>
        {!isCustomer && (
          <div className="controls">
            <input
              className="search"
              type="text"
              placeholder="Müşteri, mağaza, ziyaret türü, personel…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div className="page-size">
              <label>Göster</label>
              <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <button className="refresh" onClick={load} disabled={loading}>
              {loading ? "Yükleniyor…" : "↻ Yenile"}
            </button>
          </div>
        )}
      </div>

      {/* Kolon Başlıkları */}
      <div className="grid head-row">
        <div className="c dt" onClick={() => toggleSort("visitDate")}>
          Tarih {sortKey === "visitDate" ? (sortDir === "asc" ? "↑" : "↓") : ""}
        </div>
        <div className="c vtype" onClick={() => toggleSort("visitType")}>
          Tür {sortKey === "visitType" ? (sortDir === "asc" ? "↑" : "↓") : ""}
        </div>
        {!isCustomer && (
          <div className="c customer" onClick={() => toggleSort("customerName")}>
            Müşteri {sortKey === "customerName" ? (sortDir === "asc" ? "↑" : "↓") : ""}
          </div>
        )}
        <div className="c store" onClick={() => toggleSort("storeName")}>
          Mağaza {sortKey === "storeName" ? (sortDir === "asc" ? "↑" : "↓") : ""}
        </div>
        {!isCustomer && (
          <div className="c emp" onClick={() => toggleSort("employeeName")}>
            Personel {sortKey === "employeeName" ? (sortDir === "asc" ? "↑" : "↓") : ""}
          </div>
        )}
        <div className="c appr">Müşteri Onayı</div>
        {!isCustomer && <div className="c appr">Admin İmzası</div>}
        <div className="c actions">İşlemler</div>
      </div>

      {/* Satırlar */}
      {loading ? (
        <div className="loading">
          <span className="loading-spinner" />
          Veriler yükleniyor…
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty">Kayıt bulunamadı.</div>
      ) : (
        pageItems.map((r) => (
          <div
            className="grid data-row"
            key={`${r.visitId}-${r.updatedAt?.getTime?.() || ""}`}
          >
            <div className="c dt">
              <div className="dt-main">{fmtDT(r.visitDate)}</div>
              <div className="dt-sub">Güncelleme: {fmtDT(r.updatedAt)}</div>
            </div>
            <div className="c vtype">{visitTypeLabel(r.visitType)}</div>
            {!isCustomer && <div className="c customer">{r.customerName}</div>}
            <div className="c store">{r.storeName}</div>
            {!isCustomer && (
              <div className="c emp">
                <span className="dot" style={{ background: colorFromId(r.employeeKey) }} />
                {r.employeeName || "-"}
              </div>
            )}
            <div className="c appr">
              <Badge ok={!!r.customerSignedAt} textOk="Müşteri Onayladı" textNo="Müşteri Onayı Bekleniyor" />
            </div>
            {!isCustomer && (
              <div className="c appr">
                <Badge ok={!!r.providerSignedAt} textOk="Şirket Onayladı" textNo="Şirket Onayı Bekleniyor" />
              </div>
            )}
            <div className="c actions">
              <div className="act-group top">
                <button className="btn ghost" onClick={() => onView(r)}>
                  Görüntüle
                </button>
                {!isCustomer && (
                  <button
                    className="btn danger"
                    onClick={() => onDelete(r)}
                    disabled={!r.visitId}
                  >
                    Sil
                  </button>
                )}
              </div>
              <div className="act-group bottom">
                {isCustomer ? (
                  <button
                    className="btn primary"
                    onClick={() => startSign(r, "customer")}
                    disabled={!r.visitId || !!r.customerSignedAt || sigBusy}
                  >
                    İmzala
                  </button>
                ) : (
                  <>
                    {!r.providerSignedAt && (
                      <button
                        className="btn primary"
                        onClick={() => startSign(r, "provider")}
                        disabled={!r.visitId || sigBusy}
                      >
                        İmzala
                      </button>
                    )}
                    {!r.customerSignedAt && (
                      <button
                        className="btn warn"
                        onClick={() => startSign(r, "customer")}
                        disabled={!r.visitId || sigBusy}
                      >
                        Müşteri Onayı
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ))
      )}

      {/* Sayfalama */}
      <div className="ek1-pagination">
        <button
          className="page-btn"
          disabled={currentPage <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          ‹ Önceki
        </button>
        <span className="page-indicator">
          {currentPage} / {totalPages}
        </span>
        <button
          className="page-btn"
          disabled={currentPage >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          Sonraki ›
        </button>
        <div className="count-info">
          {filtered.length === 0
            ? "0 kayıt"
            : `${startIdx + 1}–${Math.min(startIdx + pageSize, filtered.length)} / ${filtered.length} kayıt`}
        </div>
      </div>

      {/* Biyometrik İmza Modalı */}
      <SignatureModal
        isOpen={sigModalOpen}
        onClose={() => { setSigModalOpen(false); setSigTarget(null); }}
        onConfirm={onConfirmSign}
        title={
          sigTarget?.kind === "customer"
            ? "Müşteri Onay İmzası"
            : "Personel / Admin İmzası"
        }
        subtitle="İmzanız zaman damgası ve GPS ile kayıt altına alınacaktır"
        signerName={localStorage.getItem("name") || undefined}
      />
    </div>
  );
}