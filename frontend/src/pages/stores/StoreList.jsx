import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./StoreList.scss";

export default function StoreList() {
  const navigate = useNavigate();

  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);

  const role = (typeof window !== "undefined" ? localStorage.getItem("role") : "") || "";
  const r = role.toLowerCase();
  const canEdit = r === "admin" || r === "employee";
  const canDelete = r === "admin";

  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const fetchStores = async (q) => {
    try {
      setLoading(true);
      const url = q ? `/stores/search?q=${encodeURIComponent(q)}` : "/stores/search";
      const { data } = await api.get(url);
      setStores(Array.isArray(data) ? data : []);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Mağaza listesi alınamadı");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStores(debouncedQ);
  }, [debouncedQ]);

  const totalPages = Math.max(1, Math.ceil(stores.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const startIdx = (currentPage - 1) * pageSize;
  const pageItems = useMemo(
    () => stores.slice(startIdx, startIdx + pageSize),
    [stores, startIdx, pageSize]
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, pageSize]);

  // 🔧 BURASI DÜZELTİLDİ
  const handleDetail = (id) => navigate(`/admin/stores/${id}`);
  const handleEdit = (id) => navigate(`/admin/stores/${id}/edit`);

  const handleDelete = async (id) => {
    if (!window.confirm("Bu mağazayı silmek istediğinize emin misiniz?")) return;
    try {
      await api.delete(`/stores/${id}`);
      toast.success("Mağaza silindi");
      fetchStores(debouncedQ);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        (err?.response?.data?.error || "Mağaza silinemedi");
      toast.error(msg);
    }
  };

  const handleNameClick = (id, e) => {
    e.preventDefault();
    handleDetail(id);
  };

  const fmtPhoneHref = (p) => {
    if (!p) return null;
    const digits = String(p).replace(/\D/g, "");
    return digits ? `tel:${digits}` : null;
  };

  return (
    <Layout>
      <div className="store-list-page">
        <div className="toolbar">
          <input
            className="search"
            placeholder="Mağaza ara (ad/kod)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <div className="right-controls">
            <div className="export" aria-disabled>
              Export
            </div>

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

        <div className="hint">
          {!debouncedQ
            ? "Son eklenen mağazalar listelenir. Daha fazla sonuç için arama yapın."
            : `Arama: “${debouncedQ}”`}
        </div>

        <div className="table-wrap">
          <table className="store-table">
            <thead>
              <tr>
                <th>Kod</th>
                <th>Mağaza</th>
                <th>Şehir</th>
                <th>Telefon</th>
                <th>Yetkili</th>
                <th>Durum</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center" }}>Yükleniyor...</td>
                </tr>
              ) : pageItems.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center" }}>Kayıt bulunamadı</td>
                </tr>
              ) : (
                pageItems.map((s) => {
                  const telHref = fmtPhoneHref(s.phone);
                  return (
                    <tr
                      key={s.id}
                      onDoubleClick={() => handleDetail(s.id)}
                      style={{ cursor: "default" }}
                    >
                      <td>{s.code || "—"}</td>

                      <td>
                        <a
                          href="#detail"
                          onClick={(e) => handleNameClick(s.id, e)}
                          className={canEdit ? "link-strong" : "link-soft"}
                          title="Detayı aç"
                        >
                          {s.name || "—"}
                        </a>
                      </td>

                      <td>{s.city || "—"}</td>

                      <td className="phone-cell">
                        {s.phone ? (
                          telHref ? <a href={telHref}>{s.phone}</a> : s.phone
                        ) : "—"}
                      </td>

                      <td className="manager-cell">{s.manager || "—"}</td>

                      <td>
                        <span className={`status-chip ${s.isActive ? "on" : "off"}`}>
                          {s.isActive ? "Aktif" : "Pasif"}
                        </span>
                      </td>

                      <td className="actions">
                        <button
                          className="btn btn-dark"
                          onClick={() => handleDetail(s.id)}
                          title="Kontrol Merkezi"
                        >
                          Kontrol Merkezi
                        </button>

                        {canEdit && (
                          <button
                            className="btn btn-edit"
                            onClick={() => handleEdit(s.id)}
                            title="Düzenle"
                          >
                            Düzenle
                          </button>
                        )}

                        {canDelete && (
                          <button
                            className="btn btn-delete"
                            onClick={() => handleDelete(s.id)}
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
            {stores.length === 0
              ? "0"
              : `${startIdx + 1}-${Math.min(startIdx + pageSize, stores.length)} / ${stores.length}`}
          </div>
        </div>
      </div>
    </Layout>
  );
}
