import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { User } from '../types/domain';
import { apiService } from '../services/apiService';
import { ACTIVE_ENVIRONMENTS } from '../constants/environments';
import { AUTH_PROFILE_QUERY_KEY, useAuthProfile, useLogin } from '../hooks/useAuthProfile';

const activeEnvSet = new Set<string>(ACTIVE_ENVIRONMENTS);

interface AuthContextType {
  user: User | null;
  selectedEnvironment: string | null;
  selectedFilial: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  selectEnvironmentAndFilial: (env: string, filial: string) => void;
  clearEnvironment: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [sessionActive, setSessionActive] = useState(() => !!apiService.getToken());
  const [selectedEnvironment, setSelectedEnvironment] = useState<string | null>(null);
  const [selectedFilial, setSelectedFilial] = useState<string | null>(null);

  const { data: user = null, isLoading: profileLoading } = useAuthProfile(sessionActive);
  const isLoading = sessionActive ? profileLoading : false;
  const loginMutation = useLogin();

  useEffect(() => {
    const savedEnv = localStorage.getItem('prothon_env');
    const savedFilial = localStorage.getItem('prothon_filial');
    if (savedEnv && activeEnvSet.has(savedEnv)) {
      setSelectedEnvironment(savedEnv);
      if (savedFilial) setSelectedFilial(savedFilial);
    } else if (savedEnv) {
      localStorage.removeItem('prothon_env');
      localStorage.removeItem('prothon_filial');
    }
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const authenticatedUser = await loginMutation.mutateAsync({ username, password });
      if (authenticatedUser) {
        setSessionActive(true);
        queryClient.setQueryData(AUTH_PROFILE_QUERY_KEY, authenticatedUser);
        return true;
      }
    } catch (err) {
      console.error('Login error:', err);
      if (err instanceof Error && err.message === 'SERVER_OFFLINE') throw err;
    }
    return false;
  };

  const logout = () => {
    apiService.clearToken();
    setSessionActive(false);
    queryClient.setQueryData(AUTH_PROFILE_QUERY_KEY, null);
    setSelectedEnvironment(null);
    setSelectedFilial(null);
    localStorage.removeItem('prothon_env');
    localStorage.removeItem('prothon_filial');
  };

  const selectEnvironmentAndFilial = (env: string, filial: string) => {
    if (!activeEnvSet.has(env)) return;
    setSelectedEnvironment(env);
    setSelectedFilial(filial);
    localStorage.setItem('prothon_env', env);
    localStorage.setItem('prothon_filial', filial);
  };

  const clearEnvironment = () => {
    setSelectedEnvironment(null);
    setSelectedFilial(null);
    localStorage.removeItem('prothon_env');
    localStorage.removeItem('prothon_filial');
  };

  return (
    <AuthContext.Provider value={{
      user,
      selectedEnvironment,
      selectedFilial,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      selectEnvironmentAndFilial,
      clearEnvironment
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
