import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { firstAllowedAbaPath } from '../../constants/abas';
import AbaRoute from '../../components/AbaRoute';
import SuprimentosHome from './SuprimentosHome';
import ComprasControleEstoque from '../Compras/ComprasControleEstoque';
import ComprasControleUniformes from '../Compras/ComprasControleUniformes';
import {
  ComprasCadastroConsumidores,
  ComprasCadastroMedidas,
  ComprasCadastroFornecedores,
} from '../Compras/ComprasCadastros';

const SuprimentosWorkspace: React.FC = () => {
  const { user } = useAuth();
  const fallback = firstAllowedAbaPath(user, 'Suprimentos', '/suprimentos');

  return (
    <Routes>
      <Route index element={<AbaRoute module="Suprimentos" aba="home" fallback={fallback}><SuprimentosHome /></AbaRoute>} />
      <Route path="controle-estoque" element={<AbaRoute module="Suprimentos" aba="controle-estoque" fallback={fallback}><ComprasControleEstoque /></AbaRoute>} />
      <Route path="controle-uniformes" element={<AbaRoute module="Suprimentos" aba="controle-uniformes" fallback={fallback}><ComprasControleUniformes /></AbaRoute>} />
      <Route path="cadastros/consumidores" element={<AbaRoute module="Suprimentos" aba="cadastro-consumidores" fallback={fallback}><ComprasCadastroConsumidores /></AbaRoute>} />
      <Route path="cadastros/medidas" element={<AbaRoute module="Suprimentos" aba="cadastro-medidas" fallback={fallback}><ComprasCadastroMedidas /></AbaRoute>} />
      <Route path="cadastros/fornecedores" element={<AbaRoute module="Suprimentos" aba="cadastro-fornecedores" fallback={fallback}><ComprasCadastroFornecedores /></AbaRoute>} />
      <Route path="*" element={<Navigate to={fallback} replace />} />
    </Routes>
  );
};

export default SuprimentosWorkspace;
