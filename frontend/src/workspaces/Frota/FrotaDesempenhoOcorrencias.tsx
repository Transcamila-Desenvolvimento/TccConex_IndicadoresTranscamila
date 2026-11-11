import React, { useEffect, useRef, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { userHasFuncao } from '../../constants/funcoes';
import { useAuth } from '../../contexts/AuthContext';
import { useAsyncQueryState } from '../../hooks/useAsyncQueryState';
import { apiService } from '../../services/apiService';
import {
  getFrotaErrorMessage,
  useApuracaoDesempenho,
  useCriteriosDesempenho,
  useCriarOcorrenciaDesempenho,
  useParametrosDesempenho,
  useExcluirOcorrenciaDesempenho,
  useOcorrenciasDesempenho,
} from '../../hooks/useFrotaDesempenho';
import type { ApuracaoMotorista, ApuracaoOpcao, CriterioDesempenhoOpcao } from '../../types/domain';
import { downloadBonificacaoExtratoPdf, downloadReciboBonificacaoPdf } from './desempenhoExtratoPdf';
import { dataBr, MESES, moeda, numeroBonito } from './desempenhoFormat';

const hoje = new Date();
const PAGE_SIZE_OPTIONS = [10, 20, 50];

const FrotaDesempenhoOcorrencias: React.FC = () => {
  const { user, selectedFilial } = useAuth();
  const podeRegistrar = userHasFuncao(user, 'Frota', 'registrar-ocorrencias-desempenho');
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth() + 1);
  const [busca, setBusca] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selecionado, setSelecionado] = useState<ApuracaoMotorista | null>(null);
  const [registrando, setRegistrando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const apuracao = useApuracaoDesempenho({ ano, mes, search: busca, page, pageSize });
  const { canShowEmpty } = useAsyncQueryState(apuracao);
  const motoristas = apuracao.data?.motoristas ?? [];
  const anos = [hoje.getFullYear() - 1, hoje.getFullYear(), hoje.getFullYear() + 1];
  const totalRegistros = apuracao.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalRegistros / pageSize));
  const paginaAtual = Math.min(apuracao.data?.page ?? page, totalPages);
  const resumo = apuracao.data?.resumo;

  const baixarExtrato = async () => {
    setBaixando(true);
    try {
      const completa = await apiService.getApuracaoDesempenho({ ano, mes });
      await downloadBonificacaoExtratoPdf({
        ano,
        mes,
        filial: selectedFilial ?? '',
        motoristas: completa.motoristas,
        resumo: completa.resumo,
      });
    } catch (falha) {
      window.alert(getFrotaErrorMessage(falha));
    } finally {
      setBaixando(false);
    }
  };

  return (
    <div className="desempenho-page desempenho-page--lista">
      <header className="desempenho-head">
        <div>
          <h1 className="view-page-title">Ocorrências</h1>
          <p className="desempenho-lead">
            Apuração de {MESES[mes - 1].toLowerCase()} de {ano}. Clique no motorista para ver o detalhe do mês.
          </p>
        </div>
        <div className="desempenho-acoes">
          <button type="button" className="reports-action-btn secondary" onClick={() => { void baixarExtrato(); }} disabled={baixando}>
            {baixando ? 'Gerando PDF...' : 'Extrato PDF'}
          </button>
          {podeRegistrar && (
            <button type="button" className="reports-action-btn primary" onClick={() => setRegistrando(true)}>
              Registrar ocorrência
            </button>
          )}
        </div>
      </header>

      <div className="reports-filters-bar">
        <div className="reports-filter-left">
          <div className="reports-select-wrapper">
            <select value={mes} aria-label="Mês" onChange={(event) => { setMes(Number(event.target.value)); setPage(1); setSelecionado(null); }}>
              {MESES.map((nome, indice) => <option key={nome} value={indice + 1}>{nome}</option>)}
            </select>
          </div>
          <div className="reports-select-wrapper">
            <select value={ano} aria-label="Ano" onChange={(event) => { setAno(Number(event.target.value)); setPage(1); setSelecionado(null); }}>
              {anos.map((valor) => <option key={valor} value={valor}>{valor}</option>)}
            </select>
          </div>
          <div className="reports-search-wrapper">
            <input
              type="text"
              placeholder="Buscar motorista..."
              value={busca}
              onChange={(event) => { setBusca(event.target.value); setPage(1); }}
            />
          </div>
        </div>
        <div className="reports-filter-right">
          <span className="reports-records-count"><strong>{totalRegistros}</strong> Motoristas</span>
        </div>
      </div>

      <QueryDataPanel query={apuracao} loadingMessage="Calculando a pontuação..." errorMessage="Não foi possível carregar a pontuação.">
          <div className="desempenho-kpis">
            <div className="desempenho-kpi desempenho-kpi--icone">
              <span className="desempenho-kpi-icone" aria-hidden="true"><i className="bi bi-people" /></span>
              <div>
                <span>Motoristas</span>
                <strong>{resumo?.motoristas ?? 0}</strong>
              </div>
            </div>
            <div className="desempenho-kpi desempenho-kpi--icone">
              <span className="desempenho-kpi-icone desempenho-kpi-icone--ok" aria-hidden="true"><i className="bi bi-award" /></span>
              <div>
                <span>Com bonificação</span>
                <strong>{resumo?.comBonificacao ?? 0}</strong>
              </div>
            </div>
            <div className="desempenho-kpi desempenho-kpi--icone">
              <span className="desempenho-kpi-icone desempenho-kpi-icone--valor" aria-hidden="true"><i className="bi bi-cash-stack" /></span>
              <div>
                <span>Total a pagar</span>
                <strong>{moeda(resumo?.totalPagar ?? 0)}</strong>
              </div>
            </div>
          </div>

          <div className="desempenho-tabela">
            <div className="table-container">
              <table className="erp-table reports-table">
                <thead>
                  <tr>
                    <th>Motorista</th>
                    <th className="num">Nota</th>
                    <th>Bonificação</th>
                    <th className="num">Valor</th>
                    <th className="num">Ocorrências</th>
                  </tr>
                </thead>
                <tbody>
                  {canShowEmpty && motoristas.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic', padding: '24px' }}>
                        Nenhum motorista neste período.
                      </td>
                    </tr>
                  ) : motoristas.map((motorista) => (
                    <tr key={motorista.funcionarioId} onClick={() => setSelecionado(motorista)}>
                      <td>
                        <div className="desempenho-pessoa">
                          <strong>{motorista.nomeCompleto}</strong>
                          <span>{motorista.cargo || 'Motorista'}</span>
                        </div>
                      </td>
                      <td className="num">{numeroBonito(motorista.nota)}</td>
                      <td><StatusBonus motorista={motorista} /></td>
                      <td className="num">{moeda(motorista.valor)}</td>
                      <td className="num">
                        {motorista.grupos.reduce((soma, grupo) => soma + grupo.itens.reduce((itens, item) => itens + item.quantidade, 0), 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="erp-pagination-bar">
              <div className="erp-pagination-page-size">
                <label htmlFor="ocorrencias-page-size">Itens por página</label>
                <select
                  id="ocorrencias-page-size"
                  value={pageSize}
                  onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}
                >
                  {PAGE_SIZE_OPTIONS.map((opcao) => <option key={opcao} value={opcao}>{opcao}</option>)}
                </select>
              </div>
              <span style={{ fontWeight: 500, marginRight: '4px' }}>
                Página <span className="erp-pagination-current">{paginaAtual}</span> de <span className="erp-pagination-current">{totalPages}</span>
                <span className="erp-pagination-meta">({totalRegistros} registros)</span>
              </span>
              <button
                type="button"
                className="reports-action-btn secondary"
                disabled={paginaAtual <= 1}
                onClick={() => setPage(paginaAtual - 1)}
                style={{ height: '32px', padding: '0 12px', fontSize: '12px', opacity: paginaAtual <= 1 ? 0.5 : 1 }}
              >
                Anterior
              </button>
              <button
                type="button"
                className="reports-action-btn secondary"
                disabled={paginaAtual >= totalPages}
                onClick={() => setPage(paginaAtual + 1)}
                style={{ height: '32px', padding: '0 12px', fontSize: '12px', opacity: paginaAtual >= totalPages ? 0.5 : 1 }}
              >
                Próximo
              </button>
            </div>
      </QueryDataPanel>

      {selecionado && (
        <DetalheMotorista
          motorista={motoristas.find((item) => item.funcionarioId === selecionado.funcionarioId) ?? selecionado}
          ano={ano}
          mes={mes}
          onClose={() => setSelecionado(null)}
        />
      )}
      {registrando && (
        <RegistrarOcorrencia
          ano={ano}
          mes={mes}
          motoristas={apuracao.data?.opcoes ?? []}
          criterios={apuracao.data?.criterios ?? []}
          onClose={() => setRegistrando(false)}
        />
      )}
    </div>
  );
};

function avisoExperiencia(inicio: string) {
  const [ano, mes] = (inicio || '').split('-');
  const nome = MESES[Number(mes) - 1];
  const data = nome && ano ? `, a previsão para início do recebimento é ${nome.toLocaleLowerCase('pt-BR')} de ${ano}` : '';
  return `Sem bonificação na experiência. A pontuação durante os 3 meses de experiência é apenas para registro${data}.`;
}

function StatusBonus({ motorista }: { motorista: ApuracaoMotorista }) {
  if (motorista.emExperiencia) {
    return <span className="desempenho-chip desempenho-chip--neutro">Experiência</span>;
  }
  if (motorista.zerado || Number(motorista.percentual) <= 0) {
    return <span className="desempenho-chip desempenho-chip--neutro">Sem bônus</span>;
  }
  if (Number(motorista.percentual) >= 100) {
    return <span className="desempenho-chip desempenho-chip--ok">100%</span>;
  }
  return <span className="desempenho-chip desempenho-chip--parcial">{numeroBonito(motorista.percentual)}%</span>;
}

function DetalheMotorista({
  motorista,
  ano,
  mes,
  onClose,
}: {
  motorista: ApuracaoMotorista;
  ano: number;
  mes: number;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const podeExcluir = userHasFuncao(user, 'Frota', 'excluir-ocorrencias-desempenho');
  const ocorrencias = useOcorrenciasDesempenho({ ano, mes, funcionarioId: motorista.funcionarioId }, true);
  const catalogo = useCriteriosDesempenho();
  const parametros = useParametrosDesempenho();
  const excluir = useExcluirOcorrenciaDesempenho();
  const { canShowEmpty } = useAsyncQueryState(ocorrencias);
  const lista = ocorrencias.data ?? [];
  const descricoes = new Map(
    (catalogo.data?.grupos ?? []).flatMap((grupo) => grupo.criterios.map((criterio) => [criterio.id, criterio.descricao])),
  );
  const comDescricao = lista.map((item) => ({
    ...item,
    descricao: item.descricao?.trim() || descricoes.get(item.criterioId) || '',
  }));
  const [gerandoRecibo, setGerandoRecibo] = useState(false);

  const baixarRecibo = async () => {
    setGerandoRecibo(true);
    try {
      await downloadReciboBonificacaoPdf({
        ano,
        mes,
        motorista,
        ocorrencias: comDescricao,
        aviso: motorista.emExperiencia ? avisoExperiencia(motorista.inicioBonificacao) : '',
        impressoPor: user?.name || user?.username || '',
        notaInicial: parametros.data?.notaInicial || '100',
        faixas: parametros.data?.faixas ?? [],
      });
    } catch {
      window.alert('Não foi possível gerar o recibo.');
    } finally {
      setGerandoRecibo(false);
    }
  };

  const semBonus = motorista.zerado || Number(motorista.percentual) <= 0;

  return (
    <div className="search-backdrop desempenho-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="search-modal-card desempenho-modal desempenho-modal--largo" role="dialog" aria-label="Pontuação do motorista">
        <div className="desempenho-modal-head">
          <h2>{motorista.nomeCompleto}</h2>
          <p>{motorista.cargo || 'Motorista'} · {MESES[mes - 1]} de {ano}</p>
        </div>
        <div className="desempenho-modal-corpo">
          <div className="desempenho-kpis">
            <div className="desempenho-kpi">
              <span>Nota</span>
              <strong>{numeroBonito(motorista.nota)}</strong>
            </div>
            <div className="desempenho-kpi">
              <span>Bonificação</span>
              <strong>{semBonus ? 'Sem bônus' : `${numeroBonito(motorista.percentual)}%`}</strong>
            </div>
            <div className="desempenho-kpi">
              <span>Valor</span>
              <strong>{moeda(motorista.valor)}</strong>
            </div>
          </div>
          {motorista.emExperiencia && (
            <p className="desempenho-aviso">{avisoExperiencia(motorista.inicioBonificacao)}</p>
          )}
          {motorista.zerado && motorista.motivoZero && <p className="desempenho-erro">{motorista.motivoZero}</p>}

          <section className="desempenho-bloco">
            <h3>Desconto por grupo</h3>
            <table className="desempenho-catalog">
              <thead>
                <tr>
                  <th>Grupo</th>
                  <th className="num">Desconto</th>
                </tr>
              </thead>
              <tbody>
                {motorista.grupos.map((grupo) => (
                  <tr key={grupo.id}>
                    <td>{grupo.nome}</td>
                    <td className="num">{numeroBonito(grupo.desconto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="desempenho-bloco">
            <h3>Ocorrências do mês</h3>
            <QueryDataPanel query={ocorrencias} variant="compact" loadingMessage="Carregando ocorrências...">
              {canShowEmpty && lista.length === 0 ? (
                <p className="desempenho-vazio">Nenhuma ocorrência neste mês.</p>
              ) : (
                <table className="desempenho-catalog">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Critério</th>
                      <th className="num">Qtd.</th>
                      <th className="acoes"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {comDescricao.map((item) => (
                      <tr key={item.id}>
                        <td>{dataBr(item.data)}</td>
                        <td className="desempenho-criterio-celula">
                          <strong>{item.grupoNome} · {item.criterioNome}</strong>
                          {item.descricao ? <span>{item.descricao}</span> : null}
                          {item.observacao ? <span>{item.observacao}</span> : null}
                        </td>
                        <td className="num">{item.quantidade}</td>
                        <td className="acoes">
                          {podeExcluir && (
                            <button
                              type="button"
                              className="desempenho-link desempenho-link--danger"
                              disabled={excluir.isPending}
                              onClick={() => { void excluir.mutateAsync(item.id).catch((falha) => window.alert(getFrotaErrorMessage(falha))); }}
                            >
                              Excluir
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </QueryDataPanel>
          </section>
        </div>
        <div className="desempenho-modal-foot">
          <button type="button" className="reports-action-btn secondary" onClick={() => { void baixarRecibo(); }} disabled={gerandoRecibo || ocorrencias.isPending || catalogo.isPending}>
            {gerandoRecibo ? 'Gerando PDF...' : 'Recibo PDF'}
          </button>
          <button type="button" className="reports-action-btn secondary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

function SeletorMotorista({
  motoristas,
  value,
  onChange,
}: {
  motoristas: ApuracaoOpcao[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [destaque, setDestaque] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const selecionado = motoristas.find((item) => item.funcionarioId === value) ?? null;
  const termo = busca.trim().toLocaleLowerCase('pt-BR');
  const filtrados = termo
    ? motoristas.filter((item) => `${item.nomeCompleto} ${item.cargo ?? ''}`.toLocaleLowerCase('pt-BR').includes(termo))
    : motoristas;

  useEffect(() => {
    if (!aberto) return;
    const fecharFora = (event: MouseEvent) => {
      if (!raiz.current?.contains(event.target as Node)) setAberto(false);
    };
    const fecharEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAberto(false);
    };
    document.addEventListener('mousedown', fecharFora);
    document.addEventListener('keydown', fecharEsc);
    return () => {
      document.removeEventListener('mousedown', fecharFora);
      document.removeEventListener('keydown', fecharEsc);
    };
  }, [aberto]);

  const escolher = (id: string) => {
    onChange(id);
    setAberto(false);
  };

  const navegar = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const passo = event.key === 'ArrowDown' ? 1 : -1;
      setDestaque((atual) => Math.min(Math.max(atual + passo, 0), Math.max(filtrados.length - 1, 0)));
    } else if (event.key === 'Enter' && filtrados[destaque]) {
      event.preventDefault();
      escolher(filtrados[destaque].funcionarioId);
    }
  };

  return (
    <div className="sgq-pessoa" ref={raiz}>
      <button
        type="button"
        className={`sgq-pessoa-campo${aberto ? ' is-aberto' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        onClick={() => {
          setBusca('');
          setDestaque(Math.max(motoristas.findIndex((item) => item.funcionarioId === value), 0));
          setAberto((atual) => !atual);
        }}
      >
        {selecionado ? (
          <>
            <span className="sgq-pessoa-texto">
              <span className="sgq-pessoa-nome">{selecionado.nomeCompleto}</span>
              {selecionado.cargo ? <small>{selecionado.cargo}</small> : null}
            </span>
          </>
        ) : (
          <span className="sgq-pessoa-placeholder">Escolher motorista</span>
        )}
        <i className={`bi bi-chevron-${aberto ? 'up' : 'down'}`} aria-hidden="true" />
      </button>
      {aberto && (
        <div className="sgq-pessoa-menu">
          <div className="sgq-pessoa-busca">
            <i className="bi bi-search" aria-hidden="true" />
            <input
              type="search"
              value={busca}
              autoFocus
              placeholder="Buscar por nome ou cargo..."
              aria-label="Buscar motorista"
              onChange={(event) => { setBusca(event.target.value); setDestaque(0); }}
              onKeyDown={navegar}
            />
          </div>
          <ul role="listbox">
            {filtrados.map((item, indice) => {
              const marcado = item.funcionarioId === value;
              return (
                <li key={item.funcionarioId}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={marcado}
                    className={`sgq-pessoa-opcao${marcado ? ' is-selecionada' : ''}${indice === destaque ? ' is-destaque' : ''}`}
                    onMouseEnter={() => setDestaque(indice)}
                    onClick={() => escolher(item.funcionarioId)}
                  >
                    <span className="sgq-pessoa-texto">
                      <span className="sgq-pessoa-nome">{item.nomeCompleto}</span>
                      {item.cargo ? <small>{item.cargo}</small> : null}
                    </span>
                    {marcado && <i className="bi bi-check2" aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
            {filtrados.length === 0 && (
              <li className="sgq-pessoa-vazio">
                <i className="bi bi-person-x" aria-hidden="true" />
                {motoristas.length ? 'Nenhum motorista encontrado.' : 'Nenhum motorista nesta filial.'}
              </li>
            )}
          </ul>
          {motoristas.length > 0 && (
            <div className="sgq-pessoa-rodape">
              <i className="bi bi-people" aria-hidden="true" />
              {motoristas.length} {motoristas.length === 1 ? 'motorista' : 'motoristas'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BuscaCriterio({
  criterios,
  value,
  onChange,
  onClose,
}: {
  criterios: CriterioDesempenhoOpcao[];
  value: string;
  onChange: (id: string) => void;
  onClose: () => void;
}) {
  const catalogo = useCriteriosDesempenho();
  const descricoes = new Map(
    (catalogo.data?.grupos ?? []).flatMap((grupoItem) => grupoItem.criterios.map((criterio) => [criterio.id, criterio.descricao])),
  );
  const comDescricao = criterios.map((item) => ({
    ...item,
    descricao: item.descricao || descricoes.get(item.id) || '',
  }));
  const [busca, setBusca] = useState('');
  const [grupo, setGrupo] = useState('');
  const termo = busca.trim().toLocaleLowerCase('pt-BR');
  const grupos = comDescricao.reduce<string[]>((lista, item) => {
    if (!lista.includes(item.grupoNome)) lista.push(item.grupoNome);
    return lista;
  }, []);
  const visiveis = comDescricao.filter((item) => {
    if (grupo && item.grupoNome !== grupo) return false;
    if (!termo) return true;
    return `${item.grupoNome} ${item.nome} ${item.descricao}`.toLocaleLowerCase('pt-BR').includes(termo);
  });
  return (
    <div
      className="search-backdrop desempenho-busca-backdrop"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}
    >
      <div className="search-modal-card desempenho-modal desempenho-modal--largo desempenho-busca" role="dialog" aria-label="Buscar critério">
        <div className="desempenho-modal-head">
          <h2>Buscar critério</h2>
          <p>Filtre pelo nome ou pelo grupo e selecione a linha.</p>
        </div>
        <div className="desempenho-busca-corpo">
          <div className="desempenho-busca-filtros">
            <label className="desempenho-field">
              <span>Nome</span>
              <input
                type="search"
                autoFocus
                placeholder="Digite o critério"
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
              />
            </label>
            <label className="desempenho-field desempenho-field--medio">
              <span>Grupo</span>
              <select value={grupo} onChange={(event) => setGrupo(event.target.value)}>
                <option value="">Todos</option>
                {grupos.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
              </select>
            </label>
          </div>
          <div className="desempenho-bloco desempenho-busca-tabela">
            <table className="desempenho-catalog">
              <thead>
                <tr>
                  <th>Critério</th>
                  <th>Grupo</th>
                  <th className="num">Pontos</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.length === 0 ? (
                  <tr>
                    <td className="vazio" colSpan={3}>Nenhum critério encontrado.</td>
                  </tr>
                ) : visiveis.map((item) => (
                  <tr
                    key={item.id}
                    className={item.id === value ? 'is-active' : ''}
                    aria-selected={item.id === value}
                    onClick={() => onChange(item.id)}
                  >
                    <td className="desempenho-criterio-celula">
                      <strong>{item.nome}</strong>
                      {item.descricao ? <span>{item.descricao}</span> : null}
                    </td>
                    <td>{item.grupoNome}</td>
                    <td className="num">{item.zeraBonus ? 'Zera o bônus' : `${Number(item.pontos) > 0 ? '-' : ''}${numeroBonito(item.pontos)} pts`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="desempenho-modal-foot">
          <button type="button" className="reports-action-btn secondary" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

function RegistrarOcorrencia({
  ano,
  mes,
  motoristas,
  criterios,
  onClose,
}: {
  ano: number;
  mes: number;
  motoristas: ApuracaoOpcao[];
  criterios: CriterioDesempenhoOpcao[];
  onClose: () => void;
}) {
  const criar = useCriarOcorrenciaDesempenho();
  const [funcionarioId, setFuncionarioId] = useState('');
  const [criterioId, setCriterioId] = useState('');
  const [data, setData] = useState(() => {
    const agora = new Date();
    const mesAtual = String(agora.getMonth() + 1).padStart(2, '0');
    const dia = String(agora.getDate()).padStart(2, '0');
    return `${agora.getFullYear()}-${mesAtual}-${dia}`;
  });
  const [quantidade, setQuantidade] = useState('1');
  const [observacao, setObservacao] = useState('');
  const [erro, setErro] = useState('');
  const [buscando, setBuscando] = useState(false);
  const criterio = criterios.find((item) => item.id === criterioId) ?? null;

  const enviar = async (event: React.FormEvent) => {
    event.preventDefault();
    setErro('');
    const qtd = Number(quantidade);
    if (!funcionarioId || !criterioId || !data || !Number.isInteger(qtd) || qtd < 1) {
      setErro('Preencha motorista, critério, data e quantidade.');
      return;
    }
    try {
      await criar.mutateAsync({ funcionarioId, criterioId, data, quantidade: qtd, observacao });
      onClose();
    } catch (falha) {
      setErro(getFrotaErrorMessage(falha));
    }
  };

  return (
    <>
    <div className="search-backdrop" onClick={(event) => { if (event.target === event.currentTarget && !criar.isPending) onClose(); }}>
      <form className="search-modal-card search-modal-card--allow-overflow desempenho-modal desempenho-registro" onSubmit={enviar}>
        <div className="desempenho-modal-head">
          <h2>Registrar ocorrência</h2>
          <p>{MESES[mes - 1]} de {ano}</p>
        </div>
        <div className="desempenho-registro-corpo">
          <div className="desempenho-field">
            <span>Motorista</span>
            <SeletorMotorista motoristas={motoristas} value={funcionarioId} onChange={setFuncionarioId} />
          </div>
          <label className="desempenho-field">
            <span>Critério</span>
            <input
              type="text"
              readOnly
              className="desempenho-criterio-campo"
              value={criterio ? `${criterio.grupoNome} · ${criterio.nome}` : ''}
              placeholder="Escolher critério"
              onClick={() => setBuscando(true)}
            />
          </label>
          <div className="desempenho-registro-linha">
            <label className="desempenho-field">
              <span>Data</span>
              <input type="date" value={data} onChange={(event) => setData(event.target.value)} />
            </label>
            <label className="desempenho-field">
              <span>Quantidade</span>
              <input type="number" min={1} max={99} value={quantidade} onChange={(event) => setQuantidade(event.target.value)} />
            </label>
          </div>
          <label className="desempenho-field">
            <span>Observação</span>
            <input type="text" value={observacao} maxLength={240} placeholder="Opcional" onChange={(event) => setObservacao(event.target.value)} />
          </label>
          {erro && <p className="desempenho-erro">{erro}</p>}
        </div>
        <div className="desempenho-modal-foot">
          <button type="button" className="reports-action-btn secondary" onClick={onClose} disabled={criar.isPending}>Cancelar</button>
          <button type="submit" className="reports-action-btn primary" disabled={criar.isPending}>Salvar</button>
        </div>
      </form>
    </div>
    {buscando && (
      <BuscaCriterio
        criterios={criterios}
        value={criterioId}
        onChange={(id) => { setCriterioId(id); setBuscando(false); }}
        onClose={() => setBuscando(false)}
      />
    )}
    </>
  );
}

export default FrotaDesempenhoOcorrencias;
