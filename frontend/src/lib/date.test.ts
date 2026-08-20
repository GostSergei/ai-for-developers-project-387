import { describe, expect, it } from 'vitest';
import {
  BOOKING_WINDOW_DAYS,
  GRID_END_MINUTES,
  GRID_START_MINUTES,
  addDays,
  buildBookingWindow,
  endsAt,
  formatDateKey,
  formatTime,
  gridStarts,
  isMultipleOfThirty,
  isUpcoming,
  isWithinBookingWindow,
  lastBookableStart,
  toDateTime,
  todayKey,
} from './date';

describe('date helpers', () => {
  it('formatDateKey формирует YYYY-MM-DD', () => {
    expect(formatDateKey(new Date(2026, 7, 18))).toBe('2026-08-18');
  });

  it('todayKey возвращает ключ сегодняшнего дня', () => {
    expect(todayKey()).toBe(formatDateKey(new Date()));
  });

  it('addDays прибавляет дни без сдвига времени', () => {
    const base = new Date(2026, 7, 18, 12, 0);
    const next = addDays(base, 1);
    expect(formatDateKey(next)).toBe('2026-08-19');
    expect(next.getHours()).toBe(12);
  });

  it('buildBookingWindow возвращает 14 календарных дней от сегодня', () => {
    const window = buildBookingWindow();
    expect(window).toHaveLength(BOOKING_WINDOW_DAYS);
    expect(formatDateKey(window[0])).toBe(todayKey());
    expect(formatDateKey(window[window.length - 1])).toBe(formatDateKey(addDays(new Date(), BOOKING_WINDOW_DAYS - 1)));
  });

  it('isWithinBookingWindow учитывает границы окна', () => {
    expect(isWithinBookingWindow(todayKey())).toBe(true);
    expect(isWithinBookingWindow(formatDateKey(addDays(new Date(), BOOKING_WINDOW_DAYS - 1)))).toBe(true);
    expect(isWithinBookingWindow(formatDateKey(addDays(new Date(), -1)))).toBe(false);
    expect(isWithinBookingWindow(formatDateKey(addDays(new Date(), BOOKING_WINDOW_DAYS)))).toBe(false);
  });

  it('gridStarts строит сетку 08:00–20:00 с шагом 30 минут', () => {
    const starts = gridStarts('2026-08-18');
    expect(starts).toHaveLength((GRID_END_MINUTES - GRID_START_MINUTES) / 30);
    expect(formatTime(starts[0])).toBe('08:00');
    expect(formatTime(starts[starts.length - 1])).toBe('19:30');
  });

  it('endsAt прибавляет длительность', () => {
    const start = toDateTime('2026-08-18', '08:00');
    expect(formatTime(endsAt(start, 90))).toBe('09:30');
  });

  it('lastBookableStart гарантирует встречу внутри рабочего окна', () => {
    expect(formatTime(lastBookableStart('2026-08-18', 60))).toBe('19:00');
    expect(formatTime(lastBookableStart('2026-08-18', 30))).toBe('19:30');
  });

  it('isUpcoming сравнивает с текущим моментом', () => {
    expect(isUpcoming(addDays(new Date(), 1))).toBe(true);
    expect(isUpcoming(addDays(new Date(), -1))).toBe(false);
  });

  it('isMultipleOfThirty', () => {
    expect(isMultipleOfThirty(30)).toBe(true);
    expect(isMultipleOfThirty(60)).toBe(true);
    expect(isMultipleOfThirty(45)).toBe(false);
    expect(isMultipleOfThirty(0)).toBe(false);
  });

  it('toDateTime собирает локальный момент без сдвига времени', () => {
    const date = toDateTime('2026-08-18', '08:30');
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(7);
    expect(date.getDate()).toBe(18);
    expect(date.getHours()).toBe(8);
    expect(date.getMinutes()).toBe(30);
  });
});