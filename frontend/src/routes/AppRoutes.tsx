import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ADMIN_ENVIRONMENT } from '../constants/environments';
import { useMinLoaderVisibility } from '../hooks/useMinLoaderVisibility';
import { lazyWithMinDuration } from '../utils/pageLoaderTiming';

// Pages
import LoginPage from '../pages/LoginPage';
import SelectionPage from '../pages/SelectionPage';
import ChangePasswordPage from '../pages/ChangePasswordPage';
import GoogleCallbackPage from '../pages/GoogleCallbackPage';
import DashboardLayout from '../layouts/DashboardLayout';

import PageLoader from '../components/PageLoader';

// Lazy-loaded Workspaces (Carregamento sob Demanda / Lazy Loading)
const DashboardWorkspace = lazyWithMinDuration(() => import('../workspaces/Dashboard/DashboardWorkspace'));
const AdminRouter = lazyWithMinDuration(() => import('../workspaces/Admin/AdminRouter'));
const FinanceiroWorkspace = lazyWithMinDuration(() => import('../workspaces/Financeiro/FinanceiroWorkspace'));
const RelatoriosWorkspace = lazyWithMinDuration(() => import('../workspaces/Relatorios/RelatoriosWorkspace'));
const IndicadoresWorkspace = lazyWithMinDuration(() => import('../workspaces/Indicadores/IndicadoresWorkspace'));
const ComprasWorkspace = lazyWithMinDuration(() => import('../workspaces/Compras/ComprasWorkspace'));
const RHWorkspace = lazyWithMinDuration(() => import('../workspaces/RH/RHWorkspace'));
const FaturamentoWorkspace = lazyWithMinDuration(() => import('../workspaces/Faturamento/FaturamentoWorkspace'));
// Autenticado, sem bloquear quem precisa trocar a senha (usado em /change-password).
const ProtectedRouteAllowPasswordChange: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const showLoader = useMinLoaderVisibility(isLoading);

  if (showLoader) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

// Route Guard: Requires authentication (bloqueia se houver troca de senha pendente)
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const showLoader = useMinLoaderVisibility(isLoading);

  if (showLoader) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.mustChangePassword) return <Navigate to="/change-password" replace />;

  return <>{children}</>;
};

// Route Guard: Requires environment selection
const EnvironmentRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { selectedEnvironment, isLoading, user } = useAuth();
  const showLoader = useMinLoaderVisibility(isLoading);

  if (showLoader) return <PageLoader />;
  if (user?.mustChangePassword) return <Navigate to="/change-password" replace />;
  if (!selectedEnvironment) return <Navigate to="/select-environment" replace />;

  return <>{children}</>;
};

// Redirect root / dynamically to the active environment home page
const DashboardIndexRedirect: React.FC = () => {
  const { selectedEnvironment } = useAuth();
  
  if (selectedEnvironment === 'Financeiro') {
    return <Navigate to="/financeiro/home" replace />;
  }
  if (selectedEnvironment === ADMIN_ENVIRONMENT) {
    return <Navigate to="/admin" replace />;
  }
  if (selectedEnvironment === 'Indicadores') {
    return <Navigate to="/indicadores" replace />;
  }
  if (selectedEnvironment === 'Compras') {
    return <Navigate to="/compras" replace />;
  }
  if (selectedEnvironment === 'RH') {
    return <Navigate to="/rh" replace />;
  }
  if (selectedEnvironment === 'Faturamento') {
    return <Navigate to="/faturamento" replace />;
  }
  
  return (
    <Suspense fallback={<PageLoader />}>
      <DashboardWorkspace />
    </Suspense>
  );
};

const AppRoutes: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/change-password"
          element={
            <ProtectedRouteAllowPasswordChange>
              <ChangePasswordPage />
            </ProtectedRouteAllowPasswordChange>
          }
        />
        <Route
          path="/auth/google/callback"
          element={
            <ProtectedRoute>
              <GoogleCallbackPage />
            </ProtectedRoute>
          }
        />
        
        <Route 
          path="/select-environment" 
          element={
            <ProtectedRoute>
              <SelectionPage />
            </ProtectedRoute>
          } 
        />

        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <EnvironmentRoute>
                <DashboardLayout />
              </EnvironmentRoute>
            </ProtectedRoute>
          }
        >
          {/* Main workspace redirects to dash general or respective subviews */}
          <Route index element={<DashboardIndexRedirect />} />

          <Route path="admin/*" element={
            <Suspense fallback={<PageLoader />}>
              <AdminRouter />
            </Suspense>
          } />

          <Route path="financeiro/*" element={
            <Suspense fallback={<PageLoader />}>
              <FinanceiroWorkspace />
            </Suspense>
          } />

          <Route path="relatorios" element={
            <Suspense fallback={<PageLoader />}>
              <RelatoriosWorkspace />
            </Suspense>
          } />

          <Route path="indicadores/*" element={
            <Suspense fallback={<PageLoader />}>
              <IndicadoresWorkspace />
            </Suspense>
          } />

          <Route path="compras/*" element={
            <Suspense fallback={<PageLoader />}>
              <ComprasWorkspace />
            </Suspense>
          } />

          <Route path="rh/*" element={
            <Suspense fallback={<PageLoader />}>
              <RHWorkspace />
            </Suspense>
          } />

          <Route path="faturamento/*" element={
            <Suspense fallback={<PageLoader />}>
              <FaturamentoWorkspace />
            </Suspense>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
};

export default AppRoutes;
