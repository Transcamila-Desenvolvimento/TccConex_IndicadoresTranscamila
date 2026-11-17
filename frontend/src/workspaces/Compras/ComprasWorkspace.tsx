import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { firstAllowedAbaPath } from '../../constants/abas';
import AbaRoute from '../../components/AbaRoute';
import ComprasHome from './ComprasHome';

const ComprasWorkspace: React.FC = () => {
  const { user } = useAuth();
  const fallback = firstAllowedAbaPath(user, 'Compras', '/compras');

  return (
    <Routes>
      <Route index element={<AbaRoute module="Compras" aba="home" fallback={fallback}><ComprasHome /></AbaRoute>} />
      <Route path="controle-estoque" element={<Navigate to="/suprimentos/controle-estoque" replace />} />
      <Route path="controle-uniformes" element={<Navigate to="/suprimentos/controle-uniformes" replace />} />
      <Route path="cadastros/consumidores" element={<Navigate to="/suprimentos/cadastros/consumidores" replace />} />
      <Route path="cadastros/medidas" element={<Navigate to="/suprimentos/cadastros/medidas" replace />} />
      <Route path="cadastros/fornecedores" element={<Navigate to="/suprimentos/cadastros/fornecedores" replace />} />
      <Route path="*" element={<Navigate to={fallback} replace />} />
    </Routes>
  );
};

export default ComprasWorkspace;
