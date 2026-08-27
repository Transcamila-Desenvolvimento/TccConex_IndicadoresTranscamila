import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { firstAllowedAbaPath } from '../../constants/abas';
import AbaRoute from '../../components/AbaRoute';
import ComprasHome from './ComprasHome';
import ComprasControleEstoque from './ComprasControleEstoque';

const ComprasWorkspace: React.FC = () => {
  const { user } = useAuth();
  const fallback = firstAllowedAbaPath(user, 'Compras', '/compras');

  return (
    <Routes>
      <Route index element={<AbaRoute module="Compras" aba="home" fallback={fallback}><ComprasHome /></AbaRoute>} />
      <Route path="controle-estoque" element={<AbaRoute module="Compras" aba="controle-estoque" fallback={fallback}><ComprasControleEstoque /></AbaRoute>} />
      <Route path="*" element={<Navigate to={fallback} replace />} />
    </Routes>
  );
};

export default ComprasWorkspace;
