import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getAllowedIndicadores } from '../../constants/indicadores';
import IndicadoresHome from './IndicadoresHome';
import IndicadoresFluxoCaixa from './IndicadoresFluxoCaixa';
import IndicadoresMetaFaturamento from './IndicadoresMetaFaturamento';

const IndicadoresWorkspace: React.FC = () => {
  const { user } = useAuth();
  const allowed = getAllowedIndicadores(user);

  return (
    <Routes>
      <Route index element={<IndicadoresHome />} />
      <Route
        path="fluxo-de-caixa"
        element={allowed.has('fluxo-caixa') ? <IndicadoresFluxoCaixa /> : <Navigate to="" replace />}
      />
      <Route
        path="logistica/meta-faturamento"
        element={allowed.has('meta-faturamento') ? <IndicadoresMetaFaturamento /> : <Navigate to="" replace />}
      />
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  );
};

export default IndicadoresWorkspace;
