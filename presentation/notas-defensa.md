# Notas de defensa — apoyo para el presentador

> Texto de apoyo por slide para llevar en la libreta. No se proyecta; es para ti.
> Orden y numeración según el deck final (14 slides).

---

## Slide 3 · Objetivos

Cuatro objetivos, de lo concreto a lo ambicioso:

1. **Motor de reglas de progresión reutilizable.** No una app para un solo método: un
   motor que sirve a un catálogo (GZCLP, 5/3/1, StrongLifts…). La lógica del método vive
   en un sitio y se reutiliza.
2. **App web (PWA) rápida y usable desde el móvil.** Se instala como una app y funciona
   en el gimnasio aunque haya mala cobertura.
3. **API propia con autenticación segura.** (El _por qué_ de la API propia lo desarrollo
   en su slide; aquí solo lo enuncio como objetivo.)
4. **Producción real, no solo en local.** Esto era lo ambicioso y lo que más me diferencia.

Idea de cierre: "y a partir de aquí os enseño cómo cumplí cada uno, de abajo arriba".

---

## Slide 5 · Despliegue e infraestructura

**Por qué Docker.** Empaqueta cada servicio con sus dependencias en una imagen, así corre
igual en mi máquina, en CI y en el servidor ("funciona en mi máquina" deja de ser excusa).
Con un único `docker compose up` levanto toda la pila: Caddy + API + PostgreSQL + Redis,
aislados y reproducibles.

**Por qué Caddy.** Es el _reverse proxy_ / puerta de entrada: recibe el tráfico HTTPS y lo
reparte (la web estática y la API en `api.gravityroom.app`). Lo elegí sobre nginx porque
gestiona los **certificados TLS automáticamente** (ver abajo) con una configuración mínima.

**Por qué Redis.** Almacén en memoria muy rápido que uso para tres cosas, las tres con
_fallback_ a memoria si no está: **rate-limiting** (ventana deslizante con un script Lua
**atómico**), **presencia** (usuarios online → `GET /api/stats/online`) y **caché de
lecturas** (catálogo/ejercicios, para no golpear Postgres en cada petición). El valor: es un
**estado compartido y atómico** que **sobrevive a reinicios** y serviría con varias
instancias de la API —en memoria sería por proceso y se perdería—. Y es **opcional**: en
local sin Redis la app funciona (cae a memoria / a la BD), así que no es un punto único de
fallo.

**Cómo funciona el CI/CD (GitHub Actions, `deploy.yml`).** Al hacer `push` a `main`:

1. **Construye las imágenes** de la API (y analytics) y las sube al registro **GHCR**,
   etiquetadas con el `sha` del commit.
2. **Compila la web** (Vite) apuntando a `https://api.gravityroom.app`.
3. **Despliega en el VPS por SSH**: sincroniza el `docker-compose.yml` y el `Caddyfile`,
   sube la web, **valida que el `.env` del servidor tiene todo lo que la nueva imagen
   necesita** (pre-flight, evita el arranque en bucle), hace `docker compose pull` + `up -d`
   y termina con un **health check** contra `/health`. Si algo falla, el workflow falla.

**Cómo funciona el HTTPS automático con Caddy.** Solo por declarar el dominio en el
`Caddyfile`, Caddy pide el certificado a **Let's Encrypt** vía el protocolo **ACME**, lo
instala y lo **renueva solo** antes de que caduque. Cero gestión manual de certificados.
Además, el TLD **`.app` está en la lista HSTS preload** de Google: el navegador fuerza
HTTPS por diseño, incluso antes de la primera petición.

---

## Slide 6 · Dominio y DNS

- Compré **gravityroom.app** en **Namecheap** (registrador), con **privacidad WHOIS** para
  no exponer mis datos (minimización, RGPD).
- En vez de usar el DNS de Namecheap, **delegué los nameservers al DNS de Hetzner**, donde
  está el servidor → registro y hosting gestionados desde un único panel.
- Configuré **3 registros A** apuntando a la IP del VPS: el **ápex** (`gravityroom.app`),
  **`www`** (que Caddy redirige al ápex con un 301) y **`api`** (la API).
- Idea: si cambia la IP del servidor, toco un solo sitio.

_DNS = la "agenda de contactos" de internet: traduce el nombre del dominio a la IP del servidor._

---

## Slide 7 · Base de datos

**Valor del tipado con Drizzle.** Drizzle es un ORM en el que **el esquema se define en
TypeScript y de ahí salen los tipos**. Las consultas son tipadas: si una columna no existe
o cambia de tipo, el compilador lo detecta. No hay desincronización entre lo que dice la
base de datos y lo que cree el código.

**Migraciones automáticas.** Los cambios de esquema generan ficheros SQL de migración, y la
API **los aplica sola al arrancar** (en el bootstrap). Así el esquema de producción siempre
coincide con el código desplegado, sin pasos manuales que olvidar.

---

## Slide 8 · API propia

**Por qué una API propia (y no un BaaS tipo Firebase/Supabase).** Tener mi propia API me da
**control total del contrato**: modelo los endpoints según mi dominio, decido la validación,
no quedo atado a un proveedor ni a sus límites, y aprendo a diseñar el backend de verdad.
Además expone su contrato en **OpenAPI**, del que genero el cliente tipado de la web.

**Sistema de autenticación.**

- **JWT** de acceso de **corta duración** para autorizar cada petición.
- **Rotación de _refresh tokens_**: el token de refresco se guarda _hasheado_ y se renueva
  en cada uso; si se intenta reutilizar uno viejo se detecta (defensa ante robo de token).
