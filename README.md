# T-MAP

Metabuscador de terrenos en Chile.

## ¿Qué contiene este prototipo?

- **Fuentes crudas** en `data/raw` con ejemplos de portales y remates.
- **Script de integración** (`scripts/aggregate_listings.py`) que normaliza los datos y genera `public/data/listings.json`.
- **Interfaz web estática** en `public/` que permite filtrar, ordenar y revisar indicadores clave de precio vs. avalúo.

## Cómo generar y visualizar la data

1. Instala dependencias estándar de Python 3 (solo se usa la biblioteca estándar).
2. Ejecuta el agregador:
   ```bash
   python3 scripts/aggregate_listings.py
   ```
3. Sirve la carpeta `public/` con tu herramienta favorita, por ejemplo:
   ```bash
   python3 -m http.server --directory public 3000
   ```
4. Abre `http://localhost:3000` y explora el metabuscador.

## Funcionalidades destacadas

- Integración de fuentes heterogéneas (portales tradicionales y remates) con trazabilidad del origen.
- Filtros por tipo de terreno, región, comuna, origen, rango de precio y superficie.
- Indicadores calculados automáticamente: precio/m², avalúo/m², ratio precio/avalúo y descuento vs. avalúo comercial.
- Ordenamiento por mejor oportunidad (menor ratio precio/avalúo) o por mayor descuento.
- Diseño minimalista y responsive pensado para resaltar los datos y detectar oportunidades con rapidez.
