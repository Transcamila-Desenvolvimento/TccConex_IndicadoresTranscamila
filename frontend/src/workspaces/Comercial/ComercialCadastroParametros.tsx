import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import QueryDataPanel from '../../components/QueryDataPanel';
import { useAuth } from '../../contexts/AuthContext';
import { userHasFuncao } from '../../constants/funcoes';
import {
  getComercialErrorMessage,
  useComercialParametros,
  useRestaurarComercialParametros,
  useSaveComercialParametros,
} from '../../hooks/useComercialClientes';
import type { ParametrosComercial } from '../../types/domain';
import ComercialVeiculosCatalogo from './ComercialVeiculosCatalogo';

type ListaKey = 'validades' | 'vigencias' | 'prazosFaturamento';
type PadraoKey = 'validadePadrao' | 'vigenciaPadrao' | 'faturamentoPadrao';

type FormState = {
  validades: string[];
  validadePadrao: string;
  vigencias: string[];
  vigenciaPadrao: string;
  prazosFaturamento: string[];
  faturamentoPadrao: string;
  logoPdfUrl: string | null;
  logoEmailUrl: string | null;
};

const emptyForm = (): FormState => ({
  validades: [],
  validadePadrao: '',
  vigencias: [],
  vigenciaPadrao: '',
  prazosFaturamento: [],
  faturamentoPadrao: '',
  logoPdfUrl: null,
  logoEmailUrl: null,
});

type Unidade = { value: string; singular: string; plural: string; max: number };

const UNIDADES_VALIDADE: Unidade[] = [
  { value: 'dias', singular: 'dia', plural: 'dias', max: 3650 },
  { value: 'meses', singular: 'mês', plural: 'meses', max: 120 },
  { value: 'anos', singular: 'ano', plural: 'anos', max: 10 },
];

const UNIDADES_VIGENCIA: Unidade[] = [
  { value: 'meses', singular: 'mês', plural: 'meses', max: 600 },
  { value: 'anos', singular: 'ano', plural: 'anos', max: 50 },
];

const VIGENCIA_INDETERMINADA = 'Indeterminada';
const PERIODICIDADES_FATURAMENTO = ['Semanal', 'Quinzenal', 'Mensal'];
const DDL_MAX = 365;

const inteiroValido = (valor: string, max: number): number | null => {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 && numero <= max ? numero : null;
};

const fromApi = (data: ParametrosComercial): FormState => ({
  validades: [...(data.validades ?? [])],
  validadePadrao: data.validadePadrao || '',
  vigencias: [...(data.vigencias ?? [])],
  vigenciaPadrao: data.vigenciaPadrao || '',
  prazosFaturamento: [...(data.prazosFaturamento ?? [])],
  faturamentoPadrao: data.faturamentoPadrao || '',
  logoPdfUrl: data.logoPdfUrl ?? null,
  logoEmailUrl: data.logoEmailUrl ?? null,
});

const readFileAsDataUrl = (file: File): Promise<string> => (
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.readAsDataURL(file);
  })
);

function AddPreview({ texto }: { texto: string | null }) {
  return (
    <span className="comercial-param-add-preview">
      {texto ? <>Será cadastrado: <strong>{texto}</strong></> : 'Preencha os campos'}
    </span>
  );
}

function AddButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button type="button" className="reports-action-btn secondary" disabled={disabled} onClick={onClick}>
      Adicionar
    </button>
  );
}

type QuantidadeAddProps = {
  unidades: Unidade[];
  opcaoFixa?: string;
  onAdd: (valor: string) => void;
};

function QuantidadeAdd({ unidades, opcaoFixa, onAdd }: QuantidadeAddProps) {
  const [quantidade, setQuantidade] = useState('');
  const [unidadeValue, setUnidadeValue] = useState(unidades[0].value);
  const fixa = opcaoFixa !== undefined && unidadeValue === opcaoFixa;
  const unidade = unidades.find((item) => item.value === unidadeValue) ?? unidades[0];
  const numero = fixa ? null : inteiroValido(quantidade, unidade.max);
  const texto = fixa
    ? opcaoFixa
    : numero
      ? `${numero} ${numero === 1 ? unidade.singular : unidade.plural}`
      : null;

  const handleAdd = () => {
    if (!texto) return;
    onAdd(texto);
    setQuantidade('');
  };

  return (
    <div className="comercial-param-add">
      <input
        type="number"
        min={1}
        max={unidade.max}
        step={1}
        value={fixa ? '' : quantidade}
        disabled={fixa}
        placeholder="Qtd."
        aria-label="Quantidade"
        onChange={(e) => setQuantidade(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
          }
        }}
      />
      <select value={unidadeValue} aria-label="Unidade" onChange={(e) => setUnidadeValue(e.target.value)}>
        {unidades.map((item) => (
          <option key={item.value} value={item.value}>{item.plural}</option>
        ))}
        {opcaoFixa !== undefined ? <option value={opcaoFixa}>{opcaoFixa}</option> : null}
      </select>
      <AddPreview texto={texto} />
      <AddButton disabled={!texto} onClick={handleAdd} />
    </div>
  );
}

