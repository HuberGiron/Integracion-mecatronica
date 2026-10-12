# Rúbrica de Integración Mecatrónica

Aplicación web estática para autoevaluar la **documentación del proceso completo de desarrollo de una solución mecatrónica**.

La rúbrica está separada del código en `rubric.json`, de modo que se pueden agregar, eliminar, reordenar o modificar criterios sin editar la lógica de la aplicación.

## Archivos

- `index.html` — interfaz.
- `styles.css` — estilos y formato de impresión.
- `app.js` — carga la rúbrica, calcula resultados, guarda el avance en `localStorage` y genera el reporte.
- `rubric.json` — contenido editable de la rúbrica.
- `.github/workflows/pages.yml` — despliegue opcional con GitHub Pages.

## Estructura de `rubric.json`

Cada sección contiene criterios como éste:

```json
{
  "id": "V01",
  "title": "Matriz de verificación requisito–prueba–resultado",
  "detail": "Los requerimientos o especificaciones críticas se vinculan con un método de prueba y su resultado.",
  "weight": 1,
  "tags": ["test", "trace"],
  "naAllowed": false
}
```

Campos:

- `id`: identificador único. No debe repetirse.
- `title`: texto corto del criterio.
- `detail`: explicación de la evidencia esperada.
- `weight`: peso del criterio. La aplicación acepta pesos distintos de 1.
- `tags`: etiquetas visuales opcionales.
- `naAllowed`: si es `true`, el criterio puede marcarse como **N/A** y se excluye del denominador.

La versión incluida tiene **100 criterios y 100 puntos base**. Si se marcan criterios como N/A, la calificación se normaliza únicamente sobre los criterios aplicables.

## Ejecutar localmente

Por seguridad del navegador, `rubric.json` debe cargarse por HTTP. No conviene abrir `index.html` directamente con doble clic.

Con Python:

```bash
python -m http.server 8000
```

Después abrir:

```text
http://localhost:8000
```

## GitHub Pages

El repositorio incluye un workflow para publicar el sitio como contenido estático.

En GitHub:

1. Abre `Settings > Pages`.
2. Selecciona `GitHub Actions` como fuente.
3. Ejecuta o espera el workflow `Deploy static site to Pages`.

## Criterio de evaluación

- **Cumple**: la evidencia existe, es verificable y corresponde con la versión presentada.
- **Sin marcar**: No cumple.
- **N/A**: sólo cuando el criterio realmente no corresponde al alcance del proyecto y el criterio permite esta opción.

Las evidencias deben ser reproducibles: una captura de pantalla no sustituye un archivo fuente, un render no sustituye una fotografía del sistema real y una descripción no sustituye un video cuando se necesita demostrar movimiento o funcionamiento.

## Evaluación resumida (segunda página)

La aplicación ofrece una **segunda rúbrica** para evaluar únicamente las evidencias del proyecto de integración especificadas para la entrega. La evaluación completa se mantiene intacta.

- **Evaluación completa:** `index.html`, con sus criterios originales en `rubric.json`.
- **Evaluación resumida:** `evaluacion-resumida.html`, con **31 criterios** ponderados a **100 puntos** en `rubric-resumida.json`.
- Ambas páginas comparten `app.js` y `styles.css`. Se selecciona la fuente de criterios con `data-rubric-src` en el elemento `body`; si no se indica, se conserva `rubric.json`.
- Cada evaluación tiene una clave distinta de `localStorage`, por lo que los avances y datos de cada versión no se mezclan.
- En esta rúbrica todos los criterios se consideran obligatorios: Cumple o no cumple. Conserva identificación del equipo, URL de evidencias, reporte e impresión/PDF.

Página publicada (si GitHub Pages está habilitado):
`https://hubergiron.github.io/Integracion-mecatronica/evaluacion-resumida.html`
