import React, { useState } from 'react';
import { getComprasErrorMessage } from '../../../hooks/useCompras';
import { useDeleteUniforme, useUpdateUniforme } from '../../../hooks/useUniformes';
import type { Uniforme } from '../../../types/domain';
import { TAMANHOS_SUGERIDOS } from './format';
import { Dica, ModalUniformes } from './shared';

const UniformeFormModal: React.FC<{ uniforme: Uniforme; onClose: () => void }> = ({ uniforme, onClose }) => {
  const [form, setForm] = useState({
    nome: uniforme.nome,
    codigo: uniforme.codigo,
    tamanho: uniforme.tamanho,
    estoqueMinimo: uniforme.estoqueMinimo,
  });
  const update = useUpdateUniforme();
  const remover = useDeleteUniforme();

  const salvar = () => {
    if (!form.nome.trim() || !form.tamanho.trim()) {
      alert('Informe o nome e o tamanho.');
      return;
    }
    update.mutate(
      { id: uniforme.id, nome: form.nome.trim(), codigo: form.codigo.trim(), tamanho: form.tamanho.trim(), estoqueMinimo: form.estoqueMinimo },
      { onSuccess: onClose },
    );
  };

  const excluir = () => {
    if (!confirm(`Excluir "${uniforme.nome}" tamanho ${uniforme.tamanho}?`)) return;
    remover.mutate(uniforme.id, {
      onSuccess: onClose,
      onError: (err) => alert(getComprasErrorMessage(err, 'Não foi possível excluir.')),
    });
  };

  return (
    <ModalUniformes
      title={`Editar — ${uniforme.nome} ${uniforme.tamanho}`}
      submitLabel="Salvar alterações"
      isPending={update.isPending}
      error={update.isError ? getComprasErrorMessage(update.error, 'Não foi possível salvar.') : null}
      onClose={onClose}
      onSubmit={salvar}
      footerExtra={
        <button
          type="button"
          className="reports-action-btn secondary"
          style={{ marginRight: 'auto', color: '#ef4444' }}
          disabled={remover.isPending}
          onClick={excluir}
        >
          <i className="bi bi-trash3" /> Excluir tamanho
        </button>
      }
    >
      <div className="form-grid two-cols">
        <label>
          Nome do item
          <input className="form-input" required value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
        </label>
        <label>
          Referência
          <input className="form-input" placeholder="Opcional" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} />
        </label>
        <label>
          Tamanho
          <input
            className="form-input"
            required
            list="uniforme-tamanhos"
            value={form.tamanho}
            onChange={(e) => setForm({ ...form, tamanho: e.target.value.toUpperCase() })}
          />
          <datalist id="uniforme-tamanhos">
            {TAMANHOS_SUGERIDOS.map((t) => <option key={t} value={t} />)}
          </datalist>
        </label>
        <label>
          Estoque mínimo
          <input
            className="form-input"
            type="number"
            min={0}
            value={form.estoqueMinimo}
            onChange={(e) => setForm({ ...form, estoqueMinimo: Math.max(0, parseInt(e.target.value) || 0) })}
          />
        </label>
      </div>
      <Dica>
        Saldo atual: <strong>{uniforme.qtdNova}</strong> novas e <strong>{uniforme.qtdUsada}</strong> usadas. Para mudar quantidades,
        clique no número na tela de estoque. Só dá para excluir um tamanho que nunca teve movimentação.
      </Dica>
    </ModalUniformes>
  );
};

export default UniformeFormModal;
