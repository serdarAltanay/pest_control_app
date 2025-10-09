import { useEffect, useState, useMemo } from "react";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./Biocides.scss";

const UNIT_TR = {
  ML: "ml (Mililitre)",
  GR: "gr (Gram)",
  LT: "Litre",
  KG: "Kilogram",
  ADET: "Adet",
};
const UNITS = Object.keys(UNIT_TR);

export default function Biocides() {
  const [loading, setLoading] = useState(true);
  const [list, setList] = useState([]);
  const [savingRow, setSavingRow] = useState(null); // id | "new" | null
  const [form, setForm] = useState({
    name: "",
    activeIngredient: "",
    antidote: "",
    unit: "ML",
  });

  const hasAny = useMemo(() => Array.isArray(list) && list.length > 0, [list]);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const { data } = await api.get("/biocides");
      setList(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e?.response?.data?.message || "Biyosidal listesi alınamadı");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const onNewChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const addNew = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Biyosidal adı zorunludur.");
    if (!form.activeIngredient.trim()) return toast.error("Aktif madde zorunludur.");
    if (!form.antidote.trim()) return toast.error("Antidotu zorunludur.");
    if (!form.unit) return toast.error("Ölçü birimi seçiniz.");

    setSavingRow("new");
    try {
      await api.post("/biocides", {
        name: form.name.trim(),
        activeIngredient: form.activeIngredient.trim(),
        antidote: form.antidote.trim(),
        unit: form.unit,
      });
      toast.success("Biyosidal eklendi");
      setForm({ name: "", activeIngredient: "", antidote: "", unit: "ML" });
      fetchAll();
    } catch (e2) {
      toast.error(e2?.response?.data?.message || "Kaydedilemedi");
    } finally {
      setSavingRow(null);
    }
  };

  const onRowChange = (id, field, value) => {
    setList((rows) =>
      rows.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const updateRow = async (row) => {
    setSavingRow(row.id);
    try {
      await api.put(`/biocides/${row.id}`, {
        name: row.name?.trim(),
        activeIngredient: row.activeIngredient?.trim() || "",
        antidote: row.antidote?.trim() || "",
        unit: row.unit,
      });
      toast.success("Güncellendi");
      fetchAll();
    } catch (e) {
      toast.error(e?.response?.data?.message || "Güncellenemedi");
    } finally {
      setSavingRow(null);
    }
  };

  const deleteRow = async (id) => {
    if (!window.confirm("Bu biyosidalı silmek istiyor musunuz?")) return;
    const prev = list;
    setList((rows) => rows.filter((r) => r.id !== id));
    try {
      await api.delete(`/biocides/${id}`);
      toast.success("Silindi");
    } catch (e) {
      setList(prev);
      toast.error(e?.response?.data?.message || "Silinemedi");
    }
  };

  return (
    <Layout>
      <div className="biocides-page">
        <h1 className="page-title">Biyosidal Ürünler</h1>

        {/* EKLEME FORMU */}
        <form className="card add-card" onSubmit={addNew}>
          <div className="card-title">Biyosidal Ekle</div>
          <p className="muted">Biyosidal eklemek için aşağıdaki formu eksiksiz doldurun.</p>

          <div className="grid-4">
            <div>
              <label>Biyosidal Adı *</label>
              <input
                name="name"
                value={form.name}
                onChange={onNewChange}
                placeholder="Biyosidal Adı Giriniz"
                required
              />
            </div>
            <div>
              <label>Biyosidal Aktif Madde *</label>
              <input
                name="activeIngredient"
                value={form.activeIngredient}
                onChange={onNewChange}
                placeholder="Biyosidal Aktif Madde Giriniz"
                required
              />
            </div>
            <div>
              <label>Biyosidal Antidotu *</label>
              <input
                name="antidote"
                value={form.antidote}
                onChange={onNewChange}
                placeholder="Biyosidal Antidotu Giriniz"
                required
              />
            </div>
            <div>
              <label>Ölçü Birimi *</label>
              <select name="unit" value={form.unit} onChange={onNewChange} required>
                {UNITS.map((u) => (
                  <option key={u} value={u}>{UNIT_TR[u]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="actions">
            <button className="btn primary" disabled={savingRow === "new"}>
              {savingRow === "new" ? "Kaydediliyor..." : "Biyosidal Ekle"}
            </button>
          </div>
        </form>

        {/* LİSTE */}
        <div className="card list-card">
          <div className="card-title">Biyosidal Ürünler</div>

          {loading ? (
            <div className="empty">Yükleniyor…</div>
          ) : !hasAny ? (
            <div className="empty">Kayıt bulunamadı.</div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Biyosidal Adı</th>
                    <th>Biyosidal Aktif Madde</th>
                    <th>Biyosidal Antidotu</th>
                    <th>Ölçü Birimi</th>
                    <th style={{ width: 180 }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <input
                          value={r.name || ""}
                          onChange={(e) => onRowChange(r.id, "name", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          value={r.activeIngredient || ""}
                          onChange={(e) => onRowChange(r.id, "activeIngredient", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          value={r.antidote || ""}
                          onChange={(e) => onRowChange(r.id, "antidote", e.target.value)}
                        />
                      </td>
                      <td>
                        <select
                          value={r.unit || "ML"}
                          onChange={(e) => onRowChange(r.id, "unit", e.target.value)}
                        >
                          {UNITS.map((u) => (
                            <option key={u} value={u}>{UNIT_TR[u]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="row-actions">
                        <button
                          className="btn warn"
                          onClick={() => updateRow(r)}
                          disabled={savingRow === r.id}
                        >
                          {savingRow === r.id ? "Güncelleniyor..." : "GÜNCELLE"}
                        </button>
                        <button className="btn danger" onClick={() => deleteRow(r.id)}>
                          SİL
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
