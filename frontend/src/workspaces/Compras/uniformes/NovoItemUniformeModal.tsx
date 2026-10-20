import React, { useState } from 'react';
import { getComprasErrorMessage } from '../../../hooks/useCompras';
import { useCreateUniformesLote } from '../../../hooks/useUniformes';
import { TAMANHOS_SUGERIDOS, compararTamanho, inputCelula } from './format';
import { Dica, ModalUniformes, SecaoTitulo } from './shared';

interface LinhaTamanho {
  tamanho: string;
  qtdNova: number;
  qtdUsada: number;
  estoqueMinimo: number;
}

const ATALHOS: Array<[string, string[]]> = [
  ['Camisetas (P a 5G)', ['P', 'M', 'G', 'GG', '3G', '4G', '5G']],
  ['Calças (36 a 50)', ['36', '38', '40', '42', '44', '46', '48', '50']],
  ['Tamanho único', ['ÚNICO']],
];

const numero = (valor: string) => Math.max(0, parseInt(valor) || 0);

const NovoItemUniformeModal: React.FC<{
  base?: { nome: string; codigo: string } | null;
  tamanhosExistentes?: string[];
  onClose: () => void;
}> = ({ base, tamanhosExistentes = [], onClose }) => {
  const [nome, setNome] = useState(base?.nome ?? '');
  const [codigo, setCodigo] = useState(base?.codigo ?? '');
  const [linhas, setLinhas] = useState<LinhaTamanho[]>([]);
  const [outro, setOutro] = useState('');
  const criar = useCreateUniformesLote();

  const existentes = new Set(tamanhosExistentes.map((t) => t.toUpperCase()));
  const selecionados = new Set(linhas.map((l) => l.tamanho));

  const adicionar = (tamanhos: string[]) => {
    const novos = tamanhos
      .map((t) => t.trim().toUpperCase())
      .filter((t) => t && !selecionados.has(t) && !existentes.has(t));
    if (novos.length === 0) return;
    setLinhas((atual) =>
      [...atual, ...novos.map((tamanho) => ({ tamanho, qtdNova: 0, qtdUsada: 0, estoqueMinimo: 0 }))]
        .sort((a, b) => compararTamanho(a.tamanho, b.tamanho)),
    );
  };

  const alternar = (tamanho: string) => {
    if (selecionados.has(tamanho)) setLinhas((atual) => atual.filter((l) => l.tamanho !== tamanho));
    else adicionar([tamanho]);
  };

  const atualizar = (tamanho: string, patch: Partial<LinhaTamanho>) =>
    setLinhas((atual) => atual.map((l) => (l.tamanho === tamanho ? { ...l, ...patch } : l)));

  const salvar = () => {
    if (!nome.trim()) {
      alert('Informe o nome do item.');
      return;
    }
    if (linhas.length === 0) {
      alert('Escolha ao menos um tamanho.');
      return;
    }
    criar.mutate({ nome: nome.trim(), codigo: codigo.trim(), tamanhos: linhas }, { onSuccess: onClose });
  };

  return (
    <ModalUniformes
      title={base ? `Novo tamanho — ${base.nome}` : 'Cadastrar item'}
      width={880}
      submitLabel={linhas.length > 1 ? `Cadastrar ${linhas.length} tamanhos` : 'Cadastrar'}
      isPending={criar.isPending}
      error={criar.isError ? getComprasErrorMessage(criar.error, 'Não foi possível cadastrar o item.') : null}
      onClose={onClose}
      onSubmit={salvar}
    >
      <div className="form-grid two-cols" style={{ gridTemplateColumns: '1fr 200px' }}>
        <label>
          Nome do item
          <input
            className="form-input"
            autoFocus={!base}
            disabled={Boolean(base)}
            placeholder="Ex: Camiseta manga curta, Calça, Cordão 30 anos"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </label>
        <label>
          Referência (opcional)
          <input className="form-input" disabled={Boolean(base)} value={codigo} onChange={(e) => setCodigo(e.target.value)} />
        </label>
      </div>

      <SecaoTitulo>Quais tamanhos?</SecaoTitulo>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
        {ATALHOS.map(([rotulo, tamanhos]) => (
          <button
            key={rotulo}
            type="button"
            className="reports-action-btn secondary"
            style={{ height: '28px', fontSize: '12px', padding: '0 10px' }}
            onClick={() => adicionar(tamanhos)}
          >
            + {rotulo}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        {TAMANHOS_SUGERIDOS.filter((t) => !existentes.has(t)).map((t) => {
          const ativo = selecionados.has(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => alternar(t)}
              style={{
                padding: '4px 10px', borderRadius: '14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                border: `1px solid ${ativo ? '#0f85c1' : '#e2e8f0'}`,
                background: ativo ? '#0f85c1' : '#ffffff', color: ativo ? '#ffffff' : '#475569',
              }}
            >
              {t}
            </button>
          );
        })}
        <input
          style={{ ...inputCelula, width: '110px' }}
          placeholder="Outro..."
          value={outro}
          onChange={(e) => setOutro(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              adicionar([outro]);
              setOutro('');
            }
          }}
          onBlur={() => { adicionar([outro]); setOutro(''); }}
        />
      </div>
      {existentes.size > 0 && (
        <p style={{ fontSize: '12px', color: '#94a3b8', margin: '8px 0 0' }}>
          Já cadastrados: {[...existentes].sort(compararTamanho).join(', ')}
        </p>
      )}

      {linhas.length > 0 && (
        <>
          <SecaoTitulo>Estoque inicial</SecaoTitulo>
          <div style={{ maxHeight: 'min(420px, 45vh)', overflowY: 'auto' }}>
            <table className="reports-table">
              <thead>
                <tr>
                  <th>Tamanho</th>
                  <th className="num" style={{ width: '110px' }}>Novas</th>
                  <th className="num" style={{ width: '110px' }}>Usadas</th>
                  <th className="num" style={{ width: '110px' }} title="Avisa quando o total ficar abaixo deste número">Mínimo</th>
                  <th style={{ width: '40px' }} />
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.tamanho}>
                    <td style={{ fontWeight: 700 }}>{l.tamanho}</td>
                    {(['qtdNova', 'qtdUsada', 'estoqueMinimo'] as const).map((campo) => (
                      <td key={campo}>
                        <input
                          type="number"
                          min={0}
                          placeholder="0"
                          style={{ ...inputCelula, textAlign: 'right' }}
                          value={l[campo] || ''}
                          onChange={(e) => atualizar(l.tamanho, { [campo]: numero(e.target.value) })}
                        />
                      </td>
                    ))}
                    <td>
                      <button type="button" className="btn-icon" title="Remover" onClick={() => alternar(l.tamanho)}>
                        <i className="bi bi-x-lg" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Dica>
            As quantidades entram no histórico como "Estoque inicial do cadastro". Depois, use o estoque para dar novas entradas.
          </Dica>
        </>
      )}
    </ModalUniformes>
  );
};

export default NovoItemUniformeModal;
