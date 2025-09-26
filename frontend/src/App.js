import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/login/Login.jsx"
import CustomerDashboard from "./pages/customerDashboard/CustomerDashboard.jsx";
import WorkDashboard from "./pages/workDashboard/WorkDashboard.jsx";
import PrivateRoute from "./components/PrivateRoute";
import Profile from "./pages/profile/Profile.jsx";
import "./main.scss"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/profile" element={<Profile />} />
        {/* Customer için özel panel */}
        <Route
          path="/customer"s
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

      </Routes>
    </BrowserRouter>
  );
}

export default App;