function FaturamentoAdd({ onAdd }: { onAdd: (valor: string) => void }) {
  const [periodicidade, setPeriodicidade] = useState('');
  const [ddl, setDdl] = useState('');
  const ddlNumero = ddl.trim() ? inteiroValido(ddl, DDL_MAX) : null;
  const ddlInvalido = ddl.trim() !== '' && ddlNumero === null;
  const texto = ddlInvalido
    ? null
    : periodicidade && ddlNumero
      ? `${periodicidade} / ${ddlNumero} DDL`
      : periodicidade || (ddlNumero ? `${ddlNumero} DDL` : null);

  const handleAdd = () => {
    if (!texto) return;
    onAdd(texto);
    setPeriodicidade('');
    setDdl('');
  };

  return (
    <div className="comercial-param-add">
      <select value={periodicidade} aria-label="Periodicidade" onChange={(e) => setPeriodicidade(e.target.value)}>
        <option value="">Sem periodicidade</option>
        {PERIODICIDADES_FATURAMENTO.map((item) => (
          <option key={item} value={item}>{item}</option>
        ))}
      </select>
      <input
        type="number"
        min={1}
        max={DDL_MAX}
        step={1}
        value={ddl}
        placeholder="DDL"
        aria-label="Dias de prazo (DDL)"
        onChange={(e) => setDdl(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
          }
        }}
      />
      <AddPreview texto={texto} />
      <AddButton disabled={!texto} onClick={handleAdd} />
    </div>
  );
}

type ListaEditorProps = {
  titulo: string;
  descricao: string;
  items: string[];
  padrao: string;
  canManage: boolean;
  adicionar: React.ReactNode;
  defaultOpen?: boolean;
  onRemove: (valor: string) => void;
  onPadrao: (valor: string) => void;
};

