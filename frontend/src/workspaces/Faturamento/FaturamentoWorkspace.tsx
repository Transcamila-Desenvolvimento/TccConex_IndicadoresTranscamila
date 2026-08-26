import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import FaturamentoHome from './FaturamentoHome';
import FaturamentoProtocolos from './FaturamentoProtocolos';
import FaturamentoCadastroClientes from './FaturamentoCadastroClientes';

const FaturamentoWorkspace: React.FC = () => {
  return (
    <Routes>
      <Route index element={<FaturamentoHome />} />
      <Route path="protocolos" element={<FaturamentoProtocolos />} />
      <Route path="cadastros/clientes" element={<FaturamentoCadastroClientes />} />
      <Route path="*" element={<Navigate to="/faturamento" replace />} />
    </Routes>
  );
};

export default FaturamentoWorkspace;
