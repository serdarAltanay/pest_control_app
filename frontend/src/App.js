import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/login/Login.jsx"
import CustomerDashboard from "./pages/customerDashboard/CustomerDashboard.jsx";
import WorkDashboard from "./pages/workDashboard/WorkDashboard.jsx";
import CustomerManagementPage from "./pages/customerworks/CustomerManagementPage.jsx";
import PrivateRoute from "./components/PrivateRoute";
import Profile from "./pages/profile/Profile.jsx";
import { ToastContainer } from "react-toastify";
import { ProfileProvider } from "./context/ProfileContext";
import AddAdmin from "./pages/admin/AddAdmin.jsx";
import AddEmployee from "./pages/admin/AddEmployee.jsx";
import AddCustomer from "./pages/admin/AddCustomer.jsx";
import CustomerList from "./pages/admin/CustomerList.jsx";
import CustomerDetail from "./pages/customers/CustomerDetail.jsx";
import CustomerEdit from "./pages/customers/CustomerEdit.jsx";
import StoreCreate from "./pages/stores/StoreCreate.jsx";
import StoreEdit from "./pages/stores/StoreEdit.jsx";
import StoreDetail from "./pages/stores/StoreDetail.jsx";
import StoreStations from "./pages/Stations/StoreStation.jsx";
import Biocides from "./pages/biocides/Biocides.jsx";
import StoreEk1 from "./pages/ek1/StoreEk1.jsx";
import VisitEk1 from "./pages/ek1/VisitEk1.jsx";
import Ek1Preview from "./pages/ek1/Ek1Preview.jsx";
import SerbestEk1 from "./pages/ek1/SerbestEk1";

import RodentBaitActivation from "./pages/Stations/activations/RodentBaitActivation.jsx";
import LiveCatchActivation from "./pages/Stations/activations/LiveCatchActivation.jsx";
import EFKActivation from "./pages/Stations/activations/EfkActivation.jsx";
import InsectMonitorActivation from "./pages/Stations/activations/InsectMonitorActivation.jsx";
import MothTrapActivation from "./pages/Stations/activations/MothTrapActivation.jsx";

import StationDetail from "./pages/Stations/StationDetail.jsx";

import StoreNonconformities from "./pages/nonconformities/StoreNonconformities.jsx";
import StoreList from "./pages/stores/StoreList.jsx";
import NonconformityDetail from "./pages/nonconformities/nonconformityDetail.jsx";

import StoreReports from "./pages/reports/StoreReports.jsx";
import TrendAnalysis from "./pages/analytics/TrendAnalysis.jsx";
import ReportDetail from "./pages/reports/ReportDetail.jsx";

import VisitCalendar from "./pages/calendar/VisitCalendar.jsx";
import VisitDetail from "./pages/calendar/VisitDetail.jsx";
import CustomerAgenda from "./pages/customer/CustomerAgenda.jsx";

import EmployeeRoutes from "./pages/tracking/EmployeeTracking.jsx";

import AccessOwnersList from "./pages/access/AccessOwnersList.jsx";
import AccessOwnerDetail from "./pages/access/AccessOwnerDetail";
import AccessManageStore from "./pages/access/AccessManageStore";
import AccessManageCustomer from "./pages/access/AccessManageCustomer";
import AccessNew from "./pages/access/AccessNew.jsx";

import VisitMailCompose from "./pages/mailer/VisitMailCompose.jsx";

import CustomerStoreList from "./pages/customer/CustomerStoreList.jsx";
import CustomerStoreDetail from "./pages/customer/CustomerStoreDetail.jsx";
import CustomerStoreNonconformities from "./pages/customer/CustomerStoreNonconformities.jsx";
import CustomerNcrDetail from "./pages/customer/CustomerNcrDetail.jsx";
import CustomerStationDetail from "./pages/customer/CustomerStationDetail.jsx";
import CustomerReports from "./pages/customer/CustomerReports.jsx";

import NotificationsPage from "./pages/notifications/NotificationsPage.jsx";

/* ── Yeni: Şikayet/Öneri sayfaları ─────────────────────────────── */
import CustomerFeedbackNew from "./pages/customer/FeedBackNew.jsx";
import CustomerFeedbackList from "./pages/customer/FeedbackList.jsx";
import CustomerFeedbackDetail from "./pages/customer/CompilaintDetail.jsx";
import AdminComplaintsList from "./pages/admin/ComplaintList.jsx";
import AdminComplaintDetail from "./pages/admin/ComplaintDetail.jsx";
import AdminSuggestionsList from "./pages/admin/AdminSuggestionList.jsx";
import AdminSuggestionDetail from "./pages/admin/AdminSuggestionDetail.jsx";

