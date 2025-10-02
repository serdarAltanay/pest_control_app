import { useEffect, useState } from "react";
import api from "../../api/axios";
import Layout from "../../components/Layout";
import { toast } from "react-toastify";
import "./AddCustomer.scss";

export default function AddCustomer() {
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [accountingTitle, setAccountingTitle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [contactFullName, setContactFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [gsm, setGsm] = useState("");
  const [taxOffice, setTaxOffice] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [pestType, setPestType] = useState("BELIRTILMEDI");
  const [areaM2, setAreaM2] = useState("");
  const [placeType, setPlaceType] = useState("BELIRTILMEDI");
  const [showBalance, setShowBalance] = useState(false);
  const [visitPeriod, setVisitPeriod] = useState("BELIRTILMEDI");
  const [employeeId, setEmployeeId] = useState("");
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/admin/employees");
        setEmployees(res.data || []);
      } catch {}
    })();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/customers", {
        code,
        title,
        accountingTitle: accountingTitle || undefined,
        email: email || undefined,
        password: password || undefined,
        contactFullName: contactFullName || undefined,
        phone: phone || undefined,
        gsm: gsm || undefined,
        taxOffice: taxOffice || undefined,
        taxNumber: taxNumber || undefined,
        address: address || undefined,
        city: city || undefined,
        pestType,
        areaM2: areaM2 ? Number(areaM2) : undefined,
        placeType,
        showBalance: !!showBalance,
        visitPeriod,
        employeeId: employeeId ? Number(employeeId) : undefined,
      });
      toast.success("Müşteri eklendi");

      // reset
      setCode(""); setTitle(""); setAccountingTitle(""); setEmail(""); setPassword("");
      setContactFullName(""); setPhone(""); setGsm(""); setTaxOffice(""); setTaxNumber("");
      setAddress(""); setCity(""); setPestType("BELIRTILMEDI"); setAreaM2("");
      setPlaceType("BELIRTILMEDI"); setShowBalance(false); setVisitPeriod("BELIRTILMEDI");
      setEmployeeId("");
    } catch (err) {
      toast.error(err.response?.data?.message || "Hata");
    }
  };

  return (
    <Layout>
      <div className="add-user-page">
        <h2>Müşteri Ekle</h2>
        <form className="panel" onSubmit={submit}>
          <div className="grid3">
            <div><label>Email</label><input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} placeholder="Email Giriniz"/></div>
            <div><label>Parola</label><input value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Sistem üretebilir"/></div>
            <div><label>Ünvan & Müşteri Adı *</label><input value={title} onChange={(e)=>setTitle(e.target.value)} required/></div>

            <div><label>Muhasebe Ünvanı *</label><input value={accountingTitle} onChange={(e)=>setAccountingTitle(e.target.value)} required/></div>
            <div><label>Yetkili Kişi İsim Soyisim</label><input value={contactFullName} onChange={(e)=>setContactFullName(e.target.value)}/></div>
            <div><label>Firma İletişim GSM</label><input value={gsm} onChange={(e)=>setGsm(e.target.value)}/></div>

            <div><label>Firma İletişim Telefon</label><input value={phone} onChange={(e)=>setPhone(e.target.value)}/></div>
            <div><label>Vergi Dairesi</label><input value={taxOffice} onChange={(e)=>setTaxOffice(e.target.value)}/></div>
            <div><label>Vergi No & T.C.K.N</label><input value={taxNumber} onChange={(e)=>setTaxNumber(e.target.value)}/></div>

            <div className="col-span-2"><label>Firma Adres</label><input value={address} onChange={(e)=>setAddress(e.target.value)}/></div>
            <div><label>Şehir</label><input value={city} onChange={(e)=>setCity(e.target.value)}/></div>

            <div>
              <label>Hedef Zararlı Türü *</label>
              <select value={pestType} onChange={(e)=>setPestType(e.target.value)}>
                <option value="BELIRTILMEDI">Belirtilmedi</option>
                <option value="KEMIRGEN">Kemirgen</option>
                <option value="HACCADI">Haşere (yürüyen)</option>
                <option value="UCAN">Uçan</option>
              </select>
            </div>
            <div><label>Uygulama Alanı m² *</label><input value={areaM2} onChange={(e)=>setAreaM2(e.target.value)} placeholder="m²"/></div>
            <div>
              <label>Uygulama Yeri *</label>
              <select value={placeType} onChange={(e)=>setPlaceType(e.target.value)}>
                <option value="BELIRTILMEDI">Belirtilmedi</option>
                <option value="OFIS">Ofis</option>
                <option value="DEPO">Depo</option>
                <option value="MAGAZA">Mağaza</option>
                <option value="FABRIKA">Fabrika</option>
              </select>
            </div>

            <div>
              <label>Müşteri Güncel Bakiye Görülsün mü?</label>
              <select value={showBalance ? "1":"0"} onChange={(e)=>setShowBalance(e.target.value==="1")}>
                <option value="0">Hayır</option>
                <option value="1">Evet</option>
              </select>
            </div>
            <div>
              <label>Uygulama & Ziyaret Periyodu *</label>
              <select value={visitPeriod} onChange={(e)=>setVisitPeriod(e.target.value)}>
                <option value="BELIRTILMEDI">Belirtilmedi</option>
                <option value="HAFTALIK">1 Haftalık</option>
                <option value="AYLIK">1 Aylık</option>
                <option value="IKIAYLIK">2 Aylık</option>
                <option value="UCAYLIK">3 Aylık</option>
              </select>
            </div>
            <div>
              <label>Sorumlu</label>
              <select value={employeeId} onChange={(e)=>setEmployeeId(e.target.value)}>
                <option value="">Seçiniz</option>
                {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.fullName}</option>)}
              </select>
            </div>

            <div>
              <label>Müşteri Kodu *</label>
              <input value={code} onChange={(e)=>setCode(e.target.value)} required/>
            </div>
          </div>

          <button className="success">Müşteri Ekle</button>
        </form>
      </div>
    </Layout>
  );
}
