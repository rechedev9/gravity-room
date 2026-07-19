import { describe, expect, it } from 'vitest';
import { router } from './router';

describe('router', () => {
  it('registers the public exercise-wiki routes', () => {
    const paths = Object.keys(router.routesById);
    expect(paths).toContain('/ejercicios');
    expect(paths).toContain('/ejercicios/$slug');
    expect(paths).toContain('/programas');
    expect(paths).toContain('/en/programs');
    expect(paths).toContain('/programas/gzclp-vs-stronglifts');
    expect(paths).toContain('/en/programs/automatic-progression');
    expect(paths).toContain('/en/exercises');
    expect(paths).toContain('/en/exercises/$slug');
  });

  it('registers the in-app exercise-wiki routes under the app shell', () => {
    const paths = Object.keys(router.routesById);
    // Nested under the pathless `app-layout` parent so the sidebar/app chrome
    // stays mounted when navigating to "Ejercicios" from inside the app.
    expect(paths).toContain('/app-layout/app/exercises');
    expect(paths).toContain('/app-layout/app/exercises/$slug');
  });
});
