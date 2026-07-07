import React from 'react';

type PageLoaderProps = {
  message?: string;
};

const PageLoader: React.FC<PageLoaderProps> = ({ message = 'Carregando ambiente...' }) => (
  <div className="page-loader" role="status" aria-live="polite">
    <div className="page-loader-spinner" aria-hidden="true" />
    <span className="page-loader-label">{message}</span>
  </div>
);

export default PageLoader;
