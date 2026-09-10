# Tector Hub — App

App de administración de estaciones de monitoreo acústico **LSD-Tector**, del
Laboratorio de Sistemas Dinámicos (FCEyN, UBA).

Ver detecciones, escuchar los cantos, mirar estadísticas, configurar horarios
de grabación y publicar en BirdWeather. Sin SSH y sin editar archivos de
configuración a mano.

---

## Por qué es una PWA y no una app nativa

Es una aplicación web que se instala. Una sola cosa cumple tres funciones:

- **La app de Android.** Se instala desde Chrome (*Añadir a pantalla de
  inicio*), corre en ventana propia, con su ícono, y funciona sin conexión.
- **El portal web.** La misma URL abierta en cualquier navegador.
- **El emulador.** Sin servidor configurado arranca en modo demostración, con
  datos de ejemplo, y se puede recorrer entera.

Las razones, en orden de peso:

1. **No hay que compilar nada.** Ni Android Studio, ni SDK, ni firmar un APK,
   ni Play Store. Se edita un archivo y se recarga.
2. **Un solo código.** No hay versión web que se atrase respecto de la de
   Android, porque son la misma.
3. **Se actualiza sola.** El próximo arranque ya trae los cambios; nadie tiene
   que reinstalar nada en su teléfono.

### Lo que un navegador no puede hacer

**Cambiar de red WiFi.** No hay API web para eso, y el asistente de
sincronización necesita que el teléfono se pase a la red del Tector y después
vuelva.

Así que ese paso es **guiado y no automático**: la app dice exactamente qué
hacer y detecta sola cuando el teléfono ya está en la red del dispositivo
(sondeando `http://192.168.4.1:5000/info` cada 3 segundos). El resto del flujo
—leer las redes, mandar las credenciales, verificar el resultado en el log—
sí es automático.

Son dos toques manuales en Ajustes, una sola vez por dispositivo. Si en algún
momento molestan, envolver esto en Capacitor o una TWA permite automatizarlos
sin reescribir ninguna pantalla.

> El *service worker* no es un lujo acá: mientras el teléfono está en la red
> del Tector no hay internet, y sin la app cacheada la pantalla quedaría en
> blanco justo en el medio del asistente.

---

## Probarla ahora

```bash
git clone https://github.com/LSDArroyoGold/tector-hub-app.git
cd tector-hub-app
python3 -m http.server 8080
```

Abrir `http://localhost:8080`. Sin servidor configurado entra en modo
demostración, con **d.arroyo / demo** (vienen precargados). Valida de verdad:
una contraseña equivocada muestra el error, para poder ver esa pantalla.

También hay una versión de un solo archivo en `dist/tector-hub.html`, que se
abre de un doble clic sin levantar nada. La genera `construir.py`.

## Instalarla en el teléfono

1. Servir la carpeta desde algún lugar que el teléfono alcance. Con Tailscale
   —que el laboratorio ya usa— alcanza con `python3 -m http.server 8080` en la
   máquina que corre el servidor.
2. Abrir esa dirección en **Chrome** en el teléfono.
3. Menú **⋮ → Añadir a pantalla de inicio**.
La dirección del servidor **no es un ajuste del usuario**: se completa una
vez en `SERVIDOR_POR_DEFECTO`, arriba de `api.js`, antes de publicar la app.
Vacía = modo demostración. La pantalla de Servidor sigue existiendo como
salida de emergencia —para apuntar a un servidor de prueba sin tocar el
código— pero no figura en el menú de Cuenta; se llega desde la cinta de
«modo demostración».

> **Sobre HTTP y HTTPS.** Servida por HTTP simple (el caso de Tailscale), la
> app puede hablarle al portal del Tector en `http://192.168.4.1:5000` sin
> problema. Servida por **HTTPS**, el navegador bloquea ese pedido por
> contenido mixto y el asistente de sincronización deja de funcionar —el
> resto de la app anda igual. Si se pone detrás de nginx con TLS, conviene
> dejar además el acceso por HTTP dentro de la red del laboratorio.

---

## Estructura

| Archivo | Qué es |
|---|---|
| `index.html` | El armazón. Cuatro líneas: carga estilo, `api.js` y `app.js`. |
| `estilo.css` | Identidad del proyecto, en variables CSS. Tema claro y oscuro. |
| `api.js` | Cliente del servidor **y** el modo demostración. |
| `app.js` | Pantallas, ruteo, reproductor, asistente de sincronización. |
| `sw.js` | Service worker. Cachea el armazón; nunca datos. |
| `construir.py` | Arma las versiones de un solo archivo en `dist/`. |
| `fotos-demo.js` | Generado. Fotos del modo demostración, embebidas. |
| `iconos/` | Generados de `Tector_isotipo.svg`. |

