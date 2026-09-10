/* Service worker de Tector Hub.
 *
 * POR QUE HACE FALTA, MAS ALLA DE "FUNCIONAR OFFLINE"
 * El asistente de sincronizacion obliga al telefono a salirse de su red y
 * pasarse a la del Tector, que no tiene internet. Si la app no estuviera
 * cacheada, en ese momento se quedaria en blanco y el flujo entero seria
 * imposible. Cachear el armazon no es una mejora: es lo que hace que el
 * asistente pueda existir.
 *
 * ESTRATEGIA
 * El armazon (HTML, CSS, JS, iconos) sale del cache y se actualiza en
 * segundo plano. Todo lo demas --API, audio, fotos-- va SIEMPRE a la red y
 * nunca se cachea aca: son datos que cambian, y servir una deteccion vieja
 * como si fuera la ultima seria peor que no mostrar nada.
 */
const CACHE = 'tector-hub-v1';
const ARMAZON = [
  './', './index.html', './estilo.css', './fotos-demo.js', './api.js', './app.js',
  './manifest.webmanifest',
  './iconos/icono-192.png', './iconos/icono-512.png',
  './iconos/favicon-64.png', './iconos/logo-lsd.png',
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ARMAZON))
      .then(() => self.skipWaiting())
      .catch(() => { /* si falla un archivo, igual se instala */ })
  );
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (ev) => {
  const url = new URL(ev.request.url);

  // Nada que no sea del propio origen pasa por aca: ni la API, ni las fotos
  // de Wikimedia, ni el portal del Tector en 192.168.4.1.
  if (url.origin !== location.origin || ev.request.method !== 'GET') return;

  ev.respondWith(
    caches.match(ev.request).then((guardada) => {
      const red = fetch(ev.request).then((resp) => {
        if (resp.ok) {
          const copia = resp.clone();
          caches.open(CACHE).then((c) => c.put(ev.request, copia));
        }
        return resp;
      }).catch(() => guardada);
      return guardada || red;
    })
  );
});
