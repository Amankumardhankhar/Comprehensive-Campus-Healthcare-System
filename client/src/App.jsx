import { Routes, Route, Navigate } from 'react-router-dom';
import Welcome from './pages/Welcome.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import QuickPickup from './pages/QuickPickup.jsx';
import QuickPickupPayment from './pages/QuickPickupPayment.jsx';
import QuickPickupDispense from './pages/QuickPickupDispense.jsx';
import KioskStart from './pages/KioskStart.jsx';
import KioskSensor from './pages/KioskSensor.jsx';
import KioskAnalyzing from './pages/KioskAnalyzing.jsx';
import KioskResult from './pages/KioskResult.jsx';
import AdminDashboard from './pages/admin/AdminDashboard.jsx';
import AdminInventory from './pages/admin/AdminInventory.jsx';
import AdminSessions from './pages/admin/AdminSessions.jsx';
import AdminAnalytics from './pages/admin/AdminAnalytics.jsx';
import AdminConfig from './pages/admin/AdminConfig.jsx';
import AdminUsers from './pages/admin/AdminUsers.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/quick" element={<QuickPickup />} />
      <Route path="/quick/payment/:sessionId" element={<QuickPickupPayment />} />
      <Route path="/quick/dispensing/:sessionId" element={<QuickPickupDispense />} />
      <Route path="/kiosk" element={<KioskStart />} />
      <Route path="/kiosk/sensor/:sessionId" element={<KioskSensor />} />
      <Route path="/kiosk/analyzing/:sessionId" element={<KioskAnalyzing />} />
      <Route path="/kiosk/result/:sessionId" element={<KioskResult />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/inventory" element={<AdminInventory />} />
      <Route path="/admin/users" element={<AdminUsers />} />
      <Route path="/admin/sessions" element={<AdminSessions />} />
      <Route path="/admin/analytics" element={<AdminAnalytics />} />
      <Route path="/admin/config" element={<AdminConfig />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