Sin framework y sin dependencias. La app entera son tres archivos de texto.

### El modo demostración

Si no hay servidor configurado, `api.js` responde con datos fabricados en vez
de fallar: especies reales del AMBA, el formato exacto de nombre de archivo
que arma `exportador.py`, y ventanas de amanecer y atardecer.

Usa un generador con semilla y no `Math.random`, así la demostración se ve
igual en cada recarga y se puede comparar una pantalla con la anterior. El
Tector `#4417` tiene tres días sin datos a propósito, para poder ver cómo se
comporta la app cuando un equipo se saltea ventanas.

Toda pantalla en modo demostración lleva una cinta arriba. Nunca se hacen
pasar por datos reales.

---

## Decisiones que se notan al usarla

**Un diálogo de confirmación por panel, no por control.** El requisito es que
todo cambio de configuración se confirme. Aplicado control por control, la app
sería insoportable: cambiar las dos ventanas de horario abriría cuatro
diálogos. Se agrupa por panel, con el valor anterior y el nuevo de cada cosa
que cambió.

**Ningún cambio se aplica al instante, y la app lo dice.** El Tector está
apagado casi todo el tiempo. Cuando se guardan horarios o un token de
BirdWeather, el diálogo dice la hora exacta en que el dispositivo va a tomar
el cambio, en vez de fingir que ya está hecho.

**El estado del dispositivo, al lado del nombre.** Sale de `estado.json`:
*Grabando* con su hora de fin, *En espera* con la hora en que vuelve, o *Sin
datos* cuando pasó una ventana entera sin que subiera nada. En espera es lo
normal, no una falla, y se ve distinto de un equipo mudo.

**El scrubber de audio son las barras del isotipo.** El logo del proyecto es
un pájaro hecho de barras horizontales, un espectrograma leído como silueta.
Es el único elemento decorativo de la app y también su control más usado.

**Las fotos de especie traen su atribución.** Vienen de Wikimedia Commons
—licencia consultable y crédito al autor—, resueltas y cacheadas por el
servidor. En modo demostración viajan embebidas en `fotos-demo.js`
(`herramientas/generar_fotos_demo.py` lo regenera), porque si no no habría
fotos sin servidor.

**Lo que la sincronización automática bloquea, se ve bloqueado.** El
`disabled` solo no alcanza: el campo queda igual de blanco y nada dice que no
se toca. Va con un velo gris encima, que desaparece al apagar el modo
automático.

---

## Qué falta

- **Notificaciones push.** El panel guarda las preferencias, pero todavía no
  hay quién las envíe: hace falta un *push service* del lado del servidor. Las
  preferencias quedan listas para cuando exista.
- **Ordenamiento del explorador.** Los seis criterios están definidos y el
  selector funciona; solo el orden por fecha está aplicado de verdad.
- **Probarla en el S10.** Está escrita para Chrome en Android y verificada en
  escritorio, pero todavía no corrió en el teléfono.

---

## Repositorios del proyecto

| | |
|---|---|
| [LSD-Tector2.1](https://github.com/LSDArroyoGold/LSD-Tector2.1) | Software del dispositivo |
| [tector-hub-servidor](https://github.com/LSDArroyoGold/tector-hub-servidor) | Cuentas, dispositivos y puente a Drive |
| [TectorNet](https://github.com/LSDArroyoGold/TectorNet) | Motor de detección acústica |

---

## Pruebas

```bash
python3 construir.py
python3 pruebas/probar_app.py
```

Recorre la app entera en Chrome headless como lo haría una persona: escribe
en los campos, toca botones, navega entre pantallas y completa el asistente
de sincronización. 48 comprobaciones. No necesita node, ni Selenium, ni
Playwright — alcanza con el Chrome que ya está instalado.

Existe por un motivo concreto. El primer intento tenía un bug que no se veía
leyendo el código:

```js
const tema = t.closest('[data-tema]');   // ← matchea <html data-tema="sistema">
```

`aplicarTema()` escribe `data-tema` en el `<html>`, y `closest()` sube hasta
la raíz. Así que **cualquier** clic en cualquier parte de la app encontraba
ese atributo y se interpretaba como «el usuario eligió un tema»: la pantalla
se repintaba entera y los campos de texto perdían el foco apenas se los
tocaba. La app era inusable, y las dos líneas involucradas se leían
perfectamente razonables por separado.

Los atributos de la interfaz llevan ahora prefijo `data-set-`.
