import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import StudentDashboard from './pages/student/Dashboard';
import StudentStudyPlan from './pages/student/StudyPlan';
import StudentAssignments from './pages/student/Assignments';
import StudyTimer from './pages/student/StudyTimer';
import StudentReading from './pages/student/Reading';
import StudentVocabTest from './pages/student/VocabTest';
import StudentVocabResults from './pages/student/VocabResults';
import StudentVocabAnalytics from './pages/student/VocabAnalytics';
import StudentGrammarTest from './pages/student/GrammarTest';
import StudentChat from './pages/student/Chat';
import StudentReports from './pages/student/Reports';
import StudentMaterials from './pages/student/Materials';
import StudentMaterialDetail from './pages/student/MaterialDetail';
import CoachDashboard from './pages/coach/Dashboard';
import StudentList from './pages/coach/StudentList';
import StudentDetail from './pages/coach/StudentDetail';
import StudyPlans from './pages/coach/StudyPlans';
import CoachAssignments from './pages/coach/Assignments';
import Templates from './pages/coach/Templates';
import ReadingMaterials from './pages/coach/ReadingMaterials';
import MaterialsPage from './pages/coach/Materials';
import MaterialDetail from './pages/coach/MaterialDetail';
import AdminDashboard from './pages/admin/Dashboard';
import UserManagement from './pages/admin/UserManagement';
import SettingsPage from './pages/Settings';
import type { ReactNode } from 'react';
import type { UserRole } from './types';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-sand-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen bg-sand-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RoleGuard({ allowed, children }: { allowed: UserRole[]; children: ReactNode }) {
  const { profile, loading } = useAuth();
  if (loading) return null;
  if (!profile || !allowed.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function DashboardRouter() {
  const { profile } = useAuth();
  if (profile?.role === 'admin') return <AdminDashboard />;
  if (profile?.role === 'coach') return <CoachDashboard />;
  return <StudentDashboard />;
}

function AssignmentsRouter() {
  const { profile } = useAuth();
  if (profile?.role === 'coach' || profile?.role === 'admin') {
    return <CoachAssignments />;
  }
  return <StudentAssignments />;
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />
            <Route
              path="/register"
              element={
                <PublicRoute>
                  <Register />
                </PublicRoute>
              }
            />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardRouter />} />
              <Route path="students" element={<RoleGuard allowed={['admin', 'coach']}><StudentList /></RoleGuard>} />
              <Route path="students/:id" element={<RoleGuard allowed={['admin', 'coach']}><StudentDetail /></RoleGuard>} />
              <Route path="study-plans" element={<RoleGuard allowed={['admin', 'coach']}><StudyPlans /></RoleGuard>} />
              <Route path="study-plan" element={<RoleGuard allowed={['student']}><StudentStudyPlan /></RoleGuard>} />
              <Route path="assignments" element={<AssignmentsRouter />} />
              <Route path="timer" element={<RoleGuard allowed={['student']}><StudyTimer /></RoleGuard>} />
              <Route path="reading" element={<RoleGuard allowed={['student']}><StudentReading /></RoleGuard>} />
              <Route path="vocab-test" element={<RoleGuard allowed={['student']}><StudentVocabTest /></RoleGuard>} />
              <Route path="vocab-results" element={<RoleGuard allowed={['student']}><StudentVocabResults /></RoleGuard>} />
              <Route path="vocab-analytics" element={<RoleGuard allowed={['student']}><StudentVocabAnalytics /></RoleGuard>} />
              <Route path="grammar-test" element={<RoleGuard allowed={['student']}><StudentGrammarTest /></RoleGuard>} />
              <Route path="chat" element={<RoleGuard allowed={['student']}><StudentChat /></RoleGuard>} />
              <Route path="reports" element={<RoleGuard allowed={['student']}><StudentReports /></RoleGuard>} />
              <Route path="student-materials" element={<RoleGuard allowed={['student']}><StudentMaterials /></RoleGuard>} />
              <Route path="student-materials/:id" element={<RoleGuard allowed={['student']}><StudentMaterialDetail /></RoleGuard>} />
              <Route path="reading-materials" element={<RoleGuard allowed={['admin', 'coach']}><ReadingMaterials /></RoleGuard>} />
              <Route path="materials" element={<RoleGuard allowed={['admin', 'coach']}><MaterialsPage /></RoleGuard>} />
              <Route path="materials/:id" element={<RoleGuard allowed={['admin', 'coach']}><MaterialDetail /></RoleGuard>} />
              <Route path="templates" element={<RoleGuard allowed={['admin', 'coach']}><Templates /></RoleGuard>} />
              <Route path="admin/users" element={<RoleGuard allowed={['admin']}><UserManagement /></RoleGuard>} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
