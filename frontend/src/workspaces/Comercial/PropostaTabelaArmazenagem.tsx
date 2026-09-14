import type { FormatoTarifaArmazenagem, TabelaArmazenagem } from '../../types/domain';
import {
  cloneTabelaArmazenagem,
  FORMATOS_TARIFA_ARMAZENAGEM,
  formatarValorTarifaArmazenagem,
  placeholderTarifaArmazenagem,
  TABELA_ARMAZENAGEM_PADRAO,
} from '../../types/domain';

type Props = {
  tabela: TabelaArmazenagem;
  canEdit: boolean;
  onChange: (tabela: TabelaArmazenagem) => void;
};

function CampoValor({
  valor,
  formato,
  canEdit,
  onChangeValor,
  onChangeFormato,
}: {
  valor: string;
  formato: FormatoTarifaArmazenagem;
  canEdit: boolean;
  onChangeValor: (valor: string) => void;
  onChangeFormato: (formato: FormatoTarifaArmazenagem) => void;
}) {
  return (
    <div className="proposta-armazenagem-valor">
      <select
        className="proposta-destinos-input proposta-armazenagem-formato"
        value={formato}
        disabled={!canEdit}
        aria-label="Tipo do valor"
        onChange={(e) => {
          const proximo = e.target.value as FormatoTarifaArmazenagem;
          onChangeFormato(proximo);
          if (valor.trim()) onChangeValor(formatarValorTarifaArmazenagem(valor, proximo));
        }}
      >
        {FORMATOS_TARIFA_ARMAZENAGEM.map((opcao) => (
          <option key={opcao.key} value={opcao.key}>{opcao.label}</option>
        ))}
      </select>
      <input
        className="proposta-destinos-input"
        value={valor}
        disabled={!canEdit}
        placeholder={placeholderTarifaArmazenagem(formato)}
        aria-invalid={!valor.trim()}
        onChange={(e) => onChangeValor(e.target.value)}
        onBlur={() => {
          if (valor.trim()) onChangeValor(formatarValorTarifaArmazenagem(valor, formato));
        }}
      />
    </div>
  );
}

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
            onClick={() => update({ itens: [...dados.itens, { rotulo: '', valor: '', formato: 'moeda' }] })}
          >
            <i className="bi bi-plus-lg" aria-hidden="true" />
            Adicionar
          </button>
        ) : null}
      </div>
      <div className="proposta-armazenagem-meta">
        <div>
          <span>Código</span>
          <strong>{TABELA_ARMAZENAGEM_PADRAO.codigo}</strong>
        </div>
        <div>
          <span>Unidade</span>
          <strong>{TABELA_ARMAZENAGEM_PADRAO.local}</strong>
        </div>
      </div>
      <div className="table-container proposta-destinos-wrap">
        <table className="data-table comercial-browse-table proposta-destinos-table proposta-armazenagem-table">
          <thead>
            <tr>
              <th>Armazém</th>
              <th className="col-valor">Valor</th>
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
                  <CampoValor
                    valor={item.valor}
                    formato={item.formato}
                    canEdit={canEdit}
                    onChangeValor={(valor) => update({
                      itens: dados.itens.map((linha, i) => (i === index ? { ...linha, valor } : linha)),
                    })}
                    onChangeFormato={(formato) => update({
                      itens: dados.itens.map((linha, i) => (i === index ? { ...linha, formato } : linha)),
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
        <h4>{TABELA_ARMAZENAGEM_PADRAO.horaExtraTitulo}</h4>
      </div>
      <div className="table-container proposta-destinos-wrap">
        <table className="data-table comercial-browse-table proposta-destinos-table proposta-armazenagem-table">
          <thead>
            <tr>
              <th>Período</th>
              <th className="col-valor">Valor</th>
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
                  <CampoValor
                    valor={item.valor}
                    formato={item.formato}
                    canEdit={canEdit}
                    onChangeValor={(valor) => update({
                      horaExtra: dados.horaExtra.map((linha, i) => (i === index ? { ...linha, valor } : linha)),
                    })}
                    onChangeFormato={(formato) => update({
                      horaExtra: dados.horaExtra.map((linha, i) => (i === index ? { ...linha, formato } : linha)),
                    })}
                  />
                </td>
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
