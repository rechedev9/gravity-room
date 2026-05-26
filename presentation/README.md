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

```bash
cd presentation
node build.mjs
rsync -az -e "ssh -i <SSH_KEY> -o StrictHostKeyChecking=accept-new" \
  dist/ <USER>@178.105.107.25:/opt/gravity-room/data/web-dist/presentacion/
# → https://gravityroom.app/presentacion
```

`--delete` se omite a propósito: solo añadimos la subcarpeta `presentacion/`.
Caddy ya la sirve con su `try_files {path} {path}/index.html`.

> ⚠️ **Aviso:** el deploy de la web vía CI (`git push main`) hace
> `rsync --delete` sobre `/srv/web`, así que **borra** `/presentacion`. Si tras
> la defensa se hace un push a `main`, vuelve a ejecutar el `rsync` de arriba
> para restaurarla. Hacerla permanente = integrarla en `.github/workflows/deploy.yml`.
