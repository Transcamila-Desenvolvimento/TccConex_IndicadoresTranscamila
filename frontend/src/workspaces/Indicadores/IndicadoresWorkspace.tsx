import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import IndicadoresHome from './IndicadoresHome';
import IndicadoresFluxoCaixa from './IndicadoresFluxoCaixa';
import IndicadoresMetaFaturamento from './IndicadoresMetaFaturamento';

const IndicadoresWorkspace: React.FC = () => {
  return (
    <Routes>
      <Route index element={<IndicadoresHome />} />
      <Route path="fluxo-de-caixa" element={<IndicadoresFluxoCaixa />} />
      <Route path="logistica/meta-faturamento" element={<IndicadoresMetaFaturamento />} />
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  );
};

export default IndicadoresWorkspace;
