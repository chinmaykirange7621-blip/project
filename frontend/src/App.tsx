import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ScholarDataProvider } from './hooks/useScholarData';
import { MainLayout } from './layouts/MainLayout';
import { LandingPage } from './pages/LandingPage';

const ChatPage = lazy(() => import('./pages/ChatPage').then((m) => ({ default: m.ChatPage })));
const ExplorerPage = lazy(() => import('./pages/ExplorerPage').then((m) => ({ default: m.ExplorerPage })));
const EligibilityPage = lazy(() => import('./pages/EligibilityPage').then((m) => ({ default: m.EligibilityPage })));
const ScholarshipDetailPage = lazy(() =>
  import('./pages/ScholarshipDetailPage').then((m) => ({ default: m.ScholarshipDetailPage }))
);
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));

function RouteFallback() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-16 text-center text-sm text-slate-500 dark:text-slate-400">
      Loading view...
    </div>
  );
}

export default function App() {
  return (
    <ScholarDataProvider>
      <BrowserRouter>
        <MainLayout>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/chat" element={<ChatPage />} />
              <Route path="/explore" element={<ExplorerPage />} />
              <Route path="/eligibility" element={<EligibilityPage />} />
              <Route path="/scholarships/:id" element={<ScholarshipDetailPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </MainLayout>
      </BrowserRouter>
    </ScholarDataProvider>
  );
}
