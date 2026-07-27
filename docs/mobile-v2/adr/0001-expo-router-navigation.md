# ADR 0001: Expo Router como shell de navegación móvil

- Estado: aceptado para M1
- Fecha: 2026-07-27
- Alcance de implementación: M1

## Contexto

Mobile v1 alterna pantallas con estado React dentro de un único árbol. Tracker no es un destino
principal, no hay URLs internas estables y una restauración de proceso no puede reconstruir la ruta.
Mobile v2 necesita tres tabs, rutas secundarias y deep links sin mezclar navegación con el estado del
entrenamiento.

## Decisión

Se usará Expo Router, en la versión compatible con Expo 54, como única capa de navegación. La entrada
de Expo apuntará a `expo-router/entry` y las rutas vivirán en `src/app`. El árbol obligatorio es:

```text
src/app/
  _layout.tsx
  (auth)/
    login.tsx
    signup.tsx
    verify-email.tsx
  (tabs)/
    _layout.tsx
    programs/index.tsx
    tracker/index.tsx
    profile/index.tsx
  program/[instanceId].tsx
  program/new.tsx
  program/editor/[definitionId].tsx
  workout/history.tsx
  workout/[sessionId].tsx
  exercise/index.tsx
  exercise/[exerciseId].tsx
  sync.tsx
```

`Programas`, `Tracker` y `Perfil` serán las únicas tabs. La wiki será una ruta secundaria. Los
providers de auth, React Query, i18n y SQLite estarán en el layout raíz; las pantallas solo consumirán
controladores/casos de uso.

La restauración resuelve en este orden:

1. Sin sesión autenticada: grupo `(auth)`.
2. Sesión autenticada y `workout_sessions.status = 'in_progress'`: `/tracker`.
3. Sesión autenticada sin workout activo: última tab persistida, con `/programs` como fallback.

Solo se persiste una ruta permitida de tabs; nunca parámetros de modales ni tokens. Los identificadores
de ruta se validan antes de consultar repositorios. El tracker conserva su estado operativo en SQLite,
no en el historial de navegación.

## Alternativas consideradas

- Mantener el switch manual: menor cambio inicial, pero no resuelve deep links, back stack ni
  restauración.
- React Navigation configurado a mano: válido, pero duplicaría el enrutado por archivos, linking y
  tipos que Expo Router ya integra con la versión de Expo elegida.
- Cuatro tabs incluyendo Ejercicios: hace más visible el catálogo, pero diluye el flujo operativo
  acordado y contradice el alcance de tres destinos.

## Consecuencias

- M1 debe mover el actual módulo `src/app` de v1 antes de crear el directorio de rutas para evitar una
  colisión de ownership.
- Se añadirán pruebas de resolución de ruta inicial, deep links inválidos y preservación de estado por
  tab.
- Los componentes de feature no podrán importar Expo Router salvo su adaptador de pantalla.
- Añadir una tab exige modificar este ADR y la decisión de producto, no solo crear un archivo.
- La dependencia y configuración nativa se introducen en M1; M0 no cambia el runtime.
