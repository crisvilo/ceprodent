# CEPRODENT · Aula de simulación clínica

Aplicación web estática para entrenamiento académico de procesos básicos de **Enfermería** y **Farmacia**. Está construida con HTML, CSS y JavaScript vanilla. No usa frameworks, npm, backend ni base de datos.

> **Uso exclusivamente educativo.** Todos los nombres, pacientes, órdenes, productos, lotes, movimientos y transacciones iniciales son ficticios. No utilizar para atender pacientes reales, prescribir medicamentos, decidir tratamientos, dispensar productos reales ni emitir facturas fiscales.

## Módulos incluidos

### Enfermería
- Expedientes de pacientes ficticios y búsqueda.
- Órdenes de servicio: creación, consulta y avance de estado.
- Órdenes de medicamento para prácticas de registro; no calcula ni recomienda dosis.
- Agenda diaria generada a partir de los horarios introducidos en órdenes activas.
- Registro de resultados simulados: administrada, omitida, rechazada o retenida, con observación.
- Captura de signos vitales ficticios, notas de enfermería y reportes académicos.

### Farmacia
- Catálogo de productos con códigos, categoría, presentación, lote, vencimiento, stock, stock mínimo y precios demo.
- Punto de venta con búsqueda, carrito, control de stock y bloqueo de artículos vencidos.
- Comprobantes imprimibles marcados como académicos y sin validez fiscal.
- Entradas/compra de inventario, movimientos y trazabilidad básica por usuario.
- Alertas de stock mínimo y productos próximos a vencer.
- Historial de ventas y reportes.

### Funciones comunes
- Selector de módulo al entrar.
- Registro local e inicio de sesión con roles de práctica.
- Cuenta de administrador académico para cambiar entre módulos y administrar cuentas locales.
- Persistencia con `localStorage`.
- Exportación e importación del conjunto de datos en JSON.
- Exportación de listados y reportes en CSV.
- Diseño adaptable a computadores, tabletas y móviles.

## Cuentas de demostración

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador académico | `admin@ceprodent.edu.co` | `Admin123!` |
| Enfermería | `enfermeria@ceprodent.edu.co` | `Enfermeria123!` |
| Farmacia | `farmacia@ceprodent.edu.co` | `Farmacia123!` |

Las contraseñas se convierten en hash al inicializar las cuentas. Esto no convierte el inicio de sesión en una autenticación segura: en una app estática, el navegador del usuario controla el almacenamiento local y el código descargado. Las cuentas son exclusivamente para demostración.

## Desplegar en GitHub Pages

1. Descarga el ZIP y descomprímelo.
2. Crea un repositorio de GitHub, por ejemplo `ceprodent-aula`.
3. Sube el contenido de esta carpeta a la **raíz** del repositorio: `index.html`, `styles.css`, `app.js`, `data/` y `assets/`.
4. En GitHub abre **Settings → Pages**.
5. En *Build and deployment*, elige **Deploy from a branch**, selecciona `main` y `/ (root)` y guarda.
6. Espera a que GitHub Pages publique el sitio y entra a la URL que te entregue.

La aplicación utiliza rutas relativas (`./styles.css`, `./app.js`, `./data/seed.json`) para ser compatible con el despliegue en un repositorio de proyecto. También incorpora un archivo JavaScript de respaldo con los datos de inicio por si se abre `index.html` mediante `file://` y el navegador bloquea `fetch` de JSON local.

## Cómo se guardan los datos

- `data/seed.json`: datos ficticios iniciales editables del proyecto.
- `data/seed-fallback.js`: copia para modo local sin servidor. Si editas `seed.json`, vuelve a generar la copia de respaldo desde el mismo JSON o conserva ambos sincronizados.
- `localStorage`: almacena los cambios realizados después de iniciar la app.
- **Exportar respaldo JSON**: descarga usuarios y colecciones del navegador actual.
- **Importar respaldo JSON**: reemplaza los datos actuales por un archivo exportado desde esta aplicación.
- **Restaurar datos iniciales**: borra el almacenamiento local de esta instalación y carga el conjunto de demostración de nuevo.

### Limitación importante

`localStorage` está aislado por navegador y origen. Una estudiante que entra desde otro computador no verá las órdenes, ventas ni usuarios creados en el equipo anterior. GitHub Pages no puede escribir en `seed.json` desde el navegador y no sincroniza sesiones. Por tanto, esta versión está pensada para prácticas individuales, demostraciones en un equipo o ejercicios de exportación/importación. Para uso multiusuario simultáneo habría que incorporar backend y autenticación centralizada.

## Personalizar los datos ficticios

Edita `data/seed.json`. Las principales colecciones son `patients`, `products`, `serviceOrders`, `medicationOrders`, `vitals`, `evolutions`, `sales` y `movements`. Los productos de categoría `Medicamentos` aparecen en la selección de órdenes de medicamentos. No incluyas datos personales o clínicos reales. Mantén `data/seed-fallback.js` sincronizado si quieres seguir probando abriendo el archivo directamente.

## Comprobaciones de seguridad y alcance

- No hay API, base de datos ni envío de datos a un servidor propio.
- No se implementa cifrado de registros clínicos ni control de acceso fuerte.
- Un usuario puede modificar el JavaScript o el `localStorage`; los roles sirven para enseñar flujos, no para proteger datos sensibles.
- No se calcula una dosis, no se recomiendan tratamientos y no se validan órdenes médicas.
- Las ventas no procesan pagos ni producen documentos fiscales.
- Las imágenes, perfiles y los datos incluidos no representan personas ni operaciones reales.

## Archivos

```text
ceprodent-academico/
├── index.html
├── styles.css
├── app.js
├── README.md
├── DEPLOY_GITHUB_PAGES.md
├── assets/
│   └── favicon.svg
└── data/
    ├── seed.json
    └── seed-fallback.js
```
