import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { contractOperations } from './mocks/handlers';

const SPEC_PATH = path.resolve(process.cwd(), '../tsp-output/@typespec/openapi3/openapi.yaml');

interface SpecOperation {
  method: string;
  path: string;
}

function loadSpecOperations(): SpecOperation[] {
  const spec = parse(readFileSync(SPEC_PATH, 'utf8')) as {
    paths: Record<string, Record<string, unknown>>;
  };

  const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'] as const;

  return Object.entries(spec.paths).flatMap(([path, item]) =>
    methods
      .filter((method) => item[method] !== undefined)
      .map((method) => ({ method: method.toUpperCase(), path })),
  );
}

/**
 * Единственный источник правды — main.tsp (компилируется в openapi.yaml).
 * Каждая операция спецификации обязана иметь MSW-хендлер: если в main.tsp
 * добавили или переименовали эндпоинт, этот тест падает, пока фронтенд не
 * приведён в соответствие с контрактом.
 */
describe('контракт-покрытие (main.tsp → openapi.yaml → MSW-хендлеры)', () => {
  const specOperations = loadSpecOperations();

  it('спецификация содержит непустой список операций', () => {
    expect(specOperations.length).toBeGreaterThan(0);
  });

  it('каждая операция спецификации покрыта хендлером', () => {
    for (const operation of specOperations) {
      expect(
        contractOperations.some(
          (handler) => handler.method === operation.method && handler.path === operation.path,
        ),
        `Нет хендлера для ${operation.method} ${operation.path}`,
      ).toBe(true);
    }
  });

  it('все хендлеры соответствуют операциям спецификации', () => {
    for (const handler of contractOperations) {
      expect(
        specOperations.some(
          (operation) => operation.method === handler.method && operation.path === handler.path,
        ),
        `Хендлер ${handler.method} ${handler.path} отсутствует в спецификации`,
      ).toBe(true);
    }
  });
});