import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { firstAllowedAbaPath } from '../../constants/abas';
import AbaRoute from '../../components/AbaRoute';
import LogisticaHome from './LogisticaHome';
import LogisticaConfiguracoes from './LogisticaConfiguracoes';

const LogisticaWorkspace: React.FC = () => {
  const { user } = useAuth();
  const fallback = firstAllowedAbaPath(user, 'Logística', '/logistica');

  return (
    <Routes>
      <Route index element={<AbaRoute module="Logística" aba="home" fallback={fallback}><LogisticaHome /></AbaRoute>} />
      <Route path="configuracoes" element={<AbaRoute module="Logística" aba="configuracoes" fallback={fallback}><LogisticaConfiguracoes /></AbaRoute>} />
      <Route path="*" element={<Navigate to={fallback} replace />} />
    </Routes>
  );
};

export default LogisticaWorkspace;
