import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/login/Login.jsx"
import CustomerDashboard from "./pages/customerDashboard/CustomerDashboard.jsx";
import WorkDashboard from "./pages/workDashboard/WorkDashboard.jsx";
import CustomerManagementPage from "./pages/customerworks/CustomerManagementPage.jsx";
import PrivateRoute from "./components/PrivateRoute";
import Profile from "./pages/profile/Profile.jsx";
import AddUser from "./pages/admin/AddUser.jsx";
import "./main.scss"

function App() {
  return (
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
          path="/admin"
          element={
          <PrivateRoute allowedRoles={['admin']}>
            <AddUser />
          </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
