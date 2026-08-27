import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { firstAllowedAbaPath } from '../../constants/abas';
import AbaRoute from '../../components/AbaRoute';
import FaturamentoHome from './FaturamentoHome';
import FaturamentoProtocolos from './FaturamentoProtocolos';
import FaturamentoCadastroClientes from './FaturamentoCadastroClientes';

const FaturamentoWorkspace: React.FC = () => {
  const { user } = useAuth();
  const fallback = firstAllowedAbaPath(user, 'Faturamento', '/faturamento');

  return (
    <Routes>
      <Route index element={<AbaRoute module="Faturamento" aba="home" fallback={fallback}><FaturamentoHome /></AbaRoute>} />
      <Route path="protocolos" element={<AbaRoute module="Faturamento" aba="envio-nf-cliente" fallback={fallback}><FaturamentoProtocolos /></AbaRoute>} />
      <Route path="cadastros/clientes" element={<AbaRoute module="Faturamento" aba="cadastro-clientes" fallback={fallback}><FaturamentoCadastroClientes /></AbaRoute>} />
      <Route path="*" element={<Navigate to={fallback} replace />} />
    </Routes>
  );
};

export default FaturamentoWorkspace;
