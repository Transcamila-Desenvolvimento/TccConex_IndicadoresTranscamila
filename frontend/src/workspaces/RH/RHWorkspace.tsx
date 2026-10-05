import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { firstAllowedAbaPath } from '../../constants/abas';
import AbaRoute from '../../components/AbaRoute';
import RHHome from './RHHome';
import RHMovimentacoes from './RHMovimentacoes';
import RHDocumentos from './RHDocumentos';

const RHWorkspace: React.FC = () => {
  const { user } = useAuth();
  const fallback = firstAllowedAbaPath(user, 'RH', '/rh');

  return (
    <Routes>
      <Route index element={<AbaRoute module="RH" aba="home" fallback={fallback}><RHHome /></AbaRoute>} />
      <Route path="movimentacoes" element={<AbaRoute module="RH" aba="movimentacoes" fallback={fallback}><RHMovimentacoes /></AbaRoute>} />
      <Route path="documentos" element={<AbaRoute module="RH" aba="documentos" fallback={fallback}><RHDocumentos /></AbaRoute>} />
      <Route path="*" element={<Navigate to={fallback} replace />} />
    </Routes>
  );
};

export default RHWorkspace;
