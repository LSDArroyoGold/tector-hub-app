#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Arma la version de un solo archivo de Tector Hub.

Para que sirve: la app "de verdad" son varios archivos servidos por HTTP, con
service worker, instalable desde Chrome. Pero para mostrarla, mandarla por
mensaje o abrirla de un doble clic sin levantar nada, hace falta un unico
.html que se sostenga solo. Esto genera eso: mismo codigo, CSS y JS en linea,
imagenes como data URI.

Genera dos salidas:

    dist/tector-hub.html    documento HTML completo, abrible de un doble clic
    dist/artifact.html      el mismo contenido sin <!DOCTYPE>/<html>/<head>/
                            <body>, para publicar como artifact de Claude
                            (que aporta ese armazon)

Uso:  python3 construir.py
"""
import base64
import re
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
DIST = RAIZ / 'dist'

IMAGENES = ['iconos/logo-lsd.png', 'iconos/favicon-64.png',
            'iconos/icono-192.png', 'iconos/icono-512.png',
            'iconos/apple-touch-icon.png']


def data_uri(rel):
    datos = base64.b64encode((RAIZ / rel).read_bytes()).decode()
    return f'data:image/png;base64,{datos}'


def main():
    html = (RAIZ / 'index.html').read_text(encoding='utf-8')
    css = (RAIZ / 'estilo.css').read_text(encoding='utf-8')
    api = (RAIZ / 'api.js').read_text(encoding='utf-8')
    fotos = (RAIZ / 'fotos-demo.js').read_text(encoding='utf-8')
    app = (RAIZ / 'app.js').read_text(encoding='utf-8')

    # El service worker necesita ser un archivo aparte y un origen http(s).
    # En la version de un solo archivo no existe, asi que se saca el registro
    # en vez de dejar que falle en la consola.
    app = app.replace(
        """    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* http sin sw */ });
    }""",
        '    // (sin service worker en la version de un solo archivo)')

    html = html.replace(
        '<link rel="stylesheet" href="estilo.css">',
        f'<style>\n{css}\n</style>')
    html = html.replace(
        '<script src="fotos-demo.js"></script>\n'
        '<script src="api.js"></script>\n'
        '<script src="app.js"></script>',
        f'<script>\n{fotos}\n</script>\n'
        f'<script>\n{api}\n</script>\n'
        f'<script>\n{app}\n</script>')
    html = html.replace('<link rel="manifest" href="manifest.webmanifest">\n', '')

    # Si alguna de las sustituciones de arriba deja de coincidir --pasa apenas
    # se toca index.html-- el archivo salia igual, con referencias a archivos
    # que en la version de un solo archivo no existen, y sin ningun aviso.
    sobrante = re.search(r'<script src="[^"]+"|<link rel="stylesheet" href="(?!https)',
                         html)
    if sobrante:
        raise SystemExit(
            f'construir.py: quedó sin inlinear {sobrante.group(0)!r}. '
            'Cambió index.html y hay que actualizar las sustituciones de acá.')

    for rel in IMAGENES:
        html = html.replace(rel, data_uri(rel))

    DIST.mkdir(exist_ok=True)
    (DIST / 'tector-hub.html').write_text(html, encoding='utf-8')

    # Version artifact: sin el armazon, que lo pone el propio artifact.
    cuerpo = html
    cuerpo = re.sub(r'^<!DOCTYPE html>\s*', '', cuerpo)
    cuerpo = re.sub(r'<html[^>]*>\s*', '', cuerpo)
    cuerpo = re.sub(r'\s*</html>\s*$', '', cuerpo)
    cuerpo = re.sub(r'<head>\s*', '', cuerpo)
    cuerpo = re.sub(r'\s*</head>\s*', '\n', cuerpo)
    cuerpo = re.sub(r'<body>\s*', '', cuerpo)
    cuerpo = re.sub(r'\s*</body>', '', cuerpo)
    # <meta charset> y <meta viewport> ya los pone el armazon del artifact.
    cuerpo = re.sub(r'<meta charset[^>]*>\s*', '', cuerpo)
    cuerpo = re.sub(r'<meta name="viewport"[^>]*>\s*', '', cuerpo)

    # El artifact arranca sin el data-tema del <html>, asi que la app lo pone
    # sola: aplicarTema() ya escribe document.documentElement.dataset.
    (DIST / 'artifact.html').write_text(cuerpo, encoding='utf-8')

    for f in ('tector-hub.html', 'artifact.html'):
        print(f'  dist/{f}  {(DIST / f).stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
