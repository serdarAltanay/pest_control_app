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

  // Arama filtresi
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

  // Sayfalama
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(startIdx, startIdx + pageSize);

  useEffect(() => {
    // arama/sayfa boyutu değişince sayfayı başa al
    setPage(1);
  }, [query, pageSize]);

  const fmtPeriod = (p) => PERIOD_TR[p] || "Belirtilmedi";

  const handleEdit = (id) => {
    // Edit sayfan varsa ona yönlendir
    navigate(`/admin/customers/${id}/edit`);
  };

  const handleDelete = async (id) => {
    const ok = window.confirm("Bu müşteriyi silmek istediğinize emin misiniz?");
    if (!ok) return;
    try {
      await api.delete(`/customers/${id}`);
      toast.success("Müşteri silindi");
      // listeyi yenile
      fetchCustomers();
    } catch (err) {
      toast.error(err.response?.data?.message || "Müşteri silinemedi");
    }
  };

  const handleDetail = (id) => {
    // “Kontrol Merkezi” benzeri detay sayfan varsa:
    navigate(`/admin/customers/${id}`);
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
            {/* Export tuşlarını istersen daha sonra aktif edebilirsin */}
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
                  <td colSpan={7} style={{ textAlign: "center" }}>
                    Yükleniyor...
                  </td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center" }}>
                    Kayıt bulunamadı
                  </td>
                </tr>
              ) : (
                pageItems.map((c) => (
                  <tr key={c.id}>
                    <td>{c.code || "—"}</td>
                    <td>{c.title || "—"}</td>
                    <td>{c.city || "—"}</td>
                    <td className="email-cell">{c.email || "—"}</td>
                    <td>{fmtPeriod(c.visitPeriod)}</td>
                    <td className="responsible">
                      {c.employee?.fullName ? c.employee.fullName : "—"}
                    </td>
                    <td className="actions">
                      <button className="btn btn-dark" onClick={() => handleDetail(c.id)}>
                        Kontrol Merkezi
                      </button>
                      <button className="btn btn-edit" onClick={() => handleEdit(c.id)}>
                        ✏️
                      </button>
                      <button className="btn btn-delete" onClick={() => handleDelete(c.id)}>
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))
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
