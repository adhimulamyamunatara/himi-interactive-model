import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import CompanionDock from './components/companion/CompanionDock';
import ErrorBoundary from './components/common/ErrorBoundary';
import { PageSkeleton } from './components/common/Skeleton';
import Footer from './components/layout/Footer';
import Navbar from './components/layout/Navbar';
import { useTheme } from './hooks/useTheme';
import PageTransition from './components/layout/PageTransition';
import { useUser } from './context/UserContext';

// Route-level code splitting keeps the first load small.
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Chat = lazy(() => import('./pages/Chat'));
const Profile = lazy(() => import('./pages/Profile'));
const LearningMemory = lazy(() => import('./pages/LearningMemory'));
const Code = lazy(() => import('./pages/Code'));
const Diagrams = lazy(() => import('./pages/Diagrams'));
const Camera = lazy(() => import('./pages/Camera'));
const Campus = lazy(() => import('./pages/Campus'));
const Classroom = lazy(() => import('./pages/Classroom'));
const Mentor = lazy(() => import('./pages/Mentor'));
const Notes = lazy(() => import('./pages/Notes'));
const Progress = lazy(() => import('./pages/Progress'));
const Quiz = lazy(() => import('./pages/Quiz'));
const StudyPlanner = lazy(() => import('./pages/StudyPlanner'));
const Whiteboard = lazy(() => import('./pages/Whiteboard'));
const NotFound = lazy(() => import('./pages/NotFound'));

function ProtectedRoute({ children }) {
  const { user, loading } = useUser();

  if (loading) {
    return <PageSkeleton />;
  }

  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const location = useLocation();
  useTheme({ apply: true });
  const isChatRoute = location.pathname === '/chat';

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Navbar />
      <main id="main-content" className="flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <PageTransition key={location.pathname}>
            {/* Keyed by the transition, so a crashed page resets as soon as the user navigates. */}
            <ErrorBoundary>
              <Suspense fallback={<PageSkeleton />}>
                <Routes location={location}>
                  <Route path="/" element={<Landing />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
                  <Route path="/quiz" element={<ProtectedRoute><Quiz /></ProtectedRoute>} />
                  <Route path="/study-planner" element={<ProtectedRoute><StudyPlanner /></ProtectedRoute>} />
                  <Route path="/notes" element={<ProtectedRoute><Notes /></ProtectedRoute>} />
                  <Route path="/progress" element={<ProtectedRoute><Progress /></ProtectedRoute>} />
                  <Route path="/code" element={<ProtectedRoute><Code /></ProtectedRoute>} />
                  <Route path="/diagrams" element={<ProtectedRoute><Diagrams /></ProtectedRoute>} />
                  <Route path="/camera" element={<ProtectedRoute><Camera /></ProtectedRoute>} />
                  <Route path="/campus" element={<ProtectedRoute><Campus /></ProtectedRoute>} />
                  <Route path="/classroom" element={<ProtectedRoute><Classroom /></ProtectedRoute>} />
                  <Route path="/mentor" element={<ProtectedRoute><Mentor /></ProtectedRoute>} />
                  <Route path="/whiteboard" element={<ProtectedRoute><Whiteboard /></ProtectedRoute>} />
                  <Route path="/learning-memory" element={<ProtectedRoute><LearningMemory /></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </PageTransition>
        </AnimatePresence>
      </main>
      {isChatRoute ? null : <Footer />}
      <CompanionDock />
    </div>
  );
}
