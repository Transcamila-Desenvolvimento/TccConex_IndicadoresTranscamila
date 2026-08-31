import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { firstAllowedAbaPath } from '../../constants/abas';
import AbaRoute from '../../components/AbaRoute';
import FrotaHome from './FrotaHome';
import FrotaCadastroVeiculos from './FrotaCadastroVeiculos';
import FrotaCadastroCondutores from './FrotaCadastroCondutores';
import FrotaCustos from './FrotaCustos';

const FrotaWorkspace: React.FC = () => {
  const { user } = useAuth();
  const fallback = firstAllowedAbaPath(user, 'Frota', '/frota');

  return (
    <Routes>
      <Route index element={<AbaRoute module="Frota" aba="home" fallback={fallback}><FrotaHome /></AbaRoute>} />
      <Route path="custos" element={<AbaRoute module="Frota" aba="custos-frota" fallback={fallback}><FrotaCustos /></AbaRoute>} />
      <Route path="cadastros/condutores" element={<AbaRoute module="Frota" aba="cadastro-condutores" fallback={fallback}><FrotaCadastroCondutores /></AbaRoute>} />
      <Route path="cadastros/veiculos" element={<AbaRoute module="Frota" aba="cadastro-veiculos" fallback={fallback}><FrotaCadastroVeiculos /></AbaRoute>} />
      <Route path="*" element={<Navigate to={fallback} replace />} />
    </Routes>
  );
};

export default FrotaWorkspace;
