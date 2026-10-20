import React, { useState } from 'react';
import { useResumoUniformes, useUniformes } from '../../hooks/useUniformes';
import type { ColaboradorUniformes, CondicaoUniforme, EntregaUniforme, Uniforme } from '../../types/domain';
import NovoItemUniformeModal from './uniformes/NovoItemUniformeModal';
import ColaboradoresUniformesTab from './uniformes/ColaboradoresUniformesTab';
import ColaboradorUniformesModal from './uniformes/ColaboradorUniformesModal';
import DevolucaoTotalUniformeModal from './uniformes/DevolucaoTotalUniformeModal';
import DevolucaoUniformeModal from './uniformes/DevolucaoUniformeModal';
import EntregaDetalheModal from './uniformes/EntregaDetalheModal';
import EntregaUniformeModal from './uniformes/EntregaUniformeModal';
import EstoqueUniformesTab from './uniformes/EstoqueUniformesTab';
import HistoricoUniformesTab from './uniformes/HistoricoUniformesTab';
import MovimentoEstoqueModal from './uniformes/MovimentoEstoqueModal';
import UniformeFormModal from './uniformes/UniformeFormModal';

type Aba = 'estoque' | 'colaboradores' | 'historico';

type ModalState =
  | { tipo: 'novoItem'; base: { nome: string; codigo: string } | null }
  | { tipo: 'uniforme'; uniforme: Uniforme }
  | { tipo: 'movimento'; uniforme: Uniforme; condicao: CondicaoUniforme }
  | { tipo: 'entrega'; colaboradorId?: string }
  | { tipo: 'devolucao'; entrega: EntregaUniforme | null }
  | { tipo: 'devolucaoTotal'; colaboradorId: string }
  | { tipo: 'detalhe'; entrega: EntregaUniforme }
  | null;

const ABAS: Array<[Aba, string, string]> = [
  ['estoque', 'Estoque', 'bi-box-seam'],
  ['colaboradores', 'Colaboradores', 'bi-people'],
  ['historico', 'Histórico', 'bi-clock-history'],
];

