import type { ValidationErrorItem } from './types';

const DEFAULT_BASE_URL = 'http://localhost:8000';

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ?? DEFAULT_BASE_URL;

export type ApiErrorPayload =
  | { error: string }
  | { errors: ValidationErrorItem[] };

export class ApiError extends Error {
  readonly status: number;
  readonly payload: ApiErrorPayload;

  constructor(status: number, payload: ApiErrorPayload) {
    super(status === 422 && 'errors' in payload ? 'Ошибка валидации' : 'error' in payload ? payload.error : 'Ошибка запроса');
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

export function isValidationError(error: unknown): error is ApiError & { payload: { errors: ValidationErrorItem[] } } {
  return error instanceof ApiError && error.status === 422 && 'errors' in error.payload;
}

export function isConflictError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 409;
}

export function isNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  query?: Record<string, string>;
  body?: unknown;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(path, API_BASE_URL || window.location.origin);

  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value !== undefined) {
        url.searchParams.set(key, value);
      }
    }
  }

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  if (!response.ok) {
    let payload: ApiErrorPayload;
    try {
      payload = (await response.json()) as ApiErrorPayload;
    } catch {
      payload = { error: 'Не удалось обработать ответ сервера' };
    }
    throw new ApiError(response.status, payload);
  }

  return (await response.json()) as T;
}