import React from 'react';
import type { CondicaoUniforme, StatusEntregaUniforme, TipoMovimentacaoUniforme } from '../../../types/domain';
import { CONDICAO_LABEL, PAGE_SIZE_OPTIONS } from './format';

const Badge: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
  <span
    style={{
      display: 'inline-block', padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600,
      color, background: `${color}14`, whiteSpace: 'nowrap',
    }}
  >
    {children}
  </span>
);

const AZUL = '#0f85c1';
const VERDE = '#10b981';

export const CondicaoBadge: React.FC<{ condicao: CondicaoUniforme }> = ({ condicao }) => (
  <Badge color={condicao === 'novo' ? VERDE : AZUL}>{CONDICAO_LABEL[condicao]}</Badge>
);

const STATUS_ENTREGA: Record<StatusEntregaUniforme, [string, string]> = {
  em_posse: ['Em posse', AZUL],
  parcial: ['Devolução parcial', AZUL],
  encerrada: ['Encerrada', VERDE],
};

export const StatusEntregaBadge: React.FC<{ status: StatusEntregaUniforme }> = ({ status }) => (
  <Badge color={STATUS_ENTREGA[status][1]}>{STATUS_ENTREGA[status][0]}</Badge>
);

const TIPO_COR: Record<TipoMovimentacaoUniforme, string> = {
  entrada: VERDE,
  devolucao: VERDE,
  ajuste: AZUL,
  entrega: AZUL,
  descarte: AZUL,
  perda: AZUL,
};

export const TipoMovimentacaoBadge: React.FC<{ tipo: TipoMovimentacaoUniforme; label: string }> = ({ tipo, label }) => (
  <Badge color={TIPO_COR[tipo]}>{label}</Badge>
);

export const EstoqueStatusBadge: React.FC<{ disponivel: number; minimo: number }> = ({ disponivel, minimo }) => {
  if (disponivel === 0) return <Badge color="#ef4444">Esgotado</Badge>;
  if (minimo > 0 && disponivel < minimo) return <Badge color="#f59e0b">Estoque baixo</Badge>;
  return <Badge color={VERDE}>Disponível</Badge>;
};

export const Busca: React.FC<{ value: string; placeholder: string; onChange: (value: string) => void }> = ({
  value, placeholder, onChange,
}) => (
  <div className="reports-search-wrapper" style={{ minWidth: '240px' }}>
    <i className="bi bi-search search-icon" aria-hidden="true" />
    <input type="text" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

export const ModalUniformes: React.FC<{
  title: string;
  width?: number;
  submitLabel?: string;
  submitColor?: string;
  isPending?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit?: () => void;
  footerExtra?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, width = 560, submitLabel, submitColor, isPending, error, onClose, onSubmit, footerExtra, children }) => (
  <div
    className="search-backdrop"
    style={{ display: 'flex', alignItems: 'flex-start', padding: '16px', zIndex: 3000, overflowY: 'auto' }}
    onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
  >
    <div
      className="modal-card uniformes-modal"
      style={{ width: `min(${width}px, 100%)`, margin: 'auto 0' }}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-header">
        <h3>{title}</h3>
        <button type="button" className="btn-icon" onClick={onClose} aria-label="Fechar">
          <i className="bi bi-x-lg" />
        </button>
      </div>
      <form className="modal-body" onSubmit={(e) => { e.preventDefault(); onSubmit?.(); }}>
        {children}
        {error && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '12px' }}>{error}</div>}
        <div className="modal-footer" style={{ marginTop: '20px' }}>
          {footerExtra}
          <button type="button" className="reports-action-btn secondary" onClick={onClose}>
            {onSubmit ? 'Cancelar' : 'Fechar'}
          </button>
          {onSubmit && submitLabel && (
            <button
              type="submit"
              className="reports-action-btn primary"
              style={submitColor ? { backgroundColor: submitColor, borderColor: submitColor } : undefined}
              disabled={isPending}
            >
              {isPending ? 'Salvando...' : submitLabel}
            </button>
          )}
        </div>
      </form>
    </div>
  </div>
);