- **Google OAuth** para entrar con la cuenta de Google sin gestionar contraseñas.

---

## Slide 9 · Una sola fuente de verdad

**Valor de centralizar.** Las reglas del método y los **esquemas de validación (Zod)** viven
en un único paquete, `@gzclp/domain`, que importan **tanto la web como la API**.

- **Cero duplicación:** la regla "si fallas, bajas el peso" se escribe una vez.
- **Validación idéntica** en cliente y servidor: el mismo esquema valida el formulario en el
  navegador y el cuerpo de la petición en la API.
- Si cambio una regla, **cambia en los dos lados a la vez** → imposible que se desincronicen.

Es la diferencia entre un proyecto de juguete (lógica copiada y pegada) y uno mantenible.

---

## Slide 10 · Frontend

Qué es cada pieza y por qué la elegí:

- **React (v19).** La librería de interfaz: construyo la UI con **componentes** reutilizables
  y un modelo **declarativo** (describo cómo se ve la UI según el estado, y React actualiza el
  DOM). La elegí por madurez y ecosistema.
- **Vite.** La herramienta de _build_ y servidor de desarrollo: arranque y recarga
  **instantáneos** (HMR) en local y un _bundle_ optimizado para producción. La elegí por
  velocidad frente a alternativas más pesadas.
- **TanStack Router.** El enrutador: **tipado**, sabe qué rutas y parámetros existen, y el
  compilador avisa si me equivoco en un enlace.
- **TanStack Query.** Gestiona el **estado del servidor**: cachea las respuestas de la API,
  re-pide datos en segundo plano, reintenta y deduplica peticiones. Encaja muy bien con una
  PWA (menos llamadas, mejor con mala señal).

Resumen: **React** pinta, **Vite** construye, **Router** navega con tipos y **Query** habla
con la API y cachea.

---

## Slide 11 · Calidad y proceso

**Qué significa que "el CI bloquea si el cliente de la API queda desincronizado".** La web no
escribe las llamadas a mano: usa un **cliente tipado generado** a partir del contrato
**OpenAPI** de la API. En cada cambio, el CI **arranca la API, regenera ese cliente y compara**
con el que hay en el repo (`git diff`). Si difieren, **falla**: te obliga a regenerarlo y
commitearlo. Así el frontend nunca se queda con una versión vieja del contrato del backend.

**Qué son las pruebas de carga con k6.** k6 es una herramienta que **simula muchos usuarios
concurrentes** golpeando la API para medir si aguanta. Tengo tres escenarios:

- **smoke** — 1 usuario, 30 s (comprobación rápida de que todo responde).
- **load** — 50 usuarios, 2 min (rendimiento de referencia).
- **stress** — sube hasta 100 usuarios (busca el punto de ruptura).

Con **umbrales** que deben cumplirse: latencia **p95 < 500 ms** y **menos del 1 % de errores**.

---

## Slide 13 · IA con disciplina

**Cómo uso la IA.** Como copiloto para ir más rápido, pero **yo pongo las reglas**: hay un
`CLAUDE.md` en el repo que fija convenciones, estilo y flujo de trabajo (incluido TDD).

### Qué nos da el tipado estricto (de punta a punta) al trabajar con LLMs

- **Es un contrato verificado por la máquina.** Un LLM puede alucinar un campo o una forma
  equivocada; el compilador lo caza al instante → **ese código no compila**. No depende de
  que yo lo detecte leyendo.
- **Los tipos se comparten entre capas** (dominio → API → web). Si la IA cambia un esquema,
  **todos los consumidores que quedan mal se encienden en rojo**: no puede desincronizar las
  capas en silencio.
- **Los tipos también son contexto para la IA:** con buenas firmas, sus sugerencias son más
  certeras (autocompletado e inferencia la guían).
- **Convierte fallos de runtime en errores de compilación:** se ven _antes_ de desplegar, no
  en producción.

### Qué nos da tener ESLint configurado así al trabajar con LLMs

Cada regla **cierra una "escapatoria" típica con la que un LLM hace que algo compile sin
arreglar el problema de fondo** (reglas reales de `apps/frontend/web/eslint.config.mjs`):

- `no-explicit-any` → no puede ensanchar a `any` para esquivar un error de tipos.
- `consistent-type-assertions: never` → no puede colar un `as` para forzar un tipo.
- `ban-ts-comment` → no puede silenciar el compilador con `@ts-ignore` / `@ts-expect-error`.
- `no-non-null-assertion` → no puede usar `!` ("confía, no es null").
- `max-depth: 3` → fuerza funciones pequeñas con _early returns_, más fáciles de revisar.
- `no-console` → nada de logs de depuración sueltos.

El efecto neto: **la IA está obligada a arreglar la causa, no a taparla.** Y el lint corre en
**pre-commit (Lefthook) y en CI**, así que el código que no cumple **literalmente no entra**.

### Y TDD

Primero escribo el **test que falla**, luego el código mínimo que lo hace pasar: el
comportamiento queda fijado **antes** que la solución, también cuando la escribe la IA.

**Idea fuerza:** no puedo revisar a ojo todo lo que escribe un LLM. Los **tipos + el lint
estrictos** son **revisores automáticos e innegociables** en cada commit y en CI: convierten
"confiar en la IA" en "**verificar a la IA mecánicamente**". Su código pasa por el **mismo
listón** que el mío; si no cumple, no entra. La IA **acelera**; la **corrección la garantiza
el sistema**.
