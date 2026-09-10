#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera fotos-demo.js: las fotos de las especies del modo demostración,
embebidas como data URI.

POR QUE EMBEBIDAS Y NO POR URL
En la app de verdad las fotos las sirve el servidor (ver servidor/especies.py
de tector-hub-servidor), que las resuelve contra Wikimedia y las cachea. Pero
el modo demostración tiene que funcionar sin servidor: abriendo el archivo de
un doble clic, o dentro de un visor que bloquea pedidos a dominios externos.
La única forma de que se vean fotos ahí es que viajen con la página.

Se piden a 560 px de ancho: la tarjeta destacada ocupa el ancho de la
pantalla, y en un telefono con pantalla densa una imagen mas chica se ve
ampliada y blanda.

Las imágenes son de Wikimedia Commons y llevan su atribución: el autor y la
licencia van en el mismo archivo, y la app los muestra debajo de la foto.

    python3 herramientas/generar_fotos_demo.py
"""
import base64
import io
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / 'fotos-demo.js'

API = 'https://en.wikipedia.org/w/api.php'
AGENTE = ('TectorHub/1.0 (Laboratorio de Sistemas Dinamicos, FCEyN-UBA; '
          'https://github.com/LSDArroyoGold)')
ANCHO = 560

# Las mismas diez de ESPECIES en api.js.
ESPECIES = [
    'Rufous_Hornero', 'Rufous-collared_Sparrow', 'Great_Kiskadee',
    'Chalk-browed_Mockingbird', 'House_Wren', 'Rufous-bellied_Thrush',
    'Monk_Parakeet', 'Picazuro_Pigeon', 'Masked_Gnatcatcher',
    'Green-barred_Woodpecker',
]


def pedir(parametros):
    url = f'{API}?{urllib.parse.urlencode(parametros)}'
    req = urllib.request.Request(url, headers={'User-Agent': AGENTE})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode('utf-8'))


def limpiar(texto):
    if not texto:
        return None
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', texto)).strip() or None


# Alguna pagina de Wikipedia en ingles no tiene imagen principal aunque la
# especie si tenga fotos en Commons (le pasa a House Wren). Para esas, se
# busca por el nombre cientifico, que siempre tiene ficha propia.
ALIAS = {'House_Wren': 'Troglodytes aedon'}


def resolver(nombre):
    datos = pedir({
        'action': 'query', 'format': 'json', 'redirects': 1,
        'titles': ALIAS.get(nombre, nombre.replace('_', ' ')),
        'prop': 'pageimages', 'piprop': 'thumbnail|name', 'pithumbsize': ANCHO,
    })
    for _, pagina in ((datos.get('query') or {}).get('pages') or {}).items():
        thumb = (pagina.get('thumbnail') or {}).get('source')
        if thumb:
            return thumb, pagina.get('pageimage')
    return None, None


def licencia(archivo):
    if not archivo:
        return None, None
    datos = pedir({'action': 'query', 'format': 'json',
                   'titles': f'File:{archivo}',
                   'prop': 'imageinfo', 'iiprop': 'extmetadata'})
    for _, pagina in ((datos.get('query') or {}).get('pages') or {}).items():
        meta = (pagina.get('imageinfo') or [{}])[0].get('extmetadata') or {}
        return (limpiar((meta.get('Artist') or {}).get('value')),
                limpiar((meta.get('LicenseShortName') or {}).get('value')))
    return None, None


def bajar(url):
    req = urllib.request.Request(url, headers={'User-Agent': AGENTE})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def main():
    fotos = {}
    total = 0
    for nombre in ESPECIES:
        try:
            url, archivo = resolver(nombre)
            if not url:
                print(f'  sin foto  {nombre}')
                continue
            datos = bajar(url)
            autor, lic = licencia(archivo)
            ext = Path(urllib.parse.urlparse(url).path).suffix.lower()
            mime = {'.png': 'image/png', '.webp': 'image/webp'}.get(ext, 'image/jpeg')
            fotos[nombre] = {
                'src': f'data:{mime};base64,{base64.b64encode(datos).decode()}',
                'autor': autor, 'licencia': lic,
            }
            total += len(datos)
            print(f'  {len(datos)//1024:>4} KB  {nombre}  ({lic})')
        except Exception as e:
            print(f'  ERROR     {nombre}: {e}', file=sys.stderr)

    cuerpo = ',\n'.join(
        f'  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}'
        for k, v in fotos.items())

    io.open(SALIDA, 'w', encoding='utf-8', newline='\n').write(
        '/* GENERADO por herramientas/generar_fotos_demo.py -- no editar a mano.\n'
        ' *\n'
        ' * Fotos del modo demostración, embebidas para que se vean sin servidor\n'
        ' * y sin pedidos a dominios externos. Son de Wikimedia Commons y llevan\n'
        ' * su atribución; la app la muestra debajo de la foto.\n'
        ' *\n'
        ' * En la app conectada a un servidor esto no se usa: las fotos las\n'
        ' * sirve /especies/<nombre>/foto.\n'
        ' */\n'
        f'const FOTOS_DEMO = {{\n{cuerpo}\n}};\n')

    print(f'\nfotos-demo.js: {len(fotos)} especies, {total//1024} KB')
    return 0


if __name__ == '__main__':
    sys.exit(main())
