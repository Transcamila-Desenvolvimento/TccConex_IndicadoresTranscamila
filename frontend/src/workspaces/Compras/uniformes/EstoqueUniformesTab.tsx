import React, { useMemo, useState } from 'react';
import QueryDataPanel from '../../../components/QueryDataPanel';
import { useAsyncQueryState } from '../../../hooks/useAsyncQueryState';
import { useUniformes } from '../../../hooks/useUniformes';
import type { CondicaoUniforme, Uniforme } from '../../../types/domain';
import { compararTamanho, normalizarBusca } from './format';
import { Busca } from './shared';

interface Grupo {
  nome: string;
  codigo: string;
  tamanhos: Uniforme[];
  novas: number;
  usadas: number;
  comColaboradores: number;
  alerta: boolean;
}

const abaixoDoMinimo = (u: Uniforme) => u.estoqueMinimo > 0 && u.qtdNova + u.qtdUsada < u.estoqueMinimo;

const agrupar = (uniformes: Uniforme[]): Grupo[] => {
  const mapa = new Map<string, Uniforme[]>();
  uniformes.forEach((u) => mapa.set(u.nome, [...(mapa.get(u.nome) ?? []), u]));
  return [...mapa.entries()]
    .map(([nome, lista]) => {
      const tamanhos = [...lista].sort((a, b) => compararTamanho(a.tamanho, b.tamanho));
      return {
        nome,
        codigo: tamanhos.find((t) => t.codigo)?.codigo ?? '',
        tamanhos,
        novas: tamanhos.reduce((acc, t) => acc + t.qtdNova, 0),
        usadas: tamanhos.reduce((acc, t) => acc + t.qtdUsada, 0),
        comColaboradores: tamanhos.reduce((acc, t) => acc + t.destinados, 0),
        alerta: tamanhos.some((t) => abaixoDoMinimo(t) || t.qtdNova + t.qtdUsada === 0),
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome));
};

const corDoTamanho = (u: Uniforme) => {
  if (u.qtdNova + u.qtdUsada === 0) return '#ef4444';
  if (abaixoDoMinimo(u)) return '#f59e0b';
  return '#10b981';
};

const celulaBotao: React.CSSProperties = {
  width: '100%', minWidth: '52px', padding: '8px 6px', border: '1px solid transparent', borderRadius: '6px',
  background: 'transparent', fontSize: '15px', fontWeight: 700, cursor: 'pointer', color: '#1e293b',
};

const CelulaQtd: React.FC<{ valor: number; titulo: string; onClick: () => void }> = ({ valor, titulo, onClick }) => (
  <button
    type="button"
    title={titulo}
    onClick={onClick}
    style={{ ...celulaBotao, color: valor === 0 ? '#cbd5e1' : '#1e293b' }}
    onMouseEnter={(e) => { e.currentTarget.style.background = '#f0f9ff'; e.currentTarget.style.borderColor = '#bae6fd'; }}
    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
  >
    {valor}
  </button>
);

const rotuloLinha: React.CSSProperties = {
  textAlign: 'left', fontSize: '12px', fontWeight: 600, color: '#64748b', whiteSpace: 'nowrap', width: '150px',
};

const CartaoItem: React.FC<{
  grupo: Grupo;
  onEditar: (uniforme: Uniforme) => void;
  onMovimentar: (uniforme: Uniforme, condicao: CondicaoUniforme) => void;
  onNovoTamanho: (grupo: Grupo) => void;
  onHistorico: (nome: string) => void;
}> = ({ grupo, onEditar, onMovimentar, onNovoTamanho, onHistorico }) => (
  <div className="reports-table-card" style={{ marginBottom: '16px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: '1px solid #f1f5f9', flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>
          {grupo.nome}
          {grupo.alerta && <i className="bi bi-exclamation-triangle-fill" style={{ color: '#f59e0b', marginLeft: '8px', fontSize: '13px' }} title="Algum tamanho está com estoque baixo ou esgotado" />}
        </div>
        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
          {grupo.codigo && <>Ref. {grupo.codigo} · </>}
          <strong>{grupo.novas}</strong> novas · <strong>{grupo.usadas}</strong> usadas · <strong>{grupo.comColaboradores}</strong> com colaboradores
        </div>
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        <button type="button" className="btn-table-action" onClick={() => onHistorico(grupo.nome)}>
          <i className="bi bi-clock-history" /> Histórico
        </button>
        <button type="button" className="btn-table-action" onClick={() => onNovoTamanho(grupo)}>
          <i className="bi bi-plus-lg" /> Tamanho
        </button>
      </div>
    </div>
    <div style={{ overflowX: 'auto', padding: '4px 8px 8px' }}>
      <table className="reports-table" style={{ tableLayout: 'auto' }}>
        <thead>
          <tr>
            <th style={rotuloLinha}>Tamanho</th>
            {grupo.tamanhos.map((u) => {
              const cor = corDoTamanho(u);
              return (
                <th key={u.id} style={{ textAlign: 'center', padding: '6px 4px' }}>
                  <button
                    type="button"
                    title="Editar este tamanho"
                    onClick={() => onEditar(u)}
                    style={{
                      background: `${cor}14`, color: cor,
                      border: `1px solid ${cor}55`, borderRadius: '6px',
                      padding: '4px 10px', fontWeight: 700, fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    {u.tamanho}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={rotuloLinha}>Novas</td>
            {grupo.tamanhos.map((u) => (
              <td key={u.id} style={{ textAlign: 'center', padding: '2px' }}>
                <CelulaQtd valor={u.qtdNova} titulo={`Movimentar ${u.nome} ${u.tamanho} (novas)`} onClick={() => onMovimentar(u, 'novo')} />
              </td>
            ))}
          </tr>
          <tr>
            <td style={rotuloLinha}>Usadas</td>
            {grupo.tamanhos.map((u) => (
              <td key={u.id} style={{ textAlign: 'center', padding: '2px' }}>
                <CelulaQtd valor={u.qtdUsada} titulo={`Movimentar ${u.nome} ${u.tamanho} (usadas)`} onClick={() => onMovimentar(u, 'usado')} />
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  </div>
);

const EstoqueUniformesTab: React.FC<{
  onNovo: (base?: { nome: string; codigo: string }) => void;
  onEditar: (uniforme: Uniforme) => void;
  onMovimentar: (uniforme: Uniforme, condicao: CondicaoUniforme) => void;
  onHistorico: (nome: string) => void;
}> = ({ onNovo, onEditar, onMovimentar, onHistorico }) => {
  const query = useUniformes();
  const { canShowEmpty } = useAsyncQueryState(query);
  const [busca, setBusca] = useState('');
  const [somenteBaixo, setSomenteBaixo] = useState(false);

  const grupos = useMemo(() => {
    const termo = normalizarBusca(busca.trim());
    return agrupar(query.data ?? []).filter((g) => {
      if (somenteBaixo && !g.alerta) return false;
      return !termo || normalizarBusca(`${g.nome} ${g.codigo} ${g.tamanhos.map((t) => t.tamanho).join(' ')}`).includes(termo);
    });
  }, [query.data, busca, somenteBaixo]);

  const vazio = (query.data ?? []).length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div className="reports-filters-bar" style={{ flexShrink: 0 }}>
        <div className="reports-filter-left">
          <Busca value={busca} placeholder="Buscar item, referência ou tamanho..." onChange={setBusca} />
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569', cursor: 'pointer' }}>
            <input type="checkbox" checked={somenteBaixo} onChange={(e) => setSomenteBaixo(e.target.checked)} />
            Só estoque baixo ou esgotado
          </label>
        </div>
        <div className="reports-filter-right" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span className="reports-records-count"><strong>{grupos.length}</strong> Itens</span>
          <button type="button" className="reports-action-btn primary" onClick={() => onNovo()}>
            <i className="bi bi-plus-lg" /> Cadastrar item
          </button>
        </div>
      </div>

      {!vazio && (
        <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', fontSize: '12px', color: '#64748b', margin: '-4px 0 12px', flexShrink: 0 }}>
          <span><i className="bi bi-hand-index" /> Clique numa quantidade para dar <strong>entrada</strong>, <strong>ajustar</strong> ou <strong>descartar</strong></span>
          <span><span style={{ color: '#10b981', fontWeight: 700 }}>■</span> Disponível</span>
          <span><span style={{ color: '#f59e0b', fontWeight: 700 }}>■</span> Estoque baixo</span>
          <span><span style={{ color: '#ef4444', fontWeight: 700 }}>■</span> Esgotado</span>
        </div>
      )}

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <QueryDataPanel
        query={query}
        variant="compact"
        loadingMessage="Carregando estoque..."
        refreshingMessage="Atualizando estoque..."
        errorMessage="Não foi possível carregar o estoque. Tente novamente."
      >
        {canShowEmpty && grupos.length === 0 ? (
          <div className="reports-table-card" style={{ padding: '40px 24px', textAlign: 'center', color: '#64748b' }}>
            {vazio ? (
              <>
                <i className="bi bi-box-seam" style={{ fontSize: '32px', color: '#cbd5e1' }} />
                <p style={{ margin: '10px 0 14px' }}>Nenhum uniforme cadastrado ainda.</p>
                <button type="button" className="reports-action-btn primary" onClick={() => onNovo()}>
                  <i className="bi bi-plus-lg" /> Cadastrar o primeiro item
                </button>
              </>
            ) : 'Nenhum item encontrado com esse filtro.'}
          </div>
        ) : (
          grupos.map((g) => (
            <CartaoItem
              key={g.nome}
              grupo={g}
              onEditar={onEditar}
              onMovimentar={onMovimentar}
              onNovoTamanho={(grupo) => onNovo({ nome: grupo.nome, codigo: grupo.codigo })}
              onHistorico={onHistorico}
            />
          ))
        )}
      </QueryDataPanel>
      </div>
    </div>
  );
};

export default EstoqueUniformesTab;
