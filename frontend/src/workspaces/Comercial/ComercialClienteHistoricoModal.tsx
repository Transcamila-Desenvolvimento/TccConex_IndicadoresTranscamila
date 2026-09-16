import React from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useClienteComercialHistorico } from '../../hooks/useComercialClientes';
import type { ClienteComercial } from '../../types/domain';
import { PROPOSTA_COMERCIAL_TIPO_LABEL } from '../../types/domain';
import ComercialClienteSituacaoBadge from './ComercialClienteSituacaoBadge';

interface ComercialClienteHistoricoModalProps {
  cliente: ClienteComercial;
  onClose: () => void;
}

const formatDateTime = (value?: string | null) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDate = (value?: string | null) => {
  if (!value) return '—';
  const datePart = value.slice(0, 10);
  const [year, month, day] = datePart.split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

const formatMoney = (value?: string | null) => {
  if (value == null || value === '') return '—';
  const amount = Number(String(value).replace(',', '.'));
  if (Number.isNaN(amount)) return value;
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatPercent = (value: number | null | undefined) => {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 0 })}%`;
};

const ComercialClienteHistoricoModal: React.FC<ComercialClienteHistoricoModalProps> = ({
  cliente,
  onClose,
}) => {
  const historicoQuery = useClienteComercialHistorico(cliente.id);
  const historico = historicoQuery.data;
  const situacao = historico?.situacao || cliente.situacao;
  const indice = historico?.indiceAceitacao ?? null;
  const total = historico?.totalPropostas ?? 0;
  const aceitas = historico?.propostasAceitasCount ?? 0;
  const recusadas = historico?.propostasRecusadasCount ?? 0;

  return (
    <div
      className="search-backdrop"
      style={{ display: 'flex', alignItems: 'center', padding: '24px 16px', zIndex: 3100 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-card comercial-historico-modal" role="dialog" aria-modal="true" aria-labelledby="comercial-historico-title">
        <div className="modal-header">
          <div>
            <h3 id="comercial-historico-title">Histórico do cliente</h3>
            <p className="comercial-historico-subtitle">{cliente.razaoSocial}</p>
          </div>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Fechar">
            <i className="bi bi-x-lg" />
          </button>
        </div>
        <div className="modal-body">
          <QueryDataPanel
            className="comercial-historico-content"
            query={historicoQuery}
            variant="compact"
            refreshVariant="overlay"
            loadingMessage="Carregando histórico..."
            errorMessage="Não foi possível carregar o histórico."
          >
            <dl className="comercial-historico-meta">
              <div>
                <dt>Situação</dt>
                <dd>
                  <ComercialClienteSituacaoBadge situacao={situacao} />
                </dd>
              </div>
              <div>
                <dt>Cliente desde</dt>
                <dd>{historico?.clienteDesde ? formatDate(historico.clienteDesde) : 'Potencial'}</dd>
              </div>
              <div>
                <dt>Aceitas</dt>
                <dd>{aceitas}</dd>
              </div>
              <div>
                <dt>Recusadas</dt>
                <dd>{recusadas}</dd>
              </div>
              <div>
                <dt>Aceitação</dt>
                <dd>
                  {formatPercent(indice)}
                  {total > 0 ? <small> de {total}</small> : null}
                </dd>
              </div>
            </dl>
            <h4 className="comercial-historico-section">Propostas aceitas</h4>
            {(historico?.propostasAceitas.length ?? 0) === 0 ? (
              <p className="comercial-historico-empty">Nenhuma proposta aceita para este cliente.</p>
            ) : (
              <div className="table-container comercial-historico-table">
                <table className="erp-table reports-table">
                  <thead>
                    <tr>
                      <th>Nº</th>
                      <th>Serviço</th>
                      <th>Emissão</th>
                      <th>Vigência do contrato</th>
                      <th>Valor</th>
                      <th>Aceita em</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historico?.propostasAceitas.map((proposta) => (
                      <tr key={proposta.id}>
                        <td>{proposta.numeroIdentificacao || '—'}</td>
                        <td>{PROPOSTA_COMERCIAL_TIPO_LABEL[proposta.tipo]}</td>
                        <td>{formatDate(proposta.dataProposta)}</td>
                        <td>{proposta.vigencia || '—'}</td>
                        <td>{formatMoney(proposta.valorEstimado)}</td>
                        <td>{formatDateTime(proposta.dataAtualizacao)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </QueryDataPanel>
        </div>
      </div>
    </div>
  );
};

export default ComercialClienteHistoricoModal;
