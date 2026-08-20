import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '../test/mocks/server';
import { ApiError, apiRequest, isConflictError, isNotFoundError, isValidationError } from './client';

describe('api client', () => {
  it('возвращает данные при 200', async () => {
    server.use(
      http.get('*/ping-ok', () => HttpResponse.json({ ok: true })),
    );

    const result = await apiRequest<{ ok: boolean }>('/ping-ok');
    expect(result).toEqual({ ok: true });
  });

  it('бросает ApiError с payload при 404', async () => {
    server.use(
      http.get('*/ping-404', () => HttpResponse.json({ error: 'Event type not found' }, { status: 404 })),
    );

    const error = await apiRequest('/ping-404').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
    expect((error as ApiError).payload).toEqual({ error: 'Event type not found' });
    expect(isNotFoundError(error)).toBe(true);
  });

  it('бросает ApiError с errors при 422', async () => {
    server.use(
      http.post('*/ping-422', () =>
        HttpResponse.json(
          { errors: [{ field: 'guestName', message: 'Обязательное поле' }] },
          { status: 422 },
        ),
      ),
    );

    const error = await apiRequest('/ping-422', { method: 'POST', body: {} }).catch((e: unknown) => e);
    expect(isValidationError(error)).toBe(true);
    if (isValidationError(error)) {
      expect(error.payload.errors[0]).toEqual({ field: 'guestName', message: 'Обязательное поле' });
    }
  });

  it('распознаёт конфликт 409', async () => {
    server.use(
      http.post('*/ping-409', () => HttpResponse.json({ error: 'Slot is already booked' }, { status: 409 })),
    );

    const error = await apiRequest('/ping-409', { method: 'POST', body: {} }).catch((e: unknown) => e);
    expect(isConflictError(error)).toBe(true);
  });

  it('передаёт query-параметры в URL', async () => {
    server.use(
      http.get('*/ping-query', ({ request }) => {
        const url = new URL(request.url);
        return HttpResponse.json({ eventType: url.searchParams.get('eventType') });
      }),
    );

    const result = await apiRequest<{ eventType: string }>('/ping-query', { query: { eventType: 'consultation' } });
    expect(result.eventType).toBe('consultation');
  });
});