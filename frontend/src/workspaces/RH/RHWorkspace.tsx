import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import RHHome from './RHHome';
import RHMovimentacoes from './RHMovimentacoes';

const RHWorkspace: React.FC = () => {
  return (
    <Routes>
      <Route index element={<RHHome />} />
      <Route path="movimentacoes" element={<RHMovimentacoes />} />
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  );
};

export default RHWorkspace;