const ComprasControleUniformes: React.FC = () => {
  const [aba, setAba] = useState<Aba>('estoque');
  const [modal, setModal] = useState<ModalState>(null);
  const [colaboradorAberto, setColaboradorAberto] = useState<ColaboradorUniformes | null>(null);
  const [historicoBusca, setHistoricoBusca] = useState('');
  const resumo = useResumoUniformes().data;
  const uniformes = useUniformes().data ?? [];
  const valor = (n: number | undefined) => (n === undefined ? '—' : n);

  const fechar = () => setModal(null);
  const abrirDevolucao = (entrega: EntregaUniforme | null) => setModal({ tipo: 'devolucao', entrega });
  const abrirDevolucaoTotal = (colaboradorId: string) => setModal({ tipo: 'devolucaoTotal', colaboradorId });
  const irParaAba = (destino: Aba) => { setHistoricoBusca(''); setAba(destino); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', padding: '0 4px 4px' }}>
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '6px', height: '22px', backgroundColor: '#118CC4' }} />
          <h1 className="view-page-title">Controle Uniformes</h1>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button type="button" className="reports-action-btn secondary" onClick={() => abrirDevolucao(null)}>
            <i className="bi bi-arrow-return-left" />
            <span>Receber devolução</span>
          </button>
          <button type="button" className="reports-action-btn primary" onClick={() => setModal({ tipo: 'entrega' })}>
            <i className="bi bi-box-arrow-right" />
            <span>Entregar uniforme</span>
          </button>
        </div>
      </header>

      <div className="dashboard-stats-grid" style={{ marginBottom: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', flexShrink: 0 }}>
        <div className="stat-card card-positive">
          <div className="stat-card-label">Peças novas</div>
          <div className="stat-card-value">{valor(resumo?.estoqueNovo)}</div>
          <div className="stat-card-desc">Disponíveis no estoque</div>
        </div>
        <div className="stat-card card-neutral">
          <div className="stat-card-label">Peças usadas</div>
          <div className="stat-card-value">{valor(resumo?.estoqueUsado)}</div>
          <div className="stat-card-desc">Devolvidas e reaproveitáveis</div>
        </div>
        <div className="stat-card card-neutral" style={{ cursor: 'pointer' }} onClick={() => irParaAba('colaboradores')}>
          <div className="stat-card-label">Com colaboradores</div>
          <div className="stat-card-value">{valor(resumo?.destinados)}</div>
          <div className="stat-card-desc">Entregues e ainda não devolvidas</div>
        </div>
        <div className="stat-card card-negative" style={{ cursor: 'pointer' }} onClick={() => irParaAba('estoque')}>
          <div className="stat-card-label">Estoque baixo ou esgotado</div>
          <div className="stat-card-value">{valor(resumo?.estoqueBaixo)}</div>
          <div className="stat-card-desc">Tamanhos para repor</div>
        </div>
      </div>

      <div className="reports-tabs-bar" style={{ flexShrink: 0 }}>
        {ABAS.map(([chave, label, icone]) => (
          <button key={chave} type="button" onClick={() => irParaAba(chave)} className={`reports-tab-btn ${aba === chave ? 'active' : ''}`}>
            <i className={`bi ${icone}`} style={{ marginRight: '6px' }} /> {label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {aba === 'estoque' && (
        <EstoqueUniformesTab
          onNovo={(base) => setModal({ tipo: 'novoItem', base: base ?? null })}
          onEditar={(uniforme) => setModal({ tipo: 'uniforme', uniforme })}
          onMovimentar={(uniforme, condicao) => setModal({ tipo: 'movimento', uniforme, condicao })}
          onHistorico={(nome) => { setHistoricoBusca(nome); setAba('historico'); }}
        />
      )}
      {aba === 'colaboradores' && <ColaboradoresUniformesTab onAbrir={setColaboradorAberto} />}
      {aba === 'historico' && <HistoricoUniformesTab key={historicoBusca} buscaInicial={historicoBusca} />}
      </div>

      {colaboradorAberto && (
        <ColaboradorUniformesModal
          colaborador={colaboradorAberto}
          onClose={() => setColaboradorAberto(null)}
          onNovaEntrega={(colaboradorId) => setModal({ tipo: 'entrega', colaboradorId })}
          onDetalhe={(entrega) => setModal({ tipo: 'detalhe', entrega })}
          onDevolver={abrirDevolucao}
          onDevolucaoTotal={abrirDevolucaoTotal}
        />
      )}
      {modal?.tipo === 'novoItem' && (
        <NovoItemUniformeModal
          base={modal.base}
          tamanhosExistentes={modal.base ? uniformes.filter((u) => u.nome === modal.base?.nome).map((u) => u.tamanho) : []}
          onClose={fechar}
        />
      )}
      {modal?.tipo === 'uniforme' && <UniformeFormModal uniforme={modal.uniforme} onClose={fechar} />}
      {modal?.tipo === 'movimento' && (
        <MovimentoEstoqueModal uniforme={modal.uniforme} condicaoInicial={modal.condicao} onClose={fechar} />
      )}
      {modal?.tipo === 'entrega' && <EntregaUniformeModal colaboradorIdInicial={modal.colaboradorId} onClose={fechar} />}
      {modal?.tipo === 'devolucao' && (
        <DevolucaoUniformeModal entrega={modal.entrega} onClose={fechar} onDevolucaoTotal={abrirDevolucaoTotal} />
      )}
      {modal?.tipo === 'devolucaoTotal' && (
        <DevolucaoTotalUniformeModal colaboradorIdInicial={modal.colaboradorId} onClose={fechar} />
      )}
      {modal?.tipo === 'detalhe' && <EntregaDetalheModal entrega={modal.entrega} onClose={fechar} onDevolver={abrirDevolucao} />}
    </div>
  );
};

export default ComprasControleUniformes;
