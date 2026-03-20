import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import TemplatesPage from './pages/TemplatesPage';
import TemplateEditorPage from './pages/TemplateEditorPage';
import MeetingsPage from './pages/MeetingsPage';
import NewMeetingPage from './pages/NewMeetingPage';
import MeetingDetailPage from './pages/MeetingDetailPage';
import LiveMeetingPage from './pages/LiveMeetingPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

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

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
