import React from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { abasDoModulo, firstAllowedAbaPath } from '../../constants/abas';
import AbaRoute from '../../components/AbaRoute';
import SGQHome from './SGQHome';
import SGQMatriz from './SGQMatriz';
import SGQEcossistema from './SGQEcossistema';
import SGQPesquisaSatisfacao from './SGQPesquisaSatisfacao';
import SGQAuditoriasVisaoGeral from './SGQAuditoriasVisaoGeral';
import SGQAuditorias from './SGQAuditorias';
import SGQQuestionarios from './SGQQuestionarios';
import SGQAuditoriaExecucao from './SGQAuditoriaExecucao';
import SGQAuditoriasNormas from './SGQAuditoriasNormas';
import SGQAuditoriasNormaItens from './SGQAuditoriasNormaItens';
import SGQAuditoriasCategorias from './SGQAuditoriasCategorias';
import SGQAuditoriasTiposResposta from './SGQAuditoriasTiposResposta';
import SGQSipoc from './SGQSipoc';
import SGQSipocProcedimento from './SGQSipocProcedimento';

const ABAS_AUDITORIAS_PRONTAS = new Set([
  'auditorias-visao-geral', 'auditorias-normas', 'auditorias-categorias', 'auditorias-tipos-resposta',
  'auditorias-minhas-acoes',
]);

const RedirecionaQuestionario: React.FC = () => {
  const { auditoriaId } = useParams();
  return <Navigate to={`/sgq/auditorias/minhas-acoes/${auditoriaId ?? ''}`} replace />;
};

const SGQWorkspace: React.FC = () => {
  const { user } = useAuth();
  const fallback = firstAllowedAbaPath(user, 'SGQ', '/sgq');

  return (
    <Routes>
      <Route index element={<AbaRoute module="SGQ" aba="home" fallback={fallback}><SGQHome /></AbaRoute>} />
      <Route path="pesquisa-satisfacao" element={<AbaRoute module="SGQ" aba="pesquisa-satisfacao" fallback={fallback}><SGQPesquisaSatisfacao /></AbaRoute>} />
      <Route path="sipoc" element={<AbaRoute module="SGQ" aba="sipoc" fallback={fallback}><SGQSipoc /></AbaRoute>} />
      <Route path="sipoc/:procedimentoId" element={<AbaRoute module="SGQ" aba="sipoc" fallback={fallback}><SGQSipocProcedimento /></AbaRoute>} />
      <Route path="matriz" element={<Navigate to="documentos" replace />} />
      <Route path="matriz/documentos" element={<AbaRoute module="SGQ" aba="matriz" fallback={fallback}><SGQMatriz /></AbaRoute>} />
      <Route path="matriz/ecossistema" element={<AbaRoute module="SGQ" aba="matriz-ecossistema" fallback={fallback}><SGQEcossistema /></AbaRoute>} />
      <Route path="auditorias/visao-geral" element={<AbaRoute module="SGQ" aba="auditorias-visao-geral" fallback={fallback}><SGQAuditoriasVisaoGeral /></AbaRoute>} />
      <Route path="auditorias/auditorias" element={<AbaRoute module="SGQ" aba="auditorias" fallback={fallback}><SGQAuditorias /></AbaRoute>} />
      <Route path="auditorias/auditorias/:auditoriaId" element={<RedirecionaQuestionario />} />
      <Route path="auditorias/minhas-acoes" element={<AbaRoute module="SGQ" aba="auditorias-minhas-acoes" fallback={fallback}><SGQQuestionarios /></AbaRoute>} />
      <Route path="auditorias/minhas-acoes/:auditoriaId" element={<AbaRoute module="SGQ" aba="auditorias-minhas-acoes" fallback={fallback}><SGQAuditoriaExecucao /></AbaRoute>} />
      <Route path="auditorias/normas" element={<AbaRoute module="SGQ" aba="auditorias-normas" fallback={fallback}><SGQAuditoriasNormas /></AbaRoute>} />
      <Route path="auditorias/normas/:normaId" element={<AbaRoute module="SGQ" aba="auditorias-normas" fallback={fallback}><SGQAuditoriasNormaItens /></AbaRoute>} />
      <Route path="auditorias/categorias" element={<AbaRoute module="SGQ" aba="auditorias-categorias" fallback={fallback}><SGQAuditoriasCategorias /></AbaRoute>} />
      <Route path="auditorias/tipos-resposta" element={<AbaRoute module="SGQ" aba="auditorias-tipos-resposta" fallback={fallback}><SGQAuditoriasTiposResposta /></AbaRoute>} />
      {abasDoModulo('SGQ').filter((item) => item.key.startsWith('auditorias-') && !ABAS_AUDITORIAS_PRONTAS.has(item.key)).map((item) => (
        <Route
          key={item.key}
          path={item.path.replace('/sgq/', '')}
          element={(
            <AbaRoute module="SGQ" aba={item.key} fallback={fallback}>
              <section className="view active" style={{ display: 'block', padding: '4px' }}>
                <h1 className="view-page-title">{item.label}</h1>
              </section>
            </AbaRoute>
          )}
        />
      ))}
      <Route path="*" element={<Navigate to={fallback} replace />} />
    </Routes>
  );
};

export default SGQWorkspace;
