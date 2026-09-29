/* Service worker do TccConex ERP: avisos do sistema operacional (Web Push). */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = { titulo: event.data ? event.data.text() : '' };
  }
  const titulo = dados.titulo || 'TccConex ERP';
  event.waitUntil(
    self.registration.showNotification(titulo, {
      body: dados.mensagem || '',
      icon: '/notificacao-icone.png',
      badge: '/notificacao-icone.png',
      tag: dados.tag || undefined,
      data: { id: dados.id || '', link: dados.link || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { id, link } = event.notification.data || {};
  const destino = id ? `/notificacao/${encodeURIComponent(id)}` : (link || '/');

  event.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const janela = janelas.find((cliente) => new URL(cliente.url).origin === self.location.origin);
    if (janela) {
      // Navega pelo próprio React Router para não perder formulários abertos com reload.
      janela.postMessage({ tipo: 'abrir-notificacao', destino });
      await janela.focus();
      return;
    }
    await self.clients.openWindow(destino);
  })());
});
