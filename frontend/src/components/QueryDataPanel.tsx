import React from 'react';
import {
  toAsyncQueryInput,
  useAsyncQueryState,
  type QueryResultLike,
} from '../hooks/useAsyncQueryState';

interface QueryDataPanelProps {
  query: QueryResultLike<unknown>;
  loadingMessage?: string;
  refreshingMessage?: string;
  errorMessage?: string;
  className?: string;
  /** `page` = bloco principal; `compact` = modais e áreas menores */
  variant?: 'page' | 'compact';
  /**
   * Usa o visual "página inteira" do loader inicial (mesmo spinner/tipografia
   * do loader de rota exibido no `Suspense` do lazy loading) mesmo quando o
   * conteúdo carregado usa `variant="compact"` — necessário quando o container
   * da tela não segue a cadeia flex de `--page` (ex.: rolagem própria da
   * página). Isso evita que o usuário veja dois loaders com estilos
   * diferentes em sequência. Por padrão, segue `variant !== 'compact'`.
   */
  fullPageLoader?: boolean;
  children: React.ReactNode;
}

const AsyncQuerySpinner: React.FC = () => (
  <span className="async-query-spinner" aria-hidden="true" />
);

const QueryDataPanel: React.FC<QueryDataPanelProps> = ({
  query,
  loadingMessage = 'Carregando dados...',
  refreshingMessage = 'Atualizando...',
  errorMessage = 'Não foi possível carregar os dados. Tente novamente.',
  className,
  variant = 'page',
  fullPageLoader,
  children,
}) => {
  const { showInitialLoader, showRefreshing, showError } = useAsyncQueryState(query);

  const isFullLoader = fullPageLoader ?? variant !== 'compact';
  const loadingClass = [
    'async-query-loading',
    isFullLoader ? 'async-query-loading--page' : 'async-query-loading--compact',
  ].join(' ');
  const errorClass =
    variant === 'compact' ? 'async-query-error async-query-error--compact' : 'async-query-error';

  if (showInitialLoader) {
    return (
      <div className={loadingClass} role="status" aria-live="polite">
        <AsyncQuerySpinner />
        <span className="async-query-label">{loadingMessage}</span>
      </div>
    );
  }

  if (showError) {
    return (
      <div className={errorClass} role="alert">
        {errorMessage}
      </div>
    );
  }

  return (
    <div
      className={[
        className,
        variant === 'page' ? 'async-query-content--page' : '',
        showRefreshing ? 'async-query-content async-query-content--refreshing' : 'async-query-content',
      ].filter(Boolean).join(' ')}
    >
      {showRefreshing && (
        <div className="async-query-loading async-query-loading--inline" role="status" aria-live="polite">
          <AsyncQuerySpinner />
          <span>{refreshingMessage}</span>
        </div>
      )}
      {children}
    </div>
  );
};

export default QueryDataPanel;
export { toAsyncQueryInput };
