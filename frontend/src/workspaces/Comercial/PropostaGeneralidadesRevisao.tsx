import type { PropostaCondicaoComercial } from '../../types/domain';

type Props = {
  titulo: string;
  items: PropostaCondicaoComercial[];
  canEdit: boolean;
  emptyHint: string;
  onChange: (items: PropostaCondicaoComercial[]) => void;
};

export default function PropostaGeneralidadesRevisao({
  titulo,
  items,
  canEdit,
  emptyHint,
  onChange,
}: Props) {
  const updateItem = (index: number, patch: Partial<PropostaCondicaoComercial>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  return (
    <div className="proposta-destinos-card proposta-generalidades-revisao">
      <div className="proposta-destinos-head">
        <h4>{titulo}</h4>
        {canEdit ? (
          <button
            type="button"
            className="proposta-secao-add"
            onClick={() => onChange([...items, { rotulo: '', valor: '' }])}
          >
            <i className="bi bi-plus-lg" aria-hidden="true" />
            Adicionar
          </button>
        ) : null}
      </div>
      {items.length === 0 ? (
        <p className="proposta-modalidades-hint">{emptyHint}</p>
      ) : (
        <div className="table-container proposta-destinos-wrap proposta-generalidades-wrap">
          <table className="data-table comercial-browse-table proposta-destinos-table comercial-generalidades-table">
            <colgroup>
              <col className="col-item" />
              <col className="col-condicao" />
              {canEdit ? <col className="col-actions" /> : null}
            </colgroup>
            <thead>
              <tr>
                <th className="col-item">Item</th>
                <th className="col-condicao">Condição</th>
                {canEdit ? <th className="col-actions" /> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={`${item.rotulo}-${index}`}>
                  <td>
                    <input
                      className="proposta-destinos-input"
                      value={item.rotulo}
                      disabled={!canEdit}
                      onChange={(e) => updateItem(index, { rotulo: e.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      className="proposta-destinos-input"
                      value={item.valor}
                      disabled={!canEdit}
                      maxLength={800}
                      onChange={(e) => updateItem(index, { valor: e.target.value })}
                    />
                  </td>
                  {canEdit ? (
                    <td className="col-actions">
                      <button
                        type="button"
                        className="btn-icon"
                        title="Remover"
                        onClick={() => onChange(items.filter((_, i) => i !== index))}
                      >
                        <i className="bi bi-trash" />
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
