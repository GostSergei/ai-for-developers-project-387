import dayjs, { type Dayjs } from 'dayjs';

export const GRID_START_MINUTES = 8 * 60;
export const GRID_END_MINUTES = 20 * 60;
export const GRID_STEP_MINUTES = 30;
export const BOOKING_WINDOW_DAYS = 14;

const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

const MONTHS_NOMINATIVE = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
];


const WEEKDAYS_LONG = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

export function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatDateKey(date: Date | Dayjs): string {
  const d = dayjs(date);
  return `${d.year()}-${pad2(d.month() + 1)}-${pad2(d.date())}`;
}

export function todayKey(): string {
  return formatDateKey(new Date());
}

export function addDays(date: Date | Dayjs, days: number): Date {
  return dayjs(date).add(days, 'day').toDate();
}

export function startOfDay(date: Date | Dayjs): Date {
  return dayjs(date).startOf('day').toDate();
}

export function endOfDay(date: Date | Dayjs): Date {
  return dayjs(date).endOf('day').toDate();
}

/** [сегодня, сегодня + (windowDays - 1)] — календарные дни окна бронирования. */
export function buildBookingWindow(days = BOOKING_WINDOW_DAYS): Date[] {
  const today = startOfDay(new Date());
  return Array.from({ length: days }, (_, i) => addDays(today, i));
}

/** Внутри ли дата окна бронирования [сегодня, сегодня+13]. */
export function isWithinBookingWindow(dateKey: string, days = BOOKING_WINDOW_DAYS): boolean {
  const keys = buildBookingWindow(days).map(formatDateKey);
  return keys.includes(dateKey);
}

/** Время HH:MM из момента (локальное). */
export function formatTime(date: Date | Dayjs): string {
  const d = dayjs(date);
  return `${pad2(d.hour())}:${pad2(d.minute())}`;
}

/** Собирает локальный момент из даты YYYY-MM-DD и времени HH:MM. */
export function toDateTime(dateKey: string, time: string): Date {
  return dayjs(`${dateKey}T${time}:00`).toDate();
}

export function formatDateTime(date: Date | Dayjs): string {
  const d = dayjs(date);
  return `${d.date()} ${MONTHS_GENITIVE[d.month()]}, ${formatTime(d)}`;
}

export function formatDateLong(date: Date | Dayjs): string {
  const d = dayjs(date);
  return `${WEEKDAYS_LONG[d.day()]}, ${d.date()} ${MONTHS_GENITIVE[d.month()]}`;
}

export function formatMonthNom(date: Date | Dayjs): string {
  const d = dayjs(date);
  return `${MONTHS_NOMINATIVE[d.month()]}`;
}

/** Старты 30-минутных ячеек сетки 08:00–20:00 для дня. */
export function gridStarts(dateKey: string): Date[] {
  const day = startOfDay(toDateTime(dateKey, '00:00'));
  const starts: Date[] = [];
  for (let minutes = GRID_START_MINUTES; minutes < GRID_END_MINUTES; minutes += GRID_STEP_MINUTES) {
    starts.push(dayjs(day).add(minutes, 'minute').toDate());
  }
  return starts;
}

/** Время окончания встречи = startsAt + duration. */
export function endsAt(startsAt: Date | Dayjs, durationMinutes: number): Date {
  return dayjs(startsAt).add(durationMinutes, 'minute').toDate();
}

/** Последний допустимый старт для длительности, чтобы встреча влезла в 08:00–20:00. */
export function lastBookableStart(dateKey: string, durationMinutes: number): Date {
  const day = startOfDay(toDateTime(dateKey, '00:00'));
  return dayjs(day)
    .add(GRID_END_MINUTES - durationMinutes, 'minute')
    .toDate();
}

/** Слот ещё не наступил. */
export function isUpcoming(startsAt: Date | Dayjs): boolean {
  return dayjs(startsAt).isAfter(dayjs());
}

export const durationLabels = [30, 60, 90, 120, 150, 180, 240];

export function isMultipleOfThirty(minutes: number): boolean {
  return minutes > 0 && minutes % 30 === 0;
}