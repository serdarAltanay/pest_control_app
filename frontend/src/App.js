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

import "react-toastify/dist/ReactToastify.css";
import "./main.scss"

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
      </Routes>
    </BrowserRouter>
    </ProfileProvider>
    </>
  );
}

export default App;
