import type { FormatoTarifaArmazenagem, TabelaArmazenagem } from '../../types/domain';
import { AlcaArraste, reordenarLista, useArrasteLista } from './PropostaArraste';
import {
  cloneTabelaArmazenagem,
  CODIGOS_ARMAZENAGEM,
  FORMATOS_TARIFA_ARMAZENAGEM,
  formatarValorTarifaArmazenagem,
  normalizarCodigoArmazenagem,
  placeholderTarifaArmazenagem,
  TABELA_ARMAZENAGEM_PADRAO,
} from '../../types/domain';

type TabelaUpdater = (atual: TabelaArmazenagem) => TabelaArmazenagem;

type Props = {
  tabela: TabelaArmazenagem;
  canEdit: boolean;
  onChange: (updater: TabelaUpdater) => void;
};

function valorNoFormato(valor: string, formato: FormatoTarifaArmazenagem) {
  return valor.trim() ? formatarValorTarifaArmazenagem(valor, formato) : valor;
}

function CampoValor({
  valor,
  formato,
  canEdit,
  onChangeValor,
  onFormatar,
  onTrocarFormato,
}: {
  valor: string;
  formato: FormatoTarifaArmazenagem;
  canEdit: boolean;
  onChangeValor: (valor: string) => void;
  onFormatar: () => void;
  onTrocarFormato: (formato: FormatoTarifaArmazenagem) => void;
}) {
  return (
    <div className="proposta-armazenagem-valor">
      <select
        className="proposta-destinos-input proposta-armazenagem-formato"
        value={formato}
        disabled={!canEdit}
        aria-label="Tipo do valor"
        onChange={(e) => onTrocarFormato(e.target.value as FormatoTarifaArmazenagem)}
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
        onBlur={onFormatar}
      />
    </div>
  );
}

