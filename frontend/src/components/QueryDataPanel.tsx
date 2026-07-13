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
  /**
   * `inline` — faixa acima do conteúdo (padrão legado).
   * `overlay` — sobrepõe o conteúdo sem deslocar o layout.
   */
  refreshVariant?: 'inline' | 'overlay';
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
  refreshVariant = 'inline',
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
        refreshVariant === 'overlay' ? 'async-query-content--overlay-host' : '',
        showRefreshing && refreshVariant === 'overlay'
          ? 'async-query-content async-query-content--refreshing-overlay'
          : showRefreshing
            ? 'async-query-content async-query-content--refreshing'
            : 'async-query-content',
      ].filter(Boolean).join(' ')}
    >
      {showRefreshing && refreshVariant === 'overlay' && (
        <div className="async-query-refresh-overlay" role="status" aria-live="polite" aria-busy="true">
          <div className="async-query-refresh-card">
            <AsyncQuerySpinner />
            <span>{refreshingMessage}</span>
          </div>
        </div>
      )}
      {showRefreshing && refreshVariant === 'inline' && (
        <div className="async-query-loading async-query-loading--inline" role="status" aria-live="polite">
          <AsyncQuerySpinner />
          <span>{refreshingMessage}</span>
        </div>
      )}
      <div
        className={[
          variant === 'page' ? 'async-query-content-body--page' : undefined,
          showRefreshing && refreshVariant === 'overlay' ? 'async-query-content-body--dimmed' : undefined,
        ].filter(Boolean).join(' ') || undefined}
      >
        {children}
      </div>
    </div>
  );
};

export default QueryDataPanel;
export { toAsyncQueryInput };
