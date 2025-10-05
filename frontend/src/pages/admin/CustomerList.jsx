import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./CustomerList.scss";

const PERIOD_TR = {
  BELIRTILMEDI: "Belirtilmedi",
  HAFTALIK: "1 Haftalık",
  IKIHAFTALIK: "2 Haftalık",
  AYLIK: "1 Aylık",
  IKIAYLIK: "2 Aylık",
  UCAYLIK: "3 Aylık",
};

export default function CustomerList() {
  const navigate = useNavigate();

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);

  // 👇 eklendi: rol’ü al
  const role = (localStorage.getItem("role") || "").toLowerCase();
  const canEdit = role === "admin" || role === "employee";
  const canDelete = role === "admin";

  // UI state
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/customers");
      setCustomers(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err.response?.data?.message || "Müşteri listesi alınamadı");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return customers;
    const q = query.toLowerCase();
    return customers.filter((c) => {
      const responsible = c.employee?.fullName || "";
      return (
        (c.code || "").toLowerCase().includes(q) ||
        (c.title || "").toLowerCase().includes(q) ||
        (c.city || "").toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        responsible.toLowerCase().includes(q)
      );
    });
  }, [customers, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(startIdx, startIdx + pageSize);

  useEffect(() => {
    setPage(1);
  }, [query, pageSize]);

  const fmtPeriod = (p) => PERIOD_TR[p] || "Belirtilmedi";

  // Presence
  const ONLINE_MS = 2 * 60 * 1000;
  const IDLE_MS   = 10 * 60 * 1000;
  const getPresence = (lastSeenAt) => {
    if (!lastSeenAt) return { cls: "status-offline", label: "Offline" };
    const diff = Date.now() - new Date(lastSeenAt).getTime();
    if (diff <= ONLINE_MS) return { cls: "status-online", label: "Online" };
    if (diff <= IDLE_MS)   return { cls: "status-idle", label: "Idle" };
    return { cls: "status-offline", label: "Offline" };
  };
  const relTime = (d) => {
    if (!d) return "bilgi yok";
    const diff = Math.max(0, Date.now() - new Date(d).getTime());
    const s = Math.floor(diff / 1000);
    if (s < 30) return "az önce";
    if (s < 60) return `${s} sn önce`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} dk önce`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} sa önce`;
    const g = Math.floor(h / 24);
    if (g < 30) return `${g} gün önce`;
    const ay = Math.floor(g / 30);
    if (ay < 12) return `${ay} ay önce`;
    const y = Math.floor(ay / 12);
    return `${y} yıl önce`;
  };

  const handleEdit = (id) => {
    navigate(`/admin/customers/${id}/edit`);
  };

  const handleDelete = async (id) => {
    const ok = window.confirm("Bu müşteriyi silmek istediğinize emin misiniz?");
    if (!ok) return;
    try {
      await api.delete(`/customers/${id}`);
      toast.success("Müşteri silindi");
      fetchCustomers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Müşteri silinemedi");
    }
  };

  const handleDetail = (id) => {
    navigate(`/admin/customers/${id}`);
  };

  // 👇 eklendi: müşteri adına tıklayınca yetkiye göre edit/detay
  const handleNameClick = (id, e) => {
    e.preventDefault();
     handleDetail(id);
  };

  return (
    <Layout>
      <div className="customer-list-page">
        <div className="toolbar">
          <input
            className="search"
            placeholder="Type in to Search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <div className="right-controls">
            <div className="export">Export</div>
            <div className="page-size">
              <label>Show</label>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        <div className="table-wrap">
          <table className="customer-table">
            <thead>
              <tr>
                <th>Durum</th>
                <th>Müşteri Kod</th>
                <th>Müşteri</th>
                <th>Şehir</th>
                <th>Email</th>
                <th>Ziyaret Periyodu</th>
                <th>Sorumlu</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center" }}>
                    Yükleniyor...
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center" }}>
                    Kayıt bulunamadı
                  </td>
                </tr>
              ) : (
                pageItems.map((c) => {
                  const presence = getPresence(c.lastSeenAt);
                  return (
                    <tr
                      key={c.id}
                      onDoubleClick={() => handleDetail(c.id)} // 👈 çift tık detay
                      style={{ cursor: "default" }}
                    >
                      <td
                        className={`presence ${presence.cls}`}
                        title={`Son görüldü: ${relTime(c.lastSeenAt)}`}
                      >
                        <span className="dot" />
                        <span className="presence-label">{presence.label}</span>
                      </td>
                      <td>{c.code || "—"}</td>

                      {/* 👇 müşteri adı tıklanabilir */}
                      <td>
                        <a
                          href="#edit"
                          onClick={(e) => handleNameClick(c.id, e)}
                          className={canEdit ? "link-strong" : "link-soft"}
                          title={"Detayı aç"}
                        >
                          {c.title || "—"}
                        </a>
                      </td>

                      <td>{c.city || "—"}</td>
                      <td className="email-cell">{c.email || "—"}</td>
                      <td>{fmtPeriod(c.visitPeriod)}</td>
                      <td className="responsible">
                        {c.employee?.fullName ? c.employee.fullName : "—"}
                      </td>

                      <td className="actions">
                        <button
                          className="btn btn-dark"
                          onClick={() => handleDetail(c.id)}
                        >
                          Kontrol Merkezi
                        </button>

                        {/* 👇 edit: admin + employee */}
                        {canEdit && (
                          <button
                            className="btn btn-edit"
                            onClick={() => handleEdit(c.id)}
                            title="Düzenle"
                          >
                            Düzenle
                          </button>
                        )}

                        {/* 👇 delete: sadece admin */}
                        {canDelete && (
                          <button
                            className="btn btn-delete"
                            onClick={() => handleDelete(c.id)}
                            title="Sil"
                          >
                           Sil
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="pagination">
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
    </Layout>
  );
}