export const SecaoTitulo: React.FC<{ children: React.ReactNode; acao?: React.ReactNode }> = ({ children, acao }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 0 8px' }}>
    <span style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
      {children}
    </span>
    {acao}
  </div>
);

export function Segmentado<T extends string>({ opcoes, value, onChange }: {
  opcoes: { value: T; label: string; descricao?: string; icone?: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${opcoes.length}, 1fr)`, gap: '8px' }}>
      {opcoes.map((o) => {
        const ativo = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              textAlign: 'left', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
              border: `1.5px solid ${ativo ? '#0f85c1' : '#e2e8f0'}`, background: ativo ? '#f0f9ff' : '#ffffff',
            }}
          >
            <div style={{ fontWeight: 600, fontSize: '13px', color: ativo ? '#0f85c1' : '#1e293b' }}>
              {o.icone && <i className={`bi ${o.icone}`} style={{ marginRight: '6px' }} />}
              {o.label}
            </div>
            {o.descricao && <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{o.descricao}</div>}
          </button>
        );
      })}
    </div>
  );
}

export const Dica: React.FC<{ children: React.ReactNode; cor?: 'info' | 'alerta' }> = ({ children, cor = 'info' }) => (
  <div
    style={{
      fontSize: '12px', borderRadius: '8px', padding: '10px 12px', marginTop: '12px',
      background: cor === 'info' ? '#f8fafc' : '#fffbeb',
      color: cor === 'info' ? '#475569' : '#92400e',
      border: `1px solid ${cor === 'info' ? '#e2e8f0' : '#fde68a'}`,
    }}
  >
    {children}
  </div>
);

export const EmptyRow: React.FC<{ colSpan: number; children: React.ReactNode }> = ({ colSpan, children }) => (
  <tr>
    <td colSpan={colSpan} style={{ padding: '32px 14px', textAlign: 'center', color: '#94a3b8', background: '#ffffff' }}>
      {children}
    </td>
  </tr>
);

export const BarraPaginacaoServidor: React.FC<{
  id: string;
  page: number;
  pageSize: number;
  count: number;
  onPage: (page: number) => void;
  onPageSize: (pageSize: number) => void;
}> = ({ id, page, pageSize, count, onPage, onPageSize }) => {
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const navBtn = (disabled: boolean): React.CSSProperties => ({
    height: '32px', fontSize: '12px', opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer',
  });
  return (
    <div className="erp-pagination-bar">
      <div className="erp-pagination-page-size">
        <label htmlFor={id}>Itens por página</label>
        <select id={id} value={pageSize} onChange={(e) => { onPageSize(Number(e.target.value)); onPage(1); }}>
          {PAGE_SIZE_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>
      <span style={{ fontWeight: 500, marginRight: '4px' }}>
        Página <span className="erp-pagination-current">{page}</span> de{' '}
        <span className="erp-pagination-current">{totalPages}</span>
        <span className="erp-pagination-meta">({count} registros)</span>
      </span>
      <button type="button" className="reports-action-btn secondary" title="Primeira página" aria-label="Primeira página" disabled={page <= 1} onClick={() => onPage(1)} style={{ ...navBtn(page <= 1), width: '32px', padding: 0 }}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M18.75 4.5l-7.5 7.5 7.5 7.5M11.25 4.5l-7.5 7.5 7.5 7.5" /></svg>
      </button>
      <button type="button" className="reports-action-btn secondary" disabled={page <= 1} onClick={() => onPage(page - 1)} style={{ ...navBtn(page <= 1), padding: '0 12px', gap: '6px' }}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
        Anterior
      </button>
      <button type="button" className="reports-action-btn secondary" disabled={page >= totalPages} onClick={() => onPage(page + 1)} style={{ ...navBtn(page >= totalPages), padding: '0 12px', gap: '6px' }}>
        Próximo
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
      </button>
      <button type="button" className="reports-action-btn secondary" title="Última página" aria-label="Última página" disabled={page >= totalPages} onClick={() => onPage(totalPages)} style={{ ...navBtn(page >= totalPages), width: '32px', padding: 0 }}>
        <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 4.5l7.5 7.5-7.5 7.5M12.75 4.5l7.5 7.5-7.5 7.5" /></svg>
      </button>
    </div>
  );
};
