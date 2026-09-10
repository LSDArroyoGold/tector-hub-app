#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Prueba de la app de punta a punta, en un navegador de verdad.

Arma una copia de dist/tector-hub.html con un guion inyectado que recorre la
app como lo haria una persona --escribe en los campos, toca botones, navega
entre pantallas, completa el asistente-- y despues la corre en Chrome
headless y muestra el resultado.

No hace falta node, ni Selenium, ni Playwright: alcanza con el Chrome que ya
esta instalado.

    python3 pruebas/probar_app.py

POR QUE ESTA PRUEBA EXISTE
Encontro un bug que no se veia leyendo el codigo: `closest('[data-tema]')`
matcheaba el `<html data-tema="sistema">` que escribe aplicarTema(), asi que
CUALQUIER clic en cualquier parte de la app se interpretaba como "el usuario
eligio un tema", la pantalla se repintaba entera, y los campos de texto
perdian el foco apenas se los tocaba. La app era inusable y en el codigo se
leia perfectamente razonable.
"""
import html as _html
import io
import re
import subprocess
import sys
import tempfile
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

CHROMES = [
    r'C:\Program Files\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
    r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
    r'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
]

GUION = r"""
<div id="RESULTADO" style="display:none"></div>
<script>
(async () => {
  const NL = String.fromCharCode(10);
  const R = [];
  const D = document.getElementById('RESULTADO');
  // Se pinta despues de CADA comprobacion: si algo revienta a mitad de
  // camino, igual se ve hasta donde llego y con que error.
  const volcar = () => { D.textContent = R.join(NL); };
  const errores = [];
  window.addEventListener('error', (e) => errores.push('ERROR JS: ' + e.message));
  window.addEventListener('unhandledrejection', (e) =>
    errores.push('PROMESA RECHAZADA: ' + (e.reason && e.reason.message || e.reason)));

  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  const T = (nombre, cond, extra) => {
    R.push((cond ? 'OK   ' : 'FALLA') + '  ' + nombre + (extra ? '  [' + extra + ']' : ''));
    volcar();
  };
  const txt = () => document.getElementById('app').textContent;
  const hay = (s) => txt().includes(s);
  const limpio = (s) => (s || '').replace(/\s+/g, ' ').trim().slice(0, 60);

  volcar();
  await dormir(700);

  try {
  // --- ingreso ---
  T('renderiza la pantalla de ingreso', hay('Tector Hub') && !!document.getElementById('u'));
  T('avisa que esta en modo demostracion', hay('Modo demostración'));
  const u = document.getElementById('u'), c = document.getElementById('c');
  T('el usuario viene precargado en demo', u && u.value === 'd.arroyo', u && u.value);
  T('la contrasena viene precargada', c && c.value === 'demo');

  // El bug del 10/9: un clic en cualquier lado repintaba la pantalla.
  u.focus();
  T('el campo usuario acepta foco', document.activeElement === u);
  u.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await dormir(250);
  T('sigue enfocado despues de un clic', document.activeElement === u,
    document.activeElement && document.activeElement.tagName);
  u.value = 'd.arroyo';
  u.dispatchEvent(new Event('input', { bubbles: true }));
  await dormir(200);
  T('sigue enfocado despues de escribir', document.activeElement === u);
  T('el campo no esta deshabilitado', !u.disabled);

  // --- dashboard ---
  document.querySelector('[data-accion="entrar"]').click();
  await dormir(1500);
  T('entra al dashboard', hay('Última detección') || hay('Reserva Costanera'));
  T('muestra el chip de estado del dispositivo', !!document.querySelector('.pto'));
  T('muestra la barra inferior', !!document.querySelector('.barra'));
  T('la deteccion destacada trae reproductor', !!document.querySelector('[data-play]'));
  T('el nombre de la especie sale en castellano',
    hay('Hornero') || hay('Chingolo') || hay('Benteveo'),
    limpio((document.querySelector('.nomb') || {}).textContent));

  const pl = document.querySelector('[data-play]');
  pl.querySelector('button').click();
  await dormir(600);
  T('el scrubber avanza al reproducir',
    document.querySelectorAll('.onda i.son').length > 0,
    document.querySelectorAll('.onda i.son').length + ' barras');

  const irA = async (h, espera = 1200) => { location.hash = h; await dormir(espera); };

  // --- explorador de cantos ---
  await irA('#/cantos');
  T('el explorador lista fechas', /\d{4}-\d{2}-\d{2}/.test(txt()));
  const f = document.querySelector('[data-fecha]');
  T('las carpetas de fecha son clicables', !!f);
  if (f) {
    f.click(); await dormir(1200);
    T('abre las especies de esa fecha', !!document.querySelector('[data-especie]'));
    const e = document.querySelector('[data-especie]');
    if (e) { e.click(); await dormir(1200);
      T('abre las detecciones de la especie',
        document.querySelectorAll('[data-play]').length > 0,
        document.querySelectorAll('[data-play]').length + ' audios'); }
  }

  // --- estadisticas ---
  await irA('#/datos');
  T('el histograma tiene 24 barras',
    document.querySelectorAll('.barras i').length >= 24);
  T('muestra el ranking de especies', !!document.querySelector('.rank'));

  // --- vista combinada ---
  await irA('#/todos');
  T('la vista combinada lista los 3 Tectors',
    (txt().match(/#\d{4}/g) || []).length >= 3,
    (txt().match(/#\d{4}/g) || []).join(' '));

  // --- horarios ---
  await irA('#/horarios');
  T('horarios carga los campos', !!document.querySelector('[data-campo]'));
  const dur = document.querySelector('[data-campo="duracion_amanecer_h"]');
  T('Aplicar arranca deshabilitado',
    document.querySelector('[data-accion="guardarHorarios"]').disabled);
  if (dur) {
    dur.focus();
    dur.value = '3.5';
    dur.dispatchEvent(new Event('input', { bubbles: true }));
    await dormir(400);
    T('cambiar la duracion NO hace perder el foco', document.activeElement === dur);
    T('aparece la advertencia de mas de 2 horas', hay('más de 2 horas'));
    T('recalcula la hora de fin', hay('11:'));
    T('Aplicar se habilita al haber cambios',
      !document.querySelector('[data-accion="guardarHorarios"]').disabled);
  }

  // --- confirmacion transversal (requisito 9) ---
  document.querySelector('[data-accion="guardarHorarios"]').click();
  await dormir(500);
  T('guardar abre el dialogo de confirmacion', !!document.querySelector('.velo'));
  const camb = document.querySelector('.cambios');
  T('el dialogo muestra el valor anterior y el nuevo',
    !!camb && camb.textContent.includes('→'), limpio(camb && camb.textContent));
  T('el dialogo dice cuando se va a aplicar',
    document.body.textContent.includes('próxima ventana'));
  const si = document.querySelector('[data-r="si"]');
  if (si) { si.click(); await dormir(900); }
  T('el dialogo se cierra al guardar', !document.querySelector('.velo'));

  // --- BirdWeather ---
  await irA('#/birdweather');
  T('birdweather carga', hay('Publicar detecciones'));
  const globo = document.querySelector('[data-accion="avisoBW"]');
  if (globo) { globo.click(); await dormir(200);
    T('el aviso de demora se abre solo al tocarlo', hay('Puede tardar en aparecer')); }

  // --- cuenta y preferencias ---
  await irA('#/cuenta');
  T('cuenta lista los dispositivos', hay('Mis Tectors'));
  T('cuenta muestra el credito del laboratorio',
    hay('Laboratorio de Sistemas Dinámicos'));

  await irA('#/apariencia');
  T('apariencia ofrece los 3 temas',
    document.querySelectorAll('[data-set-tema]').length === 3);
  const oscuro = document.querySelector('[data-set-tema="oscuro"]');
  if (oscuro) { oscuro.click(); await dormir(600);
    T('el tema oscuro se aplica al documento',
      document.documentElement.dataset.tema === 'oscuro'); }

  await irA('#/notificaciones');
  T('notificaciones lista los 6 tipos',
    document.querySelectorAll('[data-notif]').length === 6);
  const sw = document.querySelector('[data-notif="especie"]');
  if (sw) { sw.click(); await dormir(400);
    T('Aplicar se habilita al tocar un interruptor',
      !document.querySelector('[data-accion="guardarNotifs"]').disabled); }

  // --- asistente de sincronizacion ---
  await irA('#/sync', 600);
  T('el asistente muestra la introduccion', hay('Antes de empezar'));
  document.querySelector('[data-accion="buscar"]').click();
  await dormir(1200);
  T('arranca a buscar el Tector', hay('Buscando tu Tector'));
  T('avisa que la red de setup no tiene contrasena', hay('No tiene contraseña'));
  T('muestra el patron del SSID', hay('Tector-####-setup'));
  await dormir(4200);
  T('encuentra el Tector y lista las redes', hay('Arroyo_Casa'));
  const red = document.querySelector('[data-red]');
  if (red) {
    red.click(); await dormir(400);
    T('al elegir una red pide la contrasena', !!document.getElementById('pw'));
    document.getElementById('pw').value = 'clave';
    document.querySelector('[data-accion="conectarWifi"]').click();
    await dormir(1500);
    T('pasa a la pantalla de verificacion', hay('Verificando conexión'));
    await dormir(6500);
    T('termina con exito', hay('ha sido configurado'));
    T('muestra la linea real del log', hay('Próxima ventana'));
  }

  } catch (e) {
    R.push('');
    R.push('EXCEPCION: ' + (e && e.stack ? e.stack : e));
  }

  R.push('');
  R.push(errores.length ? errores.join(NL) : 'sin errores de JavaScript');
  const fallas = R.filter((x) => x.startsWith('FALLA')).length;
  R.unshift('=== ' + R.filter((x) => /^(OK|FALLA)/.test(x)).length
    + ' comprobaciones, ' + fallas + ' fallas ===');
  volcar();
})();
</script>
"""


def salida_utf8():
    """La consola de Windows usa cp1252 y revienta con las flechas y los
    acentos del informe. No es un fallo de la prueba, asi que no vale la pena
    que la haga fallar."""
    for flujo in (sys.stdout, sys.stderr):
        try:
            flujo.reconfigure(encoding='utf-8', errors='replace')
        except Exception:
            pass


def buscar_chrome():
    for c in CHROMES:
        if Path(c).exists():
            return c
    return None


def main():
    salida_utf8()
    origen = RAIZ / 'dist' / 'tector-hub.html'
    if not origen.exists():
        print('Falta dist/tector-hub.html. Corré primero: python3 construir.py',
              file=sys.stderr)
        return 2

    chrome = buscar_chrome()
    if not chrome:
        print('No se encontró Chrome ni Edge. Editá CHROMES en este archivo.',
              file=sys.stderr)
        return 2

    s = io.open(origen, encoding='utf-8').read()
    # Sin fuentes remotas: una peticion de red pendiente congela el reloj
    # virtual de Chrome y la pagina se vuelca antes de que el guion termine.
    s = re.sub(r'<link rel="preconnect"[^>]*>', '', s)
    s = re.sub(r'<link rel="stylesheet" href="https://fonts[^>]*>', '', s)
    s = s.replace('</body>', GUION + '\n</body>')

    tmp = Path(tempfile.mkdtemp(prefix='tector-prueba-'))
    pagina = tmp / 'prueba.html'
    io.open(pagina, 'w', encoding='utf-8').write(s)

    salida = subprocess.run(
        [chrome, '--headless=new', '--disable-gpu', '--no-sandbox',
         '--virtual-time-budget=70000', f'--user-data-dir={tmp / "perfil"}',
         '--dump-dom', pagina.as_uri()],
        capture_output=True, text=True, encoding='utf-8', errors='replace',
        timeout=300)

    m = re.search(r'id="RESULTADO"[^>]*>(.*?)</div>', salida.stdout, re.S)
    if not m or not m.group(1).strip():
        print('El guion de prueba no llegó a escribir nada. '
              '¿Error de sintaxis en la app?', file=sys.stderr)
        return 1

    texto = _html.unescape(m.group(1)).strip()
    print(texto)
    return 1 if 'FALLA' in texto else 0


if __name__ == '__main__':
    sys.exit(main())
