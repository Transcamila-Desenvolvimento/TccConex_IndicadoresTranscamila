import type { TabelaArmazenagem } from '../../types/domain';
import { cloneTabelaArmazenagem } from '../../types/domain';

type Props = {
  tabela: TabelaArmazenagem;
  canEdit: boolean;
  onChange: (tabela: TabelaArmazenagem) => void;
};

export default function PropostaTabelaArmazenagem({ tabela, canEdit, onChange }: Props) {
  const dados = cloneTabelaArmazenagem(tabela);

  const update = (patch: Partial<TabelaArmazenagem>) => {
    onChange({ ...dados, ...patch });
  };

  return (
    <div className="proposta-destinos-card proposta-armazenagem-card">
      <div className="proposta-destinos-head">
        <h4>Tarifas de armazenagem</h4>
        {canEdit ? (
          <button
            type="button"
            className="proposta-secao-add"
            onClick={() => update({ itens: [...dados.itens, { rotulo: '', valor: '' }] })}
          >
            <i className="bi bi-plus-lg" aria-hidden="true" />
            Adicionar
          </button>
        ) : null}
      </div>
      <div className="proposta-armazenagem-meta">
        <label>
          <span>Código</span>
          <input className="proposta-destinos-input" value={dados.codigo} disabled={!canEdit} onChange={(e) => update({ codigo: e.target.value })} />
        </label>
        <label>
          <span>Unidade</span>
          <input className="proposta-destinos-input" value={dados.local} disabled={!canEdit} onChange={(e) => update({ local: e.target.value })} placeholder="RONDONÓPOLIS-MT" />
        </label>
        <label>
          <span>Período inicial</span>
          <input className="proposta-destinos-input" type="date" value={dados.periodoInicio} disabled={!canEdit} onChange={(e) => update({ periodoInicio: e.target.value })} />
        </label>
        <label>
          <span>Período final</span>
          <input className="proposta-destinos-input" type="date" value={dados.periodoFim} disabled={!canEdit} onChange={(e) => update({ periodoFim: e.target.value })} />
        </label>
      </div>
      <div className="table-container proposta-destinos-wrap">
        <table className="data-table comercial-browse-table proposta-destinos-table proposta-armazenagem-table">
          <thead>
            <tr>
              <th>Armazém</th>
              <th className="col-valor">
                <input
                  className="proposta-destinos-input proposta-armazenagem-unidade"
                  value={dados.unidade}
                  disabled={!canEdit}
                  onChange={(e) => update({ unidade: e.target.value })}
                  aria-label="Unidade da tabela"
                />
              </th>
              {canEdit ? <th className="col-actions" /> : null}
            </tr>
          </thead>
          <tbody>
            {dados.itens.map((item, index) => (
              <tr key={`item-${index}`}>
                <td>
                  <input
                    className="proposta-destinos-input"
                    value={item.rotulo}
                    disabled={!canEdit}
                    onChange={(e) => update({
                      itens: dados.itens.map((linha, i) => (i === index ? { ...linha, rotulo: e.target.value } : linha)),
                    })}
                  />
                </td>
                <td>
                  <input
                    className="proposta-destinos-input"
                    value={item.valor}
                    disabled={!canEdit}
                    onChange={(e) => update({
                      itens: dados.itens.map((linha, i) => (i === index ? { ...linha, valor: e.target.value } : linha)),
                    })}
                  />
                </td>
                {canEdit ? (
                  <td className="col-actions">
                    <button
                      type="button"
                      className="btn-icon"
                      title="Remover"
                      disabled={dados.itens.length <= 1}
                      onClick={() => update({ itens: dados.itens.filter((_, i) => i !== index) })}
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

      <div className="proposta-destinos-head proposta-armazenagem-subhead">
        <h4>
          <input
            className="proposta-destinos-input proposta-armazenagem-titulo"
            value={dados.horaExtraTitulo}
            disabled={!canEdit}
            onChange={(e) => update({ horaExtraTitulo: e.target.value })}
          />
        </h4>
        {canEdit ? (
          <button
            type="button"
            className="proposta-secao-add"
            onClick={() => update({ horaExtra: [...dados.horaExtra, { periodo: '', valor: '' }] })}
          >
            <i className="bi bi-plus-lg" aria-hidden="true" />
            Adicionar
          </button>
        ) : null}
      </div>
      <div className="table-container proposta-destinos-wrap">
        <table className="data-table comercial-browse-table proposta-destinos-table proposta-armazenagem-table">
          <thead>
            <tr>
              <th>Período</th>
              <th className="col-valor">Valor</th>
              {canEdit ? <th className="col-actions" /> : null}
            </tr>
          </thead>
          <tbody>
            {dados.horaExtra.map((item, index) => (
              <tr key={`hora-${index}`}>
                <td>
                  <input
                    className="proposta-destinos-input"
                    value={item.periodo}
                    disabled={!canEdit}
                    onChange={(e) => update({
                      horaExtra: dados.horaExtra.map((linha, i) => (i === index ? { ...linha, periodo: e.target.value } : linha)),
                    })}
                  />
                </td>
                <td>
                  <input
                    className="proposta-destinos-input"
                    value={item.valor}
                    disabled={!canEdit}
                    onChange={(e) => update({
                      horaExtra: dados.horaExtra.map((linha, i) => (i === index ? { ...linha, valor: e.target.value } : linha)),
                    })}
                  />
                </td>
                {canEdit ? (
                  <td className="col-actions">
                    <button
                      type="button"
                      className="btn-icon"
                      title="Remover"
                      disabled={dados.horaExtra.length <= 1}
                      onClick={() => update({ horaExtra: dados.horaExtra.filter((_, i) => i !== index) })}
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
      <label className="proposta-armazenagem-expediente">
        <span>Expediente do CD</span>
        <input
          className="proposta-destinos-input"
          value={dados.expediente}
          disabled={!canEdit}
          onChange={(e) => update({ expediente: e.target.value })}
        />
      </label>
    </div>
  );
}
