import type { PushInscricaoPayload } from '../types/domain';

const SW_URL = '/sw.js';

export type PushPermissao = NotificationPermission | 'nao-suportado';

export interface PushEstadoNavegador {
  suportado: boolean;
  permissao: PushPermissao;
  inscricao: PushInscricaoPayload | null;
}

export function pushSuportado(): boolean {
  return typeof window !== 'undefined'
    && window.isSecureContext
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

function base64UrlParaBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const bruto = window.atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(bruto.length));
  for (let i = 0; i < bruto.length; i += 1) bytes[i] = bruto.charCodeAt(i);
  return bytes;
}

function paraPayload(inscricao: PushSubscription): PushInscricaoPayload | null {
  const json = inscricao.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;
  return { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } };
}

async function registrarServiceWorker(): Promise<ServiceWorkerRegistration> {
  await navigator.serviceWorker.register(SW_URL, { scope: '/' });
  return navigator.serviceWorker.ready;
}

async function inscricaoAtual(): Promise<PushSubscription | null> {
  const registro = await navigator.serviceWorker.getRegistration('/');
  if (!registro) return null;
  return registro.pushManager.getSubscription();
}

export async function lerEstadoPushNavegador(): Promise<PushEstadoNavegador> {
  if (!pushSuportado()) return { suportado: false, permissao: 'nao-suportado', inscricao: null };
  const inscricao = Notification.permission === 'granted' ? await inscricaoAtual() : null;
  return {
    suportado: true,
    permissao: Notification.permission,
    inscricao: inscricao ? paraPayload(inscricao) : null,
  };
}

/** Pede permissão ao usuário e cria a inscrição deste navegador. */
export async function inscreverNavegador(publicKey: string): Promise<PushInscricaoPayload> {
  if (!pushSuportado()) throw new Error('Este navegador não suporta avisos do sistema.');
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') {
    throw new Error('Permissão de notificações negada no navegador.');
  }
  const registro = await registrarServiceWorker();
  let inscricao = await registro.pushManager.getSubscription();
  if (!inscricao) {
    inscricao = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlParaBytes(publicKey),
    });
  }
  const payload = paraPayload(inscricao);
  if (!payload) throw new Error('O navegador não retornou uma inscrição válida.');
  return payload;
}

/** Garante que o service worker está registrado/atualizado quando já há permissão. */
export async function atualizarServiceWorker(): Promise<void> {
  if (!pushSuportado() || Notification.permission !== 'granted') return;
  await registrarServiceWorker();
}

export async function cancelarInscricaoNavegador(): Promise<string | null> {
  if (!pushSuportado()) return null;
  const inscricao = await inscricaoAtual();
  if (!inscricao) return null;
  const endpoint = inscricao.endpoint;
  await inscricao.unsubscribe();
  return endpoint;
}

export async function endpointDoNavegador(): Promise<string | null> {
  if (!pushSuportado()) return null;
  const inscricao = await inscricaoAtual();
  return inscricao?.endpoint ?? null;
}
