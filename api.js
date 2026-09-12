/* Cliente del servidor de Tector Hub.
 *
 * MODO DEMOSTRACION
 * Si no hay servidor configurado, todo lo de aca abajo responde con datos
 * fabricados en vez de fallar. No es un juguete: es lo que permite recorrer
 * la app entera --y mostrarla-- antes de que el servidor este levantado, y
 * es tambien lo que hace que el portal web sirva de emulador. Los datos son
 * verosimiles a proposito (especies reales del AMBA, el formato exacto de
 * nombre de archivo que arma exportador.py, ventanas de amanecer y
 * atardecer) para que lo que se ve sea lo que va a haber.
 *
 * Toda respuesta de demostracion sale marcada por la app con una cinta
 * arriba: nunca se hace pasar por datos reales.
 */

/* localStorage puede tirar excepcion, no solo devolver null: en ventana
 * privada de algunos navegadores, con las cookies de terceros bloqueadas, o
 * dentro de un iframe con permisos recortados, el simple acceso lanza
 * SecurityError. Sin este envoltorio la app entera se cae en el arranque, en
 * vez de degradarse a una sesion que dura lo que dura la pestaña. */
const Guardado = (() => {
  const memoria = {};
  let sirve = true;
  try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); }
  catch (e) { sirve = false; }
  return {
    leer(k) {
      if (!sirve) return memoria[k] ?? null;
      try { return localStorage.getItem(k); } catch (e) { return memoria[k] ?? null; }
    },
    poner(k, v) {
      memoria[k] = v;
      if (!sirve) return;
      try { localStorage.setItem(k, v); } catch (e) { /* queda en memoria */ }
    },
    borrar(k) {
      delete memoria[k];
      if (!sirve) return;
      try { localStorage.removeItem(k); } catch (e) { /* nada que hacer */ }
    },
    persiste: () => sirve,
  };
})();

/* Direccion del servidor del laboratorio.
 *
 * Es un valor de DESPLIEGUE, no una preferencia del usuario: se completa acá
 * una vez, al publicar la app, y nadie lo toca desde el telefono. Vacio =
 * modo demostracion, que es como se distribuye mientras el servidor no
 * exista.
 *
 * La pantalla de Servidor sigue existiendo como salida de emergencia (para
 * apuntar a un servidor de prueba sin recompilar nada), pero ya no figura en
 * el menu de Cuenta. Se llega desde la cinta de "modo demostración".
 *
 * El servidor corre en el S10e del laboratorio y sale a internet por Tailscale
 * Funnel: HTTPS de verdad, con certificado propio, y quien entra NO necesita
 * Tailscale. Eso es lo que permite que esta app se instale como PWA --Chrome
 * no instala nada servido por HTTP-- y que la use alguien de afuera sin pedirle
 * que se meta en una VPN. */
const SERVIDOR_POR_DEFECTO = 'https://s10e-servidor-1.tail1b934d.ts.net';

