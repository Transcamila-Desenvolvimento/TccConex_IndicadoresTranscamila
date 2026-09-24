import React, { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { firstAllowedAbaPath } from '../../constants/abas';
import AbaRoute from '../../components/AbaRoute';
import PageLoader from '../../components/PageLoader';
import ComercialHome from './ComercialHome';
import ComercialCadastroClientes from './ComercialCadastroClientes';
import ComercialCadastroGeneralidades from './ComercialCadastroGeneralidades';
import ComercialCadastroIcmsUfs from './ComercialCadastroIcmsUfs';
import ComercialCadastroParametros from './ComercialCadastroParametros';
import ComercialCadastroProdutos from './ComercialCadastroProdutos';
import ComercialPropostas from './ComercialPropostas';
import ComercialValidacaoClientes from './ComercialValidacaoClientes';

const ComercialCadastroTabelaFrete = React.lazy(() => import('./ComercialCadastroTabelaFrete'));

const ComercialWorkspace: React.FC = () => {
  const { user } = useAuth();
  const fallback = firstAllowedAbaPath(user, 'Comercial', '/comercial');

  return (
    <Routes>
      <Route index element={<AbaRoute module="Comercial" aba="home" fallback={fallback}><ComercialHome /></AbaRoute>} />
      <Route path="cadastros/clientes" element={<AbaRoute module="Comercial" aba="cadastro-clientes" fallback={fallback}><ComercialCadastroClientes /></AbaRoute>} />
      <Route path="cadastros/tabela-frete" element={<AbaRoute module="Comercial" aba="cadastro-tabela-frete" fallback={fallback}><Suspense fallback={<PageLoader />}><ComercialCadastroTabelaFrete /></Suspense></AbaRoute>} />
      <Route path="cadastros/generalidades" element={<AbaRoute module="Comercial" aba="cadastro-generalidades" fallback={fallback}><ComercialCadastroGeneralidades /></AbaRoute>} />
      <Route path="cadastros/icms-ufs" element={<AbaRoute module="Comercial" aba="cadastro-icms-ufs" fallback={fallback}><ComercialCadastroIcmsUfs /></AbaRoute>} />
      <Route path="cadastros/produtos" element={<AbaRoute module="Comercial" aba="cadastro-produtos" fallback={fallback}><ComercialCadastroProdutos /></AbaRoute>} />
      <Route path="propostas" element={<AbaRoute module="Comercial" aba="propostas-comerciais" fallback={fallback}><ComercialPropostas /></AbaRoute>} />
      <Route path="validacao-clientes" element={<AbaRoute module="Comercial" aba="validacao-clientes" fallback={fallback}><ComercialValidacaoClientes /></AbaRoute>} />
      <Route path="parametros" element={<AbaRoute module="Comercial" aba="cadastro-parametros" fallback={fallback}><ComercialCadastroParametros /></AbaRoute>} />
      <Route path="cadastros/parametros" element={<Navigate to="/comercial/parametros" replace />} />
      <Route path="*" element={<Navigate to={fallback} replace />} />
    </Routes>
  );
};

export default ComercialWorkspace;
