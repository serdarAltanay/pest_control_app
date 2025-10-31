import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./AdminSuggestion.scss";

function toDateTime(s) {
  if (!s) return "-";
  try {
    return new Date(s).toLocaleString("tr-TR");
  } catch {
    return s;
  }
}

export default function AdminSuggestionsList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [onlyUnseen, setOnlyUnseen] = useState(false);
  const [q, setQ] = useState("");

  const fetchData = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/feedback/admin/suggestions", {
        params: onlyUnseen ? { seen: "false" } : {},
      });
      const list = Array.isArray(data?.items) ? data.items : (Array.isArray(data) ? data : []);
      setRows(list);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Öneriler getirilemedi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [onlyUnseen]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(r => {
      const hay = [
        r?.title,
        r?.text,
        r?.owner?.email,
        [r?.owner?.firstName, r?.owner?.lastName].filter(Boolean).join(" "),
        // mağaza alanları kaldırıldı
      ].join(" ").toLowerCase();
      return hay.includes(term);
    });
  }, [rows, q]);

  return (
    <Layout title="Öneriler">
      <div className="admin-suggestions-page">
        <div className="head-row card">
          <div className="left">
            <h1>Öneriler</h1>
            <div className="hint">Müşterilerden gelen önerileri burada görüntüleyebilirsiniz.</div>
          </div>
          <div className="right">
            <div className="filters">
              <button
                className={`btn ${onlyUnseen ? "ghost" : ""}`}
                onClick={() => setOnlyUnseen(false)}
              >
                Tümü
              </button>
              <button
                className={`btn ${onlyUnseen ? "" : "ghost"}`}
                onClick={() => setOnlyUnseen(true)}
                title="Görülmemiş önerileri göster"
              >
                Görülmemiş
              </button>
              <button className="btn ghost" onClick={fetchData} disabled={loading}>
                {loading ? "Yükleniyor…" : "Yenile"}
              </button>
            </div>
            <input
              className="search"
              placeholder="Ara: başlık, kişi, email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        <div className="card table-wrap">
          {loading && <div className="loading">Yükleniyor…</div>}

          {!loading && filtered.length === 0 && (
            <div className="empty">Kayıt bulunamadı.</div>
          )}

          {!loading && filtered.length > 0 && (
            <table className="list-table">
              <thead>
                <tr>
                  <th style={{width: 32}}></th>
                  <th>Başlık</th>
                  <th>Müşteri</th>
                  <th>Oluşturan</th>
                  <th>Tarih</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const ownerName =
                    [r?.owner?.firstName, r?.owner?.lastName].filter(Boolean).join(" ") ||
                    r?.owner?.email ||
                    "-";
                  return (
                    <tr
                      key={r.id}
                      className="clickable"
                      onClick={() => navigate(`/admin/suggestions/${r.id}`)}
                    >
                      <td>
                        {!r?.isSeen && <span className="dot" title="Yeni / Görülmedi" />}
                      </td>
                      <td className="title-cell">
                        <div className="t">{r?.title || "-"}</div>
                        {r?.text && (
                          <div className="sub">
                            {String(r.text).slice(0, 100)}
                            {String(r.text).length > 100 ? "…" : ""}
                          </div>
                        )}
                      </td>
                      <td>{r?.ownerCustomer?.title || r?.ownerCustomerTitle || "-"}</td>
                      <td>{ownerName}</td>
                      <td>{toDateTime(r?.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );
}
