import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { firstAllowedAbaPath } from '../../constants/abas';
import AbaRoute from '../../components/AbaRoute';
import FrotaDesempenhoCriterios from './FrotaDesempenhoCriterios';
import FrotaDesempenhoOcorrencias from './FrotaDesempenhoOcorrencias';
import FrotaDesempenhoParametros from './FrotaDesempenhoParametros';
import FrotaHome from './FrotaHome';
import FrotaMotoristasUsuarios from './FrotaMotoristasUsuarios';
import FrotaOlhoVivo from './FrotaOlhoVivo';

const FrotaWorkspace: React.FC = () => {
  const { user } = useAuth();
  const fallback = firstAllowedAbaPath(user, 'Frota', '/frota');

  return (
    <Routes>
      <Route index element={<AbaRoute module="Frota" aba="home" fallback={fallback}><FrotaHome /></AbaRoute>} />
      <Route path="questionarios/olho-vivo" element={<AbaRoute module="Frota" aba="olho-vivo" fallback={fallback}><FrotaOlhoVivo /></AbaRoute>} />
      <Route path="tccconex-motoristas/usuarios" element={<AbaRoute module="Frota" aba="tccconex-motoristas-usuarios" fallback={fallback}><FrotaMotoristasUsuarios /></AbaRoute>} />
      <Route path="gestao-desempenho/ocorrencias" element={<AbaRoute module="Frota" aba="gestao-desempenho-ocorrencias" fallback={fallback}><FrotaDesempenhoOcorrencias /></AbaRoute>} />
      <Route path="gestao-desempenho/criterios" element={<AbaRoute module="Frota" aba="gestao-desempenho-criterios" fallback={fallback}><FrotaDesempenhoCriterios /></AbaRoute>} />
      <Route path="gestao-desempenho/parametros" element={<AbaRoute module="Frota" aba="gestao-desempenho-parametros" fallback={fallback}><FrotaDesempenhoParametros /></AbaRoute>} />
      <Route path="*" element={<Navigate to={fallback} replace />} />
    </Routes>
  );
};

export default FrotaWorkspace;
