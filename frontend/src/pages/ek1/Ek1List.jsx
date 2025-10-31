// src/pages/ek1/Ek1List.jsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./Ek1List.scss";

/* ───────── helpers ───────── */
const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
const fmtDT = (d) => {
  if (!(d instanceof Date)) d = d ? new Date(d) : null;
  if (!d || isNaN(d)) return "—";
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};
const COLORS = ["#60a5fa","#34d399","#fbbf24","#f87171","#a78bfa","#22d3ee","#f472b6","#f97316","#84cc16","#e879f9","#38bdf8"];
const colorFromId = (id) => COLORS[(String(id ?? "x").split("").reduce((a,c)=>a+c.charCodeAt(0),0)) % COLORS.length];

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

/* Personel alanını güvenle string'e çevir */
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

/* ───────── YENİ: FREE placeholder ayıklama ───────── */
const isFreeToken = (s) =>
  typeof s === "string" &&
  s.trim().toUpperCase().replace(/\[|\]/g, "") === "FREE";

/** Müşteri adını seç: gerçek ad alanları → mağaza adı → fallback → "—" */
const pickCustomerName = (customerObj, storeObj, fallback) => {
  const candidates = [
    customerObj?.title,
    customerObj?.fullName,
    customerObj?.name,
    customerObj?.companyName,
    customerObj?.legalName,
    customerObj?.displayName,
    fallback,
  ].filter(Boolean);

  const picked = candidates.find((v) => v && !isFreeToken(v) && v !== "—");
  return picked || storeObj?.name || fallback || "—";
};

