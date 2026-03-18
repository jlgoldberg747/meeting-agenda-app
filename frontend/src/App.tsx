import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import TemplatesPage from './pages/TemplatesPage';
import TemplateEditorPage from './pages/TemplateEditorPage';
import MeetingsPage from './pages/MeetingsPage';
import NewMeetingPage from './pages/NewMeetingPage';
import MeetingDetailPage from './pages/MeetingDetailPage';
import LiveMeetingPage from './pages/LiveMeetingPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  const { loading, user } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-muted text-sm font-bold tracking-widest uppercase animate-pulse">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/templates/new" element={<TemplateEditorPage />} />
          <Route path="/templates/:id/edit" element={<TemplateEditorPage />} />
          <Route path="/meetings" element={<MeetingsPage />} />
          <Route path="/meetings/new" element={<NewMeetingPage />} />
          <Route path="/meetings/:id" element={<MeetingDetailPage />} />
          <Route path="/meetings/:id/edit" element={<NewMeetingPage />} />
          <Route path="/meetings/:id/live" element={<LiveMeetingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/'} replace />} />
    </Routes>
  );
}
