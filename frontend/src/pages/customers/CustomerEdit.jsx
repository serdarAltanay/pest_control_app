import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { toast } from "react-toastify";
import "./CustomerEdit.scss";



export default function CustomerEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [employees, setEmployees] = useState([]);

  const [form, setForm] = useState({
    code: "",
    title: "",
    accountingTitle: "",
    email: "",
    contactFullName: "",
    phone: "",
    gsm: "",
    taxOffice: "",
    taxNumber: "",
    address: "",
    city: "",
    city: "",
    employeeId: "",
  });

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/customers/${id}`);
      setForm({
        code: data.code || "",
        title: data.title || "",
        accountingTitle: data.accountingTitle || "",
        email: data.email || "",
        contactFullName: data.contactFullName || "",
        phone: data.phone || "",
        gsm: data.gsm || "",
        taxOffice: data.taxOffice || "",
        taxNumber: data.taxNumber || "",
        address: data.address || "",
        city: data.city || "",
        city: data.city || "",
        employeeId: data.employee?.id || "",
      });
    } catch (err) {
      toast.error(err.response?.data?.message || "Müşteri bilgisi alınamadı");
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const { data } = await api.get("/employees");
      setEmployees(Array.isArray(data) ? data : []);
    } catch { /* sessiz */ }
  };

  useEffect(() => {
    fetchDetail();
    fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((p) => ({
      ...p,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const onSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        ...form,
        employeeId: form.employeeId ? Number(form.employeeId) : null,
      };
      await api.put(`/customers/${id}`, payload);
      toast.success("Müşteri güncellendi");
      navigate(`/admin/customers/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Güncellenemedi");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!window.confirm("Bu müşteriyi silmek istediğinize emin misiniz?")) return;
    try {
      await api.delete(`/customers/${id}`);
      toast.success("Müşteri silindi");
      navigate("/admin/customers");
    } catch (err) {
      toast.error(err.response?.data?.message || "Silinemedi");
    }
  };

  return (
    <Layout>
      <div className="customer-edit-page">
        <div className="page-header">
          <h1>Müşteri Düzenle</h1>
          <div className="header-actions">
            <button className="btn danger" onClick={onDelete}>Sil</button>
          </div>
        </div>

        <div className="edit-grid">
          <form className="card form-card" onSubmit={onSave}>
            <div className="grid-2">
              <div>
                <label>Müşteri Kodu *</label>
                <input name="code" value={form.code} onChange={onChange} required />
              </div>
              <div>
                <label>Ünvan *</label>
                <input name="title" value={form.title} onChange={onChange} required />
              </div>

              <div className="col-span-2">
                <label>Hesap Ünvanı</label>
                <input name="accountingTitle" value={form.accountingTitle} onChange={onChange} />
              </div>

              <div>
                <label>E-posta</label>
                <input type="email" name="email" value={form.email} onChange={onChange} />
              </div>
              <div>
                <label>Yetkili Ad Soyad</label>
                <input name="contactFullName" value={form.contactFullName} onChange={onChange} />
              </div>

              <div>
                <label>Telefon</label>
                <input name="phone" value={form.phone} onChange={onChange} />
              </div>
              <div>
                <label>GSM</label>
                <input name="gsm" value={form.gsm} onChange={onChange} />
              </div>

              <div>
                <label>Vergi Dairesi</label>
                <input name="taxOffice" value={form.taxOffice} onChange={onChange} />
              </div>
              <div>
                <label>Vergi No / TCKN</label>
                <input name="taxNumber" value={form.taxNumber} onChange={onChange} />
              </div>

              <div className="col-span-2">
                <label>Merkez Adres</label>
                <textarea name="address" rows={3} value={form.address} onChange={onChange} />
              </div>

              <div>
                <label>Şehir</label>
                <input name="city" value={form.city} onChange={onChange} />
              </div>
              <div>
                <label>Sorumlu Personel</label>
                <select name="employeeId" value={form.employeeId} onChange={onChange}>
                  <option value="">Seçiniz</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.fullName} ({e.email})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-actions">
              <button className="btn primary" disabled={saving}>
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => navigate(-1)}
                disabled={saving}
              >
                İptal
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
