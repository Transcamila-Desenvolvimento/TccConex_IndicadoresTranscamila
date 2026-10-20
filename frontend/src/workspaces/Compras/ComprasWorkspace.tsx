import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { firstAllowedAbaPath } from '../../constants/abas';
import AbaRoute from '../../components/AbaRoute';
import ComprasHome from './ComprasHome';
import ComprasControleEstoque from './ComprasControleEstoque';
import {
  ComprasCadastroConsumidores,
  ComprasCadastroMedidas,
  ComprasCadastroFornecedores,
} from './ComprasCadastros';

const ComprasWorkspace: React.FC = () => {
  const { user } = useAuth();
  const fallback = firstAllowedAbaPath(user, 'Compras', '/compras');

  return (
    <Routes>
      <Route index element={<AbaRoute module="Compras" aba="home" fallback={fallback}><ComprasHome /></AbaRoute>} />
      <Route path="controle-estoque" element={<AbaRoute module="Compras" aba="controle-estoque" fallback={fallback}><ComprasControleEstoque /></AbaRoute>} />
      <Route path="cadastros/consumidores" element={<AbaRoute module="Compras" aba="cadastro-consumidores" fallback={fallback}><ComprasCadastroConsumidores /></AbaRoute>} />
      <Route path="cadastros/medidas" element={<AbaRoute module="Compras" aba="cadastro-medidas" fallback={fallback}><ComprasCadastroMedidas /></AbaRoute>} />
      <Route path="cadastros/fornecedores" element={<AbaRoute module="Compras" aba="cadastro-fornecedores" fallback={fallback}><ComprasCadastroFornecedores /></AbaRoute>} />
      <Route path="*" element={<Navigate to={fallback} replace />} />
    </Routes>
  );
};

export default ComprasWorkspace;
