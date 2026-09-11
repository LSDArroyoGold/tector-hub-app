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
  // Los modales cuelgan de <body>, no de #app: hay() no los ve.
  const hay2 = (s) => document.body.textContent.includes(s);
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

  // El isotipo tiene que estar entero: las ultimas lineas son las patas.
  const patas = document.querySelector('svg.iso');
  T('el isotipo tiene sus 43 lineas', patas && patas.querySelectorAll('line').length === 43,
    patas && patas.querySelectorAll('line').length + ' lineas');
  T('el isotipo no esta achatado',
    patas && patas.getAttribute('width') !== patas.getAttribute('height'));
  const logoLsd = document.querySelector('.credito.grande img');
  T('el logo del laboratorio se ve grande en el ingreso',
    !!logoLsd && logoLsd.getBoundingClientRect().width >= 50,
    logoLsd && Math.round(logoLsd.getBoundingClientRect().width) + ' px');
  T('el ingreso ya no ofrece configurar el servidor',
    !document.querySelector('.centro [data-ir="/servidor"]'));

  // Una contrasena equivocada NO tiene que dejar pasar.
  c.value = 'demod';
  document.querySelector('[data-accion="entrar"]').click();
  await dormir(1200);
  T('una contrasena equivocada es rechazada',
    !!document.getElementById('u') && hay('incorrectos'),
    limpio((document.getElementById('errLogin') || {}).textContent));
  c.value = 'demo';

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

  const img = document.querySelector('img.foto');
  T('la deteccion destacada muestra una foto real',
    !!img && img.src.startsWith('data:image'), img ? img.src.slice(0, 22) : 'sin <img>');
  T('la foto trae su atribucion',
    hay('Wikimedia Commons'), limpio((document.querySelector('.credito-foto')||{}).textContent));

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

    // La miniatura no puede comerse el renglon: antes heredaba width:100%
    // de .foto y el nombre de la especie quedaba fuera de la vista.
    const mini = document.querySelector('[data-especie] img.foto.chica, [data-especie] .foto.chica');
    T('la miniatura de la carpeta es chica',
      !!mini && mini.getBoundingClientRect().width <= 70,
      mini && Math.round(mini.getBoundingClientRect().width) + ' px');
    const fila = document.querySelector('[data-especie] .crece');
    T('se ve el nombre de la especie en la carpeta',
      !!fila && fila.getBoundingClientRect().width > 100,
      fila && Math.round(fila.getBoundingClientRect().width) + ' px');
    T('se puede descargar el dia entero', !!document.querySelector('[data-carpeta]'));

    const e = document.querySelector('[data-especie]');
    if (e) { e.click(); await dormir(1200);
      T('abre las detecciones de la especie',
        document.querySelectorAll('[data-play]').length > 0,
        document.querySelectorAll('[data-play]').length + ' audios');
      T('cada deteccion se puede descargar',
        document.querySelectorAll('[data-bajar]').length ===
        document.querySelectorAll('[data-play]').length);
      T('cada deteccion se puede compartir',
        document.querySelectorAll('[data-compartir]').length > 0);
      T('se puede descargar la carpeta de la especie',
        !!document.querySelector('[data-carpeta]'));
      T('cada deteccion se puede reportar',
        document.querySelectorAll('[data-reportar]').length ===
        document.querySelectorAll('[data-play]').length);

      // --- reporte de error ---
      document.querySelector('[data-reportar]').click();
      await dormir(700);
      T('el reporte abre las opciones', hay2('Ayudanos a mejorar'));
      T('ofrece los cuatro tipos de problema',
        document.querySelectorAll('.hoja [data-elegir]').length === 4,
        document.querySelectorAll('.hoja [data-elegir]').length + ' opciones');
      T('NO ofrece confirmar que la especie estaba bien',
        !document.querySelector('.hoja').textContent.toLowerCase().includes('correcta la especie')
        && document.querySelector('.hoja').textContent.includes('Solo se reportan errores'));

      // "se cual es" tiene que abrir el selector con el catalogo entero
      document.querySelector('[data-elegir="otra_conocida"]').click();
      await dormir(800);
      T('elegir "sé cuál es" abre el selector de especies',
        !!document.getElementById('bq'));
      const filas0 = document.querySelectorAll('.hoja [data-cod]').length;
      T('el selector lista especies del catálogo', filas0 > 5, filas0 + ' visibles');
      const bq = document.getElementById('bq');
      bq.value = 'hornero';
      bq.dispatchEvent(new Event('input', { bubbles: true }));
      await dormir(500);
      const prim = document.querySelector('.hoja [data-cod] .crece div');
      T('la búsqueda encuentra el Hornero',
        !!prim && prim.textContent.toLowerCase().includes('hornero'),
        prim && prim.textContent);
      document.querySelector('.hoja [data-cod]').click();
      await dormir(700);
      T('confirma antes de enviar el reporte',
        document.body.textContent.includes('¿Enviar el reporte?'));
      T('el resumen muestra la especie elegida',
        (document.querySelector('.cambios') || {}).textContent
          && document.querySelector('.cambios').textContent.includes('Hornero'));
      document.querySelector('[data-r="si"]').click();
      await dormir(900);
      T('en demostración avisa que no se envía a ningún lado',
        document.body.textContent.includes('no se envía'),
        limpio((document.querySelector('.tostada') || {}).textContent));

      // Sin servidor no hay audio: tiene que decirlo, no fallar en silencio.
      document.querySelector('[data-bajar]').click();
      await dormir(900);
      T('descargar en demostracion explica que falta el servidor',
        document.body.textContent.includes('necesitan un servidor'),
        limpio((document.querySelector('.tostada') || {}).textContent));
    }
  }

  // La advertencia sobre la precision del modelo: tiene que estar en Cantos,
  // y no estar siempre a la vista.
  await irA('#/cantos');
  T('la advertencia no se muestra sola', !document.querySelector('.enc .globo .txt'));
  T('hay un globo para abrirla',
    !!document.querySelector('[data-accion="avisoPrecision"]'));
  document.querySelector('[data-accion="avisoPrecision"]').click();
  await dormir(400);
  T('la advertencia da el numero medido', hay2('89'));
  T('lo traduce a algo entendible', hay2('de cada 100'));
  T('avisa que la red es mas sensible a unas especies',
    hay2('más sensible a unas especies'));
  T('y que los conteos no miden abundancia real',
    hay2('no significa que sea más abundante'));
  T('cierra diciendo que se va a mejorar', hay2('Futuras versiones de TectorNet'));
  document.querySelector('[data-accion="avisoPrecision"]').click();
  await dormir(300);
  T('se cierra al volver a tocarla', !document.querySelector('.enc .globo .txt'));

  // El selector de orden tiene que CAMBIAR algo, no solo marcarse. Antes
  // ofrecia seis criterios y solo dos hacian efecto.
  await irA('#/cantos');
  const verOrden = async (id) => {
    document.querySelector('[data-accion="ordenar"]').click();
    await dormir(600);
    document.querySelector(`.hoja [data-elegir="${id}"]`).click();
    await dormir(900);
  };
  await verOrden('especie_top');
  T('ordenar por especie agrupa por especie, no por fecha',
    document.querySelectorAll('[data-todo-especie]').length > 0
    && document.querySelectorAll('[data-fecha]').length === 0,
    document.querySelectorAll('[data-todo-especie]').length + ' especies');
  const prim2 = document.querySelector('[data-todo-especie] .mini');
  T('y muestra cuántas detecciones tiene cada una',
    !!prim2 && /\d+ detecciones/.test(prim2.textContent), prim2 && limpio(prim2.textContent));

  await verOrden('confianza');
  T('ordenar por confianza da una lista plana',
    document.querySelectorAll('[data-det]').length > 0
    && document.querySelectorAll('[data-fecha]').length === 0);
  const pills = [...document.querySelectorAll('[data-det] .pill')]
    .map((x) => parseInt(x.textContent, 10));
  T('y viene de mayor a menor confianza',
    pills.length > 2 && pills.every((v, i) => i === 0 || pills[i - 1] >= v),
    pills.slice(0, 5).join(' '));

  await verOrden('hora');
  const horas = [...document.querySelectorAll('[data-det] .mono')]
    .map((x) => (x.textContent.split('·')[1] || '').trim()).filter(Boolean);
  T('ordenar por hora del día ordena por hora',
    horas.length > 2 && horas.every((v, i) => i === 0 || horas[i - 1] <= v),
    horas.slice(0, 4).join(' '));

  await verOrden('fecha_asc');
  T('volver a fecha muestra carpetas de día otra vez',
    document.querySelectorAll('[data-fecha]').length > 0);
  const fs = [...document.querySelectorAll('[data-fecha]')].map((x) => x.dataset.fecha);
  T('y de la más antigua a la más reciente',
    fs.every((v, i) => i === 0 || fs[i - 1] <= v), fs.slice(0, 3).join(' '));
  await verOrden('fecha_desc');

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
  T('con sincronizacion automatica el inicio esta velado',
    document.querySelectorAll('.velado').length > 0,
    document.querySelectorAll('.velado').length + ' velados');
  T('ya no aparece la nota de las dos ventanas', !hay('Solo hay dos'));
  if (dur) {
    dur.focus();
    dur.value = '3.5';
    dur.dispatchEvent(new Event('input', { bubbles: true }));
    await dormir(400);
    T('cambiar la duracion NO hace perder el foco', document.activeElement === dur);
    T('aparece la advertencia de mas de 2 horas', hay('más de 2 horas'));
    T('la advertencia dice que el Tector corta la ventana',
      hay('cortar la ventana antes de tiempo'));
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
  // Al apagar la sincronizacion automatica el velo se tiene que ir.
  await irA('#/horarios');
  document.querySelector('[data-accion="autoSync"]').click();
  await dormir(500);
  T('al apagar la sincronizacion automatica se va el velo',
    document.querySelectorAll('.velado').length === 0,
    document.querySelectorAll('.velado').length + ' velados');
  T('y el inicio queda editable',
    !document.querySelector('[data-campo="inicio_amanecer"]').disabled);

  await irA('#/cuenta');
  T('cuenta lista los dispositivos', hay('Mis Tectors'));
  // La cinta de "modo demostración" si tiene un enlace al servidor, y esta
  // bien: es la unica puerta de entrada que queda. Lo que no tiene que estar
  // es la FILA del menu de Cuenta.
  T('el menu de Cuenta ya no tiene la fila de Servidor',
    !document.querySelector('.fila[data-ir="/servidor"]'));
  T('cuenta muestra el credito del laboratorio',
    hay('Laboratorio de Sistemas Dinámicos'));
  T('el credito nombra al departamento',
    hay('Departamento de Física, FCEyN, UBA'));

  // Atribucion de las fotos: es una obligacion de las licencias CC, no un
  // adorno. Tiene que estar y tiene que poder llegarse al original.
  document.querySelector('[data-accion="creditos"]').click();
  await dormir(900);
  T('hay una pantalla de créditos de las fotos',
    document.body.textContent.includes('Wikimedia Commons'));
  const enlaces = document.querySelectorAll('.hoja a[href*="commons.wikimedia"], .hoja a[href*="wikipedia"]');
  T('cada foto enlaza a su ficha original', enlaces.length >= 5,
    enlaces.length + ' enlaces');
  T('los créditos nombran autor y licencia',
    document.querySelector('.hoja').textContent.includes('CC BY'));
  document.querySelector('.velo').click();
  await dormir(400);

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

  // --- asistente en modo guiado (el que corre servido por HTTPS) ---
  // Se fuerza con ?guiado=1 porque la prueba corre desde file://.
  history.replaceState(null, '', location.pathname + '?guiado=1');
  // Salir del asistente antes de volver a entrar: mientras el hash siga
  // siendo #/sync la app conserva el estado del asistente anterior, y se
  // quedaria mostrando la pantalla de exito de la corrida de arriba.
  await irA('#/cuenta', 600);
  await irA('#/sync', 700);
  document.querySelector('[data-accion="buscar"]').click();
  await dormir(900);
  T('el modo guiado pide el numero de serie', !!document.getElementById('serie'));
  T('explica que la red no tiene contrasena', hay('No tiene contraseña'));
  const inv = document.getElementById('serie');
  if (inv) {
    inv.value = '99';
    document.querySelector('[data-accion="confirmarSerie"]').click();
    await dormir(500);
    T('rechaza un numero de serie invalido', hay('cuatro dígitos'));
    inv.value = '4417';
    document.querySelector('[data-accion="confirmarSerie"]').click();
    await dormir(700);
    T('pasa a la pantalla de la pagina del Tector', hay('Abrir la página del Tector'));
    const enlace = document.querySelector('a[href^="http://192.168.4.1"]');
    T('el enlace apunta al portal por navegacion, no por fetch',
      !!enlace && enlace.target === '_blank', enlace && enlace.getAttribute('href'));
    T('explica por que este paso va afuera', hay('servida por HTTPS'));
    T('ofrece verificar al volver', !!document.querySelector('[data-accion="verificarGuiado"]'));
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

    # La prueba corre contra el BUNDLE, no contra los archivos sueltos: es un
    # solo .html que Chrome puede abrir por file://, sin levantar un servidor.
    # El precio es que el bundle se puede quedar viejo, y entonces las pruebas
    # pasan contra codigo que ya no es el que se publica. Paso una vez: se
    # cambio api.js, la suite dio 104 de 104, y estaba mirando la version
    # anterior. Mejor que falle ruidosamente.
    fuentes = [RAIZ / n for n in ('index.html', 'api.js', 'app.js',
                                  'estilos.css', 'catalogo.js',
                                  'fotos-demo.js')]
    viejas = [f.name for f in fuentes
              if f.exists() and f.stat().st_mtime > origen.stat().st_mtime]
    if viejas:
        print('dist/tector-hub.html es mas viejo que: ' + ', '.join(viejas),
              file=sys.stderr)
        print('Corré primero: python3 construir.py', file=sys.stderr)
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
    # El modo demostracion se fuerza acá, en la copia temporal. La app
    # publicada apunta al servidor del laboratorio, pero estas pruebas
    # ejercitan la INTERFAZ y tienen que poder correr sin red y sin servidor,
    # en cualquier maquina. Sin esto, apuntar la app a un servidor real
    # convierte media suite en roja por motivos que no tienen nada que ver
    # con lo que se esta probando.
    s = re.sub(r"const SERVIDOR_POR_DEFECTO = '[^']*';",
               "const SERVIDOR_POR_DEFECTO = '';", s, count=1)
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
