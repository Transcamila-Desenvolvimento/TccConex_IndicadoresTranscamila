/** Ambiente e filial da aba. sessionStorage não vaza para as outras abas. */

const ENV_KEY = 'prothon_env';
const FILIAL_KEY = 'prothon_filial';

function dropSharedCopy() {
  localStorage.removeItem(ENV_KEY);
  localStorage.removeItem(FILIAL_KEY);
}

/** Abas já abertas tinham a escolha no localStorage. Copia uma vez e apaga o compartilhado. */
function migrateFromLocalStorage() {
  if (sessionStorage.getItem(ENV_KEY) || sessionStorage.getItem(FILIAL_KEY)) {
    dropSharedCopy();
    return;
  }
  const env = localStorage.getItem(ENV_KEY);
  const filial = localStorage.getItem(FILIAL_KEY);
  if (env) sessionStorage.setItem(ENV_KEY, env);
  if (filial) sessionStorage.setItem(FILIAL_KEY, filial);
  dropSharedCopy();
}

export function getSessionEnvironment(): string | null {
  migrateFromLocalStorage();
  return sessionStorage.getItem(ENV_KEY);
}

export function getSessionFilial(): string | null {
  migrateFromLocalStorage();
  return sessionStorage.getItem(FILIAL_KEY);
}

export function setSessionContext(env: string, filial: string) {
  sessionStorage.setItem(ENV_KEY, env);
  sessionStorage.setItem(FILIAL_KEY, filial);
  dropSharedCopy();
}

export function setSessionEnvironment(env: string) {
  sessionStorage.setItem(ENV_KEY, env);
  localStorage.removeItem(ENV_KEY);
}

export function clearSessionContext() {
  sessionStorage.removeItem(ENV_KEY);
  sessionStorage.removeItem(FILIAL_KEY);
  dropSharedCopy();
}
