import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';

import { server } from './mocks/server';
import { resetDb } from './mocks/db';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
}

if (typeof document !== 'undefined' && document.fonts === undefined) {
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: {
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      ready: Promise.resolve(),
    },
  });
}

if (typeof window !== 'undefined') {
  const scrollIntoView = window.HTMLElement.prototype.scrollIntoView;
  if (typeof scrollIntoView !== 'function') {
    window.HTMLElement.prototype.scrollIntoView = () => undefined;
  }

  // jsdom возвращает нулевые размеры, поэтому floating-ui (Mantine Popover/Combobox)
  // считает reference-элемент «скрытым» и прячет выпадающий список (display: none).
  // Даём ненулевой rect и «окно просмотра», чтобы options стали доступными в тестах.
  const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
    const rect = originalGetBoundingClientRect.call(this);
    return {
      ...rect,
      width: rect.width || 500,
      height: rect.height || 500,
      right: rect.right || 500,
      bottom: rect.bottom || 500,
    };
  };

  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    get: () => 1024,
  });
  Object.defineProperty(document.documentElement, 'clientHeight', {
    configurable: true,
    get: () => 768,
  });
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    get: () => 1024,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    get: () => 768,
  });
}

if (typeof window !== 'undefined') {
  const cssStyle = window.CSSStyleDeclaration?.prototype;
  if (cssStyle) {
    const cssTextDescriptor = Object.getOwnPropertyDescriptor(cssStyle, 'cssText');
    if (cssTextDescriptor?.set) {
      const originalCssText = cssTextDescriptor.set;
      Object.defineProperty(cssStyle, 'cssText', {
        configurable: true,
        set(this: CSSStyleDeclaration, value: string) {
          try {
            originalCssText.call(this, value);
          } catch {
            // jsdom падает на некоторых CSS-shorthand (например, background),
            // устанавливаемых Mantine; визуальные стили тестам не нужны.
          }
        },
      });
    }
  }
}

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  resetDb();
});

afterAll(() => {
  server.close();
});