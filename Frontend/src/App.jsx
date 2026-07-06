import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import OAuthCallback from './pages/OAuthCallback';
import DashboardHome from './pages/DashboardHome';
import { ActionRequiredPage, ProgressReportsPage, CompletedReportsPage } from './pages/DashboardWorkspaces';
import AnalysisNew from './pages/AnalysisNew';
import AnalysisResult from './pages/AnalysisResult';
import ProfilePage from './pages/ProfilePage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/oauth/callback" element={<OAuthCallback />} />
        <Route path="/shared/:token" element={<AnalysisResult shared />} />
        <Route path="/" element={<Layout><DashboardHome /></Layout>} />
        <Route path="/dashboard/action" element={<Layout><ActionRequiredPage /></Layout>} />
        <Route path="/dashboard/progress" element={<Layout><ProgressReportsPage /></Layout>} />
        <Route path="/dashboard/completed" element={<Layout><CompletedReportsPage /></Layout>} />
        <Route path="/analysis/new" element={<Layout><AnalysisNew /></Layout>} />
        <Route path="/analysis/:id" element={<Layout><AnalysisResult /></Layout>} />
        <Route path="/profile" element={<Layout><ProfilePage /></Layout>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