import Contacts from "./pages/customer/Contacts.jsx";

import "react-toastify/dist/ReactToastify.css";
import "./main.scss"
import 'leaflet/dist/leaflet.css';

function App() {
  return (
    <>
      <ToastContainer position="top-right" autoClose={3000} />
      <ProfileProvider>
        <BrowserRouter>
          <Routes>
            {/* Bildirimler: tüm roller erişebilir (giriş şart) */}
            <Route
              path="/notifications"
              element={
                <PrivateRoute allowedRoles={['admin','employee','customer']}>
                  <NotificationsPage />
                </PrivateRoute>
              }
            />

            <Route path="/" element={<Login />} />
            <Route path="/profile" element={<Profile />} />

            {/* Customer Dashboard */}
            <Route
              path="/customer"
              element={
                <PrivateRoute allowedRoles={['customer']}>
                  <CustomerDashboard />
                </PrivateRoute>
              }
            />

            {/* Admin oluşturma/ekleme sayfaları */}
            <Route
              path="/admin/admins/new"
              element={
                <PrivateRoute allowedRoles={['admin']}>
                  <AddAdmin />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/employees/new"
              element={
                <PrivateRoute allowedRoles={['admin']}>
                  <AddEmployee />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/customers/new"
              element={
                <PrivateRoute allowedRoles={['admin','employee']}>
                  <AddCustomer />
                </PrivateRoute>
              }
            />

            {/* Employee & Admin ortak panel */}
            <Route
              path="/work"
              element={
                <PrivateRoute allowedRoles={['employee','admin']}>
                  <WorkDashboard />
                </PrivateRoute>
              }
            />
            <Route
              path="/customers"
              element={
                <PrivateRoute allowedRoles={["employee", "admin"]}>
                  <CustomerManagementPage/>
                </PrivateRoute>
              }
            />

            {/* Admin & Employee müşteriler */}
            <Route
              path="/admin/customers"
              element={
                <PrivateRoute allowedRoles={['admin','employee']}>
                  <CustomerList />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/customers/:id"
              element={
                <PrivateRoute allowedRoles={['admin', 'employee']}>
                  <CustomerDetail />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/customers/:id/edit"
              element={
                <PrivateRoute allowedRoles={['admin', 'employee']}>
                  <CustomerEdit />
                </PrivateRoute>
              }
            />

            {/* Mağazalar */}
            <Route
              path="/admin/customers/:customerId/stores/new"
              element={
                <PrivateRoute allowedRoles={['admin', 'employee']}>
                  <StoreCreate />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/stores"
              element={
                <PrivateRoute allowedRoles={['admin', 'employee']}>
                  <StoreList  />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/stores/:storeId/edit"
              element={
                <PrivateRoute allowedRoles={['admin', 'employee']}>
                  <StoreEdit  />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/stores/:storeId"
              element={
                <PrivateRoute allowedRoles={['admin', 'employee']}>
                  <StoreDetail  />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/stores/:storeId/stations"
              element={
                <PrivateRoute allowedRoles={['admin', 'employee']}>
                  <StoreStations  />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/stores/:storeId/stations/new"
              element={
                <PrivateRoute allowedRoles={['admin', 'employee']}>
                  <StoreStations openMode="create" />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/biocides"
              element={
                <PrivateRoute allowedRoles={['admin', 'employee']}>
                  <Biocides/>
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/stores/:storeId/ek1"
              element={
                <PrivateRoute allowedRoles={['admin', 'employee']}>
                  <StoreEk1 />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/stores/:storeId/visits/:visitId/biocides"
              element={
                <PrivateRoute allowedRoles={['admin', 'employee']}>
                  <VisitEk1 />
                </PrivateRoute>
              }
            />
            <Route
              path="/ek1/visit/:visitId"
              element={
                <PrivateRoute allowedRoles={['admin','employee','customer']}>
                  <Ek1Preview />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/stores/:storeId/visits/:visitId/preview"
              element={
                <PrivateRoute allowedRoles={['admin', 'employee']}>
                  <Ek1Preview  />
                </PrivateRoute>
              }
            />
            <Route
              path="/ek1/serbest"
              element={
                <PrivateRoute allowedRoles={['admin', 'employee']}>
                  <SerbestEk1  />
                </PrivateRoute>
              }
            />

            {/* İSTASYON AKTİVASYONLARI */}
            <Route
              path="/admin/stores/:storeId/stations/:stationId/activation/rodent-bait"
              element={
                <PrivateRoute allowedRoles={['admin', 'employee']}>
                  <RodentBaitActivation />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/stores/:storeId/stations/:stationId/activation/live-catch"
              element={
                <PrivateRoute allowedRoles={['admin', 'employee']}>
                  <LiveCatchActivation />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/stores/:storeId/stations/:stationId/activation/efk"
              element={
                <PrivateRoute allowedRoles={['admin', 'employee']}>
                  <EFKActivation />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/stores/:storeId/stations/:stationId/activation/insect-monitor"
              element={
                <PrivateRoute allowedRoles={['admin', 'employee']}>
                  <InsectMonitorActivation />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/stores/:storeId/stations/:stationId/activation/moth-trap"
              element={
                <PrivateRoute allowedRoles={['admin', 'employee']}>
                  <MothTrapActivation />
                </PrivateRoute>
              }
            />

            {/* Ziyaret bağlamlı aynı sayfalar */}
            <Route
              path="/admin/stores/:storeId/visits/:visitId/stations/:stationId/activation/rodent-bait"
              element={
                <PrivateRoute allowedRoles={['admin', 'employee']}>
                  <RodentBaitActivation />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/stores/:storeId/visits/:visitId/stations/:stationId/activation/live-catch"
              element={
                <PrivateRoute allowedRoles={['admin', 'employee']}>
                  <LiveCatchActivation />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/stores/:storeId/visits/:visitId/stations/:stationId/activation/efk"
              element={
                <PrivateRoute allowedRoles={['admin', 'employee']}>
                  <EFKActivation />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/stores/:storeId/visits/:visitId/stations/:stationId/activation/insect-monitor"
              element={
                <PrivateRoute allowedRoles={['admin', 'employee']}>
                  <InsectMonitorActivation />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/stores/:storeId/visits/:visitId/stations/:stationId/activation/moth-trap"
              element={
                <PrivateRoute allowedRoles={['admin', 'employee']}>
                  <MothTrapActivation />
                </PrivateRoute>
              }
            />

            {/* İstasyon detay */}
            <Route
              path="/admin/stations/:stationId"
              element={
                <PrivateRoute allowedRoles={['admin', 'employee']}>
                  <StationDetail />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/stations/:stationId/edit"
              element={
                <PrivateRoute allowedRoles={['admin', 'employee']}>
                  <StationDetail openEdit />
                </PrivateRoute>
              }
            />

            {/* Uygunsuzluklar */}
            <Route
              path="/admin/stores/:storeId/nonconformities"
              element={
                <PrivateRoute allowedRoles={['admin', 'employee']}>
                  <StoreNonconformities />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/stores/:storeId/nonconformities/:ncrId"
              element={
                <PrivateRoute allowedRoles={['admin','employee']}>
                  <NonconformityDetail />
                </PrivateRoute>
              }
            />

            {/* Raporlar & Analitik */}
            <Route
              path="/admin/stores/:storeId/reports"
              element={
                <PrivateRoute allowedRoles={['admin', 'employee']}>
                  <StoreReports />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/stores/:storeId/analytics"
              element={
                <PrivateRoute allowedRoles={['admin', 'employee']}>
                  <TrendAnalysis />
                </PrivateRoute>
              }
            />
            <Route
              path="/customer/stores/:storeId/analytics"
              element={
                <PrivateRoute allowedRoles={['customer']}>
                  <TrendAnalysis />
                </PrivateRoute>
              }
            />
            <Route
              path="/customer/reports"
              element={
                <PrivateRoute allowedRoles={['customer','admin','employee']}>
                  <CustomerReports />
                </PrivateRoute>
              }
            />
            <Route path="/customer/stores/:storeId/reports" element={<CustomerReports />} />
            <Route
              path="/customer/reports/:storeId/:reportId"
              element={
                <PrivateRoute allowedRoles={['customer','admin','employee']}>
                  <ReportDetail />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/stores/:storeId/reports/:reportId"
              element={
                <PrivateRoute allowedRoles={['admin','employee']}>
                  <ReportDetail />
                </PrivateRoute>
              }
            />

            {/* Takvim/Ziyaret */}
            <Route
              path="/calendar"
              element={
                <PrivateRoute allowedRoles={['admin','employee']}>
                  <VisitCalendar />
                </PrivateRoute>
              }
            />
            <Route
              path="/calendar/visit/:id"
              element={
                <PrivateRoute allowedRoles={['admin','employee','customer']}>
                  <VisitDetail />
                </PrivateRoute>
              }
            />
            <Route
              path="/customer/calendar/visit/:id"
              element={
                <PrivateRoute allowedRoles={['customer']}>
                  <VisitDetail />
                </PrivateRoute>
              }
            />
            <Route
              path="/customer/agenda"
              element={
                <PrivateRoute allowedRoles={['customer']}>
                  <CustomerAgenda />
                </PrivateRoute>
              }
            />

            {/* Personel konum izleme (yalnız admin) */}
            <Route
              path="/tracking/employees"
              element={
                <PrivateRoute allowedRoles={['admin']}>
                  <EmployeeRoutes />
                </PrivateRoute>
              }
            />

            {/* Erişim yönetimi (admin + employee) */}
            <Route
              path="/admin/access"
              element={
                <PrivateRoute allowedRoles={['admin','employee']}>
                  <AccessOwnersList  />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/access/new"
              element={
                <PrivateRoute allowedRoles={['admin','employee']}>
                  <AccessNew   />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/access/owner/:ownerId"
              element={
                <PrivateRoute allowedRoles={['admin','employee']}>
                  <AccessOwnerDetail   />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/stores/:storeId/access"
              element={
                <PrivateRoute allowedRoles={['admin','employee']}>
                  <AccessManageStore    />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/customers/:customerId/access"
              element={
                <PrivateRoute allowedRoles={['admin','employee']}>
                  <AccessManageCustomer    />
                </PrivateRoute>
              }
            />

            {/* Mailer */}
            <Route
              path="/mail/visit/:visitId"
              element={
                <PrivateRoute allowedRoles={['admin']}>
                  <VisitMailCompose  />
                </PrivateRoute>
              }
            />

            {/* Customer modülleri */}
            <Route
              path="/customer/stores"
              element={
                <PrivateRoute allowedRoles={['customer']}>
                  <CustomerStoreList />
                </PrivateRoute>
              }
            />
            <Route
              path="/customer/stores/:storeId"
              element={
                <PrivateRoute allowedRoles={['customer']}>
                  <CustomerStoreDetail />
                </PrivateRoute>
              }
            />
            <Route
              path="/customer/stores/:storeId/nonconformities"
              element={
                <PrivateRoute allowedRoles={['customer']}>
                  <CustomerStoreNonconformities />
                </PrivateRoute>
              }
            />
            <Route
              path="/customer/stores/:storeId/nonconformities/:ncrId"
              element={
                <PrivateRoute allowedRoles={['customer']}>
                  <CustomerNcrDetail />
                </PrivateRoute>
              }
            />
            <Route
              path="/customer/stations/:stationId"
              element={
                <PrivateRoute allowedRoles={['customer']}>
                  <CustomerStationDetail />
                </PrivateRoute>
              }
            />

            {/* ───────── Şikayet / Öneri (employee erişemez) ───────── */}
            <Route
              path="/customer/feedback/new"
              element={
                <PrivateRoute allowedRoles={['customer']}>
                  <CustomerFeedbackNew />
                </PrivateRoute>
              }
            />
            <Route
              path="/customer/feedback"
              element={
                <PrivateRoute allowedRoles={['customer']}>
                  <CustomerFeedbackList />
                </PrivateRoute>
              }
            />
            <Route
              path="/customer/feedback/:id"
              element={
                <PrivateRoute allowedRoles={['customer']}>
                  <CustomerFeedbackDetail />
                </PrivateRoute>
              }
            />
            <Route
              path="/customer/contacts"
              element={
                <PrivateRoute allowedRoles={['customer']}>
                  <Contacts />
                </PrivateRoute>
              }
            />

            {/* Admin: şikayet/öneri izleme */}
            <Route
              path="/admin/complaints"
              element={
                <PrivateRoute allowedRoles={['admin']}>
                  <AdminComplaintsList />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/complaints/:id"
              element={
                <PrivateRoute allowedRoles={['admin']}>
                  <AdminComplaintDetail />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/suggestions"
              element={
                <PrivateRoute allowedRoles={['admin']}>
                  <AdminSuggestionsList />
                </PrivateRoute>
              }
            />
            <Route
              path="/admin/suggestions/:id"
              element={
                <PrivateRoute allowedRoles={['admin']}>
                  <AdminSuggestionDetail />
                </PrivateRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </ProfileProvider>
    </>
  );
}

export default App;
