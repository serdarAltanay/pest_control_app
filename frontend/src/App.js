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
        <Route path="/" element={<Login />} />
        <Route path="/profile" element={<Profile />} />
        {/* Customer için özel panel */}
        <Route
          path="/customer"
          element={
            <PrivateRoute allowedRoles={['customer']}>
              <CustomerDashboard />
            </PrivateRoute>
          }
        />

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
            <PrivateRoute allowedRoles={['admin']}>
              <AddCustomer />
            </PrivateRoute>
          }
        />

        {/* Employee ve Admin tek panel */}
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
        <Route
          path="/admin/customers/:customerId/stores/new"
          element={
            <PrivateRoute allowedRoles={['admin', 'employee']}>
              <StoreCreate />
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
          path="/admin/stations/:stationId/edit"
          element={
            <PrivateRoute allowedRoles={['admin', 'employee']}>
              <StoreStations openMode="edit"  />
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
          path="/admin/stores/:storeId/visits/:visitId/preview"
          element={
            <PrivateRoute allowedRoles={['admin', 'employee']}>
              <Ek1Preview  />
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
