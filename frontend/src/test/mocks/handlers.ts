import { http, HttpResponse, type HttpHandler } from 'msw';
import type { AdminDaySlots, Booking, EventType, Slot } from '../../api/types';
import {
  endsAt,
  gridStarts,
  isWithinBookingWindow,
  lastBookableStart,
  toDateTime,
  GRID_END_MINUTES,
  GRID_START_MINUTES,
} from '../../lib/date';
import { getDb, seedBooking } from './db';

const NOT_FOUND_EVENT_TYPE = 'Event type not found';
const NOT_FOUND_DATE = 'Date is out of booking window';
const CONFLICT_BOOKED = 'Slot is already booked';
const CONFLICT_EVENT_TYPE = 'Event type with this id already exists';

function json<T>(body: T, status = 200) {
  return HttpResponse.json(body, { status });
}

function error(status: number, error: string) {
  return json({ error }, status);
}

function validation(errors: Array<{ field: string; message: string }>) {
  return json({ errors }, 422);
}

function parseTime(time: string): { hour: number; minute: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function isOnGrid(time: string): boolean {
  const parsed = parseTime(time);
  if (!parsed) return false;
  const total = parsed.hour * 60 + parsed.minute;
  return total % 30 === 0;
}

function isWithinWorkHours(dateKey: string, time: string, duration: number): boolean {
  const start = toDateTime(dateKey, time);
  const end = endsAt(start, duration);
  const dayStart = toDateTime(dateKey, '00:00');
  const startMin = (start.getTime() - dayStart.getTime()) / 60000;
  const endMin = (end.getTime() - dayStart.getTime()) / 60000;
  return startMin >= GRID_START_MINUTES && endMin <= GRID_END_MINUTES;
}

function hasOverlap(start: Date, end: Date): boolean {
  return getDb().bookings.some((booking) => {
    const existingStart = new Date(booking.startsAt);
    const existingEnd = new Date(booking.endsAt);
    return existingStart < end && start < existingEnd;
  });
}

function bookingOverlapsCell(cellStart: Date): boolean {
  return getDb().bookings.some((booking) => {
    const existingStart = new Date(booking.startsAt);
    const existingEnd = new Date(booking.endsAt);
    return cellStart >= existingStart && cellStart < existingEnd;
  });
}

/** Все 30-минутные ячейки дня (вид владельца). */
function buildAdminSlots(dateKey: string): AdminDaySlots {
  const slots = gridStarts(dateKey).map((cellStart) => {
    const booking = getDb().bookings.find((item) => {
      const start = new Date(item.startsAt);
      const end = new Date(item.endsAt);
      return cellStart >= start && cellStart < end;
    });
    const booked = Boolean(booking);
    return {
      startsAt: toLocalIso(cellStart),
      status: booked ? ('booked' as const) : ('free' as const),
      ...(booking
        ? {
            booking: {
              id: booking.id,
              eventType: getDb().eventTypes.find((et) => et.id === booking.eventTypeId)!,
              guestName: booking.guestName,
              guestContact: booking.guestContact,
            },
          }
        : {}),
    };
  });
  return { date: dateKey, slots };
}

/** Гостевые слоты: только будущие и помещающиеся в рабочее окно для длительности. */
function buildGuestSlots(dateKey: string, duration: number): Slot[] {
  const lastStart = lastBookableStart(dateKey, duration);
  return gridStarts(dateKey)
    .filter((cellStart) => cellStart.getTime() > Date.now() && cellStart <= lastStart)
    .map((cellStart) => ({
      startsAt: toLocalIso(cellStart),
      status: bookingOverlapsCell(cellStart) ? ('booked' as const) : ('free' as const),
    }));
}

function toLocalIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

function validateEventTypeInput(body: Record<string, unknown>) {
  const errors: Array<{ field: string; message: string }> = [];
  if (typeof body.id !== 'string' || body.id.trim() === '') {
    errors.push({ field: 'id', message: 'Обязательное поле' });
  } else if (body.id.length > 50) {
    errors.push({ field: 'id', message: 'Не более 50 символов' });
  }
  if (typeof body.name !== 'string' || body.name.trim() === '') {
    errors.push({ field: 'name', message: 'Обязательное поле' });
  } else if (body.name.length > 100) {
    errors.push({ field: 'name', message: 'Не более 100 символов' });
  }
  if (typeof body.description === 'string' && body.description.length > 1000) {
    errors.push({ field: 'description', message: 'Не более 1000 символов' });
  }
  const duration = Number(body.duration);
  if (!Number.isInteger(duration) || duration <= 0 || duration % 30 !== 0) {
    errors.push({ field: 'duration', message: 'Длительность должна быть кратна 30 минутам' });
  }
  return errors;
}

function validateBookingInput(body: Record<string, unknown>, dateKey: string) {
  const errors: Array<{ field: string; message: string }> = [];
  const requiredFields: Array<[string, string]> = [
    ['time', 'Обязательное поле'],
    ['eventTypeId', 'Обязательное поле'],
    ['guestName', 'Обязательное поле'],
    ['guestContact', 'Обязательное поле'],
  ];
  for (const [field, message] of requiredFields) {
    if (typeof body[field] !== 'string' || (body[field] as string).trim() === '') {
      errors.push({ field, message });
    }
  }
  if (errors.length === 0) {
    if (!isWithinBookingWindow(dateKey)) {
      errors.push({ field: 'date', message: 'Дата вне окна бронирования' });
    }
    if (!isOnGrid(String(body.time))) {
      errors.push({ field: 'time', message: 'Время должно попадать на границу сетки 30 минут' });
    }
  }
  return errors;
}

type Resolver = Parameters<typeof http.get>[1];
type HandlerDef = {
  method: 'get' | 'post';
  path: string;
  resolver: Resolver;
};

const defs: HandlerDef[] = [
  {
    method: 'get',
    path: '/event-types',
    resolver: () => json(getDb().eventTypes),
  },
  {
    method: 'get',
    path: '/guest/:date',
    resolver: ({ params, request }) => {
      const dateKey = String(params.date);
      const eventTypeId = new URL(request.url).searchParams.get('eventType') ?? '';
      if (!isWithinBookingWindow(dateKey)) {
        return error(404, NOT_FOUND_DATE);
      }
      const eventType = getDb().eventTypes.find((item) => item.id === eventTypeId);
      if (!eventType) {
        return error(404, NOT_FOUND_EVENT_TYPE);
      }
      return json({
        date: dateKey,
        eventType,
        slots: buildGuestSlots(dateKey, eventType.duration),
      });
    },
  },
  {
    method: 'post',
    path: '/guest/:date/availability',
    resolver: async ({ params, request }) => {
      const dateKey = String(params.date);
      const body = (await request.json()) as { time: string; eventTypeId: string };
      if (!getDb().eventTypes.some((item) => item.id === body.eventTypeId)) {
        return error(404, NOT_FOUND_EVENT_TYPE);
      }
      if (!isWithinBookingWindow(dateKey)) {
        return json({ available: false, reason: 'out-of-window' });
      }
      if (!isOnGrid(body.time)) {
        return json({ available: false, reason: 'invalid-grid' });
      }
      const eventType = getDb().eventTypes.find((item) => item.id === body.eventTypeId)!;
      if (!isWithinWorkHours(dateKey, body.time, eventType.duration)) {
        return json({ available: false, reason: 'out-of-hours' });
      }
      const start = toDateTime(dateKey, body.time);
      if (start.getTime() <= Date.now()) {
        return json({ available: false, reason: 'already-passed' });
      }
      const end = endsAt(start, eventType.duration);
      if (hasOverlap(start, end)) {
        return json({ available: false, reason: 'booked' });
      }
      return json({ available: true });
    },
  },
  {
    method: 'post',
    path: '/guest/:date/booking',
    resolver: async ({ params, request }) => {
      const dateKey = String(params.date);
      const body = (await request.json()) as Record<string, unknown>;

      if (!getDb().eventTypes.some((item) => item.id === body.eventTypeId)) {
        return error(404, NOT_FOUND_EVENT_TYPE);
      }

      const errors = validateBookingInput(body, dateKey);
      if (errors.length > 0) {
        return validation(errors);
      }

      const eventType = getDb().eventTypes.find((item) => item.id === body.eventTypeId)!;
      const time = String(body.time);
      const start = toDateTime(dateKey, time);
      const end = endsAt(start, eventType.duration);

      if (!isWithinWorkHours(dateKey, time, eventType.duration)) {
        return validation([{ field: 'time', message: 'Встреча выходит за рабочие часы 08:00–20:00' }]);
      }
      if (start.getTime() <= Date.now()) {
        return validation([{ field: 'time', message: 'Время уже наступило' }]);
      }
      if (hasOverlap(start, end)) {
        return error(409, CONFLICT_BOOKED);
      }

      const booking = seedBooking({
        dateKey,
        time,
        eventTypeId: eventType.id,
        guestName: String(body.guestName),
        guestContact: String(body.guestContact),
      });
      return json(booking, 201);
    },
  },
  {
    method: 'get',
    path: '/admin',
    resolver: () => {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const bookings = getDb()
        .bookings.filter((booking) => new Date(booking.startsAt).getTime() >= startOfToday.getTime())
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
      return json({ bookings });
    },
  },
  {
    method: 'get',
    path: '/admin/:date',
    resolver: ({ params }) => {
      const dateKey = String(params.date);
      if (!isWithinBookingWindow(dateKey)) {
        return error(404, NOT_FOUND_DATE);
      }
      return json(buildAdminSlots(dateKey));
    },
  },
  {
    method: 'post',
    path: '/admin/event-types',
    resolver: async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      const errors = validateEventTypeInput(body);
      if (errors.length > 0) {
        return validation(errors);
      }
      if (getDb().eventTypes.some((item) => item.id === body.id)) {
        return error(409, CONFLICT_EVENT_TYPE);
      }
      const eventType: EventType = {
        id: String(body.id),
        name: String(body.name),
        description: typeof body.description === 'string' ? body.description : undefined,
        duration: Number(body.duration),
      };
      getDb().eventTypes.push(eventType);
      return json(eventType, 201);
    },
  },
];

export const handlers = defs.map(({ method, path, resolver }) =>
  (http[method] as (path: string, resolver: Resolver) => HttpHandler)(`*${path}`, resolver),
);

/** Операции контракта, покрытые хендлерами (для теста соответствия спецификации). */
export const contractOperations = defs.map(({ method, path }) => ({
  method: method.toUpperCase(),
  path: path.replace(/:(\w+)/g, '{$1}'),
}));

export type { Booking };
export type { EventType };