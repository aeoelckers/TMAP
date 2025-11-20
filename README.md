# T-MAP

Metabuscador de terrenos en Chile.

## ¿Qué contiene este prototipo?

- **Fuentes crudas** en `data/raw` con ejemplos de portales y remates apuntando a búsquedas reales en los sitios chilenos.
- **Script de integración** (`scripts/aggregate_listings.py`) que normaliza los datos y genera `docs/data/listings.json` listo para ser publicado.
- **Interfaz web estática** en `docs/` compatible con GitHub Pages y que permite filtrar, ordenar y revisar indicadores clave de precio vs. avalúo.
- **Directorio de portales reales** en `docs/data/portals.json` que la SPA muestra como una grilla de accesos directos para abrir búsquedas en los sitios oficiales.

## Cómo generar y visualizar la data

1. Instala dependencias estándar de Python 3 (solo se usa la biblioteca estándar).
2. Ejecuta el agregador:
   ```bash
   python3 scripts/aggregate_listings.py
   ```
3. Sirve la carpeta `docs/` con tu herramienta favorita, por ejemplo:
   ```bash
   python3 -m http.server --directory docs 3000
   ```
4. Abre `http://localhost:3000` y explora el metabuscador.

## Publicar como GitHub Page

1. Ejecuta `python3 scripts/aggregate_listings.py` para regenerar `docs/data/listings.json` con la última data.
2. Haz commit de los cambios en `docs/` (HTML, CSS, JS y JSON).
3. En GitHub, ve a **Settings → Pages** y selecciona:
   - **Source**: `Deploy from a branch`.
   - **Branch**: `main`, carpeta `/docs`.
4. Guarda la configuración. GitHub Pages servirá automáticamente `docs/index.html` y la SPA quedará disponible públicamente con los datos integrados.

## Funcionalidades destacadas

- Integración de fuentes heterogéneas (portales tradicionales y remates) con trazabilidad del origen.
- Filtros por tipo de terreno, región, comuna, origen, rango de precio, superficie y palabras clave.
- Indicadores calculados automáticamente: precio/m², avalúo/m², ratio precio/avalúo y descuento vs. avalúo comercial.
- Ordenamiento por mejor oportunidad (menor ratio precio/avalúo) o por mayor descuento.
- Diseño minimalista y responsive pensado para resaltar los datos y detectar oportunidades con rapidez.
- Panel de **fuentes reales** con enlaces directos a portales inmobiliarios y agregadores chilenos para abrir la búsqueda original sin salir de T-MAP.
