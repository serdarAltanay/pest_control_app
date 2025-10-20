import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./Ek1List.scss";

/* ───────── Helpers ───────── */
const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
const fmtDT = (d) =>
  `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

const COLORS = ["#60a5fa","#34d399","#fbbf24","#f87171","#a78bfa","#22d3ee","#f472b6","#f97316","#84cc16","#e879f9","#38bdf8"];
const colorFromId = (id) =>
  COLORS[(String(id ?? "x").split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % COLORS.length];

const VISIT_TYPE_LABEL = {
  PERIYODIK: "Periyodik",
  ACIL_CAGRI: "Acil Çağrı",
  ISTASYON_KURULUM: "İstasyon Kurulum",
  ILK_ZIYARET: "İlk Ziyaret",
  DIGER: "Diğer",
};
const visitTypeLabel = (v) => VISIT_TYPE_LABEL[v] || "Diğer";

/* ───────── API (fallback'li yollar) ───────── */
async function getOk(url) { try { const { data } = await api.get(url); return data; } catch { return undefined; } }
async function postOk(url, body) { try { const { data } = await api.post(url, body); return data; } catch { return undefined; } }
async function delOk(url) { try { const { data } = await api.delete(url); return data; } catch { return undefined; } }

async function fetchEk1List() {
  const candidates = ["/api/ek1", "/api/admin/ek1", "/api/api/ek1"];
  for (const p of candidates) { const d = await getOk(p); if (Array.isArray(d)) return d; }
  return [];
}
async function fetchBundle(visitId) {
  const cands = [
    `/api/ek1/visit/${visitId}`,
    `/api/admin/ek1/visit/${visitId}`,
    `/api/api/ek1/visit/${visitId}`,
  ];
  for (const p of cands) { const d = await getOk(p); if (d && d.visit) return d; }
  throw new Error("Ziyaret paketi getirilemedi");
}
async function signProvider(visitId, signerName) {
  const body = signerName ? { name: signerName } : {};
  const cands = [
    `/api/ek1/visit/${visitId}/sign/provider`,
    `/api/admin/ek1/visit/${visitId}/sign/provider`,
    `/api/api/ek1/visit/${visitId}/sign/provider`,
  ];
  for (const p of cands) { const d = await postOk(p, body); if (d) return d; }
  throw new Error("Admin onayı (imza) verilemedi");
}
async function sendMail(visitId, email) {
  const body = { email };
  const cands = [
    `/api/ek1/${visitId}/send-email`,
    `/api/admin/ek1/${visitId}/send-email`,
    `/api/api/ek1/${visitId}/send-email`,
  ];
  for (const p of cands) { const d = await postOk(p, body); if (d) return d; }
  throw new Error("E-posta gönderilemedi");
}
async function deleteEk1(visitId) {
  const cands = [
    `/api/ek1/visit/${visitId}`,
    `/api/visits/${visitId}`,
  ];
  for (const p of cands) { const d = await delOk(p); if (d) return d; }
  throw new Error("Silme işlemi başarısız");
}

/* ───────── Component ───────── */
export default function Ek1List() {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  // ► SAYFALAMA
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const [sortKey, setSortKey] = useState("updatedAt");
  const [sortDir, setSortDir] = useState("desc"); // yeni → eski

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await fetchEk1List();

      const base = raw.map((r) => {
        const visitId = r.visitId ?? r.id ?? null;
        const visitDate = r.start ? new Date(r.start) : new Date(r.updatedAt || r.createdAt || Date.now());
        const createdAt = r.createdAt ? new Date(r.createdAt) : visitDate;
        const updatedAt = r.updatedAt ? new Date(r.updatedAt) : visitDate;

        return {
          visitId,
          storeId: r.storeId ?? null,
          storeName: r.storeName ?? (r.storeId ? `Mağaza #${r.storeId}` : "-"),
          customerName: r.customerName ?? "-",
          visitType: r.visitType || "DIGER",
          visitDate,
          providerSignedAt: r.providerSignedAt ? new Date(r.providerSignedAt) : null,
          customerSignedAt: r.customerSignedAt ? new Date(r.customerSignedAt) : null,
          pdfUrl: r.pdfUrl || r.fileUrl || null,
          createdAt, updatedAt,
          employeeName: "-",
          employeeKey: r.storeId ?? visitId ?? 0,
        };
      });

      // İlk yüklemede imza durumlarını bundle ile kesinleştir
      const bundles = await Promise.allSettled(
        base.filter((r) => !!r.visitId).map((r) => fetchBundle(r.visitId))
      );
      let idx = 0;
      for (let i = 0; i < base.length; i++) {
        const r = base[i];
        if (!r.visitId) continue;
        const res = bundles[idx++];
        if (res.status === "fulfilled") {
          const b = res.value;
          const rep = b.report || {};
          const vis = b.visit || {};
          base[i] = {
            ...r,
            visitType: vis.visitType || r.visitType || "DIGER",
            visitDate: vis.date ? new Date(vis.date) : r.visitDate,
            providerSignedAt: rep.providerSignedAt ? new Date(rep.providerSignedAt) : r.providerSignedAt,
            customerSignedAt: rep.customerSignedAt ? new Date(rep.customerSignedAt) : r.customerSignedAt,
          };
        }
      }

      base.sort((a, b) => {
        const A = a.updatedAt?.getTime?.() ?? a.visitDate?.getTime?.() ?? 0;
        const B = b.updatedAt?.getTime?.() ?? b.visitDate?.getTime?.() ?? 0;
        return B - A;
      });

      setRows(base);
      setPage(1); // yeni veri geldiğinde sayfayı başa al
    } catch {
      setRows([]);
      toast.error("Ek-1 listesi yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Arama + sıralama
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

  // ► SAYFALAMA hesapları
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(startIdx, startIdx + pageSize);

  // arama ya da sayfa boyutu değiştiğinde sayfayı 1'e çek
  useEffect(() => { setPage(1); }, [q, pageSize]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  /* Actions */
  const onView = (row) => {
    if (row.pdfUrl) {
      window.open(row.pdfUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (row.storeId && row.visitId) {
      navigate(`/admin/stores/${row.storeId}/visits/${row.visitId}/preview`);
    } else if (row.storeId) {
      navigate(`/admin/stores/${row.storeId}/ek1`);
    } else {
      toast.info("Önizleme için mağaza/ziyaret bilgisi eksik");
    }
  };

  const onSignAdmin = async (row) => {
    if (!row.visitId) { toast.error("visitId bulunamadı"); return; }
    const signer = window.prompt("İmzalayan isim (opsiyonel):", "");
    try {
      await signProvider(row.visitId, signer || undefined);
      toast.success("Admin onayı verildi");
      setRows((prev) =>
        prev.map((r) =>
          r.visitId === row.visitId ? { ...r, providerSignedAt: new Date() } : r
        )
      );
    } catch (e) {
      toast.error(e.message || "Onay verilemedi");
    }
  };

  const onSendMail = async (row) => {
    if (!row.visitId) { toast.error("visitId bulunamadı"); return; }
    const email = window.prompt("E-posta adresi:", "");
    if (!email) return;
    try {
      await sendMail(row.visitId, email);
      toast.success("E-posta gönderildi");
    } catch (e) {
      toast.error(e.message || "E-posta gönderilemedi");
    }
  };

  const onStoreDetail = (row) => {
    if (!row.storeId) return toast.info("Mağaza bilgisi yok");
    navigate(`/admin/stores/${row.storeId}`);
  };

  const onDelete = async (row) => {
    if (!row.visitId) { toast.error("visitId bulunamadı"); return; }
    const ok = window.confirm("Bu Ek-1 kaydını silmek istediğinize emin misiniz?");
    if (!ok) return;
    try {
      await deleteEk1(row.visitId);
      toast.success("Kayıt silindi");
      setRows((prev) => prev.filter((r) => r.visitId !== row.visitId));
    } catch (e) {
      toast.error(e.message || "Silme işlemi başarısız");
    }
  };

  const Badge = ({ ok, textOk = "Onaylandı", textNo = "Onaylanmadı" }) => (
    <span className={`appr-badge ${ok ? "ok" : "pending"}`}>{ok ? textOk : textNo}</span>
  );

  return (
    <div className="ek1-list card">
      <div className="ek1-head">
        <div className="title">Ziyaret Kayıtları (Ek-1)</div>
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
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <button className="refresh" onClick={load} disabled={loading}>
            {loading ? "Yükleniyor…" : "Yenile"}
          </button>
        </div>
      </div>

      <div className="grid head-row">
        <div className="c dt" onClick={() => toggleSort("visitDate")}>
          Tarih/Saat <span className="sort">{sortKey === "visitDate" ? (sortDir === "asc" ? "↑" : "↓") : ""}</span>
        </div>
        <div className="c vtype" onClick={() => toggleSort("visitType")}>
          Ziyaret Türü <span className="sort">{sortKey === "visitType" ? (sortDir === "asc" ? "↑" : "↓") : ""}</span>
        </div>
        <div className="c customer" onClick={() => toggleSort("customerName")}>
          Müşteri <span className="sort">{sortKey === "customerName" ? (sortDir === "asc" ? "↑" : "↓") : ""}</span>
        </div>
        <div className="c store" onClick={() => toggleSort("storeName")}>
          Mağaza <span className="sort">{sortKey === "storeName" ? (sortDir === "asc" ? "↑" : "↓") : ""}</span>
        </div>
        <div className="c emp" onClick={() => toggleSort("employeeName")}>
          Personel <span className="sort">{sortKey === "employeeName" ? (sortDir === "asc" ? "↑" : "↓") : ""}</span>
        </div>
        <div className="c appr">Müşteri Onayı</div>
        <div className="c appr">Admin Onayı</div>
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

            <div className="c vtype">
              <div className="title-main">{visitTypeLabel(r.visitType)}</div>
            </div>

            <div className="c customer">{r.customerName}</div>
            <div className="c store">{r.storeName}</div>

            <div className="c emp">
              <span className="dot" style={{ background: colorFromId(r.employeeKey) }} />
              {r.employeeName || "-"}
            </div>

            <div className="c appr">
              <Badge ok={!!r.customerSignedAt} />
            </div>

            <div className="c appr">
              <Badge ok={!!r.providerSignedAt} />
            </div>

            <div className="c actions">
              <button className="btn ghost" onClick={() => onView(r)}>Görüntüle</button>
              <button className="btn" onClick={() => onSignAdmin(r)} disabled={!r.visitId || !!r.providerSignedAt}>İmzala (Admin)</button>
              <button className="btn ghost" onClick={() => onSendMail(r)} disabled={!r.visitId}>Mail Gönder</button>
              <button className="btn link" onClick={() => onStoreDetail(r)} disabled={!r.storeId}>Detay</button>
              <button className="btn danger" onClick={() => onDelete(r)} disabled={!r.visitId}>Sil</button>
            </div>
          </div>
        ))
      )}

      {/* ► SAYFALAMA KONTROLLERİ */}
      <div className="ek1-pagination">
        <button
          className="page-btn"
          disabled={currentPage <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          Prev
        </button>

        <span className="page-indicator">{currentPage}</span>

        <button
          className="page-btn"
          disabled={currentPage >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
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