/* ───────── api helpers ───────── */
async function listEk1() {
  const { data } = await api.get("/ek1", { params: { scope: "mine" } });
  return Array.isArray(data) ? data : [];
}
async function getBundle(visitId) {
  const { data } = await api.get(`/ek1/visit/${visitId}`);
  return data;
}
async function signProvider(visitId, name) {
  const { data } = await api.post(`/ek1/visit/${visitId}/sign/provider`, name ? { name } : {});
  return data;
}
async function signCustomer(visitId, name) {
  const { data } = await api.post(`/ek1/visit/${visitId}/sign/customer`, name ? { name } : {});
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

/* ───────── component ───────── */
export default function Ek1List() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  // sıralama & sayfalama
  const [sortKey, setSortKey] = useState("updatedAt");
  const [sortDir, setSortDir] = useState("desc");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const base = await listEk1();

      const withVisit = await Promise.all(
        base.map(async (r) => {
          const visitId = r.visitId ?? r.id ?? r?.visit?.id ?? null;

          // İlk değerler (fallback)
          let createdAt = r.createdAt || r?.visit?.createdAt || null;
          let start = r.start || r?.visit?.date || null;
          let providerSignedAt = r.providerSignedAt || r?.report?.providerSignedAt || null;
          let customerSignedAt = r.customerSignedAt || r?.report?.customerSignedAt || null;
          let visitType = r.visitType || r?.visit?.visitType || "DIGER";
          let employeeName = r.employeeName || "";

          // Görünen adlar
          let storeName = r.storeName ?? r?.visit?.store?.name ?? (r.storeId ? `Mağaza #${r.storeId}` : "-");
          let customerNameRaw = r.customerName ?? r?.visit?.store?.customer?.title ?? "-";

          // Nesne referansları (daha sonra pick için)
          let storeObj = r?.visit?.store || null;
          let customerObj = r?.visit?.store?.customer || null;

          if (visitId) {
            try {
              const b = await getBundle(visitId);
              const rep = b?.report || {};
              const vis = b?.visit || {};
              const st  = vis?.store || {};
              const cu  = st?.customer || {};

              if (vis?.date) start = vis.date;
              if (vis?.createdAt) createdAt = vis.createdAt;
              if (vis?.visitType) visitType = vis.visitType;
              if (!employeeName) employeeName = normalizeEmployees(vis?.employees);

              providerSignedAt = providerSignedAt || rep.providerSignedAt || null;
              customerSignedAt = customerSignedAt || rep.customerSignedAt || null;

              // Nesne/baslıkları bundle ile iyileştir
              storeObj = st || storeObj;
              customerObj = cu || customerObj;
              storeName = st?.name || storeName;
              customerNameRaw = cu?.title ?? customerNameRaw;
            } catch {}
          }

          // FREE / [FREE] placeholder'ını kullanıcı-dostu isme dönüştür
          const customerName = pickCustomerName(customerObj, storeObj, customerNameRaw);

          const updatedAt =
            r.updatedAt ||
            r?.visit?.updatedAt ||
            providerSignedAt ||
            customerSignedAt ||
            createdAt ||
            start ||
            null;

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

  // filtre + sıralama
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = rows;
    if (needle) {
      list = list.filter((r) =>
        [r.customerName, r.storeName, r.employeeName, visitTypeLabel(r.visitType)]
          .join(" ")
          .toLowerCase()
          .includes(needle)
      );
    }
    const dir = sortDir === "asc" ? 1 : -1;
    const sorted = [...list].sort((a, b) => {
      const A = a[sortKey], B = b[sortKey];
      if (A instanceof Date && B instanceof Date) return (A - B) * dir;
      return String(A ?? "").localeCompare(String(B ?? "")) * dir;
    });
    return sorted;
  }, [rows, q, sortKey, sortDir]);

  // sayfalama
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(startIdx, startIdx + pageSize);
  useEffect(() => { setPage(1); }, [q, pageSize]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const onView = (row) => {
    if (row.pdfUrl) return window.open(row.pdfUrl, "_blank", "noopener,noreferrer");
    if (!row.visitId) return toast.info("visitId yok");
    if (isCustomer) return navigate(`/ek1/visit/${row.visitId}`);
    if (row.storeId) return navigate(`/admin/stores/${row.storeId}/visits/${row.visitId}/preview`);
    return toast.info("Önizleme için mağaza/ziyaret bilgisi eksik");
  };

  const onSignAdmin = async (row) => {
    if (!row.visitId) return toast.error("visitId yok");
    const name = window.prompt("İmzalayan isim (opsiyonel):", "") || undefined;
    await signProvider(row.visitId, name);
    toast.success("Admin onayı verildi");
    setRows((prev) => prev.map((r) => (r.visitId === row.visitId ? { ...r, providerSignedAt: new Date() } : r)));
  };

  const onSignCustomer = async (row) => {
    if (!row.visitId) return toast.error("visitId yok");
    const accessOwnerName = localStorage.getItem("name") || undefined;
    await signCustomer(row.visitId, isCustomer ? accessOwnerName : (accessOwnerName || undefined));
    toast.success("Müşteri onayı verildi");
    setRows((prev) => prev.map((r) => (r.visitId === row.visitId ? { ...r, customerSignedAt: new Date() } : r)));
  };

  const onDelete = async (row) => {
    if (!row.visitId) return toast.error("visitId yok");
    if (!window.confirm("Bu EK-1 kaydını silmek istiyor musunuz?")) return;
    await deleteEk1(row.visitId);
    toast.success("Kayıt silindi");
    setRows((prev) => prev.filter((r) => r.visitId !== row.visitId));
  };

  const Badge = ({ ok, textOk = "Onaylandı", textNo = "Onaylanmadı" }) =>
    <span className={`appr-badge ${ok ? "ok" : "pending"}`}>{ok ? textOk : textNo}</span>;

  return (
    <div className="ek1-list card">
      <div className="ek1-head">
        <div className="title">Ziyaret Kayıtları (EK-1)</div>
        {!isCustomer && (
          <div className="controls">
            <input
              className="search"
              type="text"
              placeholder="Ara: müşteri, mağaza, ziyaret türü, personel…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div className="page-size">
              <label>Göster</label>
              <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                {[10,25,50,100].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <button className="refresh" onClick={load} disabled={loading}>
              {loading ? "Yükleniyor…" : "Yenile"}
            </button>
          </div>
        )}
      </div>

      <div className="grid head-row">
        <div className="c dt" onClick={() => toggleSort("visitDate")}>
          Tarih/Saat <span className="sort">{sortKey === "visitDate" ? (sortDir === "asc" ? "↑" : "↓") : ""}</span>
        </div>
        <div className="c vtype" onClick={() => toggleSort("visitType")}>
          Ziyaret Türü <span className="sort">{sortKey === "visitType" ? (sortDir === "asc" ? "↑" : "↓") : ""}</span>
        </div>
        {!isCustomer && (
          <div className="c customer" onClick={() => toggleSort("customerName")}>
            Müşteri <span className="sort">{sortKey === "customerName" ? (sortDir === "asc" ? "↑" : "↓") : ""}</span>
          </div>
        )}
        <div className="c store" onClick={() => toggleSort("storeName")}>
          Mağaza <span className="sort">{sortKey === "storeName" ? (sortDir === "asc" ? "↑" : "↓") : ""}</span>
        </div>
        {!isCustomer && (
          <div className="c emp" onClick={() => toggleSort("employeeName")}>
            Personel <span className="sort">{sortKey === "employeeName" ? (sortDir === "asc" ? "↑" : "↓") : ""}</span>
          </div>
        )}
        <div className="c appr">Müşteri Onayı</div>
        {!isCustomer && <div className="c appr">Admin Onayı</div>}
        <div className="c actions">İşlemler</div>
      </div>

      {loading ? (
        <div className="loading">Veriler getiriliyor…</div>
      ) : filtered.length === 0 ? (
        <div className="empty">Kayıt bulunamadı.</div>
      ) : (
        pageItems.map((r) => (
          <div className="grid data-row" key={`${r.visitId}-${r.updatedAt?.getTime?.() || ""}`}>
            <div className="c dt">
              <div className="dt-main">{fmtDT(r.visitDate)}</div>
              <div className="dt-sub">Güncelleme: {fmtDT(r.updatedAt)}</div>
            </div>
            <div className="c vtype"><div className="title-main">{visitTypeLabel(r.visitType)}</div></div>
            {!isCustomer && <div className="c customer">{r.customerName}</div>}
            <div className="c store">{r.storeName}</div>
            {!isCustomer && (
              <div className="c emp">
                <span className="dot" style={{ background: colorFromId(r.employeeKey) }} />
                {r.employeeName || "-"}
              </div>
            )}
            <div className="c appr"><Badge ok={!!r.customerSignedAt} /></div>
            {!isCustomer && <div className="c appr"><Badge ok={!!r.providerSignedAt} /></div>}
            <div className="c actions">
              <button className="btn ghost" onClick={() => onView(r)}>Görüntüle</button>
              {isCustomer ? (
                <button
                  className="btn"
                  onClick={() => onSignCustomer(r)}
                  disabled={!r.visitId || !!r.customerSignedAt}
                  title="AccessOwner adıyla onay verilir"
                >
                  İmzala (Müşteri)
                </button>
              ) : (
                <>
                  <button
                    className="btn"
                    onClick={() => onSignAdmin(r)}
                    disabled={!r.visitId || !!r.providerSignedAt}
                  >
                    İmzala (Admin)
                  </button>
                  <button className="btn danger" onClick={() => onDelete(r)} disabled={!r.visitId}>Sil</button>
                </>
              )}
            </div>
          </div>
        ))
      )}

      <div className="ek1-pagination">
        <button className="page-btn" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
          Prev
        </button>
        <span className="page-indicator">{currentPage}</span>
        <button className="page-btn" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
          Next
        </button>
        <div className="count-info">
          {filtered.length === 0
            ? "0"
            : `${startIdx + 1}-${Math.min(startIdx + pageSize, filtered.length)} / ${filtered.length}`}
        </div>
      </div>
    </div>
  );
}
