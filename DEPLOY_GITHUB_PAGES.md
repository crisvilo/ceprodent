# Publicar en GitHub Pages

1. Descomprime `ceprodent-academico.zip`.
2. Crea un repositorio nuevo en GitHub.
3. Sube **el contenido de la carpeta**, no una carpeta adicional anidada, a la raíz del repositorio.
4. Abre `Settings` → `Pages`.
5. Selecciona `Deploy from a branch`, rama `main`, carpeta `/ (root)` y pulsa `Save`.
6. Abre la URL publicada. La primera carga crea el conjunto de datos de demostración en el navegador.
7. Entra con una cuenta demo o crea una cuenta local.

Cuentas demo:
- Administrador: `admin@ceprodent.edu.co` / `Admin123!`
- Enfermería: `enfermeria@ceprodent.edu.co` / `Enfermeria123!`
- Farmacia: `farmacia@ceprodent.edu.co` / `Farmacia123!`

## Nota sobre cambios y respaldos

Los cambios se guardan en `localStorage`; no se escriben en GitHub ni en los archivos JSON del repositorio. Descarga periódicamente un respaldo desde `Datos y respaldos`. Para mover la práctica a otro navegador, importa allí ese respaldo.

Si GitHub Pages no muestra la actualización, confirma que los archivos `index.html`, `app.js`, `styles.css` y la carpeta `data/` estén en la raíz publicada y recarga el sitio sin caché.
