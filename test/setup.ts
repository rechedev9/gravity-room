import * as matchers from '@testing-library/jest-dom/matchers';
import { afterEach, expect } from 'bun:test';
import { cleanup } from '@testing-library/react';

// happy-dom is registered in register-dom.ts (must run first via preload order)
expect.extend(matchers);

afterEach(() => {
  cleanup();
  localStorage.clear();
});
