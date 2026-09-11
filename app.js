/* Tector Hub -- app de administracion de estaciones LSD-Tector.
 *
 * PWA en JavaScript sin framework. La razon no es purismo: es que asi la
 * misma cosa es la app de Android (se instala desde Chrome, corre en
 * ventana propia, con icono) y el portal web, sin cadena de compilacion, sin
 * Play Store, y sin que nadie tenga que instalar Android Studio para tocar
 * una pantalla.
 *
 * LO QUE UN NAVEGADOR NO PUEDE HACER
 * El asistente de sincronizacion necesita cambiar de red WiFi, y para eso no
 * hay API en la web. Asi que ese paso es guiado y no automatico: la app dice
 * exactamente que hacer y detecta sola cuando el telefono ya esta en la red
 * del Tector (sondeando su portal). El resto del flujo --leer las redes,
 * mandar las credenciales, verificar el resultado-- si es automatico.
 */

const App = (() => {
  /* Version de la app. Se muestra en Cuenta > Estado de la app y sirve para
   * saber si el telefono ya tomo un cambio. Subirla NO es lo que dispara la
   * actualizacion --de eso se encarga el service worker-- pero es la unica
   * forma de verificar a simple vista que version esta corriendo. */
  const VERSION = '2026.09.10-3';
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (t) => String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  const E = {
    ruta: '', usuario: null, dispositivos: [], activo: null,
    combinado: false, cargando: false, datos: {}, sync: null,
    // Instalacion como app: 'prompt' guarda el evento que dispara el
    // dialogo nativo. Ver capturarInstalacion().
    prompt: null, instalada: false, sw: 'sin registrar',
  };

  /* INSTALAR LA APP
   *
   * Chrome no deja abrir su dialogo de instalacion cuando uno quiere: avisa
   * con beforeinstallprompt que ya se puede, y hay que guardar ese evento
   * para usarlo despues, cuando la persona toque un boton.
   *
   * Existe este boton propio porque el item "Instalar aplicación" del menu
   * de Chrome es dificil de encontrar, aparece con otro nombre segun la
   * version, y a veces tarda en aparecer --Chrome espera a que el usuario
   * haya interactuado con la pagina antes de considerarla instalable. */
  function capturarInstalacion() {
    window.addEventListener('beforeinstallprompt', (ev) => {
      ev.preventDefault();
      E.prompt = ev;
      const b = document.querySelector('[data-accion="instalar"]');
      if (b) b.hidden = false;
    });
    window.addEventListener('appinstalled', () => {
      E.prompt = null; E.instalada = true;
      toast('Tector Hub quedó instalada');
    });
    // display-mode standalone = ya se esta corriendo desde el icono.
    E.instalada = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
  }

  /* ---------------- iconos ---------------- */
  /* El isotipo del proyecto: el pajaro esta hecho de barras horizontales,
   * un espectrograma leido como silueta. Son las 43 lineas exactas de
   * assets/tector_isotipo.svg, como [x1, y, x2] -- todas horizontales.
   * NO recortar la lista: las ultimas son las patas. */
  const ISO_LINEAS = [
    [148.55,40.01,186.37],[142.45,46.08,191.31],[136.1,52.14,208.69],
    [133.99,58.21,226.31],[130.47,64.28,225.37],[126.94,70.35,198.59],
    [123.89,76.42,191.31],[119.19,82.49,189.9],[112.61,88.56,188.96],
    [105.33,94.62,193.89],[101.57,100.69,195.3],[97.81,106.76,196.01],
    [93.82,112.83,195.54],[90.77,118.9,193.42],[86.54,124.97,192.48],
    [82.55,131.03,190.13],[78.08,137.1,186.84],[75.03,143.17,184.26],
    [70.1,149.24,181.44],[67.98,155.31,176.98],[65.63,161.38,169.23],
    [63.52,167.44,161],[59.99,173.51,147.85],[56.24,179.58,95.23],
    [98.75,179.58,100.63],[109.09,179.58,120.84],[130.94,179.58,141.04],
    [52.01,185.65,84.66],[112.14,185.65,119.66],[133.99,185.65,145.97],
    [46.84,191.72,71.04],[116.61,191.72,124.59],[140.57,191.72,151.84],
    [38.85,197.79,66.57],[119.66,197.79,127.65],[145.74,197.79,159.83],
    [36.03,203.86,62.11],[110.97,203.86,132.58],[135.63,203.86,180.03],
    [29.69,209.92,56.47],[109.09,209.92,181.91],[29.69,215.99,49.42],
    [128.35,215.99,154.43]];
  function iso(alto = 30) {
    const l = ISO_LINEAS.map(([x1, y, x2]) =>
      `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/>`).join('');
    // El pajaro no es cuadrado (200x179): forzar width=height lo achataria.
    return `<svg class="iso" width="${Math.round(alto * 200 / 179)}"
      height="${alto}" viewBox="28 38 200 179"
      fill="none" stroke="currentColor" stroke-width="3.38" stroke-linecap="round"
      aria-hidden="true">${l}</svg>`;
  }
  const IC = {
    inicio: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 10 12 3l8 7v10a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1z"/></svg>',
    cantos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
    datos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 19V11M10 19V5M15 19v-6M20 19v-9"/></svg>',
    cuenta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15l13-7.5z"/></svg>',
    pausa: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4.5" width="4" height="15" rx="1"/><rect x="14" y="4.5" width="4" height="15" rx="1"/></svg>',
    tilde: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5 9.5 18 20 6"/></svg>',
    cruz: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    bajar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v11m0 0 4-4m-4 4-4-4"/><path d="M4 18h16"/></svg>',
    compartir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4m0 0L8 8m4-4 4 4"/><path d="M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6"/></svg>',
    reportar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v5"/><circle cx="12" cy="16.6" r=".6" fill="currentColor"/><path d="M10.3 4.2 2.9 17.4a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z"/></svg>',
    campana: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6z"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>',
  };

  /* ---------------- utilidades ---------------- */
  function toast(mensaje, ms = 2800) {
    const previo = $('.tostada'); if (previo) previo.remove();
    const d = document.createElement('div');
    d.className = 'tostada'; d.setAttribute('role', 'status'); d.textContent = mensaje;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), ms);
  }

  function ir(ruta) { location.hash = '#' + ruta; }

  function haceCuanto(iso) {
    if (!iso) return 'sin datos';
    const ms = Date.now() - new Date(iso).getTime();
    const min = Math.round(ms / 6e4);
    if (min < 2) return 'recién';
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 36) return `hace ${h} h`;
    return `hace ${Math.round(h / 24)} días`;
  }

  function nombreLindo(d) {
    return d.nombre_es || d.nombre_comun_es || d.especie || d.nombre_comun || '';
  }

  /* Un Tector se considera mudo cuando paso una ventana entera sin que
   * subiera nada. No alcanza con "hace rato": entre ventanas el equipo esta
   * apagado, y eso es lo normal, no una falla. */
  function estadoDe(disp) {
    const e = disp.estado;
    /* Un Tector con software 1.1 no publica estado.json --esa version no lo
     * tiene-- pero funciona perfectamente: sube sus detecciones y baja sus
     * horarios igual. Marcarlo como "sin datos" seria mentir. */
    if (disp.heredado && !e) {
      return { clase: 'legado', texto: 'Versión 1.1 · sin reporte de estado' };
    }
    if (!e) return { clase: 'mudo', texto: 'Sin datos todavía' };
    const horas = (Date.now() - new Date(e.generado).getTime()) / 36e5;
    if (horas > 26) return { clase: 'mudo', texto: `Sin datos ${haceCuanto(e.generado)}` };
    /* 'desconocido' viene del estado reconstruido de un 1.1 cuando la ultima
     * ventana quedo abierta y nunca se cerro: el equipo dejo de escribir en
     * medio. Decir "grabando" ahi seria mentir; no saber es un dato mejor. */
    if (e.estado === 'desconocido') {
      return { clase: 'mudo', texto: 'Quedó una ventana sin cerrar' };
    }
    if (e.estado === 'grabando') {
      return { clase: 'grabando', texto: `Grabando · hasta ${e.proxima_ventana?.hora || '—'}` };
    }
    return { clase: 'espera', texto: `En espera · ${e.proxima_ventana?.hora || '—'}` };
  }

  const activo = () => E.dispositivos.find((d) => d.serie === E.activo) || E.dispositivos[0];

  /* ---------------- confirmacion transversal ----------------
   * Requisito 9 de la especificacion. Un dialogo por PANEL y no por control:
   * agrupa todo lo que cambio en una sola pregunta, con el valor anterior y
   * el nuevo. Preguntar control por control cumpliria la letra y haria la
   * app insoportable de usar. */
  function confirmar({ titulo, cambios = [], aviso, nota, confirmar: txtOk = 'Guardar',
                       cancelar = 'Descartar', peligro = false, seguir = true }) {
    return new Promise((resolve) => {
      const velo = document.createElement('div');
      velo.className = 'velo medio';
      velo.innerHTML = `
        <div class="hoja" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
          <h2>${esc(titulo)}</h2>
          ${cambios.length ? `<div class="cambios">${cambios.map((c) =>
            `<div class="c"><span>${esc(c[0])}</span><span>${esc(c[1])}</span></div>`).join('')}</div>` : ''}
          ${aviso ? `<div class="aviso info"><span class="ic">⏱</span><div>${aviso}</div></div>` : ''}
          ${nota ? `<p class="mini" style="margin:-2px 0 10px">${esc(nota)}</p>` : ''}
          <div class="duo">
            <button class="b sec" data-r="no">${esc(cancelar)}</button>
            <button class="b ${peligro ? 'peligro' : ''}" data-r="si">${esc(txtOk)}</button>
          </div>
          ${seguir ? '<button class="b sec" data-r="seguir" style="margin-top:9px;border:0;background:none">Seguir editando</button>' : ''}
        </div>`;
      const cerrar = (v) => { velo.remove(); document.removeEventListener('keydown', tecla); resolve(v); };
      const tecla = (ev) => { if (ev.key === 'Escape') cerrar(null); };
      velo.addEventListener('click', (ev) => {
        if (ev.target === velo) return cerrar(null);
        const b = ev.target.closest('[data-r]'); if (!b) return;
        cerrar(b.dataset.r === 'si' ? true : b.dataset.r === 'no' ? false : null);
      });
      document.addEventListener('keydown', tecla);
      document.body.appendChild(velo);
      velo.querySelector('[data-r="si"]').focus();
    });
  }

  function hoja(html) {
    return new Promise((resolve) => {
      const velo = document.createElement('div');
      velo.className = 'velo';
      velo.innerHTML = `<div class="hoja" role="dialog" aria-modal="true">${html}</div>`;
      velo.addEventListener('click', (ev) => {
        if (ev.target === velo) { velo.remove(); return resolve(null); }
        const b = ev.target.closest('[data-elegir]');
        if (b) { velo.remove(); resolve(b.dataset.elegir); }
      });
      document.body.appendChild(velo);
    });
  }

  /* ---------------- reproductor ----------------
   * El scrubber son las barras del isotipo: el mismo motivo del logo,
   * cumpliendo la funcion del control mas usado de la app. */
  const AUDIO = new Audio();
  let sonando = null;

  function ondaHTML(id) {
    const n = 30;
    let b = '';
    for (let i = 0; i < n; i++) {
      const h = 4 + Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)) * 15;
      b += `<i style="height:${h.toFixed(1)}px"></i>`;
    }
    return `<div class="play" data-play="${esc(id)}">
      <button aria-label="Reproducir">${IC.play}</button>
      <button class="onda" aria-label="Posición">${b}</button>
      <span class="tiempo">0:00</span></div>`;
  }

  function pintarOnda(cont, frac) {
    const barras = cont.querySelectorAll('.onda i');
    const hasta = Math.round(barras.length * frac);
    barras.forEach((b, i) => b.classList.toggle('son', i < hasta));
    const t = cont.querySelector('.tiempo');
    const dur = AUDIO.duration || (sonando && sonando.demo ? 4 : 0);
    if (t && dur) {
      const s = Math.floor(frac * dur);
      t.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }
  }

  function reproducir(cont, url) {
    const id = cont.dataset.play;
    if (sonando && sonando.id === id) {
      if (sonando.demo) { detener(); return; }
      if (AUDIO.paused) { AUDIO.play(); cont.querySelector('button').innerHTML = IC.pausa; }
      else { AUDIO.pause(); cont.querySelector('button').innerHTML = IC.play; }
      return;
    }
    detener();

    if (!url) {
      /* Modo demostracion: no hay audio real, pero el scrubber corre igual
       * para que la interaccion se pueda ver y probar.
       *
       * setInterval y no requestAnimationFrame: rAF se congela cuando la
       * pestaña pasa a segundo plano, y tampoco corre en un navegador
       * headless, que es donde se prueba esto. A 40 ms el movimiento se ve
       * igual de fluido y es reproducible. */
      sonando = { id, cont, demo: true, t0: Date.now() };
      cont.querySelector('button').innerHTML = IC.pausa;
      sonando.reloj = setInterval(() => {
        if (!sonando || sonando.id !== id) return;
        const f = (Date.now() - sonando.t0) / 4000;
        if (f >= 1) { detener(); return; }
        pintarOnda(cont, f);
      }, 40);
      toast('En modo demostración no hay audio real.');
      return;
    }

    sonando = { id, cont, demo: false };
    AUDIO.src = url;
    AUDIO.play().catch(() => { toast('No se pudo reproducir el audio.'); detener(); });
    cont.querySelector('button').innerHTML = IC.pausa;
  }

  function detener() {
    if (!sonando) return;
    if (sonando.reloj) clearInterval(sonando.reloj);
    if (!sonando.demo) { AUDIO.pause(); AUDIO.currentTime = 0; }
    const b = sonando.cont.querySelector('button');
    if (b) b.innerHTML = IC.play;
    pintarOnda(sonando.cont, 0);
    const t = sonando.cont.querySelector('.tiempo');
    if (t) t.textContent = '0:00';
    sonando = null;
  }

  AUDIO.addEventListener('timeupdate', () => {
    if (sonando && !sonando.demo && AUDIO.duration) {
      pintarOnda(sonando.cont, AUDIO.currentTime / AUDIO.duration);
    }
  });
  AUDIO.addEventListener('ended', detener);

  /* ---------------- reportar un error ----------------
   *
   * Solo errores: no hay opcion de confirmar que la especie estaba bien. Si
   * la hubiera, lo que llegaria seria una mezcla de "escuche y estaba bien"
   * con "toque sin escuchar", indistinguibles entre si, y el dato no
   * serviria para nada. Asi, un reporte significa siempre lo mismo.
   */
  function elegirEspecie() {
    return new Promise((resolve) => {
      const velo = document.createElement('div');
      velo.className = 'velo';
      velo.innerHTML = `
        <div class="hoja" role="dialog" aria-modal="true" style="max-height:88vh">
          <h2>¿Qué ave era?</h2>
          <div class="campo" style="margin:10px 0 8px">
            <input id="bq" placeholder="Buscar por nombre común o científico"
              autocomplete="off" autocapitalize="none"></div>
          <div id="res" style="max-height:52vh;overflow-y:auto;
            margin:0 -4px"></div>
          <button class="b sec chica" data-cerrar style="margin-top:10px">Cancelar</button>
        </div>`;
      const res = velo.querySelector('#res');
      const pintarLista = (texto) => {
        const l = API.buscarEspecies(texto);
        res.innerHTML = l.length ? l.map((e) => `
          <button class="fila" data-cod="${esc(e.codigo)}"
            style="border-radius:8px;padding:9px 8px">
            <div class="crece"><div style="font-weight:600;font-size:13.5px">${esc(e.comun)}</div>
              <div class="cient" style="margin:0">${esc(e.cientifico)}</div></div>
          </button>`).join('')
          : `<p class="mini" style="padding:12px 6px">Ninguna especie coincide.
             El catálogo tiene ${API.catalogo().length} especies, todas con su
             nombre en inglés y en latín.</p>`;
      };
      pintarLista('');
      const buscar = velo.querySelector('#bq');
      // input y no keyup: tambien dispara al pegar o al dictar.
      buscar.addEventListener('input', () => pintarLista(buscar.value));
      velo.addEventListener('click', (ev) => {
        if (ev.target === velo || ev.target.closest('[data-cerrar]')) {
          velo.remove(); return resolve(null);
        }
        const b = ev.target.closest('[data-cod]');
        if (!b) return;
        const e = API.catalogo().find((x) => x.codigo === b.dataset.cod);
        velo.remove();
        resolve(e || null);
      });
      document.body.appendChild(velo);
      buscar.focus();
    });
  }

  async function reportarDeteccion(ruta) {
    const d = activo();
    const nombre = ruta.split('/').pop();

    const tipo = await hoja(`
      <h2>Ayudanos a mejorar el Tector</h2>
      <p class="chico">¿Qué tiene de malo esta detección?</p>
      <p class="mini mono" style="word-break:break-all">${esc(nombre)}</p>
      ${API.TIPOS_REPORTE.map(([id, titulo, sub]) => `
        <button class="opcion" data-elegir="${id}" style="align-items:flex-start">
          <span><span class="tit">${esc(titulo)}</span>
            <div class="mini">${esc(sub)}</div></span></button>`).join('')}
      <p class="mini" style="margin-top:12px">Solo se reportan errores: no hay
        opción de confirmar que la especie estaba bien. Un reporte significa
        siempre lo mismo, y así el dato sirve.</p>`);
    if (!tipo) return;

    let especie = null;
    if (tipo === 'otra_conocida') {
      especie = await elegirEspecie();
      if (!especie) return;
    }

    const etiqueta = (API.TIPOS_REPORTE.find((t) => t[0] === tipo) || [])[1];
    const ok = await confirmar({
      titulo: '¿Enviar el reporte?', seguir: false, confirmar: 'Enviar',
      cancelar: 'Cancelar',
      cambios: [
        ['Problema', etiqueta],
        ...(especie ? [['Especie correcta', especie.comun]] : []),
      ],
      nota: 'El reporte viaja al servidor del laboratorio junto con la ruta '
        + 'del audio, para poder volver a escucharlo.',
    });
    if (!ok) return;

    try {
      const r = await API.reportar(d.serie, {
        ruta, tipo, especie_sugerida: especie ? especie.codigo : null,
      });
      toast(r.demo
        ? 'En modo demostración el reporte no se envía a ningún lado.'
        : 'Gracias. El reporte quedó registrado.', 4000);
    } catch (err) {
      toast(err.message, 4500);
    }
  }

  /* ---------------- descargar y compartir ----------------
   *
   * Los dos caminos empiezan igual --hay que traerse el archivo con el token
   * de sesion, porque un <a download> no manda cabeceras-- y se separan al
   * final: uno se lo pasa al navegador para que lo guarde, el otro al menu de
   * compartir del sistema.
   *
   * Compartir solo existe si el navegador soporta enviar archivos. En Chrome
   * de Android si; en un escritorio casi nunca, y ahi el boton avisa en vez
   * de no hacer nada. */
  function guardarBlob(blob, nombre) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Sin esto el blob queda en memoria hasta recargar la pagina.
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  async function traer(ruta, nombre, textoEspera) {
    toast(textoEspera, 60000);
    try {
      const r = await API.bajarArchivo(ruta, nombre);
      const t = $('.tostada'); if (t) t.remove();
      return r;
    } catch (err) {
      const t = $('.tostada'); if (t) t.remove();
      toast(err.message, 5000);
      return null;
    }
  }

  async function descargarAudio(ruta) {
    const d = activo();
    const nombre = ruta.split('/').pop();
    const r = await traer(API.rutaAudio(d.serie, ruta), nombre, 'Descargando…');
    if (r) { guardarBlob(r.blob, r.nombre); toast('Descargado'); }
  }

  async function compartirAudio(ruta) {
    const d = activo();
    const nombre = ruta.split('/').pop();
    if (!navigator.canShare) {
      toast('Este navegador no puede compartir archivos. Usá descargar.', 4500);
      return;
    }
    const r = await traer(API.rutaAudio(d.serie, ruta), nombre, 'Preparando…');
    if (!r) return;
    const archivo = new File([r.blob], r.nombre, { type: 'audio/mpeg' });
    if (!navigator.canShare({ files: [archivo] })) {
      toast('Este navegador no puede compartir audio. Usá descargar.', 4500);
      return;
    }
    try {
      await navigator.share({ files: [archivo], title: r.nombre });
    } catch (e) {
      // AbortError = la persona cerro el menu de compartir. No es un error.
      if (e.name !== 'AbortError') toast('No se pudo compartir.');
    }
  }

  async function descargarCarpeta(fecha, especie) {
    const d = activo();
    const nombre = `Tector${d.serie}_${fecha}${especie ? '_' + especie : ''}.zip`;
    const r = await traer(API.rutaCarpeta(d.serie, fecha, especie || null),
                          nombre, 'Armando el zip… puede tardar');
    if (r) { guardarBlob(r.blob, r.nombre); toast('Descargado'); }
  }

  /* ---------------- piezas de UI ---------------- */
  /* Si la foto no carga, en su lugar va el isotipo.
   *
   * El reemplazo se hace desde una funcion global y no con un onerror
   * inline: el HTML del isotipo lleva comillas dobles, y meterlo dentro de
   * onerror="..." cerraba el atributo antes de tiempo. El resto del codigo
   * se escapaba al documento y aparecia como texto suelto debajo de cada
   * foto (bug real, visible en el dashboard el 10/9). */
  window.__fotoRota = (img) => {
    const d = document.createElement('div');
    d.className = img.className + ' sinfoto';
    d.innerHTML = iso(64);
    img.replaceWith(d);
  };

  function foto(det, clase = '') {
    const url = API.urlFoto(det.especie_carpeta);
    if (!url) {
      return `<div class="foto ${clase} sinfoto">${iso(64)}</div>`;
    }
    return `<img class="foto ${clase}" loading="lazy" alt="${esc(det.especie)}"
      src="${esc(url)}" onerror="__fotoRota(this)">`;
  }

  /* Wikimedia Commons pide atribucion, asi que la foto viaja con el credito
   * de su autor y su licencia. Va chiquito debajo de la tarjeta destacada,
   * no en cada miniatura: repetirlo cinco veces seria ruido. */
  function creditoFotoHTML(det) {
    const c = API.creditoFoto(det.especie_carpeta);
    if (!c) return '';
    const texto = `Foto: ${esc(c.autor || 'autor no indicado')} · ${esc(c.licencia)}`;
    // Enlace a la ficha del archivo en Commons: ahi estan el autor, el texto
    // completo de la licencia y el original. Las licencias CC piden poder
    // llegar a eso, no solo nombrarlo.
    return `<div class="credito-foto">${c.pagina
      ? `<a href="${esc(c.pagina)}" target="_blank" rel="noopener">${texto} ↗</a>`
      : texto} · Wikimedia Commons</div>`;
  }

  function pillConfianza(c) {
    const cl = c >= 80 ? 'ok' : c >= 65 ? 'teal' : 'avi';
    return `<span class="pill ${cl}">${c}%</span>`;
  }

  function encabezado(titulo, { volver, sub, derecha = '' } = {}) {
    return `<header class="enc">
      ${volver ? `<button class="volver" data-ir="${esc(volver)}" aria-label="Volver">‹</button>`
               : `<span style="flex:none">${iso(26)}</span>`}
      <h1>${esc(titulo)}${sub ? `<div class="sub">${esc(sub)}</div>` : ''}</h1>
      ${derecha}</header>`;
  }

  function barra(actual) {
    const b = (id, ruta, txt, icono) =>
      `<button data-ir="${ruta}" ${actual === id ? 'aria-current="page"' : ''}>
        ${icono}<span>${txt}</span></button>`;
    return `<nav class="barra">
      ${b('inicio', '/', 'Inicio', IC.inicio)}
      ${b('cantos', '/cantos', 'Cantos', IC.cantos)}
      ${b('datos', '/datos', 'Datos', IC.datos)}
      ${b('cuenta', '/cuenta', 'Cuenta', IC.cuenta)}</nav>`;
  }

  function cinta() {
    if (!API.enDemo()) return '';
    return `<div class="cinta">Modo demostración · datos de ejemplo ·
      <button data-ir="/servidor">conectar un servidor</button></div>`;
  }

  const cargando = (txt = 'Cargando…') =>
    `<div class="centro"><div class="spin"></div><p class="chico">${esc(txt)}</p></div>`;

  /* ---------------- pantallas ---------------- */
  const P = {};

  P.login = () => `
    <div class="pantalla"><div class="centro">
      ${iso(58)}
      <h1 style="font-size:27px;font-weight:700">Tector Hub</h1>
      <div style="width:100%;max-width:340px;margin-top:14px;text-align:left">
        ${API.enDemo() ? `<div class="aviso info" style="margin-bottom:12px">
          <span class="ic">i</span><div><b>Modo demostración.</b> Entrá con
          <b>d.arroyo</b> / <b>demo</b>, que ya vienen cargados. Los datos son
          de ejemplo.</div></div>` : ''}
        <div class="campo"><label for="u">Usuario</label>
          <input id="u" data-entrar autocomplete="username" autocapitalize="none"
            value="${API.enDemo() ? 'd.arroyo' : ''}"></div>
        <div class="campo"><label for="c">Contraseña</label>
          <input id="c" type="password" data-entrar autocomplete="current-password"
            value="${API.enDemo() ? 'demo' : ''}"></div>
        <div id="errLogin"></div>
        <button class="b" data-accion="entrar">Entrar</button>
        <button class="b sec chica" data-accion="instalar" ${E.prompt ? '' : 'hidden'}>
          Instalar en el teléfono</button>
        <p class="mini" style="text-align:center">¿No tenés cuenta? Pedila al laboratorio.</p>
      </div>
      <div style="flex:1"></div>
      <div class="credito grande" style="max-width:340px">
        <span>Desarrollado por el</span>
        <img src="iconos/logo-lsd.png" alt="Laboratorio de Sistemas Dinámicos">
        <span>Laboratorio de Sistemas Dinámicos<br>
          Departamento de Física, FCEyN, UBA</span>
      </div>
    </div></div>`;

  P.servidor = () => `
    <div class="pantalla">
      ${encabezado('Servidor', { volver: '/login' })}
      <div class="scroll">
        <p class="chico" style="margin-top:14px">La dirección del servidor del
          laboratorio. Si la dejás vacía, la app funciona en modo demostración
          con datos de ejemplo.</p>
        <div class="campo"><label for="s">Dirección</label>
          <input id="s" inputmode="url" placeholder="http://tector:8099"
            value="${esc(API.servidor())}"></div>
        <button class="b" data-accion="guardarServidor">Guardar</button>
        <button class="b sec" data-accion="probar">Probar conexión</button>
        <div id="resProbar"></div>
      </div></div>`;

  P.inicio = () => {
    const d = activo();
    if (!d) return P.sinDispositivos();
    const dets = E.datos.dets || [];
    const est = estadoDe(d);
    const e = d.estado || {};

    if (!dets.length) {
      return `<div class="pantalla con-barra">
        ${cinta()}${cabeceraDispositivo(d, est)}
        <div class="scroll"><div class="vacio">
          ${iso(52)}
          <p class="sec">Todavía no hay detecciones</p>
          <p class="chico" style="max-width:270px;margin:0 auto">
            El Tector graba en las ventanas de amanecer y atardecer.
            ${e.proxima_ventana ? `La próxima es a las <b>${esc(e.proxima_ventana.hora)}</b>.` : ''}</p>
        </div></div>${barra('inicio')}</div>`;
    }

    const [primera, ...resto] = dets.slice(0, 5);
    return `<div class="pantalla con-barra">
      ${cinta()}${cabeceraDispositivo(d, est)}
      <div class="scroll">
        <span class="rot">Última detección · ${esc(haceCuanto(primera.fecha + 'T' + primera.hora))}</span>
        <div class="destacada">
          ${foto(primera)}
          <div class="cuerpo">
            <div class="entre">
              <div><div class="nomb">${esc(nombreLindo(primera))}</div>
                ${primera.nombre_cientifico ? `<div class="cient">${esc(primera.nombre_cientifico)}</div>` : ''}</div>
              ${pillConfianza(primera.confianza)}</div>
            ${ondaHTML(primera.ruta)}
            <div class="entre" style="margin-top:7px">
              <span class="mini mono">${esc(primera.fecha)} · ${esc(primera.hora)}</span>
              <button class="ico" data-reportar="${esc(primera.ruta)}"
                aria-label="Reportar un problema">${IC.reportar}</button></div>
            ${creditoFotoHTML(primera)}
          </div></div>
        <div class="grilla4">
          ${resto.map((d2) => `<button class="mini-det" data-det="${esc(d2.ruta)}">
            ${foto(d2)}<div class="pie"><div class="n">${esc(nombreLindo(d2))}</div>
            <div class="h">${esc(d2.hora.slice(0, 5))}</div></div></button>`).join('')}
        </div>
        <button class="b sec chica" data-ir="/cantos">Ver todos los cantos →</button>
        ${panelDatos()}
        ${panelHorarios(e)}
      </div>${barra('inicio')}</div>`;
  };

  function cabeceraDispositivo(d, est) {
    return `<header class="enc">
      <span style="flex:none">${iso(24)}</span>
      <button style="flex:1;min-width:0;background:none;border:0;text-align:left;padding:0;color:inherit;cursor:pointer"
        data-accion="elegirDisp">
        <h1 style="font-size:16px">${esc(d.apodo || 'Tector ' + d.serie)} <span style="color:var(--mut)">⌄</span></h1>
        <div class="est"><span class="pto ${est.clase}"></span>${esc(est.texto)}</div>
      </button>
      <button class="pill neu" style="border:0;cursor:pointer" data-ir="/todos">Todos</button>
    </header>`;
  }

  function panelDatos() {
    const s = E.datos.stats;
    if (!s) return '';
    const max = Math.max(...s.histograma_horas, 1);
    return `<button class="t" style="display:block;width:100%;text-align:left;cursor:pointer"
      data-ir="/datos">
      <div class="entre"><span class="rot" style="margin:0">Estadísticas</span>
        <span class="mini">Ver todas →</span></div>
      <div class="barras" style="height:44px">${s.histograma_horas.map((v) =>
        `<i class="${v === max ? 'pico' : ''}" style="height:${Math.max(6, v / max * 100)}%"></i>`).join('')}</div>
      <div class="mini">Pico ${s.histograma_horas.indexOf(max)}:00 · ${s.especies_distintas} especies · ${s.total} detecciones</div>
    </button>`;
  }

  function panelHorarios(e) {
    const h = e.horarios;
    if (!h) return '';
    return `<button class="t" style="display:block;width:100%;text-align:left;cursor:pointer"
      data-ir="/horarios">
      <div class="entre"><span class="rot" style="margin:0">Horarios</span>
        <span class="pill ${h.auto_sync ? 'ok' : 'neu'}">${h.auto_sync ? 'Automático' : 'Manual'}</span></div>
      <div class="mono" style="font-size:13px;margin-top:5px">
        ${esc(h.amanecer?.inicio)}–${esc(h.amanecer?.fin)} · ${esc(h.atardecer?.inicio)}–${esc(h.atardecer?.fin)}</div>
    </button>`;
  }

  P.sinDispositivos = () => `
    <div class="pantalla">${cinta()}
      <div class="centro">
        ${iso(52)}
        <h1 style="font-size:20px;font-weight:600">Bienvenido${E.usuario ? ', ' + esc(E.usuario.nombre.split(' ')[0]) : ''}</h1>
        <p class="chico" style="max-width:280px">Todavía no tenés ningún Tector
          vinculado a tu cuenta. Vamos a dar de alta el primero.</p>
        <div class="t plana" style="text-align:left;width:100%;max-width:320px">
          <span class="rot" style="margin-top:0">Vas a necesitar</span>
          <p class="chico" style="margin:0">· El Tector encendido y cerca<br>
            · La red WiFi del lugar y su contraseña</p></div>
        <div style="flex:1"></div>
        <button class="b" data-ir="/sync" style="max-width:320px">Sincronizar dispositivo</button>
        <p class="mini">Este paso no se puede saltear.</p>
      </div></div>`;

  P.todos = () => {
    const r = E.datos.resumen;
    if (!r) return cargando();
    const u = r.ultima_deteccion;
    return `<div class="pantalla con-barra">${cinta()}
      ${encabezado('Todos los Tectors', { sub: `${r.dispositivos} dispositivos`,
        derecha: '<button class="pill teal" style="border:0" data-ir="/">Uno</button>' })}
      <div class="scroll">
        <div class="cifras" style="grid-template-columns:repeat(3,1fr);margin-top:14px">
          <div class="cifra"><div class="n">${r.detecciones}</div><div class="d">detecciones</div></div>
          <div class="cifra"><div class="n">${r.especies}</div><div class="d">especies</div></div>
          <div class="cifra"><div class="n">${r.reportando}/${r.dispositivos}</div><div class="d">reportando</div></div>
        </div>
        <span class="rot">Dispositivos</span>
        <div class="t cero">${E.dispositivos.map((d) => {
          const e = estadoDe(d);
          return `<button class="fila" data-disp="${esc(d.serie)}">
            <div class="crece"><div style="font-weight:600">${esc(d.apodo || 'Tector ' + d.serie)}</div>
              <div class="est"><span class="pto ${e.clase}"></span>${esc(e.texto)}</div></div>
            <span class="mini mono">#${esc(d.serie)}</span><span class="chev">›</span></button>`;
        }).join('')}</div>
        ${u ? `<span class="rot">Última detección de la red</span>
        <div class="destacada">${foto(u)}<div class="cuerpo">
          <div class="nomb">${esc(nombreLindo(u))}</div>
          <div class="mini">${esc(u.apodo || '')} · #${esc(u.serie)} · ${esc(u.fecha)} ${esc(u.hora)}</div>
          ${ondaHTML(u.ruta)}</div></div>` : ''}
      </div>${barra('inicio')}</div>`;
  };

  /* EL EXPLORADOR TIENE TRES VISTAS, NO UNA
   *
   * El selector de orden ofrecia seis criterios y solo dos hacian algo: los
   * otros cuatro no tienen sentido sobre una lista de carpetas de fecha.
   * "Por especie" o "por confianza" no son formas de ordenar fechas, son
   * formas distintas de agrupar las detecciones.
   *
   * Asi que el selector cambia la VISTA:
   *   fecha_desc / fecha_asc    carpetas por dia
   *   especie_az / especie_top  carpetas por especie, juntando todos los dias
   *   hora / confianza          lista plana de detecciones
   */
  const ORDENES = [
    ['fecha_desc', 'Fecha, más reciente primero'],
    ['fecha_asc', 'Fecha, más antigua primero'],
    ['especie_az', 'Especie, A–Z'],
    ['especie_top', 'Especie, más detectada'],
    ['hora', 'Hora del día'],
    ['confianza', 'Confianza'],
  ];

  function ordenActual() {
    return E.datos.orden || API.guardado.leer('tector.orden') || 'fecha_desc';
  }

  function porEspecie(todas) {
    const g = {};
    todas.forEach((d) => {
      g[d.especie_carpeta] = g[d.especie_carpeta] || {
        carpeta: d.especie_carpeta, nombre: nombreLindo(d),
        cientifico: d.nombre_cientifico, cuantas: 0, ultima: '',
      };
      const e = g[d.especie_carpeta];
      e.cuantas++;
      const sello = d.fecha + ' ' + d.hora;
      if (sello > e.ultima) e.ultima = sello;
    });
    return Object.values(g);
  }

  P.cantos = () => {
    const d = activo();
    const todas = E.datos.todas || [];
    const orden = ordenActual();
    const etiqueta = (ORDENES.find((o) => o[0] === orden) || [])[1] || '';

    let cuerpo;
    if (!todas.length) {
      cuerpo = '<div class="vacio"><p class="chico">Todavía no hay detecciones.</p></div>';
    } else if (orden.startsWith('fecha')) {
      const fechas = [...new Set(todas.map((x) => x.fecha))].sort();
      if (orden === 'fecha_desc') fechas.reverse();
      const cuenta = {};
      todas.forEach((x) => { cuenta[x.fecha] = (cuenta[x.fecha] || 0) + 1; });
      cuerpo = fechas.map((f) => `
        <button class="fila t" style="margin-bottom:8px;border-radius:11px"
          data-fecha="${esc(f)}">
          <div class="crece"><div class="mono" style="font-weight:600">${esc(f)}</div>
            <div class="mini">${cuenta[f]} detecciones</div></div>
          <span class="chev">›</span></button>`).join('');
    } else if (orden.startsWith('especie')) {
      const grupos = porEspecie(todas);
      if (orden === 'especie_az') {
        grupos.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      } else {
        grupos.sort((a, b) => b.cuantas - a.cuantas);
      }
      cuerpo = `<div class="t cero">${grupos.map((g) => `
        <button class="fila" data-todo-especie="${esc(g.carpeta)}">
          ${foto({ especie_carpeta: g.carpeta, especie: g.nombre }, 'chica')}
          <div class="crece"><div style="font-weight:600">${esc(g.nombre)}</div>
            <div class="mini">${g.cuantas} ${g.cuantas === 1 ? 'detección' : 'detecciones'}
              · última ${esc(g.ultima.slice(0, 10))}</div></div>
          <span class="chev">›</span></button>`).join('')}</div>`;
    } else {
      const lista = [...todas];
      if (orden === 'hora') {
        // Por hora del dia, juntando todos los dias: sirve para ver a que
        // hora canta cada especie, no para recorrer un dia.
        lista.sort((a, b) => a.hora.localeCompare(b.hora));
      } else {
        lista.sort((a, b) => b.confianza - a.confianza);
      }
      cuerpo = `<div class="t cero">${lista.slice(0, 300).map((x) => `
        <button class="fila" data-det="${esc(x.ruta)}">
          ${foto(x, 'chica')}
          <div class="crece"><div style="font-weight:600">${esc(nombreLindo(x))}</div>
            <div class="mini mono">${esc(x.fecha)} · ${esc(x.hora)}</div></div>
          ${pillConfianza(x.confianza)}<span class="chev">›</span></button>`).join('')}
        </div>${lista.length > 300
          ? '<p class="mini">Se muestran las primeras 300 de ' + lista.length + '.</p>'
          : ''}`;
    }

    return `<div class="pantalla con-barra">${cinta()}
      <header class="enc">
        <span style="flex:none">${iso(24)}</span>
        <h1 style="display:flex;align-items:center;gap:7px">Cantos
          <span class="globo"><button data-accion="avisoPrecision"
            aria-label="Sobre la precisión de las detecciones">i</button></span>
          ${d ? `<div class="sub">${esc(d.apodo || 'Tector ' + d.serie)}</div>` : ''}
        </h1>
        <button class="pill neu" style="border:0;cursor:pointer"
          data-accion="ordenar">${esc(etiqueta.split(',')[0])} ⌄</button>
      </header>
      <div class="scroll">
        <p class="mini" style="margin:12px 2px 8px">${esc(etiqueta)}</p>
        ${cuerpo}
      </div>${barra('cantos')}</div>`;
  };

  P.especieTodas = (carpeta) => {
    const dets = E.datos.dets || [];
    const info = dets[0] || {};
    return `<div class="pantalla con-barra">
      ${encabezado(nombreLindo(info) || carpeta.replace(/_/g, ' '),
        { volver: '/cantos', sub: `${dets.length} detecciones · todos los días` })}
      <div class="scroll">
        ${info.nombre_cientifico ? `<p class="cient" style="margin:12px 0 4px">${esc(info.nombre_cientifico)}</p>` : ''}
        ${dets.map((x) => `<div class="t">
          <div class="entre"><span class="mono" style="font-weight:600">${esc(x.fecha)} ${esc(x.hora)}</span>
            ${pillConfianza(x.confianza)}</div>
          ${ondaHTML(x.ruta)}
          <div class="entre" style="margin-top:8px;gap:7px">
            <span class="mini mono" style="word-break:break-all;font-size:9.5px;flex:1">
              ${esc(x.ruta.split('/').pop())}</span>
            <button class="ico" data-bajar="${esc(x.ruta)}" aria-label="Descargar">${IC.bajar}</button>
            <button class="ico" data-compartir="${esc(x.ruta)}" aria-label="Compartir">${IC.compartir}</button>
            <button class="ico" data-reportar="${esc(x.ruta)}" aria-label="Reportar un problema">${IC.reportar}</button>
          </div></div>`).join('')}
      </div>${barra('cantos')}</div>`;
  };

  P.cantosFecha = (fecha) => {
    const grupos = E.datos.grupos || [];
    return `<div class="pantalla con-barra">
      ${encabezado(fecha, { volver: '/cantos', sub: `${grupos.length} especies` })}
      <div class="scroll">
        <button class="b sec chica" style="margin-top:14px"
          data-carpeta="${esc(fecha)}|">↓ Descargar el día entero · zip</button>
        <div class="t cero">${grupos.map((g) => `
          <button class="fila" data-especie="${esc(g.carpeta)}">
            ${foto({ especie_carpeta: g.carpeta, especie: g.nombre }, 'chica')}
            <div class="crece"><div style="font-weight:600">${esc(g.nombre)}</div>
              <div class="mini">${g.cuantas} ${g.cuantas === 1 ? 'archivo' : 'archivos'}</div></div>
            <span class="chev">›</span></button>`).join('')}</div>
      </div>${barra('cantos')}</div>`;
  };

  P.cantosEspecie = (fecha, especie) => {
    const dets = E.datos.dets || [];
    const info = dets[0] || {};
    return `<div class="pantalla con-barra">
      ${encabezado(nombreLindo(info) || especie.replace(/_/g, ' '),
        { volver: '/cantos/' + fecha, sub: `${fecha} · ${dets.length} detecciones` })}
      <div class="scroll">
        ${info.nombre_cientifico ? `<p class="cient" style="margin:12px 0 4px">${esc(info.nombre_cientifico)}</p>` : ''}
        <button class="b sec chica" data-carpeta="${esc(fecha)}|${esc(especie)}">
          ↓ Descargar las ${dets.length} · zip</button>
        ${dets.map((d) => `<div class="t">
          <div class="entre"><span class="mono" style="font-weight:600">${esc(d.hora)}</span>
            ${pillConfianza(d.confianza)}</div>
          ${ondaHTML(d.ruta)}
          <div class="entre" style="margin-top:8px;gap:7px">
            <span class="mini mono" style="word-break:break-all;font-size:9.5px;flex:1">
              ${esc(d.ruta.split('/').pop())}</span>
            <button class="ico" data-bajar="${esc(d.ruta)}" aria-label="Descargar">${IC.bajar}</button>
            <button class="ico" data-compartir="${esc(d.ruta)}" aria-label="Compartir">${IC.compartir}</button>
            <button class="ico" data-reportar="${esc(d.ruta)}"
              aria-label="Reportar un problema">${IC.reportar}</button>
          </div></div>`).join('')}
      </div>${barra('cantos')}</div>`;
  };

  P.datos = () => {
    const s = E.datos.stats;
    const d = activo();
    if (!s) return cargando('Calculando estadísticas…');
    const max = Math.max(...s.histograma_horas, 1);
    const maxEsp = s.top_especies[0]?.detecciones || 1;
    const maxDia = Math.max(...s.por_fecha.map((x) => x.detecciones), 1);
    const h = s.hallazgos?.[0];
    return `<div class="pantalla con-barra">${cinta()}
      ${encabezado('Estadísticas', { sub: d ? (d.apodo || 'Tector ' + d.serie) : '',
        derecha: '<span class="pill neu">30 días</span>' })}
      <div class="scroll">
        <div class="cifras" style="margin-top:14px">
          <div class="cifra"><div class="n">${s.promedio_por_dia}</div><div class="d">detecciones por día</div></div>
          <div class="cifra"><div class="n">${s.especies_distintas}</div><div class="d">especies distintas</div></div>
        </div>
        ${h ? `<span class="rot">Hallazgo destacado</span>
        <div class="t" style="border-color:var(--terra)">
          <div class="nomb" style="font-size:15px">${esc(h.especie)}</div>
          <p class="chico" style="margin:4px 0 0">Primera vez en esta estación.
            Registrada el ${esc(h.fecha)} a las ${esc(h.hora.slice(0, 5))}
            con ${h.confianza}% de confianza.</p>
          ${h.ruta ? ondaHTML(h.ruta) : `<p class="mini" style="margin:6px 0 0">
            El audio de ese día ya no está en Drive. La detección se conserva
            en el resumen diario, pero no se puede escuchar.</p>`}</div>` : ''}
        ${s.dias_sin_audio?.length ? `<div class="aviso" style="margin-top:12px">
          <span class="ic">i</span><div>${s.dias_sin_audio.length === 1
            ? 'Hay 1 día'
            : 'Hay ' + s.dias_sin_audio.length + ' días'} en este período cuyo
            audio ya no está en Drive. Sus detecciones siguen contando acá
            —salen del resumen diario que guarda el Tector— pero no aparecen
            en Cantos y no se pueden escuchar.</div></div>` : ''}
        <span class="rot">Histograma de horarios</span>
        <div class="t">
          <div class="barras">${s.histograma_horas.map((v) =>
            `<i class="${v === max ? 'pico' : ''}" style="height:${Math.max(4, v / max * 100)}%"></i>`).join('')}</div>
          <div class="eje"><span>00</span><span>06</span><span>12</span><span>18</span><span>23</span></div>
          <p class="mini" style="margin:6px 0 0">Pico entre las
            ${String(s.histograma_horas.indexOf(max)).padStart(2, '0')}:00 y las
            ${String(s.histograma_horas.indexOf(max) + 1).padStart(2, '0')}:00,
            con ${max} detecciones.</p></div>
        <span class="rot">Especies más registradas</span>
        <div class="t"><div class="rank">${s.top_especies.slice(0, 6).map((t) => `
          <div class="r"><div class="e"><span>${esc(t.especie)}</span>
            <span class="v">${t.detecciones}</span></div>
            <div class="b" style="width:${(t.detecciones / maxEsp * 100).toFixed(0)}%"></div></div>`).join('')}
        </div></div>
        <span class="rot">Detecciones por día</span>
        <div class="t">
          <div class="barras" style="height:56px">${s.por_fecha.map((x) =>
            `<i style="height:${Math.max(4, x.detecciones / maxDia * 100)}%" title="${esc(x.fecha)}"></i>`).join('')}</div>
          <p class="mini">${esc(s.por_fecha[0]?.fecha || '')} → ${esc(s.por_fecha.at(-1)?.fecha || '')}</p></div>
        <div class="cifras">
          <div class="cifra"><div class="n">${s.total}</div><div class="d">detecciones en ${s.dias} días</div></div>
          <div class="cifra"><div class="n">${s.confianza_media ?? '—'}%</div><div class="d">confianza media</div></div>
        </div>
      </div>${barra('datos')}</div>`;
  };

  P.cuenta = () => {
    const u = E.usuario || {};
    return `<div class="pantalla con-barra">${cinta()}
      ${encabezado('Mi cuenta', { derecha:
        `<button class="volver" data-ir="/notificaciones" aria-label="Notificaciones"
          style="width:34px">${IC.campana}</button>` })}
      <div class="scroll">
        <div class="t" style="margin-top:14px"><div style="font-weight:600">${esc(u.nombre || '')}</div>
          <div class="mini mono">${esc(u.usuario || '')}</div></div>
        <span class="rot">Mis Tectors</span>
        <div class="t cero">${E.dispositivos.map((d) => {
          const e = estadoDe(d);
          return `<button class="fila" data-config="${esc(d.serie)}">
            <div class="crece"><div style="font-weight:600">${esc(d.apodo || 'Tector ' + d.serie)}</div>
              <div class="mini mono">#${esc(d.serie)}${d.estado?.version_software ? ' · ' + esc(d.estado.version_software) : ''}</div></div>
            <span class="pto ${e.clase}"></span><span class="chev">›</span></button>`;
        }).join('')}</div>
        <button class="b chica" data-ir="/sync">+ Agregar un Tector</button>
        <span class="rot">Aplicación</span>
        <button class="b sec chica" data-accion="instalar" ${E.prompt ? '' : 'hidden'}>
          Instalar en el teléfono</button>
        <div class="t cero">
          <button class="fila" data-accion="creditos"><span class="crece">Créditos de las fotos</span><span class="chev">›</span></button>
          <button class="fila" data-accion="diagnostico"><span class="crece">Estado de la app</span>
            <span class="mini">${E.instalada ? 'instalada' : 'en el navegador'}</span><span class="chev">›</span></button>
          <button class="fila" data-ir="/apariencia"><span class="crece">Apariencia</span><span class="chev">›</span></button>
          <button class="fila" data-ir="/notificaciones"><span class="crece">Notificaciones</span><span class="chev">›</span></button>
          <button class="fila" data-accion="salir"><span class="crece">Cerrar sesión</span><span class="chev">›</span></button>
        </div>
        <div class="credito" style="margin-top:22px">
          <img src="iconos/logo-lsd.png" alt="Laboratorio de Sistemas Dinámicos">
          <span>Desarrollado por el<br>
            <b>Laboratorio de Sistemas Dinámicos</b><br>
            Departamento de Física, FCEyN, UBA</span></div>
      </div>${barra('cuenta')}</div>`;
  };

  P.dispositivo = (serie) => {
    const d = E.dispositivos.find((x) => x.serie === serie);
    if (!d) return P.cuenta();
    const e = d.estado || {};
    const b = e.bateria;
    return `<div class="pantalla">
      ${encabezado(d.apodo || 'Tector ' + serie, { volver: '/cuenta', sub: '#' + serie })}
      <div class="scroll">
        <span class="rot">Estado</span>
        <div class="t">
          <div class="entre"><span class="est"><span class="pto ${estadoDe(d).clase}"></span>
            ${esc(estadoDe(d).texto)}</span>
            <span class="mini">${esc(haceCuanto(e.generado))}</span></div>
          ${b ? `<div class="entre" style="margin-top:8px"><span class="chico">Batería</span>
            <span class="mono">${b.porcentaje != null
              ? b.porcentaje + ' %'
              : b.voltaje_v + ' V · ' + b.corriente_ma + ' mA'}</span></div>
            ${b.throttled && b.throttled !== '0x0' ? `<div class="aviso cuidado" style="margin-top:8px">
              <span class="ic">!</span><div>La Raspberry reportó
              <b>throttling</b> (${esc(b.throttled)}): puede ser alimentación
              insuficiente o temperatura alta.</div></div>` : ''}` : ''}
          ${e.detecciones_ultima_ventana != null ? `<div class="entre" style="margin-top:6px">
            <span class="chico">Última ventana</span>
            <span class="mono">${e.detecciones_ultima_ventana} detecciones</span></div>` : ''}
          ${e.fuente === 'log' ? `<p class="mini" style="margin-top:8px">Este
            Tector tiene la versión 1.1, que no informa su estado. Esto se
            deduce de lo último que anotó en su registro, así que puede
            estar desactualizado.</p>` : ''}
          ${e.version_software ? `<div class="entre" style="margin-top:6px">
            <span class="chico">Software</span><span class="mono">${esc(e.version_software)}</span></div>` : ''}
        </div>
        <span class="rot">Configuración</span>
        <div class="t cero">
          <button class="fila" data-ir="/horarios"><span class="crece">Horarios de grabación</span><span class="chev">›</span></button>
          <button class="fila" data-ir="/birdweather"><span class="crece">BirdWeather</span><span class="chev">›</span></button>
          <button class="fila" data-accion="renombrar"><span class="crece">Cambiar apodo</span><span class="chev">›</span></button>
          <button class="fila" data-accion="resincronizar"><span class="crece">Volver a sincronizar WiFi</span><span class="chev">›</span></button>
        </div>
        <button class="b sec chica" data-accion="desvincular" style="color:var(--mal)">
          Desvincular este Tector</button>
        <p class="mini">Desvincularlo lo saca de tu cuenta. No borra nada de
          Drive ni apaga el dispositivo: sigue grabando y subiendo igual.</p>
      </div></div>`;
  };

  P.horarios = () => {
    const d = activo();
    const h = E.datos.horariosForm;
    if (!h) return cargando();
    const finAm = sumarHoras(h.inicio_amanecer, h.duracion_amanecer_h);
    const finAt = sumarHoras(h.inicio_atardecer, h.duracion_atardecer_h);
    const larga = (x) => x > 2;
    const ventana = (cual, etiqueta, ini, dur, fin) => `
      <span class="rot">Ventana de ${etiqueta}</span>
      <div class="t" ${larga(dur) ? 'style="border-color:var(--avi)"' : ''}>
        <div style="display:flex;gap:9px">
          <div class="campo${h.auto_sync ? ' velado' : ''}" style="flex:1;margin:0">
            <label for="i-${cual}">Inicio${h.auto_sync ? ' 🔒' : ''}</label>
            <input id="i-${cual}" type="time" value="${esc(ini)}" data-campo="inicio_${cual}"
              ${h.auto_sync ? 'disabled' : ''}></div>
          <div class="campo" style="flex:1;margin:0">
            <label for="d-${cual}">Duración (h)</label>
            <input id="d-${cual}" type="number" step="0.5" min="0.5" max="12"
              value="${dur}" data-campo="duracion_${cual}_h"></div>
        </div>
        <div class="entre${h.auto_sync ? ' velado' : ''}" style="margin-top:9px">
          <span class="chico">Termina a las</span><span class="mono">${esc(fin)}</span></div>
        ${larga(dur) ? `<div class="aviso cuidado" style="margin:9px 0 0"><span class="ic">⚠</span>
          <div>Las ventanas de más de 2 horas consumen mucha batería: el Tector
          puede cortar la ventana antes de tiempo para preservar batería.</div></div>` : ''}
      </div>`;

    return `<div class="pantalla">
      ${encabezado('Horarios', { volver: '/', sub: d ? (d.apodo || '#' + d.serie) : '' })}
      <div class="scroll">
        <div class="t" style="margin-top:14px"><div class="entre">
          <div style="flex:1"><div class="sec">Sincronización automática</div>
            <p class="mini" style="margin:2px 0 0">${h.auto_sync
              ? 'El inicio y el fin siguen el amanecer y el atardecer reales de la ubicación del Tector.'
              : 'Definís vos cada ventana a mano.'}</p></div>
          <button class="sw" role="switch" aria-checked="${h.auto_sync}"
            data-accion="autoSync" aria-label="Sincronización automática"></button>
        </div></div>
        ${ventana('amanecer', 'amanecer', h.inicio_amanecer, h.duracion_amanecer_h, finAm)}
        ${ventana('atardecer', 'atardecer', h.inicio_atardecer, h.duracion_atardecer_h, finAt)}
        ${h.auto_sync ? `<div class="aviso info"><span class="ic">🔒</span>
          <div>El inicio y el fin los calcula el Tector cada día. La duración
          la elegís vos.</div></div>` : ''}
        <button class="b" data-accion="guardarHorarios" ${E.datos.horariosSucio ? '' : 'disabled'}>
          Aplicar cambios</button>
      </div></div>`;
  };

  P.birdweather = () => {
    const d = activo();
    const b = E.datos.bw;
    if (!b) return cargando();
    if (!b.conectado && E.datos.bwEditando) {
      return `<div class="pantalla">
        ${encabezado('BirdWeather', { volver: '/birdweather' })}
        <div class="scroll">
          <p class="sec" style="margin-top:14px">Conectá tu estación</p>
          <p class="chico">Pegá el token que te dio BirdWeather al crear la estación.</p>
          <div class="campo"><label for="tk">Token de estación</label>
            <input id="tk" autocapitalize="none" autocomplete="off"
              data-entrar-bw ${API.enDemo() ? 'value="a3f9c0de-1234-5678-c721"' : ''}></div>
          <div id="errBW"></div>
          <div class="t plana"><span class="rot" style="margin-top:0">Se va a publicar</span>
            <div class="mono" style="font-size:13px">${esc(b.ubicacion?.lat ?? '—')}, ${esc(b.ubicacion?.lon ?? '—')}</div>
            <p class="mini" style="margin:4px 0 0">Las coordenadas las pone el
              propio dispositivo, no la app.</p></div>
          <button class="b" data-accion="conectarBW">Conectar</button>
        </div></div>`;
    }
    return `<div class="pantalla">
      ${encabezado('BirdWeather', { volver: '/', sub: d ? (d.apodo || '#' + d.serie) : '' })}
      <div class="scroll">
        <div class="t" style="margin-top:14px"><div class="entre">
          <div style="flex:1;display:flex;align-items:center;gap:7px">
            <span class="sec">Publicar detecciones</span>
            <span class="globo izq"><button data-accion="avisoBW" aria-label="Sobre la demora">i</button></span>
          </div>
          <button class="sw" role="switch" aria-checked="${b.conectado}"
            data-accion="toggleBW" aria-label="Publicar en BirdWeather"></button>
        </div>
        ${b.conectado ? `<hr style="border:0;border-top:1px solid var(--rule);margin:11px 0">
          <div class="entre"><span class="chico">Token</span>
            <span class="mono">${esc(b.token_parcial || '—')}</span></div>` : ''}
        </div>
        ${b.conectado ? `
          <a class="b sec" href="${esc(b.mapa || 'https://app.birdweather.com/')}"
            target="_blank" rel="noopener" style="text-decoration:none;line-height:1.4">
            Ver mi estación en el mapa ↗</a>`
        : `<p class="chico">BirdWeather es un mapa público de estaciones de
            monitoreo acústico. Al activarlo, cada detección de este Tector se
            sube con su audio y su ubicación.</p>
           <p class="mini">Necesitás un token de estación de birdweather.com</p>`}
      </div></div>`;
  };

  P.apariencia = () => {
    const tema = API.guardado.leer('tector.tema') || 'sistema';
    const texto = API.guardado.leer('tector.texto') || 'normal';
    const op = (v, actual, txt, sub) => `
      <button class="opcion" data-set-tema="${v}" aria-selected="${actual === v}">
        <span><span class="tit">${txt}</span>${sub ? `<div class="mini">${sub}</div>` : ''}</span>
        ${actual === v ? '<span class="pill ok">✓</span>' : ''}</button>`;
    return `<div class="pantalla">
      ${encabezado('Apariencia', { volver: '/cuenta' })}
      <div class="scroll">
        <span class="rot">Tema</span>
        <div class="t cero" style="padding:5px">
          ${op('claro', tema, 'Claro')}
          ${op('oscuro', tema, 'Oscuro', 'Para salidas de campo de madrugada: el fondo claro arruina la visión nocturna.')}
          ${op('sistema', tema, 'Seguir al sistema')}
        </div>
        <span class="rot">Tamaño del texto</span>
        <div class="t cero" style="padding:5px">
          <button class="opcion" data-set-texto="normal" aria-selected="${texto === 'normal'}">
            <span class="tit">Normal</span>${texto === 'normal' ? '<span class="pill ok">✓</span>' : ''}</button>
          <button class="opcion" data-set-texto="grande" aria-selected="${texto === 'grande'}">
            <span class="tit" style="font-size:17px">Grande</span>${texto === 'grande' ? '<span class="pill ok">✓</span>' : ''}</button>
        </div>
        <span class="rot">Vista previa</span>
        <div class="destacada">
          <div class="foto sinfoto" style="aspect-ratio:16/7">${iso(56)}</div>
          <div class="cuerpo"><div class="nomb">Hornero</div>
            <div class="cient">Furnarius rufus</div>${ondaHTML('previa')}</div></div>
      </div></div>`;
  };

  const NOTIFS = [
    ['mudo', 'Un Tector dejó de reportar', 'Sin subidas por más de 48 h', true],
    ['bateria', 'Cierre por batería baja', 'Se cortó una ventana antes de tiempo', true],
    ['alerta', 'Alertas del log', 'Servicios caídos, alarma sin armar', true],
    ['especie', 'Especie nueva en la estación', '', false],
    ['ventana', 'Resumen de cada ventana', '', false],
    ['software', 'Software actualizado', '', false],
  ];

  function notifs() {
    try { return JSON.parse(API.guardado.leer('tector.notifs') || 'null')
      || Object.fromEntries(NOTIFS.map((n) => [n[0], n[3]])); }
    catch (e) { return Object.fromEntries(NOTIFS.map((n) => [n[0], n[3]])); }
  }

  P.notificaciones = () => {
    const n = E.datos.notifs || notifs();
    const fila = ([id, tit, sub]) => `<div class="t"><div class="entre">
      <div style="flex:1"><div style="font-weight:600;font-size:14px">${esc(tit)}</div>
        ${sub ? `<div class="mini">${esc(sub)}</div>` : ''}</div>
      <button class="sw" role="switch" aria-checked="${!!n[id]}" data-notif="${id}"
        aria-label="${esc(tit)}"></button></div></div>`;
    return `<div class="pantalla">
      ${encabezado('Notificaciones', { volver: '/cuenta' })}
      <div class="scroll">
        <p class="chico" style="margin-top:14px">Por defecto solo llegan los
          eventos que piden atención. Cada tipo se silencia por separado.</p>
        <span class="rot">Importantes</span>
        ${NOTIFS.filter((x) => x[3]).map(fila).join('')}
        <span class="rot">Opcionales</span>
        ${NOTIFS.filter((x) => !x[3]).map(fila).join('')}
        <button class="b" data-accion="guardarNotifs" ${E.datos.notifsSucio ? '' : 'disabled'}>
          Aplicar cambios</button>
      </div></div>`;
  };

  /* ---------------- asistente de sincronizacion ---------------- */
  P.sync = () => {
    const s = E.sync || {};
    const cerrar = E.dispositivos.length ? '/cuenta' : null;

    if (s.paso === 'buscando') {
      return `<div class="pantalla">
        ${encabezado('Sincronizar', { volver: '/sync' })}
        <div class="centro">
          <div class="spin"></div>
          <p class="sec">Buscando tu Tector</p>
          <p class="chico" style="max-width:290px">Abrí los ajustes de WiFi del
            teléfono y conectate a la red del dispositivo. No tiene contraseña.</p>
          <div class="t plana" style="width:100%;max-width:320px;text-align:left">
            <span class="rot" style="margin-top:0">Buscá una red así</span>
            <div class="mono" style="font-size:15px;color:var(--terra-ink)">Tector-####-setup</div>
            <p class="mini" style="margin:6px 0 0">Los cuatro dígitos son el
              número de serie, y están en la etiqueta del equipo.</p></div>
          <p class="mini">Detectando… ${s.segundos || 0} s</p>
          <div style="flex:1"></div>
          <button class="b sec" style="max-width:320px" data-accion="abrirWifi">
            Abrir ajustes de WiFi</button>
          <button class="b sec chica" style="max-width:320px" data-ir="${cerrar || '/sync'}">Cancelar</button>
        </div></div>`;
    }

    if (s.paso === 'sinRed') {
      return `<div class="pantalla">
        ${encabezado('Sincronizar', { volver: '/sync' })}
        <div class="centro">
          <div class="tilde neu">⏱</div>
          <p class="sec">No encontramos ningún Tector</p>
          <p class="chico" style="max-width:290px">Buscamos dos minutos y el
            teléfono nunca llegó a una red de configuración.</p>
          <div class="t plana" style="width:100%;max-width:320px;text-align:left">
            <span class="rot" style="margin-top:0">Probá esto</span>
            <p class="chico" style="margin:0">· Confirmá que estás conectado a
              <span class="mono">Tector-####-setup</span><br>
              · Mantené apretado 3 s el botón de setup del equipo<br>
              · Acercate más al dispositivo<br>
              · Verificá que tenga batería</p></div>
          <div style="flex:1"></div>
          <button class="b" style="max-width:320px" data-accion="buscar">Buscar de nuevo</button>
          <button class="b sec chica" style="max-width:320px" data-ir="${cerrar || '/sync'}">Cancelar</button>
        </div></div>`;
    }

    /* MODO GUIADO -- por que existe
     *
     * Servida por HTTPS (GitHub Pages, que es lo que permite instalarla como
     * app), la pagina NO puede hacerle fetch a http://192.168.4.1:5000: el
     * navegador bloquea el contenido mixto. Asi que el paso de elegir la red
     * no se puede dibujar dentro de la app.
     *
     * Lo que el navegador SI permite es NAVEGAR a una direccion http desde
     * una pagina https --el bloqueo es para subrecursos y fetch, no para ir
     * a otra pagina. De ahi este modo: la app abre la pagina que el propio
     * Tector sirve, que ya tiene la identidad del proyecto y hace lo mismo,
     * y despues verifica el resultado contra el servidor.
     *
     * Servida por HTTP --dentro de la tailnet-- no hace falta nada de esto y
     * se usa el modo automatico de siempre. */
    if (s.paso === 'serie') {
      return `<div class="pantalla">
        ${encabezado('Sincronizar', { volver: '/sync' })}
        <div class="scroll">
          <div class="aviso info" style="margin-top:14px"><span class="ic">1</span>
            <div>Abrí los ajustes de WiFi del teléfono y conectate a la red del
            Tector. <b>No tiene contraseña.</b></div></div>
          <div class="t plana">
            <span class="rot" style="margin-top:0">Buscá una red así</span>
            <div class="mono" style="font-size:16px;color:var(--terra-ink)">Tector-####-setup</div>
            <p class="mini" style="margin:6px 0 0">Los cuatro dígitos son el
              número de serie del equipo, y están en su etiqueta.</p></div>
          <div class="aviso info"><span class="ic">2</span>
            <div>Escribí acá esos cuatro dígitos, para que sepamos con qué
            Tector estamos trabajando.</div></div>
          <div class="campo"><label for="serie">Número de serie</label>
            <input id="serie" inputmode="numeric" maxlength="4" placeholder="4417"
              value="${esc(s.serie || '')}"></div>
          <div id="errSerie"></div>
          <button class="b" data-accion="confirmarSerie">Siguiente</button>
          <button class="b sec chica" data-ir="${cerrar || '/sync'}">Cancelar</button>
        </div></div>`;
    }

    if (s.paso === 'guiado') {
      return `<div class="pantalla">
        ${encabezado(`Configurar Tector ${s.serie}`, { volver: '/sync' })}
        <div class="scroll">
          <div class="aviso info" style="margin-top:14px"><span class="ic">3</span>
            <div>Abrí la página del Tector y elegí ahí la red WiFi a la que se
            va a conectar, con su contraseña.</div></div>
          <a class="b" href="${esc(API.PORTAL)}" target="_blank" rel="noopener"
            style="text-decoration:none;line-height:1.4">Abrir la página del Tector ↗</a>
          <p class="mini" style="text-align:center;margin-top:-2px">
            Se abre en el navegador, en <span class="mono">192.168.4.1</span></p>
          <div class="aviso cuidado" style="margin-top:16px"><span class="ic">4</span>
            <div>Cuando el Tector diga que está conectando, <b>volvé a tu red
            WiFi de siempre</b> y tocá Verificar acá abajo.</div></div>
          <button class="b" data-accion="verificarGuiado">Verificar</button>
          <button class="b sec chica" data-ir="${cerrar || '/sync'}">Cancelar</button>
          <div class="t plana" style="margin-top:14px">
            <p class="mini" style="margin:0">Este paso se hace en la página del
              propio Tector porque la app está servida por HTTPS y el navegador
              no la deja hablarle directo a un equipo por HTTP. Es una
              limitación del navegador, no del Tector.</p></div>
        </div></div>`;
    }

    if (s.paso === 'redes') {
      return `<div class="pantalla">
        ${encabezado(`Configurar Tector ${s.serie}`, { sub: 'Paso 2 de 3' })}
        <div class="scroll">
          <div class="aviso bien" style="margin-top:14px"><span class="ic">✓</span>
            <div>Conectado a <b>Tector-${esc(s.serie)}-setup</b></div></div>
          <span class="rot">Red a la que se va a conectar</span>
          <div class="t cero">${(s.redes || []).map((r, i) => `
            <button class="fila" data-red="${i}" ${s.elegida === r.ssid ? 'style="background:var(--terra-soft)"' : ''}>
              <span class="crece">${r.protegida ? '🔒 ' : ''}${esc(r.ssid)}</span>
              <span class="mini mono">${r.senal ?? '?'}%</span></button>`).join('')}
          </div>
          <button class="b sec chica" data-accion="recargarRedes">↻ Actualizar lista</button>
          ${s.elegida ? `
            <div class="campo"><label for="pw">Contraseña de ${esc(s.elegida)}</label>
              <input id="pw" type="password" autocomplete="off"></div>
            <div class="chk"><input type="checkbox" id="verpw"><label for="verpw">Mostrar contraseña</label></div>
            <button class="b" data-accion="conectarWifi" style="margin-top:12px">Conectar</button>
          ` : '<p class="mini">Elegí una red para continuar.</p>'}
        </div></div>`;
    }

    if (s.paso === 'verificando') {
      const p = s.progreso || 0;
      const paso = (n, txt) => `<div class="paso ${p > n ? 'listo' : p === n ? 'curso' : ''}">
        <span class="marca">${p > n ? '✓' : p === n ? '⋯' : n + 1}</span><span>${txt}</span></div>`;
      return `<div class="pantalla">
        ${encabezado('Verificando conexión')}
        <div class="centro">
          <div class="spin"></div>
          <p class="sec">Verificando conexión</p>
          <div class="t" style="width:100%;max-width:330px"><div class="pasos">
            ${paso(0, 'El Tector recibió las credenciales')}
            ${paso(1, 'Volviste a tu red WiFi de siempre')}
            ${paso(2, 'Leyendo el log del Tector')}
          </div></div>
          ${p === 1 ? `<div class="aviso cuidado" style="max-width:330px;text-align:left">
            <span class="ic">!</span><div>Volvé a conectar el teléfono a tu red
            WiFi normal para que podamos confirmar el resultado.</div></div>` : ''}
          <p class="mini">Puede tardar hasta 3 minutos · ${s.segundos || 0} s</p>
          <div style="flex:1"></div>
          <p class="mini" style="max-width:300px">No cierres la app.</p>
        </div></div>`;
    }

    if (s.paso === 'exito') {
      return `<div class="pantalla">
        ${encabezado('Listo')}
        <div class="centro">
          <div class="tilde">${IC.tilde}</div>
          <p class="sec">Su Tector ha sido configurado</p>
          ${s.log ? `<div class="log" style="max-width:330px">${esc(s.log)}</div>` : ''}
          <div style="width:100%;max-width:330px;text-align:left;margin-top:6px">
            <div class="campo"><label for="ap">Apodo (opcional)</label>
              <input id="ap" placeholder="Ej: Reserva Costanera"
                value="${esc(s.apodo || '')}"></div>
          </div>
          <div style="flex:1"></div>
          <button class="b" style="max-width:330px" data-accion="terminarSync">Ir al dashboard</button>
        </div></div>`;
    }

    if (s.paso === 'errorTector') {
      return `<div class="pantalla">
        ${encabezado('No se pudo conectar')}
        <div class="centro">
          <div class="tilde mal">${IC.cruz}</div>
          <p class="sec">El Tector no pudo conectarse</p>
          ${s.modo === 'guiado' ? `
            <p class="chico" style="max-width:290px">Pasaron tres minutos y el
              Tector no avisó que se conectó.</p>
            <div class="t plana" style="width:100%;max-width:320px;text-align:left">
              <p class="chico" style="margin:0">Fijate si la red
                <span class="mono">Tector-${esc(s.serie)}-setup</span> volvió a
                aparecer en tu lista de WiFi: si está, la red o la contraseña
                que le diste no funcionaron. Si no está, puede que el Tector sí
                se haya conectado y todavía no haya subido nada.</p></div>`
          : `
            <p class="chico" style="max-width:290px">Volvió a modo configuración,
              así que la red o la contraseña no funcionaron.</p>
            <div class="t" style="width:100%;max-width:320px;border-color:var(--mal)">
              <span class="rot" style="margin-top:0">Detectado de nuevo</span>
              <div class="mono" style="font-size:14px">Tector-${esc(s.serie)}-setup</div></div>`}
          <div style="flex:1"></div>
          <button class="b" style="max-width:320px" data-accion="buscar">Reiniciar conexión</button>
          <button class="b sec chica" style="max-width:320px" data-ir="${cerrar || '/sync'}">Salir del asistente</button>
        </div></div>`;
    }

    if (s.paso === 'sinConexion') {
      return `<div class="pantalla">
        ${encabezado('Sin conexión')}
        <div class="centro">
          <div class="tilde neu">📶</div>
          <p class="sec">Sin conexión</p>
          <p class="chico" style="max-width:290px">Conectate a una red WiFi y reintentá.</p>
          <div class="t plana" style="width:100%;max-width:320px;text-align:left">
            <p class="chico" style="margin:0">No pudimos leer el log, así que
              <b>no sabemos</b> si el Tector se conectó o no. Cuando recuperes
              internet lo verificamos.</p></div>
          <div style="flex:1"></div>
          <button class="b" style="max-width:320px" data-accion="reverificar">Reintentar</button>
          <button class="b sec chica" style="max-width:320px" data-ir="${cerrar || '/sync'}">Salir del asistente</button>
        </div></div>`;
    }

    // intro
    return `<div class="pantalla">
      ${encabezado('Sincronizar dispositivo', { volver: cerrar || undefined })}
      <div class="centro">
        ${iso(46)}
        <p class="sec">Sincronizar un Tector</p>
        <p class="chico" style="max-width:290px">Vamos a conectar el dispositivo
          a una red WiFi. Si ya estaba configurado, esto reemplaza su red actual.</p>
        <div class="t plana" style="width:100%;max-width:320px;text-align:left">
          <span class="rot" style="margin-top:0">Antes de empezar</span>
          <p class="chico" style="margin:0">1 · Encendé el Tector<br>
            2 · Mantené apretado 3 s el botón de setup<br>
            3 · Quedate cerca del dispositivo</p></div>
        <div style="flex:1"></div>
        <button class="b" style="max-width:320px" data-accion="buscar">Empezar</button>
        ${cerrar ? `<button class="b sec chica" style="max-width:320px" data-ir="${cerrar}">Cancelar</button>` : ''}
      </div></div>`;
  };

  /* Parche puntual del panel de horarios, sin volver a pintar la pantalla.
   * Solo tres cosas dependen de lo que el usuario escribe: la hora de fin
   * calculada, la advertencia de ventana larga, y si "Aplicar" esta
   * habilitado. */
  function refrescarHorarios() {
    const h = E.datos.horariosForm;
    if (!h) return;
    ['amanecer', 'atardecer'].forEach((cual) => {
      const dur = Number(h['duracion_' + cual + '_h']) || 0;
      const fin = sumarHoras(h['inicio_' + cual], dur);
      const campo = document.querySelector(`[data-campo="duracion_${cual}_h"]`);
      const tarjeta = campo && campo.closest('.t');
      if (!tarjeta) return;

      const salida = tarjeta.querySelector('.entre .mono');
      if (salida) salida.textContent = fin;

      const larga = dur > 2;
      tarjeta.style.borderColor = larga ? 'var(--avi)' : '';
      let alerta = tarjeta.querySelector('.aviso.cuidado');
      if (larga && !alerta) {
        alerta = document.createElement('div');
        alerta.className = 'aviso cuidado';
        alerta.style.margin = '9px 0 0';
        // Mismo texto que la plantilla de P.horarios. Si cambia uno tiene que
        // cambiar el otro: este es el que se ve al mover la duración, aquel
        // el que se ve al entrar a la pantalla.
        alerta.innerHTML = '<span class="ic">⚠</span><div>Las ventanas de '
          + 'más de 2 horas consumen mucha batería: el Tector puede cortar '
          + 'la ventana antes de tiempo para preservar batería.</div>';
        tarjeta.appendChild(alerta);
      } else if (!larga && alerta) {
        alerta.remove();
      }
    });
    const boton = document.querySelector('[data-accion="guardarHorarios"]');
    if (boton) boton.disabled = !E.datos.horariosSucio;
  }

  /* ---------------- logica ---------------- */
  function sumarHoras(hhmm, horas) {
    if (!hhmm) return '—';
    const [h, m] = hhmm.split(':').map(Number);
    const t = ((h * 60 + m + Math.round(horas * 60)) % 1440 + 1440) % 1440;
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
  }

  function aplicarTema() {
    document.documentElement.dataset.tema = API.guardado.leer('tector.tema') || 'sistema';
    document.documentElement.dataset.texto = API.guardado.leer('tector.texto') || 'normal';
  }

  async function cargarDispositivos() {
    E.dispositivos = await API.dispositivos();
    if (!E.activo || !E.dispositivos.some((d) => d.serie === E.activo)) {
      E.activo = E.dispositivos[0]?.serie || null;
    }
  }

  /* ---------------- router ---------------- */
  async function pintar() {
    const ruta = location.hash.slice(1) || '/';
    E.ruta = ruta;
    const app = $('#app');

    if (!API.hayToken() && ruta !== '/servidor') { app.innerHTML = P.login(); return enlazar(); }

    const partes = ruta.split('/').filter(Boolean);
    app.innerHTML = cargando();

    try {
      if (ruta === '/servidor') { app.innerHTML = P.servidor(); return enlazar(); }
      if (ruta === '/apariencia') { app.innerHTML = P.apariencia(); return enlazar(); }
      if (ruta === '/notificaciones') {
        if (!E.datos.notifs) { E.datos.notifs = notifs(); E.datos.notifsSucio = false; }
        app.innerHTML = P.notificaciones(); return enlazar();
      }
      if (ruta === '/sync') { app.innerHTML = P.sync(); return enlazar(); }

      if (!E.dispositivos.length) await cargarDispositivos();
      if (!E.dispositivos.length) { app.innerHTML = P.sinDispositivos(); return enlazar(); }

      const serie = E.activo;

      if (ruta === '/') {
        const [dets, stats] = await Promise.all([
          API.detecciones(serie, { limite: 5 }), API.estadisticas(serie),
        ]);
        E.datos.dets = dets; E.datos.stats = stats;
        app.innerHTML = P.inicio();
      } else if (ruta === '/todos') {
        E.datos.resumen = await API.resumen();
        app.innerHTML = P.todos();
      } else if (ruta === '/cantos') {
        // Las tres vistas del explorador salen del mismo listado; cambiar de
        // orden no vuelve a pedir nada.
        E.datos.todas = await API.detecciones(serie, { limite: 2000 });
        app.innerHTML = P.cantos();
      } else if (partes[0] === 'cantos' && partes.length === 2) {
        const fecha = decodeURIComponent(partes[1]);
        const dets = await API.detecciones(serie, { fecha, limite: 1000 });
        const g = {};
        dets.forEach((d) => {
          g[d.especie_carpeta] = g[d.especie_carpeta]
            || { carpeta: d.especie_carpeta, nombre: nombreLindo(d), cuantas: 0 };
          g[d.especie_carpeta].cuantas++;
        });
        E.datos.grupos = Object.values(g).sort((a, b) => b.cuantas - a.cuantas);
        app.innerHTML = P.cantosFecha(fecha);
      } else if (partes[0] === 'especie' && partes.length === 2) {
        const carpeta = decodeURIComponent(partes[1]);
        E.datos.dets = await API.detecciones(serie, { especie: carpeta, limite: 1000 });
        app.innerHTML = P.especieTodas(carpeta);
      } else if (partes[0] === 'cantos' && partes.length === 3) {
        const fecha = decodeURIComponent(partes[1]);
        const especie = decodeURIComponent(partes[2]);
        E.datos.dets = await API.detecciones(serie, { fecha, especie, limite: 500 });
        app.innerHTML = P.cantosEspecie(fecha, especie);
      } else if (ruta === '/datos') {
        E.datos.stats = await API.estadisticas(serie);
        app.innerHTML = P.datos();
      } else if (ruta === '/cuenta') {
        app.innerHTML = P.cuenta();
      } else if (partes[0] === 'dispositivo') {
        app.innerHTML = P.dispositivo(partes[1]);
      } else if (ruta === '/horarios') {
        if (!E.datos.horariosForm) {
          const h = await API.horarios(serie);
          const v = h.en_dispositivo || {};
          E.datos.horariosOriginal = {
            auto_sync: !!v.auto_sync,
            inicio_amanecer: v.amanecer?.inicio || '08:00',
            duracion_amanecer_h: Number(v.duracion_amanecer_h || 2),
            inicio_atardecer: v.atardecer?.inicio || '18:00',
            duracion_atardecer_h: Number(v.duracion_atardecer_h || 2),
            offset_amanecer_min: Number(v.offset_amanecer_min || 0),
            offset_atardecer_min: Number(v.offset_atardecer_min || 0),
          };
          E.datos.horariosForm = { ...E.datos.horariosOriginal };
          E.datos.horariosSucio = false;
        }
        app.innerHTML = P.horarios();
      } else if (ruta === '/birdweather') {
        if (!E.datos.bw) E.datos.bw = await API.birdweather(serie);
        app.innerHTML = P.birdweather();
      } else {
        location.hash = '#/'; return;
      }
    } catch (err) {
      if (err.codigo === 401) { API.salir(); location.hash = '#/login'; location.reload(); return; }
      app.innerHTML = `<div class="pantalla"><div class="centro">
        <div class="tilde mal">${IC.cruz}</div>
        <p class="sec">No se pudieron cargar los datos</p>
        <p class="chico" style="max-width:290px">${esc(err.message)}</p>
        <button class="b" style="max-width:300px" data-accion="recargar">Reintentar</button>
        <button class="b sec chica" style="max-width:300px" data-ir="/servidor">Revisar el servidor</button>
      </div></div>`;
    }
    enlazar();
  }

  /* ---------------- eventos ---------------- */
  function enlazar() {
    const app = $('#app');

    /* Sin <form>: la app corre tambien dentro de iframes con sandbox, donde
     * el envio de formularios queda bloqueado por el navegador y el foco de
     * los campos se comporta de forma erratica. Enter se ata a mano. */
    app.querySelectorAll('[data-entrar]').forEach((i) =>
      i.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); accion('entrar'); }
      }));
    app.querySelectorAll('[data-entrar-bw]').forEach((i) =>
      i.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); accion('conectarBW'); }
      }));
    const campoServidor = $('#s');
    if (campoServidor) campoServidor.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); accion('guardarServidor'); }
    });
    const campoPw = $('#pw');
    if (campoPw) campoPw.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); accion('conectarWifi'); }
    });
    const ver = $('#verpw');
    if (ver) ver.addEventListener('change', () => {
      const p = $('#pw'); p.type = ver.checked ? 'text' : 'password';
    });
    /* Los campos de horario NO re-renderizan la pantalla en cada tecla:
     * reemplazar el HTML mientras alguien escribe le saca el foco al input y
     * el campo se vuelve inusable. Se parchean solo los nodos que dependen
     * del valor. */
    app.querySelectorAll('[data-campo]').forEach((i) => {
      i.addEventListener('input', () => {
        const c = i.dataset.campo;
        E.datos.horariosForm[c] = i.type === 'number' ? Number(i.value) : i.value;
        E.datos.horariosSucio = JSON.stringify(E.datos.horariosForm)
          !== JSON.stringify(E.datos.horariosOriginal);
        refrescarHorarios();
      });
    });
  }

  document.addEventListener('click', async (ev) => {
    const t = ev.target;

    const play = t.closest('[data-play]');
    if (play) {
      const ruta = play.dataset.play;
      const d = activo();

      /* Si es el que ya esta sonando, esto es pausa o reanudar: reproducir()
       * lo resuelve antes de mirar la url, asi que no hace falta ir a buscar
       * nada. Sin este atajo, cada pausa esperaria una promesa. */
      if (sonando && sonando.id === ruta) { reproducir(play, null); return; }
      if (!d) { reproducir(play, null); return; }

      /* El audio se baja con fetch autenticado (ver API.urlAudio): puede
       * tardar un segundo, y sin aviso parece que el boton no anda. */
      play.classList.add('cargando');
      API.urlAudio(d.serie, ruta)
        .then((url) => reproducir(play, url))
        .catch((e) => toast(e.mensaje || 'No se pudo traer el audio.'))
        .finally(() => play.classList.remove('cargando'));
      return;
    }

    const rep = t.closest('[data-reportar]');
    if (rep) { await reportarDeteccion(rep.dataset.reportar); return; }

    const bajar = t.closest('[data-bajar]');
    if (bajar) { await descargarAudio(bajar.dataset.bajar); return; }
    const comp = t.closest('[data-compartir]');
    if (comp) { await compartirAudio(comp.dataset.compartir); return; }
    const carp = t.closest('[data-carpeta]');
    if (carp) {
      const [fecha, especie] = carp.dataset.carpeta.split('|');
      await descargarCarpeta(fecha, especie);
      return;
    }

    const irA = t.closest('[data-ir]');
    if (irA) { detener(); ir(irA.dataset.ir); return; }

    const det = t.closest('[data-det]');
    if (det) {
      const donde = (E.datos.dets || []).concat(E.datos.todas || []);
      const d = donde.find((x) => x.ruta === det.dataset.det);
      if (d) ir(`/cantos/${encodeURIComponent(d.fecha)}/${encodeURIComponent(d.especie_carpeta)}`);
      return;
    }
    const f = t.closest('[data-fecha]');
    if (f) { ir('/cantos/' + encodeURIComponent(f.dataset.fecha)); return; }
    const todoEsp = t.closest('[data-todo-especie]');
    if (todoEsp) { ir('/especie/' + encodeURIComponent(todoEsp.dataset.todoEspecie)); return; }
    const esp = t.closest('[data-especie]');
    if (esp) {
      ir(`/cantos/${encodeURIComponent(E.ruta.split('/')[2])}/${encodeURIComponent(esp.dataset.especie)}`);
      return;
    }
    const disp = t.closest('[data-disp]');
    if (disp) { E.activo = disp.dataset.disp; limpiar(); ir('/'); return; }
    const cfg = t.closest('[data-config]');
    if (cfg) { E.activo = cfg.dataset.config; limpiar(); ir('/dispositivo/' + cfg.dataset.config); return; }

    /* OJO con el nombre de estos atributos. Antes eran data-tema y
     * data-texto, los MISMOS que aplicarTema() escribe en <html>. Como
     * closest() sube hasta la raiz, cualquier clic en cualquier lugar de la
     * app encontraba <html data-tema="..."> y se interpretaba como "el
     * usuario eligio un tema": la pantalla se volvia a pintar entera en cada
     * clic, y los campos de texto perdian el foco apenas se los tocaba.
     * Los de la interfaz llevan prefijo data-set-. */
    const tema = t.closest('[data-set-tema]');
    if (tema) {
      API.guardado.poner('tector.tema', tema.dataset.setTema); aplicarTema(); pintar();
      toast('Tema aplicado'); return;
    }
    const texto = t.closest('[data-set-texto]');
    if (texto) {
      API.guardado.poner('tector.texto', texto.dataset.setTexto); aplicarTema(); pintar();
      return;
    }
    const nt = t.closest('[data-notif]');
    if (nt) {
      E.datos.notifs[nt.dataset.notif] = !E.datos.notifs[nt.dataset.notif];
      E.datos.notifsSucio = JSON.stringify(E.datos.notifs) !== JSON.stringify(notifs());
      $('#app').innerHTML = P.notificaciones(); enlazar(); return;
    }
    const red = t.closest('[data-red]');
    if (red) {
      E.sync.elegida = E.sync.redes[Number(red.dataset.red)].ssid;
      $('#app').innerHTML = P.sync(); enlazar(); return;
    }

    const acc = t.closest('[data-accion]');
    if (acc) { await accion(acc.dataset.accion, acc); return; }
  });

  function limpiar() { E.datos = {}; }

  async function entrar() {
    const b = document.querySelector('[data-accion="entrar"]');
    const u = $('#u').value.trim(), c = $('#c').value;
    if (!u || !c) {
      $('#errLogin').innerHTML = '<p class="error">Completá usuario y contraseña.</p>';
      return;
    }
    b.disabled = true; b.textContent = 'Entrando…';
    try {
      const r = await API.login(u, c);
      E.usuario = r.usuario;
      limpiar(); E.dispositivos = [];
      location.hash = r.tiene_dispositivos ? '#/' : '#/sync';
      pintar();
    } catch (err) {
      $('#errLogin').innerHTML = `<p class="error">${esc(err.message)}</p>`;
      b.disabled = false; b.textContent = 'Entrar';
    }
  }

  /* ---------------- acciones ---------------- */
  async function accion(nombre, el) {
    const serie = E.activo;

    if (nombre === 'recargar') { limpiar(); pintar(); return; }

    if (nombre === 'instalar') {
      if (!E.prompt) { await accion('diagnostico'); return; }
      E.prompt.prompt();
      const r = await E.prompt.userChoice;
      E.prompt = null;
      if (r.outcome === 'accepted') toast('Instalando…');
      pintar();
      return;
    }

    if (nombre === 'creditos') {
      const especies = [...new Set(
        (E.datos.dets || []).map((d) => d.especie_carpeta))];
      const lista = await API.creditos(especies);
      await hoja(`<h2>Créditos de las fotos</h2>
        <p class="chico">Las fotos de especies vienen de Wikimedia Commons.
          Son de uso libre, incluso comercial, pero <b>piden citar al autor y
          la licencia</b>: por eso están acá y debajo de cada foto.</p>
        ${lista.length ? lista.map((c) => `
          <div style="padding:9px 2px;border-top:1px solid var(--rule)">
            <div style="font-weight:600;font-size:13.5px">${esc(c.especie)}</div>
            <div class="mini">${esc(c.autor || 'autor no indicado')} · ${esc(c.licencia)}</div>
            ${c.pagina ? `<a class="mini" href="${esc(c.pagina)}" target="_blank"
              rel="noopener">Ver el original en Commons ↗</a>` : ''}
          </div>`).join('')
        : '<p class="mini">Todavía no se cargó ninguna foto.</p>'}
        <p class="mini" style="margin-top:12px">Las que están bajo CC BY-SA
          piden además que, si alguien <i>modifica</i> la foto, publique el
          resultado con la misma licencia. Mostrarlas sin retocar, como hace
          la app, no obliga a nada de eso.</p>`);
      return;
    }

    if (nombre === 'diagnostico') {
      const seguro = window.isSecureContext;
      const std = window.matchMedia('(display-mode: standalone)').matches;
      const fila = (k, v, ok) =>
        `<div class="entre" style="padding:5px 0"><span class="chico">${esc(k)}</span>
         <span class="mini" style="color:var(${ok ? '--ok' : '--avi'})">${esc(v)}</span></div>`;
      await confirmar({
        titulo: 'Estado de la app', seguir: false, cancelar: 'Cerrar',
        confirmar: 'Copiar',
        cambios: [
          ['Versión', VERSION],
          ['Servida por HTTPS', seguro ? 'sí' : 'NO'],
          ['Service worker', E.sw],
          ['Corriendo instalada', std ? 'sí' : 'no'],
          ['Se puede instalar ahora', E.prompt ? 'sí' : 'todavía no'],
        ], 
        nota: !E.prompt && !std
          ? 'Si el botón de instalar no aparece: Chrome pide HTTPS, un service '
            + 'worker activo, y que hayas interactuado con la página. A veces '
            + 'aparece recién al volver a entrar. En una pestaña de incógnito '
            + 'nunca aparece.'
          : null,
      }).then(async (copiar) => {
        if (copiar) {
          const txt = [`version: ${VERSION}`, `origen: ${location.origin}`,
            `seguro: ${seguro}`,
            `service worker: ${E.sw}`, `standalone: ${std}`,
            `puede instalar: ${!!E.prompt}`,
            `navegador: ${navigator.userAgent}`].join(String.fromCharCode(10));
          try { await navigator.clipboard.writeText(txt); toast('Copiado'); }
          catch (e) { toast('No se pudo copiar'); }
        }
      });
      return;
    }

    if (nombre === 'entrar') { await entrar(); return; }

    if (nombre === 'guardarServidor') {
      API.fijarServidor($('#s').value);
      API.salir(); limpiar(); E.dispositivos = [];
      toast($('#s').value.trim() ? 'Servidor guardado' : 'Modo demostración');
      location.hash = '#/login'; pintar();
      return;
    }

    if (nombre === 'conectarWifi') {
      await mandarCredenciales(E.sync.elegida, $('#pw').value);
      return;
    }

    if (nombre === 'conectarBW') {
      const b = el; const tk = $('#tk').value.trim();
      if (!tk) { $('#errBW').innerHTML = '<p class="error">Pegá el token.</p>'; return; }
      b.disabled = true; b.textContent = 'Conectando…';
      try {
        const r = await API.guardarBirdweather(serie, tk);
        E.datos.bw = await API.birdweather(serie);
        E.datos.bwEditando = false;
        pintar(); toast(r.aviso || 'Guardado');
      } catch (err) {
        $('#errBW').innerHTML = `<p class="error">${esc(err.message)}</p>`;
        b.disabled = false; b.textContent = 'Conectar';
      }
      return;
    }

    if (nombre === 'salir') {
      const ok = await confirmar({ titulo: '¿Cerrar sesión?', seguir: false,
        confirmar: 'Cerrar sesión', cancelar: 'Cancelar', peligro: true });
      if (ok) { API.salir(); limpiar(); E.dispositivos = []; location.hash = '#/login'; pintar(); }
      return;
    }

    if (nombre === 'probar') {
      const url = $('#s').value.trim();
      const caja = $('#resProbar');
      caja.innerHTML = '<p class="chico">Probando…</p>';
      try {
        const r = await fetch(url.replace(/\/+$/, '') + '/salud');
        caja.innerHTML = r.ok
          ? '<div class="aviso bien"><span class="ic">✓</span><div>El servidor responde.</div></div>'
          : `<div class="aviso error"><span class="ic">✕</span><div>Respondió ${r.status}.</div></div>`;
      } catch (e) {
        caja.innerHTML = '<div class="aviso error"><span class="ic">✕</span><div>No respondió. Revisá la dirección y que estés en la misma red.</div></div>';
      }
      return;
    }

    if (nombre === 'elegirDisp') {
      const elegido = await hoja(`<h2>Elegir dispositivo</h2>
        ${E.dispositivos.map((d) => {
          const e = estadoDe(d);
          return `<button class="opcion" data-elegir="${esc(d.serie)}"
            aria-selected="${d.serie === E.activo}">
            <span><span class="tit">${esc(d.apodo || 'Tector ' + d.serie)}</span>
              <div class="est"><span class="pto ${e.clase}"></span>${esc(e.texto)}</div></span>
            <span class="mini mono">#${esc(d.serie)}</span></button>`;
        }).join('')}
        <hr style="border:0;border-top:1px solid var(--rule);margin:10px 0">
        <button class="b sec chica" data-elegir="__todos">Ver todos combinados</button>`);
      if (!elegido) return;
      if (elegido === '__todos') { ir('/todos'); return; }
      E.activo = elegido; limpiar(); pintar();
      return;
    }

    if (nombre === 'autoSync') {
      E.datos.horariosForm.auto_sync = !E.datos.horariosForm.auto_sync;
      E.datos.horariosSucio = JSON.stringify(E.datos.horariosForm)
        !== JSON.stringify(E.datos.horariosOriginal);
      $('#app').innerHTML = P.horarios(); enlazar();
      return;
    }

    if (nombre === 'guardarHorarios') {
      const n = E.datos.horariosForm, o = E.datos.horariosOriginal;
      const cambios = [];
      if (n.auto_sync !== o.auto_sync) cambios.push(['Automático',
        `${o.auto_sync ? 'Sí' : 'No'} → ${n.auto_sync ? 'Sí' : 'No'}`]);
      ['amanecer', 'atardecer'].forEach((v) => {
        const iN = n['inicio_' + v], iO = o['inicio_' + v];
        const dN = n['duracion_' + v + '_h'], dO = o['duracion_' + v + '_h'];
        if (iN !== iO || dN !== dO) {
          cambios.push([v.charAt(0).toUpperCase() + v.slice(1),
            `${iO}–${sumarHoras(iO, dO)} → ${iN}–${sumarHoras(iN, dN)}`]);
        }
      });
      const est = activo()?.estado;
      const cuando = est?.proxima_ventana?.hora;
      const ok = await confirmar({
        titulo: '¿Guardar los horarios?', cambios,
        aviso: `El Tector va a tomar el cambio cuando cierre su próxima ventana${cuando ? `, a las <b>${esc(cuando)}</b>` : ''}. Hasta entonces sigue con los horarios anteriores.`,
        nota: 'Los cambios de hora de inicio rigen desde la ventana siguiente, no desde la que esté en curso.',
      });
      if (!ok) { if (ok === false) { E.datos.horariosForm = { ...E.datos.horariosOriginal };
        E.datos.horariosSucio = false; $('#app').innerHTML = P.horarios(); enlazar(); } return; }
      try {
        const r = await API.guardarHorarios(serie, n);
        E.datos.horariosOriginal = { ...n }; E.datos.horariosSucio = false;
        $('#app').innerHTML = P.horarios(); enlazar();
        toast(r.aviso || 'Guardado');
      } catch (err) { toast(err.message, 4200); }
      return;
    }

    if (nombre === 'guardarNotifs') {
      const previo = notifs();
      const cambios = NOTIFS.filter((n) => !!previo[n[0]] !== !!E.datos.notifs[n[0]])
        .map((n) => [n[1], `${previo[n[0]] ? 'Sí' : 'No'} → ${E.datos.notifs[n[0]] ? 'Sí' : 'No'}`]);
      const ok = await confirmar({ titulo: '¿Guardar los cambios?', cambios });
      if (ok === false) { E.datos.notifs = notifs(); E.datos.notifsSucio = false;
        $('#app').innerHTML = P.notificaciones(); enlazar(); return; }
      if (!ok) return;
      API.guardado.poner('tector.notifs', JSON.stringify(E.datos.notifs));
      E.datos.notifsSucio = false;
      $('#app').innerHTML = P.notificaciones(); enlazar();
      toast('Preferencias guardadas');
      return;
    }

    /* Advertencia sobre la precision del modelo.
     *
     * Va como globo y no como texto fijo por lo mismo que el aviso de
     * BirdWeather: una advertencia siempre visible se vuelve invisible a la
     * semana. Pero tiene que estar, y en la pantalla donde alguien mira las
     * detecciones y saca conclusiones. */
    if (nombre === 'avisoPrecision') {
      const g = el.closest('.globo');
      const previo = g.querySelector('.txt');
      if (previo) { previo.remove(); return; }
      const d = document.createElement('div');
      d.className = 'txt';
      d.style.width = 'min(330px,86vw)';
      d.style.maxHeight = '62vh';
      d.style.overflowY = 'auto';
      d.innerHTML = `
        <b style="color:var(--ink)">El Tector no es perfecto</b>
        <p style="margin:6px 0">Un estudio interno midió un <b>89&nbsp;% de
          precisión</b>: de cada 100 aves detectadas, unas 11 están mal
          etiquetadas en promedio. Es algo inevitable de un modelo de
          aprendizaje automático enfrentado a un fenómeno tan variable como el
          canto de las aves.</p>
        <p style="margin:6px 0">Además, la red es <b>más sensible a unas
          especies que a otras</b>, y produce más detecciones de esas. Que una
          especie aparezca mucho en estas listas no significa que sea más
          abundante en el sitio: puede significar solo que la red responde
          mejor a su canto. Estos conteos no son una medida directa de la
          distribución real de aves del lugar.</p>
        <p style="margin:6px 0 0">Futuras versiones de TectorNet van a tratar
          de mejorar las dos cosas.</p>
        <div class="mini" style="text-align:right;margin-top:8px">Entendido</div>`;
      g.appendChild(d);
      return;
    }

    if (nombre === 'avisoBW') {
      const g = el.closest('.globo');
      const previo = g.querySelector('.txt');
      if (previo) { previo.remove(); return; }
      const d = document.createElement('div');
      d.className = 'txt';
      d.innerHTML = `<b style="color:var(--ink)">Puede tardar en aparecer</b><br>
        BirdWeather procesa las estaciones nuevas con sus propios tiempos. Tu
        Tector puede tardar varias horas en verse en el mapa aunque acá figure
        como conectado. La demora es de BirdWeather, no de la app.`;
      g.appendChild(d);
      return;
    }

    if (nombre === 'toggleBW') {
      if (E.datos.bw.conectado) {
        const ok = await confirmar({
          titulo: '¿Desconectar de BirdWeather?', seguir: false, peligro: true,
          confirmar: 'Desconectar', cancelar: 'Cancelar',
          nota: 'Este Tector deja de publicar. Las detecciones que ya subiste siguen en el mapa; para borrarlas hay que hacerlo desde BirdWeather.',
        });
        if (!ok) return;
        try {
          const r = await API.guardarBirdweather(serie, '');
          E.datos.bw = await API.birdweather(serie);
          pintar(); toast(r.aviso || 'Desconectado');
        } catch (err) { toast(err.message, 4200); }
      } else {
        E.datos.bwEditando = true; $('#app').innerHTML = P.birdweather(); enlazar();
      }
      return;
    }

    if (nombre === 'renombrar') {
      const d = E.dispositivos.find((x) => x.serie === serie);
      const nuevo = prompt('Apodo del Tector ' + serie, d?.apodo || '');
      if (nuevo === null) return;
      const ok = await confirmar({ titulo: '¿Guardar el apodo?',
        cambios: [['Apodo', `${d?.apodo || '—'} → ${nuevo || '—'}`]], seguir: false });
      if (!ok) return;
      await API.renombrar(serie, nuevo);
      await cargarDispositivos(); pintar(); toast('Apodo guardado');
      return;
    }

    if (nombre === 'desvincular') {
      const d = E.dispositivos.find((x) => x.serie === serie);
      const ok = await confirmar({
        titulo: `¿Desvincular ${d?.apodo || 'Tector ' + serie}?`,
        seguir: false, peligro: true, confirmar: 'Desvincular', cancelar: 'Cancelar',
        nota: 'Sale de tu cuenta. No borra nada de Drive ni apaga el dispositivo: sigue grabando y subiendo igual, y podés volver a vincularlo después.',
      });
      if (!ok) return;
      await API.desvincular(serie);
      E.dispositivos = []; limpiar(); await cargarDispositivos();
      ir(E.dispositivos.length ? '/cuenta' : '/sync');
      toast('Tector desvinculado');
      return;
    }

    if (nombre === 'resincronizar') { ir('/sync'); return; }
    if (nombre === 'abrirWifi') {
      toast('Abrí Ajustes → WiFi y elegí la red Tector-####-setup', 4500);
      return;
    }
    if (nombre === 'buscar') { buscarTector(); return; }

    if (nombre === 'confirmarSerie') {
      const v = ($('#serie').value || '').trim();
      if (!/^\d{4}$/.test(v)) {
        $('#errSerie').innerHTML =
          '<p class="error">Son cuatro dígitos, como 4417.</p>';
        return;
      }
      E.sync.serie = v; E.sync.paso = 'guiado';
      $('#app').innerHTML = P.sync(); enlazar();
      return;
    }

    if (nombre === 'verificarGuiado') {
      E.sync.ssidDestino = null;
      verificar();
      return;
    }
    if (nombre === 'recargarRedes') { cargarRedes(); return; }
    if (nombre === 'reverificar') { verificar(); return; }
    if (nombre === 'terminarSync') {
      const ap = $('#ap')?.value.trim();
      try {
        if (!API.enDemo()) {
          await API.vincular(E.sync.serie, ap || null);
          if (ap) await API.renombrar(E.sync.serie, ap);
        }
      } catch (e) { /* ya estaba vinculado */ }
      E.sync = null; E.dispositivos = []; limpiar();
      await cargarDispositivos();
      ir('/');
      return;
    }
    if (nombre === 'ordenar') {
      const actual = ordenActual();
      const elegido = await hoja(`<h2>Ordenar por</h2>
        ${ORDENES.map(([v, txt]) => `<button class="opcion" data-elegir="${v}"
            aria-selected="${actual === v}"><span class="tit">${txt}</span>
            ${actual === v ? '' : ''}</button>`).join('')}
        <p class="mini" style="margin:10px 2px 0">Los seis criterios salen del
          nombre del archivo, que es donde el sistema guarda cada detección.
          Los tres pares cambian cómo se agrupa: por día, por especie, o
          todas las detecciones en una lista.</p>`);
      if (!elegido) return;
      E.datos.orden = elegido;
      API.guardado.poner('tector.orden', elegido);
      $('#app').innerHTML = P.cantos(); enlazar();
      return;
    }
  }

  /* ---------------- asistente: pasos ---------------- */
  let temporizador = null;

  function pararReloj() { if (temporizador) { clearInterval(temporizador); temporizador = null; } }

  /* Servida por HTTPS el navegador bloquea el fetch a 192.168.4.1, asi que
   * no se puede escanear ni listar redes desde adentro: se guia. Por HTTP
   * --tailnet o localhost-- se hace todo solo. En demostracion se simula el
   * modo automatico, que es el que mas hay para mostrar. */
  function modoGuiado() {
    // ?guiado=1 fuerza el modo guiado en cualquier contexto. Sirve para
    // verlo sin montar HTTPS, y para probarlo automaticamente.
    if (new URLSearchParams(location.search).get('guiado') === '1') return true;
    return location.protocol === 'https:' && !API.enDemo();
  }

  async function buscarTector() {
    pararReloj();
    if (modoGuiado()) {
      E.sync = { paso: 'serie', modo: 'guiado' };
      ir('/sync'); $('#app').innerHTML = P.sync(); enlazar();
      return;
    }
    E.sync = { paso: 'buscando', segundos: 0, modo: 'auto' };
    ir('/sync'); $('#app').innerHTML = P.sync(); enlazar();

    if (API.enDemo()) {
      temporizador = setInterval(() => {
        E.sync.segundos += 1;
        if (E.sync.segundos === 4) {
          pararReloj();
          E.sync = { paso: 'redes', serie: '4417', redes: [
            { ssid: 'Arroyo_Casa', senal: 88, protegida: true },
            { ssid: 'Fibertel-2G', senal: 61, protegida: true },
            { ssid: 'iPhone de Toto', senal: 44, protegida: true },
          ] };
        }
        $('#app').innerHTML = P.sync(); enlazar();
      }, 1000);
      return;
    }

    const inicio = Date.now();
    temporizador = setInterval(async () => {
      E.sync.segundos = Math.round((Date.now() - inicio) / 1000);
      const info = await API.portalInfo();
      if (info) {
        pararReloj();
        E.sync = { paso: 'redes', serie: info.serie, redes: [] };
        $('#app').innerHTML = P.sync(); enlazar();
        cargarRedes();
        return;
      }
      if (E.sync.segundos >= 120) { pararReloj(); E.sync.paso = 'sinRed'; }
      $('#app').innerHTML = P.sync(); enlazar();
    }, 3000);
  }

  async function cargarRedes() {
    if (API.enDemo()) return;
    try { E.sync.redes = await API.portalRedes(); }
    catch (e) { toast('No se pudo leer la lista de redes del Tector.'); }
    $('#app').innerHTML = P.sync(); enlazar();
  }

  async function mandarCredenciales(ssid, password) {
    E.sync.paso = 'verificando'; E.sync.progreso = 0; E.sync.segundos = 0;
    E.sync.ssidDestino = ssid;
    $('#app').innerHTML = P.sync(); enlazar();

    if (!API.enDemo()) {
      try { await API.portalConfigurar(ssid, password); }
      catch (e) { toast('El Tector no aceptó las credenciales.'); }
    }
    setTimeout(() => { E.sync.progreso = 1; $('#app').innerHTML = P.sync(); enlazar(); }, 1200);
    setTimeout(verificar, 2600);
  }

  /* Verificacion. La especificacion pedia una ventana de 1 minuto; el piso
   * real del dispositivo (nmcli add hasta 30 s, up hasta 60 s, resync de
   * reloj, ipinfo, calculo de horarios y dos subidas por rclone) es de unos
   * 90 s. Con un minuto la app declararia error en conexiones que
   * funcionaron, asi que la ventana es de 3 minutos. */
  const VENTANA_MS = 180000;

  async function verificar() {
    pararReloj();
    E.sync.paso = 'verificando'; E.sync.progreso = 2;
    const inicio = Date.now();
    $('#app').innerHTML = P.sync(); enlazar();

    if (API.enDemo()) {
      temporizador = setInterval(() => {
        E.sync.segundos = Math.round((Date.now() - inicio) / 1000);
        if (E.sync.segundos >= 5) {
          pararReloj();
          E.sync.paso = 'exito';
          E.sync.log = `[${new Date().toISOString().slice(0, 16).replace('T', ' ')}] `
            + `Conectado a ${E.sync.ssidDestino || 'Arroyo_Casa'}. Próxima ventana: 18:09. Apagando.`;
        }
        $('#app').innerHTML = P.sync(); enlazar();
      }, 1000);
      return;
    }

    temporizador = setInterval(async () => {
      E.sync.segundos = Math.round((Date.now() - inicio) / 1000);

      // Que el dispositivo aparezca registrado ya es senal de exito: se
      // registra recien cuando logro conectarse a internet.
      let vinculado = false;
      try { await API.vincular(E.sync.serie, null); vinculado = true; }
      catch (e) { vinculado = e.codigo === 409; }

      if (vinculado) {
        let linea = '';
        try {
          const r = await fetch(
            `${API.servidor()}/dispositivos/${E.sync.serie}/log`,
            { headers: { Authorization: 'Bearer ' + API.guardado.leer('tector.token') } });
          if (r.ok) {
            const log = (await r.json()).log || '';
            linea = log.split('\n').reverse().find((l) => /Conectado a .*Próxima ventana/.test(l)) || '';
          }
        } catch (e) { /* sin red todavia */ }
        pararReloj();
        E.sync.paso = 'exito'; E.sync.log = linea;
        $('#app').innerHTML = P.sync(); enlazar();
        return;
      }

      if (Date.now() - inicio >= VENTANA_MS) {
        pararReloj();
        /* Si la red de setup reaparecio, el que fallo fue el Tector. Si no,
         * el que no llega a ningun lado es el telefono.
         *
         * En modo guiado no se puede preguntar: sondear el portal es
         * justamente el fetch que el navegador bloquea. Se asume el caso mas
         * probable --que el Tector no pudo conectarse-- y la pantalla de
         * error lo dice sin afirmar de mas. */
        const info = E.sync.modo === 'guiado' ? true : await API.portalInfo(2500);
        E.sync.paso = info ? 'errorTector' : 'sinConexion';
        $('#app').innerHTML = P.sync(); enlazar();
        return;
      }
      $('#app').innerHTML = P.sync(); enlazar();
    }, 5000);
  }

  /* ---------------- arranque ---------------- */
  function iniciar() {
    aplicarTema();
    capturarInstalacion();
    E.usuario = API.usuarioGuardado();
    window.addEventListener('hashchange', () => {
      if (!location.hash.startsWith('#/sync')) { pararReloj(); E.sync = null; }
      detener(); pintar();
    });
    pintar();
    /* El service worker solo puede registrarse en un contexto seguro: HTTPS
     * o localhost. Servida por HTTP simple en una IP de la red --el caso de
     * la tailnet-- el navegador lo rechaza, la app anda igual pero sin
     * offline y sin poder instalarse. Antes ese error se tragaba en
     * silencio; ahora queda a la vista en Cuenta. */
    if (!window.isSecureContext) {
      E.sw = 'no disponible: la página no se sirve por HTTPS';
    } else if (!('serviceWorker' in navigator)) {
      E.sw = 'no disponible: el navegador no lo soporta';
    } else {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        E.sw = reg.active ? 'activo' : 'instalándose';
        reg.addEventListener('updatefound', () => { E.sw = 'actualizándose'; });
      }).catch((e) => { E.sw = 'falló: ' + e.message; });

      /* Actualizacion sin desinstalar nada.
       *
       * El service worker nuevo se instala solo al abrir la app y toma el
       * control enseguida (skipWaiting + clients.claim). Cuando eso pasa, la
       * pagina que se esta viendo todavia es la vieja: hay que recargarla
       * una vez para ver la nueva. Esto lo hace solo.
       *
       * El guardia evita el bucle clasico: sin el, cada recarga puede
       * disparar otro controllerchange y la app se recarga para siempre. */
      let recargando = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (recargando) return;
        recargando = true;
        location.reload();
      });
      // Buscar version nueva cada vez que se vuelve a la app.
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          navigator.serviceWorker.getRegistration()
            .then((reg) => reg && reg.update()).catch(() => { /* sin red */ });
        }
      });
    }
  }

  return { iniciar, pintar };
})();

document.addEventListener('DOMContentLoaded', App.iniciar);
