#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera catalogo.js: la lista de especies que el motor puede reconocer.

PARA QUE
--------
Lo usa el selector de especies del reporte de errores: cuando alguien dice
"hay un ave pero no es esta, y se cual es", tiene que poder elegirla de algun
lado. Ese "algun lado" no puede ser la lista de especies ya detectadas por su
Tector --justamente lo que falta es una que el motor no acerto.

DE DONDE SALE
-------------
Del propio modelo, no de una lista escrita a mano:

  modelo/birdset_efficientnetb1_config.json  -> id2label, los codigos eBird
      que BirdSet puede predecir. BirdSet es el filtro final del pipeline,
      asi que su vocabulario es el limite real de lo que el sistema puede
      llegar a decir.

  modelo/eBird_taxonomy_codes_2024E.json  -> traduce cada codigo a
      "Nombre cientifico_Common Name".

Se descarta a proposito perch2_labels.csv: Perch2 clasifica tambien ranas,
insectos y ruido ambiente (la primera etiqueta de esa lista es una rana), y
mezclar eso en un selector de aves no ayuda a nadie.

LO QUE NO ENTRA
---------------
Al 10/9/2026, de las 9736 etiquetas de BirdSet solo 6297 tienen nombre en el
archivo de taxonomia que trae el proyecto --que es el de BirdNET, mas chico
que el eBird completo. De las otras 3439 solo se conoce el codigo (ostric2,
sobkiw1...), que no le sirve a nadie en un selector. Quedan afuera.

Si en algun momento hace falta la lista completa, hay que traer la taxonomia
eBird entera (ebird.org/api/keygen, y ya hay una EBIRD_API_KEY en
config_general.txt del dispositivo).

    python3 herramientas/generar_catalogo.py
"""
import io
import json
import sys
import urllib.request
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / 'catalogo.js'

BASE = 'https://raw.githubusercontent.com/LSDArroyoGold/TectorNet/master/modelo'
BIRDSET = f'{BASE}/birdset_efficientnetb1_config.json'
TAXONOMIA = f'{BASE}/eBird_taxonomy_codes_2024E.json'


def bajar(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.loads(r.read().decode('utf-8'))


def main():
    print('Bajando el vocabulario de BirdSet y la taxonomía…')
    bs = bajar(BIRDSET)
    tax = bajar(TAXONOMIA)

    codigos = list(bs['id2label'].values())
    filas, sin_nombre = [], 0
    vistos = set()
    for codigo in codigos:
        nombre = tax.get(codigo)
        if not nombre or '_' not in nombre:
            sin_nombre += 1
            continue
        cientifico, comun = nombre.split('_', 1)
        # El pipe separa campos: si apareciera en un nombre, rompe el parseo.
        if '|' in cientifico or '|' in comun or codigo in vistos:
            continue
        vistos.add(codigo)
        filas.append(f'{codigo}|{cientifico}|{comun}')

    filas.sort(key=lambda f: f.split('|')[2].lower())

    cuerpo = '\\n'.join(filas)
    io.open(SALIDA, 'w', encoding='utf-8', newline='\n').write(
        '/* GENERADO por herramientas/generar_catalogo.py -- no editar a mano.\n'
        ' *\n'
        ' * Las especies que el motor puede reconocer, para el selector del\n'
        ' * reporte de errores. Salen del vocabulario de BirdSet (el filtro\n'
        ' * final del pipeline) traducido con la taxonomía de eBird.\n'
        ' *\n'
        ' * Una línea por especie: codigo_ebird|Nombre cientifico|Common name.\n'
        ' * Una sola cadena y no un array de objetos: son miles de entradas, y\n'
        ' * así el archivo pesa la mitad y el navegador no arma miles de\n'
        ' * objetos en el arranque. Se parsea recién cuando se abre el selector.\n'
        f' *\n'
        f' * {len(filas)} especies. Quedaron afuera {sin_nombre} etiquetas de\n'
        ' * BirdSet cuyo código no está en la taxonomía que trae el proyecto.\n'
        ' */\n'
        f'const CATALOGO = "{cuerpo}";\n')

    kb = SALIDA.stat().st_size // 1024
    print(f'  {len(filas)} especies, {sin_nombre} sin nombre (descartadas)')
    print(f'  catalogo.js: {kb} KB')
    print(f'  ejemplos: {filas[0]}  /  {filas[len(filas) // 2]}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
