import React from 'react';
import type { EntregaUniforme } from '../../../types/domain';
import { formatCpf, formatDateBr, formatDateTimeBr } from './format';
import { CondicaoBadge, ModalUniformes, SecaoTitulo, StatusEntregaBadge } from './shared';
import { baixarTermoUniforme, imprimirTermoUniforme } from './termoUniformePdf';

const Campo: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: '13px', color: '#1e293b', marginTop: '2px' }}>{children}</div>
  </div>
);

const EntregaDetalheModal: React.FC<{
  entrega: EntregaUniforme;
  onClose: () => void;
  onDevolver: (entrega: EntregaUniforme) => void;
}> = ({ entrega, onClose, onDevolver }) => (
  <ModalUniformes
    title={`Termo ${entrega.numero}`}
    width={860}
    onClose={onClose}
    footerExtra={
      <>
        {entrega.totalPendente > 0 && (
          <button type="button" className="reports-action-btn secondary" onClick={() => onDevolver(entrega)}>
            <i className="bi bi-arrow-return-left" /> Registrar devolução
          </button>
        )}
        <button type="button" className="reports-action-btn secondary" onClick={() => void baixarTermoUniforme(entrega)}>
          <i className="bi bi-download" /> Baixar PDF
        </button>
        <button type="button" className="reports-action-btn primary" onClick={() => void imprimirTermoUniforme(entrega)}>
          <i className="bi bi-printer" /> Reimprimir termo
        </button>
      </>
    }
  >
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px 16px' }}>
      <Campo label="Colaborador"><strong>{entrega.colaboradorNome}</strong></Campo>
      <Campo label="CPF">{formatCpf(entrega.colaboradorCpf)}</Campo>
      <Campo label="Cargo / setor">{[entrega.colaboradorCargo, entrega.colaboradorSetor].filter(Boolean).join(' · ') || '—'}</Campo>
      <Campo label="Situação"><StatusEntregaBadge status={entrega.status} /></Campo>
      <Campo label="Data da entrega">{formatDateBr(entrega.dataEntrega)}</Campo>
      <Campo label="Registrado por">{entrega.usuarioNome || '—'}</Campo>
      <Campo label="Registrado em">{formatDateTimeBr(entrega.criadoEm)}</Campo>
      <Campo label="Peças pendentes">{entrega.totalPendente} de {entrega.totalEntregue}</Campo>
    </div>
    {entrega.observacoes && (
      <p style={{ fontSize: '13px', color: '#475569', margin: '12px 0 0' }}><strong>Observações:</strong> {entrega.observacoes}</p>
    )}

    <SecaoTitulo>Itens</SecaoTitulo>
    <table className="reports-table">
      <thead>
        <tr>
          <th>Uniforme</th>
          <th>Condição</th>
          <th className="num" style={{ textAlign: 'right' }}>Entregue</th>
          <th className="num" style={{ textAlign: 'right' }}>Devolvida (usada)</th>
          <th className="num" style={{ textAlign: 'right' }}>Descartada</th>
          <th className="num" style={{ textAlign: 'right' }}>Perdida</th>
          <th className="num" style={{ textAlign: 'right' }}>Pendente</th>
        </tr>
      </thead>
      <tbody>
        {entrega.itens.map((item) => (
          <tr key={item.id}>
            <td style={{ fontWeight: 600 }}>
              {item.uniformeNome} — {item.uniformeTamanho}
              {item.uniformeCodigo && <span style={{ color: '#94a3b8', fontWeight: 400 }}> ({item.uniformeCodigo})</span>}
            </td>
            <td><CondicaoBadge condicao={item.condicao} /></td>
            <td className="num" style={{ textAlign: 'right' }}>{item.quantidade}</td>
            <td className="num" style={{ textAlign: 'right' }}>{item.qtdDevolvida}</td>
            <td className="num" style={{ textAlign: 'right' }}>{item.qtdDescartada}</td>
            <td className="num" style={{ textAlign: 'right', color: item.qtdPerdida ? '#f59e0b' : undefined }}>{item.qtdPerdida}</td>
            <td className="num" style={{ textAlign: 'right', fontWeight: 700 }}>{item.pendente}</td>
          </tr>
        ))}
      </tbody>
    </table>

    <SecaoTitulo>Devoluções</SecaoTitulo>
    {entrega.devolucoes.length === 0 ? (
      <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>Nenhuma devolução registrada.</p>
    ) : (
      entrega.devolucoes.map((dev) => (
        <div key={dev.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px' }}>
          <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>
            <strong style={{ color: '#1e293b' }}>{formatDateBr(dev.dataDevolucao)}</strong> · registrada por {dev.usuarioNome || '—'} em {formatDateTimeBr(dev.criadoEm)}
          </div>
          <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#334155' }}>
            {dev.itens.map((it) => (
              <li key={it.entregaItemId}>
                {it.uniformeNome} — {it.uniformeTamanho}:{' '}
                {[
                  it.qtdBoa && `${it.qtdBoa} em boas condições`,
                  it.qtdDanificada && `${it.qtdDanificada} danificada(s)`,
                  it.qtdSemCondicoes && `${it.qtdSemCondicoes} sem condições`,
                  it.qtdPerdida && `${it.qtdPerdida} perdida(s)`,
                ].filter(Boolean).join(', ')}
              </li>
            ))}
          </ul>
          {dev.observacoes && <div style={{ fontSize: '12px', color: '#475569', marginTop: '6px' }}>Obs.: {dev.observacoes}</div>}
        </div>
      ))
    )}
  </ModalUniformes>
);

export default EntregaDetalheModal;
