import React, { useState } from 'react';
import QueryDataPanel from '../../../components/QueryDataPanel';
import { useAsyncQueryState } from '../../../hooks/useAsyncQueryState';
import { useEntregasUniforme, useUniformesEmPosse } from '../../../hooks/useUniformes';
import type { ColaboradorUniformes, EntregaUniforme } from '../../../types/domain';
import { formatCpf, formatDateBr } from './format';
import {
  BarraPaginacaoServidor, CondicaoBadge, EmptyRow, ModalUniformes, SecaoTitulo, StatusEntregaBadge,
} from './shared';
import { imprimirTermoUniforme } from './termoUniformePdf';

const ColaboradorUniformesModal: React.FC<{
  colaborador: ColaboradorUniformes;
  onClose: () => void;
  onNovaEntrega: (colaboradorId: string) => void;
  podeEntregar: boolean;
  podeDevolver: boolean;
  onDetalhe: (entrega: EntregaUniforme) => void;
  onDevolver: (entrega: EntregaUniforme) => void;
  onDevolucaoTotal: (colaboradorId: string) => void;
}> = ({ colaborador, onClose, onNovaEntrega, podeEntregar, podeDevolver, onDetalhe, onDevolver, onDevolucaoTotal }) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const emPosseQuery = useUniformesEmPosse(colaborador.colaboradorId);
  const entregasQuery = useEntregasUniforme({ page, pageSize, colaboradorId: colaborador.colaboradorId });
  const { canShowEmpty: podeVazioPosse } = useAsyncQueryState(emPosseQuery);
  const { canShowEmpty: podeVazioEntregas } = useAsyncQueryState(entregasQuery);
  const emPosse = emPosseQuery.data ?? [];
  const entregas = entregasQuery.data?.results ?? [];
  const totalEmPosse = emPosse.reduce((acc, i) => acc + i.pendente, 0);

  return (
    <ModalUniformes
      title={`Uniformes de ${colaborador.nome}`}
      width={1080}
      onClose={onClose}
      footerExtra={
        <>
          {podeEntregar && (
            <button
              type="button"
              className="reports-action-btn primary"
              onClick={() => onNovaEntrega(colaborador.colaboradorId)}
            >
              <i className="bi bi-box-arrow-right" /> Nova entrega para {colaborador.nome.split(' ')[0]}
            </button>
          )}
          {podeDevolver && totalEmPosse > 0 && (
            <button
              type="button"
              className="reports-action-btn secondary"
              style={{ marginRight: 'auto', color: '#c2410c' }}
              onClick={() => onDevolucaoTotal(colaborador.colaboradorId)}
            >
              <i className="bi bi-arrow-return-left" /> Devolução total
            </button>
          )}
          {totalEmPosse === 0 && <span style={{ marginRight: 'auto' }} />}
        </>
      }
    >
      <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap', fontSize: '13px', color: '#475569' }}>
        <span>CPF: <strong>{formatCpf(colaborador.cpf)}</strong></span>
        <span>Cargo: <strong>{colaborador.cargo || '—'}</strong></span>
        <span>Setor: <strong>{colaborador.setorNome || '—'}</strong></span>
      </div>

      <SecaoTitulo>Está com ele agora ({totalEmPosse} peça{totalEmPosse === 1 ? '' : 's'})</SecaoTitulo>
      <QueryDataPanel query={emPosseQuery} variant="compact" loadingMessage="Carregando..." refreshingMessage="Atualizando..." errorMessage="Não foi possível carregar.">
        <table className="reports-table">
          <thead>
            <tr>
              <th>Uniforme</th>
              <th>Condição</th>
              <th className="num" style={{ textAlign: 'right' }}>Quantidade</th>
              <th>Termo</th>
              <th>Entregue em</th>
            </tr>
          </thead>
          <tbody>
            {podeVazioPosse && emPosse.length === 0 ? (
              <EmptyRow colSpan={5}>Nenhum uniforme com este colaborador.</EmptyRow>
            ) : (
              emPosse.map((i) => (
                <tr key={i.id}>
                  <td style={{ fontWeight: 600 }}>{i.uniformeNome} — {i.uniformeTamanho}</td>
                  <td><CondicaoBadge condicao={i.condicao} /></td>
                  <td className="num" style={{ textAlign: 'right', fontWeight: 700 }}>{i.pendente}</td>
                  <td style={{ color: '#0f85c1', fontWeight: 600 }}>{i.entregaNumero}</td>
                  <td style={{ color: '#64748b' }}>{formatDateBr(i.dataEntrega)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </QueryDataPanel>

      <SecaoTitulo>Termos de entrega</SecaoTitulo>
      <QueryDataPanel query={entregasQuery} variant="compact" loadingMessage="Carregando..." refreshingMessage="Atualizando..." errorMessage="Não foi possível carregar.">
        <table className="reports-table">
          <thead>
            <tr>
              <th>Termo</th>
              <th>Data</th>
              <th>Itens</th>
              <th style={{ textAlign: 'center' }}>Situação</th>
              <th style={{ width: '200px' }} />
            </tr>
          </thead>
          <tbody>
            {podeVazioEntregas && entregas.length === 0 ? (
              <EmptyRow colSpan={5}>Nenhuma entrega registrada.</EmptyRow>
            ) : (
              entregas.map((e) => (
                <tr key={e.id}>
                  <td style={{ fontWeight: 700, color: '#0f85c1' }}>{e.numero}</td>
                  <td style={{ color: '#64748b' }}>{formatDateBr(e.dataEntrega)}</td>
                  <td style={{ color: '#475569', fontSize: '12px', whiteSpace: 'normal', overflowWrap: 'anywhere', minWidth: '220px' }}>
                    {e.itens.map((i) => `${i.quantidade}× ${i.uniformeNome} ${i.uniformeTamanho}`).join(', ')}
                  </td>
                  <td style={{ textAlign: 'center' }}><StatusEntregaBadge status={e.status} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                      {podeDevolver && e.totalPendente > 0 && (
                        <button type="button" className="btn-table-action" onClick={() => onDevolver(e)}>
                          <i className="bi bi-arrow-return-left" /> Devolução
                        </button>
                      )}
                      <button type="button" className="btn-icon" title="Reimprimir termo" onClick={() => void imprimirTermoUniforme(e)}>
                        <i className="bi bi-printer" />
                      </button>
                      <button type="button" className="btn-icon" title="Ver detalhes" onClick={() => onDetalhe(e)}>
                        <i className="bi bi-eye" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </QueryDataPanel>
      {(entregasQuery.data?.count ?? 0) > pageSize && (
        <BarraPaginacaoServidor
          id="uniformes-colaborador-termos-page-size"
          page={page}
          pageSize={pageSize}
          count={entregasQuery.data?.count ?? 0}
          onPage={setPage}
          onPageSize={setPageSize}
        />
      )}
    </ModalUniformes>
  );
};

export default ColaboradorUniformesModal;
