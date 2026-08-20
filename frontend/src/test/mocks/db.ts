import type { Booking, EventType } from '../../api/types';
import { addDays, endsAt, formatDateKey, toDateTime } from '../../lib/date';

export interface Db {
  eventTypes: EventType[];
  bookings: Booking[];
  nextBookingId: number;
}

export const DEFAULT_EVENT_TYPES: EventType[] = [
  {
    id: 'consultation',
    name: 'Консультация',
    description: 'Разбор проекта',
    duration: 30,
  },
  {
    id: 'meeting',
    name: 'Встреча',
    description: 'Обычная встреча',
    duration: 60,
  },
];

export function createDb(): Db {
  return {
    eventTypes: [...DEFAULT_EVENT_TYPES],
    bookings: [],
    nextBookingId: 1,
  };
}

let db: Db = createDb();

export function getDb(): Db {
  return db;
}

export function resetDb(): void {
  db = createDb();
}

export function seedEventType(eventType: EventType): void {
  db.eventTypes.push(eventType);
}

export interface SeedBookingInput {
  dateKey: string;
  time: string;
  eventTypeId: string;
  guestName?: string;
  guestContact?: string;
}

/** Создаёт броню на будущую дату/время (всегда в будущем относительно переданных dateKey+time). */
export function seedBooking(input: SeedBookingInput): Booking {
  const eventType = db.eventTypes.find((item) => item.id === input.eventTypeId);
  if (!eventType) {
    throw new Error(`Unknown eventType: ${input.eventTypeId}`);
  }

  const startsAt = toDateTime(input.dateKey, input.time);
  const booking: Booking = {
    id: db.nextBookingId++,
    eventTypeId: eventType.id,
    eventTypeName: eventType.name,
    duration: eventType.duration,
    guestName: input.guestName ?? 'Иван Петров',
    guestContact: input.guestContact ?? 'ivan@example.com',
    startsAt: toLocalIso(startsAt),
    endsAt: toLocalIso(endsAt(startsAt, eventType.duration)),
  };

  db.bookings.push(booking);
  return booking;
}

function toLocalIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

/** Дата, от которой считаем окно бронирования (по умолчанию — сегодня). */
export function now(): Date {
  return new Date();
}

/** Ближайший будущий день из окна (смещение 1) как ключ YYYY-MM-DD. */
export function futureDateKey(daysAhead = 1): string {
  return formatDateKey(addDays(now(), daysAhead));
}