const API = (() => {
  /* Audios ya bajados, por ruta -> URL de blob. Ver urlAudio(). */
  const cacheAudio = new Map();

  const LS = {
    servidor: 'tector.servidor',
    token: 'tector.token',
    usuario: 'tector.usuario',
  };

  function base() {
    return (Guardado.leer(LS.servidor) || SERVIDOR_POR_DEFECTO)
      .replace(/\/+$/, '');
  }
  function token() { return Guardado.leer(LS.token) || ''; }
  function demo() { return !base(); }

  class ErrorAPI extends Error {
    constructor(mensaje, codigo) { super(mensaje); this.codigo = codigo; }
  }

  async function pedir(ruta, opciones = {}) {
    const cabeceras = { ...(opciones.headers || {}) };
    if (opciones.body) cabeceras['Content-Type'] = 'application/json';
    if (token()) cabeceras['Authorization'] = 'Bearer ' + token();

    let resp;
    try {
      resp = await fetch(base() + ruta, {
        ...opciones,
        headers: cabeceras,
        body: opciones.body ? JSON.stringify(opciones.body) : undefined,
      });
    } catch (e) {
      throw new ErrorAPI('No se pudo contactar al servidor. Revisá tu conexión.', 0);
    }

    if (resp.status === 401) {
      Guardado.borrar(LS.token);
      throw new ErrorAPI('Tu sesión venció. Volvé a entrar.', 401);
    }
    if (!resp.ok) {
      let detalle = 'Algo salió mal (' + resp.status + ').';
      try { detalle = (await resp.json()).detail || detalle; } catch (e) { /* sin cuerpo */ }
      throw new ErrorAPI(detalle, resp.status);
    }
    if (resp.status === 204) return null;
    return resp.json();
  }

  /* ----------------------------------------------------------------
   * Datos de demostracion
   * ---------------------------------------------------------------- */

  // Credenciales del modo demostracion. La pantalla de ingreso las precarga
  // y las muestra, asi que no son un secreto: son parte de la demostracion.
  const USUARIO_DEMO = 'd.arroyo';
  const CLAVE_DEMO = 'demo';

  const ESPECIES = [
    ['Rufous_Hornero', 'Hornero', 'Furnarius rufus'],
    ['Rufous-collared_Sparrow', 'Chingolo', 'Zonotrichia capensis'],
    ['Great_Kiskadee', 'Benteveo', 'Pitangus sulphuratus'],
    ['Chalk-browed_Mockingbird', 'Calandria grande', 'Mimus saturninus'],
    ['House_Wren', 'Ratona común', 'Troglodytes aedon'],
    ['Rufous-bellied_Thrush', 'Zorzal colorado', 'Turdus rufiventris'],
    ['Monk_Parakeet', 'Cotorra', 'Myiopsitta monachus'],
    ['Picazuro_Pigeon', 'Paloma picazuró', 'Patagioenas picazuro'],
    ['Masked_Gnatcatcher', 'Tacuarita azul', 'Polioptila dumicola'],
    ['Green-barred_Woodpecker', 'Carpintero real', 'Colaptes melanochloros'],
  ];

  // Generador con semilla: la demostracion tiene que verse igual en cada
  // recarga. Con Math.random las estadisticas cambiarian solas y no se
  // podria comparar una pantalla con la anterior.
  function azar(semilla) {
    let s = semilla >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  function fechaISO(diasAtras) {
    const d = new Date();
    d.setDate(d.getDate() - diasAtras);
    return d.toISOString().slice(0, 10);
  }

  function generarDetecciones(serie, dias = 30) {
    const r = azar(parseInt(serie, 10) * 7919);
    const salida = [];
    for (let d = 0; d < dias; d++) {
      // Los dias 3 a 5 sin datos: hueco deliberado, para que se vea como se
      // comporta la app cuando un Tector se salteo ventanas.
      if (serie === '4417' && d >= 3 && d <= 5) continue;
      const fecha = fechaISO(d);
      const cuantas = 6 + Math.floor(r() * 22);
      for (let i = 0; i < cuantas; i++) {
        const [ing, cast, cient] = ESPECIES[Math.floor(r() * ESPECIES.length)];
        // Bimodal: amanecer (7-10) y atardecer (17-20), como las ventanas.
        const amanecer = r() < 0.55;
        const hh = amanecer ? 7 + Math.floor(r() * 3) : 17 + Math.floor(r() * 3);
        const mm = Math.floor(r() * 60), ss = Math.floor(r() * 60);
        const p2 = (n) => String(n).padStart(2, '0');
        const hora = `${p2(hh)}:${p2(mm)}:${p2(ss)}`;
        const conf = 52 + Math.floor(r() * 47);
        salida.push({
          especie: ing.replace(/_/g, ' '), especie_carpeta: ing,
          nombre_es: cast, nombre_cientifico: cient,
          confianza: conf, fecha, hora,
          ruta: `Tector ${serie}/Detecciones/${fecha}/${ing}/${ing}-${conf}-${fecha}-tectornet-${hora}.mp3`,
        });
      }
    }
    salida.sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));
    return salida;
  }

  const CACHE_DEMO = {};
  function detsDemo(serie) {
    if (!CACHE_DEMO[serie]) CACHE_DEMO[serie] = generarDetecciones(serie);
    return CACHE_DEMO[serie];
  }

  function estadoDemo(serie, modo) {
    const horarios = {
      auto_sync: true,
      amanecer: { inicio: '08:18', fin: '10:18' },
      atardecer: { inicio: '18:09', fin: '20:09' },
      duracion_amanecer_h: '2', duracion_atardecer_h: '2',
      offset_amanecer_min: '0', offset_atardecer_min: '0',
    };
    const generado = new Date(Date.now() - (modo === 'mudo' ? 3 * 864e5 : 5 * 36e5));
    return {
      version_formato: 1, serie,
      generado: generado.toISOString().slice(0, 19),
      estado: modo === 'grabando' ? 'grabando' : 'en_espera',
      ventana_activa: modo === 'grabando' ? 'atardecer' : null,
      proxima_ventana: modo === 'grabando'
        ? { cual: 'atardecer', hora: '20:09' } : { cual: 'atardecer', hora: '18:09' },
      cierre_forzado: false,
      horarios,
      ubicacion: { lat: '-34.6131', lon: '-58.3772' },
      bateria: modo === 'mudo' ? null
        : { timestamp: generado.toISOString().slice(0, 16),
            voltaje_v: 7.42, corriente_ma: 468, temp_cpu_c: 51.2, throttled: '0x0' },
      umbral_bateria_v: '6.9',
      detecciones_hoy: modo === 'mudo' ? 0 : 23,
      version_software: '2c4f1a9',
      drive_path: `Tector ${serie}`,
    };
  }

  const DISPOSITIVOS_DEMO = [
    { serie: '4417', apodo: 'Reserva Costanera', modo: 'espera' },
    { serie: '2810', apodo: 'Delta Tigre', modo: 'grabando' },
    { serie: '0931', apodo: 'Patio LSD', modo: 'mudo' },
  ];

  const espera = (ms = 260) => new Promise((r) => setTimeout(r, ms));

  /* ---------------------------------------------------------------- */

  return {
    ErrorAPI,
    enDemo: demo,
    servidor: base,
    hayToken: () => !!token(),

    fijarServidor(url) {
      if (url) Guardado.poner(LS.servidor, url.trim());
      else Guardado.borrar(LS.servidor);
    },
    usuarioGuardado() {
      try { return JSON.parse(Guardado.leer(LS.usuario) || 'null'); }
      catch (e) { return null; }
    },
    salir() {
      Guardado.borrar(LS.token);
      Guardado.borrar(LS.usuario);
    },
    guardado: Guardado,

    async login(usuario, clave) {
      if (demo()) {
        await espera(420);
        /* Se validan las credenciales aunque sean de mentira: si cualquier
         * cosa entrara, no se podria ver el estado de error del login, y
         * quien prueba la app se llevaria la idea de que no valida nada. */
        if (usuario !== USUARIO_DEMO || clave !== CLAVE_DEMO) {
          throw new ErrorAPI('Usuario o contraseña incorrectos.', 401);
        }
        const u = { usuario, nombre: 'Diego Arroyo' };
        Guardado.poner(LS.token, 'demo');
        Guardado.poner(LS.usuario, JSON.stringify(u));
        return { usuario: u, tiene_dispositivos: true };
      }
      const r = await pedir('/auth/login', { method: 'POST', body: { usuario, clave } });
      Guardado.poner(LS.token, r.token);
      Guardado.poner(LS.usuario, JSON.stringify(r.usuario));
      return r;
    },

    async dispositivos() {
      if (demo()) {
        await espera();
        return DISPOSITIVOS_DEMO.map((d) => ({
          serie: d.serie, apodo: d.apodo, drive_path: `Tector ${d.serie}`,
          estado: estadoDemo(d.serie, d.modo),
        }));
      }
      return (await pedir('/dispositivos')).dispositivos;
    },

    async vincular(serie, apodo) {
      if (demo()) { await espera(500); return { ok: true, serie }; }
      return pedir('/dispositivos/vincular', { method: 'POST', body: { serie, apodo } });
    },
    async renombrar(serie, apodo) {
      if (demo()) { await espera(); return { ok: true }; }
      return pedir('/dispositivos/' + serie, { method: 'PATCH', body: { apodo } });
    },
    async desvincular(serie) {
      if (demo()) { await espera(); return { ok: true }; }
      return pedir('/dispositivos/' + serie, { method: 'DELETE' });
    },

    async fechas(serie) {
      if (demo()) {
        await espera();
        return [...new Set(detsDemo(serie).map((d) => d.fecha))];
      }
      return (await pedir(`/dispositivos/${serie}/fechas`)).fechas;
    },

    async detecciones(serie, { fecha, especie, limite = 200 } = {}) {
      if (demo()) {
        await espera();
        let l = detsDemo(serie);
        if (fecha) l = l.filter((d) => d.fecha === fecha);
        if (especie) l = l.filter((d) => d.especie_carpeta === especie);
        return l.slice(0, limite);
      }
      const q = new URLSearchParams();
      if (fecha) q.set('fecha', fecha);
      if (especie) q.set('especie', especie);
      q.set('limite', limite);
      return (await pedir(`/dispositivos/${serie}/detecciones?${q}`)).detecciones;
    },

    async estadisticas(serie, dias = 30) {
      if (demo()) {
        await espera(340);
        const l = detsDemo(serie);
        const horas = Array(24).fill(0);
        const porEsp = {}, porFecha = {};
        l.forEach((d) => {
          horas[parseInt(d.hora.slice(0, 2), 10)]++;
          porEsp[d.especie] = (porEsp[d.especie] || 0) + 1;
          porFecha[d.fecha] = (porFecha[d.fecha] || 0) + 1;
        });
        const conf = l.map((d) => d.confianza);
        const nuevas = l.filter((d) => d.especie === 'Masked Gnatcatcher').slice(-1);
        return {
          dias, total: l.length,
          promedio_por_dia: +(l.length / Object.keys(porFecha).length).toFixed(1),
          especies_distintas: Object.keys(porEsp).length,
          histograma_horas: horas,
          top_especies: Object.entries(porEsp).sort((a, b) => b[1] - a[1])
            .slice(0, 10).map(([especie, detecciones]) => ({ especie, detecciones })),
          por_fecha: Object.entries(porFecha).sort()
            .map(([fecha, detecciones]) => ({ fecha, detecciones })),
          confianza_media: +(conf.reduce((a, b) => a + b, 0) / conf.length).toFixed(1),
          hallazgos: nuevas.map((d) => ({
            especie: d.especie, fecha: d.fecha, hora: d.hora,
            confianza: d.confianza, ruta: d.ruta, desde_resumen: false,
          })),
          /* Dias que cuentan en las estadisticas pero cuyo audio ya no esta
           * en Drive. En la demostracion siempre esta todo, asi que va
           * vacio: se declara igual para que la forma sea la misma que la
           * del servidor y nadie tenga que adivinar si el campo existe. */
          dias_sin_audio: [],
        };
      }
      return pedir(`/dispositivos/${serie}/estadisticas?dias=${dias}`);
    },

    async horarios(serie) {
      if (demo()) {
        await espera();
        return { en_drive: {}, en_dispositivo: estadoDemo(serie, 'espera').horarios };
      }
      return pedir(`/dispositivos/${serie}/horarios`);
    },

    async guardarHorarios(serie, datos) {
      if (demo()) {
        await espera(480);
        return { ok: true, aplicado: false, se_aplica_en: '18:09',
                 aviso: 'El Tector toma el cambio cuando despierte, a las 18:09.' };
      }
      return pedir(`/dispositivos/${serie}/horarios`, { method: 'PUT', body: datos });
    },

    async birdweather(serie) {
      if (demo()) {
        await espera();
        return { conectado: serie === '2810',
                 token_parcial: serie === '2810' ? 'a3f9…c721' : null,
                 mapa: serie === '2810' ? 'https://app.birdweather.com/stations/a3f9' : null,
                 ubicacion: { lat: '-34.6131', lon: '-58.3772' },
                 aplicado: '18:09' };
      }
      return pedir(`/dispositivos/${serie}/birdweather`);
    },

    async guardarBirdweather(serie, tk) {
      if (demo()) {
        await espera(520);
        if (tk && tk.length < 6) throw new ErrorAPI(
          'BirdWeather rechazó este token. Revisá que sea el de la estación y no el de tu cuenta.', 400);
        return { ok: true, conectado: !!tk, aplicado: false, se_aplica_en: '18:09',
                 aviso: 'El Tector toma el cambio cuando despierte, a las 18:09.' };
      }
      return pedir(`/dispositivos/${serie}/birdweather`, { method: 'PUT', body: { token: tk } });
    },

    async resumen() {
      if (demo()) {
        await espera(300);
        const todas = DISPOSITIVOS_DEMO.flatMap((d) =>
          d.modo === 'mudo' ? [] : detsDemo(d.serie).slice(0, 200)
            .map((x) => ({ ...x, serie: d.serie, apodo: d.apodo })));
        todas.sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));
        return {
          dispositivos: DISPOSITIVOS_DEMO.length, reportando: 2,
          detecciones: todas.length,
          especies: new Set(todas.map((d) => d.especie)).size,
          ultima_deteccion: todas[0] || null,
        };
      }
      return pedir('/resumen');
    },

    /* Audio para reproducir, como URL de blob local.
     *
     * NO se puede pasar la URL del servidor directo al <audio>: el endpoint
     * exige Authorization, y un elemento <audio> no manda cabeceras. Antes
     * esto devolvia la URL pelada y el servidor contestaba 401, asi que NO
     * SONABA NADA contra un servidor real. En modo demostracion no se veia,
     * porque ahi no hay audio.
     *
     * La alternativa era aceptar el token como parametro en la URL, pero un
     * token en la barra de direcciones termina en historiales y logs.
     *
     * Se baja entero antes de sonar. Son clips de segundos --unos 400 KB--
     * asi que la espera no se nota, y a cambio el <audio> tiene el archivo
     * completo: la duracion y el arrastre del scrubber funcionan de una.
     *
     * Cache por ruta: volver a tocar play sobre algo ya escuchado no vuelve a
     * pedirlo. Las URL de blob se revocan al reemplazarlas para no dejar el
     * archivo colgado en memoria. */
    async urlAudio(serie, ruta) {
      if (demo()) return null;
      const clave = serie + '|' + ruta;
      if (cacheAudio.has(clave)) return cacheAudio.get(clave);
      const { blob } = await this.bajarArchivo(
        `/dispositivos/${serie}/audio?ruta=${encodeURIComponent(ruta)}`,
        'canto.mp3');
      const url = URL.createObjectURL(blob);
      // Unas pocas alcanzan: se escucha de a una, y cada blob ocupa memoria.
      if (cacheAudio.size >= 12) {
        const vieja = cacheAudio.keys().next().value;
        URL.revokeObjectURL(cacheAudio.get(vieja));
        cacheAudio.delete(vieja);
      }
      cacheAudio.set(clave, url);
      return url;
    },

    /* ---------- reportes de error ----------
     *
     * No hay opcion de confirmar que la especie estaba bien, a proposito: si
     * la hubiera, lo que llegaria seria una mezcla de "escuche y estaba
     * bien" con "toque sin escuchar", indistinguibles. Asi un reporte
     * significa siempre lo mismo. */
    TIPOS_REPORTE: [
      ['sin_ave', 'No hay ningún ave en este audio',
       'Es ruido, viento, una persona, otro animal…'],
      ['otra_desconocida', 'Hay un ave, pero no es esta especie',
       'No sé cuál es'],
      ['otra_conocida', 'Hay un ave, pero no es esta especie',
       'Sé cuál es y la puedo elegir'],
      ['audio_cortado', 'El canto está cortado o partido en dos',
       'Empieza tarde, se corta antes de terminar, o es medio canto'],
    ],

    /* Los reportes que ya hizo esta cuenta, para marcar en las listas que
     * canto ya fue reportado. Sin esto la persona no tenia forma de saberlo
     * y podia reportar dos veces lo mismo. */
    async misReportes() {
      if (demo()) return { reportes: [] };
      return pedir('/reportes');
    },

    async reportar(serie, cuerpo) {
      if (demo()) {
        await espera(500);
        return { ok: true, demo: true };
      }
      return pedir(`/dispositivos/${serie}/reportes`,
                   { method: 'POST', body: cuerpo });
    },

    /* El catalogo de especies que el motor puede reconocer, para el selector
     * del reporte. Viene como una sola cadena de miles de lineas (ver
     * catalogo.js) y se parsea una sola vez, la primera vez que hace falta:
     * armar los 6297 objetos en el arranque seria trabajo tirado para una
     * pantalla que casi nunca se abre. */
    _catalogo: null,
    catalogo() {
      if (this._catalogo) return this._catalogo;
      if (typeof CATALOGO === 'undefined') return [];
      this._catalogo = CATALOGO.split(String.fromCharCode(10)).map((l) => {
        const [codigo, cientifico, comun] = l.split('|');
        return { codigo, cientifico, comun,
                 busqueda: (comun + ' ' + cientifico).toLowerCase() };
      });
      return this._catalogo;
    },

    buscarEspecies(texto, limite = 40) {
      const q = (texto || '').trim().toLowerCase();
      const todas = this.catalogo();
      if (!q) return todas.slice(0, limite);
      // Primero las que EMPIEZAN con lo buscado: escribiendo "hor" uno
      // espera "Hornero" arriba, no una especie que lo tenga en el medio.
      const empiezan = [], contienen = [];
      for (const e of todas) {
        const i = e.busqueda.indexOf(q);
        if (i === 0 || e.comun.toLowerCase().startsWith(q)) empiezan.push(e);
        else if (i > 0) contienen.push(e);
        if (empiezan.length >= limite) break;
      }
      return empiezan.concat(contienen).slice(0, limite);
    },

    /* Descargas.
     *
     * No se puede usar un <a download> apuntando al endpoint: la API pide el
     * token en una cabecera, y un <a> no manda cabeceras. Hay que bajar el
     * archivo con fetch y despues entregarselo al navegador como blob.
     *
     * Devuelve {blob, nombre} o lanza ErrorAPI. */
    async bajarArchivo(ruta, nombre) {
      if (demo()) {
        throw new ErrorAPI(
          'Las descargas necesitan un servidor conectado. En modo '
          + 'demostración no hay archivos de audio reales.', 0);
      }
      const resp = await fetch(base() + ruta,
        { headers: { Authorization: 'Bearer ' + token() } });
      if (!resp.ok) {
        let detalle = `No se pudo descargar (${resp.status}).`;
        try { detalle = (await resp.json()).detail || detalle; } catch (e) { /* */ }
        throw new ErrorAPI(detalle, resp.status);
      }
      // El servidor propone el nombre en Content-Disposition; si no viene,
      // se usa el que pidio quien llamo.
      const cd = resp.headers.get('Content-Disposition') || '';
      const m = /filename="([^"]+)"/.exec(cd);
      return { blob: await resp.blob(), nombre: (m && m[1]) || nombre };
    },

    rutaAudio(serie, ruta) {
      return `/dispositivos/${serie}/audio?ruta=${encodeURIComponent(ruta)}`;
    },

    rutaCarpeta(serie, fecha, especie) {
      const q = new URLSearchParams({ fecha });
      if (especie) q.set('especie', especie);
      return `/dispositivos/${serie}/descargar?${q}`;
    },

    urlFoto(especieCarpeta) {
      if (!especieCarpeta) return null;
      if (demo()) {
        // Embebidas en fotos-demo.js, para que se vean sin servidor y sin
        // pedidos a dominios externos.
        const f = (typeof FOTOS_DEMO !== 'undefined') && FOTOS_DEMO[especieCarpeta];
        return f ? f.src : null;
      }
      return `${base()}/especies/${encodeURIComponent(especieCarpeta)}/foto`;
    },

    /* Autor y licencia de la foto. En demostracion salen del archivo
     * embebido; con servidor hay que pedirlos, asi que devuelve null y la
     * pantalla los completa despues con especie(). */
    creditoFoto(especieCarpeta) {
      if (!demo() || !especieCarpeta) return null;
      const f = (typeof FOTOS_DEMO !== 'undefined') && FOTOS_DEMO[especieCarpeta];
      return f && f.licencia
        ? { autor: f.autor, licencia: f.licencia, pagina: f.pagina } : null;
    },

    /* Todas las fotos que la app puede llegar a mostrar, con su atribucion.
     * Alimenta la pantalla de créditos. Con servidor se arma pidiendo la
     * ficha de cada especie; en demostracion sale del archivo embebido. */
    async creditos(especies) {
      if (demo()) {
        if (typeof FOTOS_DEMO === 'undefined') return [];
        return Object.entries(FOTOS_DEMO).map(([k, v]) => ({
          especie: k.replace(/_/g, ' '), autor: v.autor,
          licencia: v.licencia, pagina: v.pagina,
        }));
      }
      const fichas = await Promise.all((especies || []).map((e) =>
        this.especie(e).catch(() => null)));
      return fichas.filter((f) => f && f.licencia).map((f) => ({
        especie: f.nombre_comun, autor: f.autor, licencia: f.licencia,
        pagina: f.descripcion_url,
      }));
    },

    async especie(nombre) {
      if (demo()) {
        const e = ESPECIES.find((x) => x[0] === nombre);
        return e ? { nombre_comun: e[1], nombre_cientifico: e[2], imagen: null } : null;
      }
      try { return await pedir('/especies/' + encodeURIComponent(nombre)); }
      catch (e) { return null; }
    },

    /* ---------- el portal del propio Tector, por la red de setup ----------
     * Esto NO pasa por el servidor: es la app hablandole directo al
     * dispositivo por su red de configuracion. Timeouts cortos a proposito
     * --se usa para detectar si el telefono ya esta en la red de setup, y
     * ahi una demora larga es indistinguible de un "no". */
    PORTAL: 'http://192.168.4.1:5000',

    async portalInfo(msTimeout = 2500) {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), msTimeout);
      try {
        const r = await fetch(this.PORTAL + '/info', { signal: ctl.signal, cache: 'no-store' });
        if (!r.ok) return null;
        return r.json();
      } catch (e) { return null; } finally { clearTimeout(t); }
    },

    async portalRedes() {
      const r = await fetch(this.PORTAL + '/redes', { cache: 'no-store' });
      if (!r.ok) throw new ErrorAPI('El Tector no devolvió la lista de redes.', r.status);
      return (await r.json()).redes;
    },

    async portalConfigurar(ssid, password) {
      const r = await fetch(this.PORTAL + '/configurar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ssid, password }),
      });
      if (!r.ok) throw new ErrorAPI('El Tector no aceptó las credenciales.', r.status);
      return r.json();
    },
  };
})();
