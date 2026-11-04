import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { firstAllowedAbaPath } from '../../constants/abas';
import AbaRoute from '../../components/AbaRoute';
import FrotaHome from './FrotaHome';
import FrotaOlhoVivo from './FrotaOlhoVivo';

const FrotaWorkspace: React.FC = () => {
  const { user } = useAuth();
  const fallback = firstAllowedAbaPath(user, 'Frota', '/frota');

  return (
    <Routes>
      <Route index element={<AbaRoute module="Frota" aba="home" fallback={fallback}><FrotaHome /></AbaRoute>} />
      <Route path="questionarios/olho-vivo" element={<AbaRoute module="Frota" aba="olho-vivo" fallback={fallback}><FrotaOlhoVivo /></AbaRoute>} />
      <Route path="*" element={<Navigate to={fallback} replace />} />
    </Routes>
  );
};

export default FrotaWorkspace;