export default function PropostaTabelaArmazenagem({ tabela, canEdit, onChange }: Props) {
  const dados = cloneTabelaArmazenagem(tabela);
  const arrasteItens = useArrasteLista(canEdit);
  const arrasteHora = useArrasteLista(canEdit);

  const alterar = (patcher: (dados: TabelaArmazenagem) => TabelaArmazenagem) => {
    onChange((atual) => patcher(cloneTabelaArmazenagem(atual)));
  };

  return (
    <div className="proposta-destinos-card proposta-armazenagem-card">
      <div className="proposta-destinos-head">
        <h4>Tarifas de armazenagem</h4>
        {canEdit ? (
          <button
            type="button"
            className="proposta-secao-add"
            onClick={() => alterar((atual) => ({
              ...atual,
              itens: [...atual.itens, { rotulo: '', valor: '', formato: 'moeda' }],
            }))}
          >
            <i className="bi bi-plus-lg" aria-hidden="true" />
            Adicionar
          </button>
        ) : null}
      </div>
      <div className="proposta-armazenagem-meta">
        <div>
          <span>Código</span>
          <div className="proposta-armazenagem-codigo" role="group" aria-label="Código">
            {CODIGOS_ARMAZENAGEM.map((opcao) => {
              const marcado = normalizarCodigoArmazenagem(dados.codigo) === opcao;
              return (
                <label key={opcao} className={marcado ? 'is-selected' : undefined}>
                  <input
                    type="checkbox"
                    checked={marcado}
                    disabled={!canEdit}
                    onChange={() => alterar((atual) => ({ ...atual, codigo: opcao }))}
                  />
                  {opcao}
                </label>
              );
            })}
          </div>
        </div>
        <div>
          <span>Unidade</span>
          <strong>{TABELA_ARMAZENAGEM_PADRAO.local}</strong>
        </div>
      </div>
      <div className="table-container proposta-destinos-wrap" ref={arrasteItens.refCaixa}>
        <table className="erp-table reports-table comercial-browse-table proposta-destinos-table proposta-armazenagem-table">
          <thead>
            <tr>
              {canEdit ? <th className="col-drag" aria-label="Ordem" /> : null}
              <th>Armazém</th>
              <th className="col-valor">Valor</th>
              {canEdit ? <th className="col-actions" aria-label="Excluir" /> : null}
            </tr>
          </thead>
          <tbody>
            {dados.itens.map((item, index) => (
              <tr
                key={`item-${index}`}
                {...arrasteItens.propsLinha(index, (de, para) => alterar((atual) => ({
                  ...atual,
                  itens: reordenarLista(atual.itens, de, para),
                })))}
              >
                {canEdit ? (
                  <td className="col-drag">
                    <AlcaArraste {...arrasteItens.propsAlca(index)} />
                  </td>
                ) : null}
                <td>
                  <input
                    className="proposta-destinos-input"
                    value={item.rotulo}
                    disabled={!canEdit}
                    onChange={(e) => {
                      const rotulo = e.target.value;
                      alterar((atual) => ({
                        ...atual,
                        itens: atual.itens.map((linha, i) => (i === index ? { ...linha, rotulo } : linha)),
                      }));
                    }}
                  />
                </td>
                <td>
                  <CampoValor
                    valor={item.valor}
                    formato={item.formato}
                    canEdit={canEdit}
                    onChangeValor={(valor) => alterar((atual) => ({
                      ...atual,
                      itens: atual.itens.map((linha, i) => (i === index ? { ...linha, valor } : linha)),
                    }))}
                    onFormatar={() => alterar((atual) => ({
                      ...atual,
                      itens: atual.itens.map((linha, i) => (
                        i === index ? { ...linha, valor: valorNoFormato(linha.valor, linha.formato) } : linha
                      )),
                    }))}
                    onTrocarFormato={(formato) => alterar((atual) => ({
                      ...atual,
                      itens: atual.itens.map((linha, i) => (
                        i === index
                          ? { ...linha, formato, valor: valorNoFormato(linha.valor, formato) }
                          : linha
                      )),
                    }))}
                  />
                </td>
                {canEdit ? (
                  <td className="col-actions">
                    <button
                      type="button"
                      className="btn-icon"
                      title="Remover"
                      disabled={dados.itens.length <= 1}
                      onClick={() => alterar((atual) => ({
                        ...atual,
                        itens: atual.itens.filter((_, i) => i !== index),
                      }))}
                    >
                      <i className="bi bi-trash" />
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {arrasteItens.marca}
      </div>

      <div className="proposta-destinos-head proposta-armazenagem-subhead">
        {canEdit ? (
          <input
            className="proposta-destinos-input proposta-armazenagem-titulo"
            value={dados.horaExtraTitulo}
            aria-label="Título da hora extra"
            onChange={(e) => {
              const horaExtraTitulo = e.target.value;
              alterar((atual) => ({ ...atual, horaExtraTitulo }));
            }}
          />
        ) : (
          <h4>{dados.horaExtraTitulo}</h4>
        )}
      </div>
      <div className="table-container proposta-destinos-wrap" ref={arrasteHora.refCaixa}>
        <table className="erp-table reports-table comercial-browse-table proposta-destinos-table proposta-armazenagem-table">
          <thead>
            <tr>
              {canEdit ? <th className="col-drag" aria-label="Ordem" /> : null}
              <th>Período</th>
              <th className="col-valor">Valor</th>
            </tr>
          </thead>
          <tbody>
            {dados.horaExtra.map((item, index) => (
              <tr
                key={`hora-${index}`}
                {...arrasteHora.propsLinha(index, (de, para) => alterar((atual) => ({
                  ...atual,
                  horaExtra: reordenarLista(atual.horaExtra, de, para),
                })))}
              >
                {canEdit ? (
                  <td className="col-drag">
                    <AlcaArraste {...arrasteHora.propsAlca(index)} />
                  </td>
                ) : null}
                <td>
                  <input
                    className="proposta-destinos-input"
                    value={item.periodo}
                    disabled={!canEdit}
                    onChange={(e) => {
                      const periodo = e.target.value;
                      alterar((atual) => ({
                        ...atual,
                        horaExtra: atual.horaExtra.map((linha, i) => (i === index ? { ...linha, periodo } : linha)),
                      }));
                    }}
                  />
                </td>
                <td>
                  <CampoValor
                    valor={item.valor}
                    formato={item.formato}
                    canEdit={canEdit}
                    onChangeValor={(valor) => alterar((atual) => ({
                      ...atual,
                      horaExtra: atual.horaExtra.map((linha, i) => (i === index ? { ...linha, valor } : linha)),
                    }))}
                    onFormatar={() => alterar((atual) => ({
                      ...atual,
                      horaExtra: atual.horaExtra.map((linha, i) => (
                        i === index ? { ...linha, valor: valorNoFormato(linha.valor, linha.formato) } : linha
                      )),
                    }))}
                    onTrocarFormato={(formato) => alterar((atual) => ({
                      ...atual,
                      horaExtra: atual.horaExtra.map((linha, i) => (
                        i === index
                          ? { ...linha, formato, valor: valorNoFormato(linha.valor, formato) }
                          : linha
                      )),
                    }))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {arrasteHora.marca}
      </div>
      <label className="proposta-armazenagem-expediente">
        <span>Expediente do CD</span>
        <input
          className="proposta-destinos-input"
          value={dados.expediente}
          disabled={!canEdit}
          onChange={(e) => {
            const expediente = e.target.value;
            alterar((atual) => ({ ...atual, expediente }));
          }}
        />
      </label>
    </div>
  );
}
