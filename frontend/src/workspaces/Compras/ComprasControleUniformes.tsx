import React, { useEffect, useMemo, useState } from 'react';
import { userHasFuncao } from '../../constants/funcoes';
import { useAuth } from '../../contexts/AuthContext';
import { useExportarEstoqueUniformes, useResumoUniformes, useUniformes } from '../../hooks/useUniformes';
import { downloadBlobAsFile } from '../../hooks/useFaturamentoProtocolos';
import type { ColaboradorUniformes, CondicaoUniforme, EntregaUniforme, Uniforme } from '../../types/domain';
import { compararTamanho } from './uniformes/format';
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
import './uniformes/uniformeErp.css';

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

const precisaRepor = (uniforme: Uniforme) => {
  const disponivel = uniforme.qtdNova + uniforme.qtdUsada;
  return disponivel === 0 || (uniforme.estoqueMinimo > 0 && disponivel < uniforme.estoqueMinimo);
};

const ComprasControleUniformes: React.FC = () => {
  const { user } = useAuth();
  const pode = (acao: 'cadastrar-uniformes' | 'editar-uniformes' | 'movimentar-uniformes' | 'entregar-uniformes' | 'devolver-uniformes' | 'exportar-uniformes') =>
    userHasFuncao(user, 'Compras', acao);
  const [aba, setAba] = useState<Aba>('estoque');
  const [modal, setModal] = useState<ModalState>(null);
  const [colaboradorAberto, setColaboradorAberto] = useState<ColaboradorUniformes | null>(null);
  const [historicoBusca, setHistoricoBusca] = useState('');
  const resumo = useResumoUniformes().data;
  const uniformes = useUniformes().data ?? [];
  const exportarEstoque = useExportarEstoqueUniformes();
  const valor = (n: number | undefined) => (n === undefined ? '—' : n);
  const tamanhosBaixos = useMemo(() => {
    const baixos = uniformes.filter(precisaRepor);
    const repetidos = new Set<string>();
    const vistos = new Set<string>();
    baixos.forEach((uniforme) => {
      if (vistos.has(uniforme.tamanho)) repetidos.add(uniforme.tamanho);
      vistos.add(uniforme.tamanho);
    });
    return [...baixos]
      .sort((a, b) => compararTamanho(a.tamanho, b.tamanho) || a.nome.localeCompare(b.nome))
      .map((uniforme) => ({
        id: uniforme.id,
        rotulo: repetidos.has(uniforme.tamanho) ? `${uniforme.nome} ${uniforme.tamanho}` : uniforme.tamanho,
      }));
  }, [uniformes]);
  const comColaboradores = useMemo(() => {
    const mapa = new Map<string, number>();
    uniformes.forEach((uniforme) => {
      if (uniforme.destinados <= 0) return;
      mapa.set(uniforme.nome, (mapa.get(uniforme.nome) ?? 0) + uniforme.destinados);
    });
    return [...mapa.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
      .map(([nome, quantidade]) => ({ nome, quantidade }));
  }, [uniformes]);

  useEffect(() => {
    document.querySelector('.content')?.scrollTo({ top: 0 });
  }, [aba]);

  const fechar = () => setModal(null);
  const abrirDevolucao = (entrega: EntregaUniforme | null) => setModal({ tipo: 'devolucao', entrega });
  const abrirDevolucaoTotal = (colaboradorId: string) => setModal({ tipo: 'devolucaoTotal', colaboradorId });
  const irParaAba = (destino: Aba) => { setHistoricoBusca(''); setAba(destino); };
  const baixarEstoque = async () => {
    try {
      const arquivo = await exportarEstoque.mutateAsync();
      const hoje = new Date().toISOString().slice(0, 10);
      downloadBlobAsFile(arquivo, `estoque_uniformes_${hoje}.xlsx`);
    } catch (erro) {
      window.alert(erro instanceof Error ? erro.message : 'Não foi possível exportar o estoque.');
    }
  };

  return (
    <div className={`uniforme-erp${aba === 'estoque' ? '' : ' uniforme-erp--lista'}`}>
      <header className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '16px', flexShrink: 0 }}>
        <div>
          <h1 className="view-page-title">Controle Uniformes</h1>
          <p className="uniforme-erp-sub">Almoxarifado · estoque, entregas e devoluções</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {pode('exportar-uniformes') && (
            <button
              type="button"
              className="reports-action-btn secondary"
              onClick={baixarEstoque}
              disabled={exportarEstoque.isPending}
            >
              <i className={`bi ${exportarEstoque.isPending ? 'bi-hourglass-split' : 'bi-download'}`} />
              <span>{exportarEstoque.isPending ? 'Exportando...' : 'Exportar estoque'}</span>
            </button>
          )}
          {pode('devolver-uniformes') && (
            <button type="button" className="reports-action-btn secondary" onClick={() => abrirDevolucao(null)}>
              <i className="bi bi-arrow-return-left" />
              <span>Receber devolução</span>
            </button>
          )}
          {pode('entregar-uniformes') && (
            <button type="button" className="reports-action-btn primary" onClick={() => setModal({ tipo: 'entrega' })}>
              <i className="bi bi-box-arrow-right" />
              <span>Entregar uniforme</span>
            </button>
          )}
        </div>
      </header>

      {aba === 'estoque' && <div className="dashboard-stats-grid" style={{ marginBottom: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', flexShrink: 0 }}>
        <div className="stat-card card-positive uniforme-kpi uniforme-kpi--novo">
          <div className="uniforme-kpi-topo">
            <span className="uniforme-kpi-icone" aria-hidden="true"><i className="bi bi-box-seam" /></span>
            <div className="stat-card-label">Peças novas</div>
          </div>
          <div className="stat-card-value">{valor(resumo?.estoqueNovo)}</div>
          <div className="stat-card-desc">Disponíveis no estoque</div>
        </div>
        <div className="stat-card card-neutral uniforme-kpi uniforme-kpi--usado">
          <div className="uniforme-kpi-topo">
            <span className="uniforme-kpi-icone" aria-hidden="true"><i className="bi bi-arrow-repeat" /></span>
            <div className="stat-card-label">Peças usadas</div>
          </div>
          <div className="stat-card-value">{valor(resumo?.estoqueUsado)}</div>
          <div className="stat-card-desc">Devolvidas e reaproveitáveis</div>
        </div>
        <div className="stat-card card-neutral uniforme-kpi uniforme-kpi--fora" style={{ cursor: 'pointer' }} onClick={() => irParaAba('colaboradores')}>
          <div className="uniforme-kpi-topo">
            <span className="uniforme-kpi-icone" aria-hidden="true"><i className="bi bi-people" /></span>
            <div className="stat-card-label">Com colaboradores</div>
          </div>
          <div className="stat-card-value">{valor(resumo?.destinados)}</div>
          <div className="stat-card-desc">Entregues e ainda não devolvidas</div>
          {comColaboradores.length > 0 && (
            <div className="uniforme-kpi-chips">
              {comColaboradores.map((item) => (
                <span key={item.nome} className="uniforme-selo">
                  {item.nome} · {item.quantidade}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="stat-card card-negative uniforme-kpi uniforme-kpi--alerta" style={{ cursor: 'pointer' }} onClick={() => irParaAba('estoque')}>
          <div className="uniforme-kpi-topo">
            <span className="uniforme-kpi-icone" aria-hidden="true"><i className="bi bi-exclamation-circle" /></span>
            <div className="stat-card-label">Estoque baixo ou esgotado</div>
          </div>
          <div className="stat-card-value">{valor(resumo?.estoqueBaixo)}</div>
          <div className="stat-card-desc">Tamanhos para repor</div>
          {tamanhosBaixos.length > 0 && (
            <div className="uniforme-kpi-chips">
              {tamanhosBaixos.map((item) => (
                <span
                  key={item.id}
                  className="uniforme-selo uniforme-selo--alerta"
                  style={{
                    fontSize: '12px', fontWeight: 700, color: '#e11d48',
                    background: '#fff1f2', border: '1px solid #fecdd3',
                    borderRadius: '6px', padding: '2px 8px', lineHeight: 1.4,
                  }}
                >
                  {item.rotulo}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>}

      <div className="reports-tabs-bar" style={{ flexShrink: 0 }}>
        {ABAS.map(([chave, label, icone]) => (
          <button key={chave} type="button" onClick={() => irParaAba(chave)} className={`reports-tab-btn ${aba === chave ? 'active' : ''}`}>
            <i className={`bi ${icone}`} style={{ marginRight: '6px' }} /> {label}
          </button>
        ))}
      </div>

      <div className="uniforme-erp-aba">
      {aba === 'estoque' && (
        <EstoqueUniformesTab
          podeCadastrar={pode('cadastrar-uniformes')}
          podeEditar={pode('editar-uniformes')}
          podeMovimentar={pode('movimentar-uniformes')}
          onNovo={(base) => setModal({ tipo: 'novoItem', base: base ?? null })}
          onEditar={(uniforme) => setModal({ tipo: 'uniforme', uniforme })}
          onMovimentar={(uniforme, condicao) => setModal({ tipo: 'movimento', uniforme, condicao })}
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
          podeEntregar={pode('entregar-uniformes')}
          podeDevolver={pode('devolver-uniformes')}
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
      {modal?.tipo === 'detalhe' && (
        <EntregaDetalheModal
          entrega={modal.entrega}
          podeDevolver={pode('devolver-uniformes')}
          onClose={fechar}
          onDevolver={abrirDevolucao}
        />
      )}
    </div>
  );
};

export default ComprasControleUniformes;