function ListaEditor({
  titulo,
  descricao,
  items,
  padrao,
  canManage,
  adicionar,
  defaultOpen = false,
  onRemove,
  onPadrao,
}: ListaEditorProps) {
  const [aberta, setAberta] = useState(defaultOpen);
  const painelId = useId();

  return (
    <section className={`comercial-param-card comercial-param-accordion${aberta ? ' is-open' : ''}`}>
      <button
        type="button"
        className="comercial-param-accordion-toggle"
        aria-expanded={aberta}
        aria-controls={painelId}
        onClick={() => setAberta((atual) => !atual)}
      >
        <span className="comercial-param-accordion-copy">
          <span className="comercial-param-accordion-title">{titulo}</span>
          <span className="comercial-param-accordion-desc">{descricao}</span>
        </span>
        <i className={`bi ${aberta ? 'bi-chevron-up' : 'bi-chevron-down'}`} aria-hidden="true" />
      </button>
      {aberta ? (
        <div id={painelId} className="comercial-param-accordion-body">
          <ul className="comercial-param-list">
            {items.map((item) => (
              <li key={item} className={item === padrao ? 'is-padrao' : undefined}>
                <label className="comercial-param-option">
                  <input
                    type="radio"
                    name={`padrao-${titulo}`}
                    checked={item === padrao}
                    disabled={!canManage}
                    onChange={() => onPadrao(item)}
                  />
                  <span>{item}</span>
                  {item === padrao ? <em>padrão</em> : null}
                </label>
                {canManage ? (
                  <button
                    type="button"
                    className="comercial-param-remove"
                    title={`Remover ${item}`}
                    disabled={items.length <= 1}
                    onClick={() => onRemove(item)}
                  >
                    <i className="bi bi-trash" aria-hidden />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {canManage ? adicionar : null}
        </div>
      ) : null}
    </section>
  );
}

type LogoFieldProps = {
  label: string;
  hint: string;
  value: string | null;
  canManage: boolean;
  onChange: (url: string | null) => void;
};

function LogoField({ label, hint, value, canManage, onChange }: LogoFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      window.alert('Selecione uma imagem (PNG, JPG ou WEBP).');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      window.alert('A logo deve ter no máximo 2 MB.');
      return;
    }
    try {
      onChange(await readFileAsDataUrl(file));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Não foi possível carregar a imagem.');
    }
  };

  return (
    <section className="comercial-param-card comercial-param-card--logo">
      <header className="comercial-param-card-head">
        <h2>{label}</h2>
        <p>{hint}</p>
      </header>
      <div className="comercial-param-logo">
        <div className="comercial-param-logo-preview">
          {value ? (
            <img src={value} alt={`Pré-visualização — ${label}`} />
          ) : (
            <span>Sem logo (usa a padrão do sistema)</span>
          )}
        </div>
        {canManage ? (
          <div className="comercial-param-logo-actions">
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={(e) => {
                void handleFile(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              className="reports-action-btn secondary"
              onClick={() => inputRef.current?.click()}
            >
              Escolher imagem
            </button>
            {value ? (
              <button
                type="button"
                className="reports-action-btn secondary"
                onClick={() => onChange(null)}
              >
                Remover
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function ComercialCadastroParametros({ secao }: { secao: 'prazos' | 'logos' }) {
  const { user } = useAuth();
  const canManage = userHasFuncao(user, 'Comercial', 'gerenciar-parametros');
  const parametrosQuery = useComercialParametros();
  const saveParametros = useSaveComercialParametros();
  const restaurarParametros = useRestaurarComercialParametros();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [baseline, setBaseline] = useState<FormState>(emptyForm);

  useEffect(() => {
    if (parametrosQuery.data) {
      const next = fromApi(parametrosQuery.data);
      setForm(next);
      setBaseline(next);
    }
  }, [parametrosQuery.data]);

  const isDirty = useMemo(() => {
    if (secao === 'prazos') {
      return (
        JSON.stringify({
          validades: form.validades,
          validadePadrao: form.validadePadrao,
          vigencias: form.vigencias,
          vigenciaPadrao: form.vigenciaPadrao,
          prazosFaturamento: form.prazosFaturamento,
          faturamentoPadrao: form.faturamentoPadrao,
        }) !== JSON.stringify({
          validades: baseline.validades,
          validadePadrao: baseline.validadePadrao,
          vigencias: baseline.vigencias,
          vigenciaPadrao: baseline.vigenciaPadrao,
          prazosFaturamento: baseline.prazosFaturamento,
          faturamentoPadrao: baseline.faturamentoPadrao,
        })
      );
    }
    return (
      form.logoPdfUrl !== baseline.logoPdfUrl
      || form.logoEmailUrl !== baseline.logoEmailUrl
    );
  }, [form, baseline, secao]);

  const updateLista = (key: ListaKey, items: string[]) => {
    setForm((current) => {
      const next = { ...current, [key]: items };
      const padraoKey: PadraoKey = key === 'validades'
        ? 'validadePadrao'
        : key === 'vigencias'
          ? 'vigenciaPadrao'
          : 'faturamentoPadrao';
      if (!items.includes(next[padraoKey])) {
        next[padraoKey] = items[0] || '';
      }
      return next;
    });
  };

  const addItem = (key: ListaKey, texto: string) => {
    setForm((current) => {
      if (current[key].includes(texto)) return current;
      return { ...current, [key]: [...current[key], texto] };
    });
  };

  const removeItem = (key: ListaKey, valor: string) => {
    updateLista(key, form[key].filter((item) => item !== valor));
  };

  const handleSave = (event?: React.FormEvent) => {
    event?.preventDefault();
    saveParametros.mutate({
      validades: form.validades,
      validadePadrao: form.validadePadrao,
      vigencias: form.vigencias,
      vigenciaPadrao: form.vigenciaPadrao,
      prazosFaturamento: form.prazosFaturamento,
      faturamentoPadrao: form.faturamentoPadrao,
      logoPdfUrl: form.logoPdfUrl,
      logoEmailUrl: form.logoEmailUrl,
    }, {
      onSuccess: (data) => {
        const next = fromApi(data);
        setForm(next);
        setBaseline(next);
      },
      onError: (err) => alert(getComercialErrorMessage(err)),
    });
  };

  const handleRestaurar = () => {
    if (!window.confirm(
      'Restaurar validades, vigências e prazos de faturamento ao padrão? As logos não serão alteradas.',
    )) {
      return;
    }
    restaurarParametros.mutate(undefined, {
      onSuccess: (data) => {
        const next = fromApi(data);
        setForm(next);
        setBaseline(next);
      },
      onError: (err) => alert(getComercialErrorMessage(err)),
    });
  };

  const titulo = secao === 'prazos' ? 'Parâmetros' : 'Personalizar';

  return (
    <div className="fat-list-compact comercial-param-page">
      <header className="view-header comercial-param-page-header">
        <div className="comercial-param-page-title">
          <div className="comercial-param-page-accent" />
          <div>
            <p className="comercial-param-page-kicker">{secao === 'prazos' ? 'Cadastros' : 'Configurações'}</p>
            <h1 className="view-page-title">{titulo}</h1>
          </div>
        </div>
        {canManage ? (
          <div className="comercial-param-page-actions">
            {secao === 'prazos' ? (
              <button
                type="button"
                className="reports-action-btn secondary"
                disabled={restaurarParametros.isPending || saveParametros.isPending}
                onClick={handleRestaurar}
              >
                {restaurarParametros.isPending ? 'Restaurando...' : 'Restaurar listas'}
              </button>
            ) : null}
            <button
              type="button"
              className="reports-action-btn primary"
              style={{ backgroundColor: '#118CC4', borderColor: '#118CC4' }}
              disabled={!isDirty || saveParametros.isPending}
              onClick={() => handleSave()}
            >
              {saveParametros.isPending ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        ) : null}
      </header>

      <QueryDataPanel
        query={parametrosQuery}
        refreshVariant="overlay"
        loadingMessage="Carregando parâmetros..."
        refreshingMessage="Atualizando parâmetros..."
        errorMessage="Não foi possível carregar os parâmetros do Comercial."
      >
        <form className="comercial-param-layout" onSubmit={handleSave}>
          {secao === 'prazos' ? (
            <div className="comercial-param-row comercial-param-row--listas">
              <ListaEditor
                titulo="Validades"
                descricao="Opções e padrão das novas propostas."
                items={form.validades}
                padrao={form.validadePadrao}
                canManage={canManage}
                adicionar={(
                  <QuantidadeAdd unidades={UNIDADES_VALIDADE} onAdd={(valor) => addItem('validades', valor)} />
                )}
                onRemove={(valor) => removeItem('validades', valor)}
                onPadrao={(valor) => setForm((current) => ({ ...current, validadePadrao: valor }))}
              />
              <ListaEditor
                titulo="Vigência do contrato"
                descricao="Opções de vigência contratual."
                items={form.vigencias}
                padrao={form.vigenciaPadrao}
                canManage={canManage}
                adicionar={(
                  <QuantidadeAdd
                    unidades={UNIDADES_VIGENCIA}
                    opcaoFixa={VIGENCIA_INDETERMINADA}
                    onAdd={(valor) => addItem('vigencias', valor)}
                  />
                )}
                onRemove={(valor) => removeItem('vigencias', valor)}
                onPadrao={(valor) => setForm((current) => ({ ...current, vigenciaPadrao: valor }))}
              />
              <ListaEditor
                titulo="Prazos de faturamento"
                descricao="Opções de prazo / DDL."
                items={form.prazosFaturamento}
                padrao={form.faturamentoPadrao}
                canManage={canManage}
                adicionar={<FaturamentoAdd onAdd={(valor) => addItem('prazosFaturamento', valor)} />}
                onRemove={(valor) => removeItem('prazosFaturamento', valor)}
                onPadrao={(valor) => setForm((current) => ({ ...current, faturamentoPadrao: valor }))}
              />
              <ComercialVeiculosCatalogo canManage={canManage} />
            </div>
          ) : (
            <div className="comercial-param-row comercial-param-row--logos">
              <LogoField
                label="Logo do PDF"
                hint="Usada no rodapé/assinatura do PDF da proposta."
                value={form.logoPdfUrl}
                canManage={canManage}
                onChange={(url) => setForm((current) => ({ ...current, logoPdfUrl: url }))}
              />
              <LogoField
                label="Logo do e-mail"
                hint="Embutida no e-mail. Se vazia, usa a do PDF ou a padrão."
                value={form.logoEmailUrl}
                canManage={canManage}
                onChange={(url) => setForm((current) => ({ ...current, logoEmailUrl: url }))}
              />
            </div>
          )}
        </form>
      </QueryDataPanel>
    </div>
  );
}
