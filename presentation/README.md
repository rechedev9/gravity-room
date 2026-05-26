# Gravity Room — Presentación de defensa (Proyecto Fin de Ciclo · DAW)

Slide deck para la defensa, hecho con **reveal.js** (HTML/JS, sin frameworks).
Todo el contenido está en `index.html`; la narración de cada slide vive en las
**notas del presentador** (`<aside class="notes">`).

> 100 % autocontenido: reveal.js está **vendoreado** en `reveal/` y se usan
> **fuentes del sistema**, sin CDNs ni Google Fonts. Así la presentación se sirve
> bajo el CSP estricto de `gravityroom.app` sin tocar la config de Caddy.

## Estructura

```
index.html            # 13 slides + notas de presentador · <base href="/presentacion/">
css/theme.css         # tema oscuro con acento ámbar, fuentes del sistema
reveal/               # reveal.js + plugins (notes, highlight) vendoreados
assets/screenshots/   # capturas reales del producto (demo + móvil)
build.mjs             # ensambla dist/ (autocontenido) para desplegar
dist/                 # salida que se sube al servidor
```

## Uso (local)

reveal.js usa `<base href="/presentacion/">`, así que hay que servirlo bajo esa ruta:

```bash
cd presentation
node build.mjs                       # genera dist/
mkdir -p /tmp/gr-serve
ln -sfn "$(pwd)/dist" /tmp/gr-serve/presentacion
cd /tmp/gr-serve && python3 -m http.server 4321
# abrir http://localhost:4321/presentacion/
```

## Presentar

- **Navegación:** flechas / espacio. Vista general: `O`.
- **Modo presentador** (notas + cronómetro): pulsa `S`.
- Número de slide abajo a la derecha.

## Exportar a PDF (plan B en USB)

Con la presentación servida en `http://localhost:4321/presentacion/`:

```bash
cd presentation
bunx decktape reveal "http://localhost:4321/presentacion/" slides-export.pdf
```

(`slides-export.pdf` está en `.gitignore`.)

## Desplegar a producción

**Automático vía CI.** El deck se empaqueta dentro del artefacto de la web en
`.github/workflows/deploy.yml` (job `build-web`, paso _"Bundle presentation deck
into web dist"_), así que **cada `git push` a `main` lo despliega** junto con la
SPA y el `rsync --delete` ya **no** lo borra. Servido por Caddy con
`try_files {path} {path}/index.html` → <https://gravityroom.app/presentacion>.

**Manual (opcional)**, para actualizar solo el deck sin un deploy completo:

```bash
cd presentation
node build.mjs
rsync -az -e "ssh -i <SSH_KEY> -o StrictHostKeyChecking=accept-new" \
  dist/ <USER>@178.105.107.25:/opt/gravity-room/data/web-dist/presentacion/
```

(`--delete` se omite: solo añadimos la subcarpeta `presentacion/`.)
