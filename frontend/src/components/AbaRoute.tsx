import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { firstAllowedAbaPath, userCanSeeAba } from '../constants/abas';

type Props = {
  module: string;
  aba: string;
  fallback: string;
  children: React.ReactElement;
};

const AbaRoute: React.FC<Props> = ({ module, aba, fallback, children }) => {
  const { user } = useAuth();
  if (!userCanSeeAba(user, module, aba)) {
    return <Navigate to={firstAllowedAbaPath(user, module, fallback)} replace />;
  }
  return children;
};

export default AbaRoute;
