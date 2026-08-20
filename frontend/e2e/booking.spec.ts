import { expect, test, type APIRequestContext, type APIResponse, type Page } from '@playwright/test';

/**
 * Интеграционные тесты основного сценария бронирования.
 * Запускаются против реального стека: vite preview (фронт) + FastAPI (бэк),
 * который поднимает Playwright (см. playwright.config.ts → webServer).
 * Сценарии: docs/user-scenarios.md.
 */

const API_BASE_URL = 'http://localhost:8000';

function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function relativeDateKey(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

const WEEKDAYS_LONG = [
  'воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота',
];
const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

function parseDateKey(day: string): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date);
}

/** Локальная подпись дня в BookingPage (см. formatDateLong в src/lib/date). */
function longDateLabel(day: string): string {
  const date = parseDateKey(day);
  return `${WEEKDAYS_LONG[date.getDay()]}, ${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`;
}

async function createEventType(
  api: APIRequestContext,
  id: string,
  name: string,
  duration = 30,
): Promise<void> {
  const response = await api.post(apiUrl('/admin/event-types'), { data: { id, name, duration } });
  expect(response.status(), `POST /admin/event-types (${id})`).toBe(201);
}

async function bookSlot(
  api: APIRequestContext,
  day: string,
  eventTypeId: string,
  time: string,
): Promise<APIResponse> {
  return api.post(apiUrl(`/guest/${day}/booking`), {
    data: {
      time,
      eventTypeId,
      guestName: 'Иван Петров',
      guestContact: 'ivan@example.com',
    },
  });
}

/** Открывает день в DatePicker; при необходимости перелистывает месяц вперёд. */
async function openDay(page: Page, day: string): Promise<void> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const target = page.getByRole('button', { name: day, exact: true });
    if ((await target.count()) > 0) {
      await target.first().click();
      return;
    }
    await page.locator('button[data-direction="next"]').first().click();
  }
  throw new Error(`День ${day} не найден в календаре`);
}

test('S1+S4: гость бронирует слот, владелец видит встречу и слот дня', async ({
  page,
  request,
}) => {
  const eventTypeId = `e2e-consult-${Date.now()}`;
  const name = 'Консультация';
  const day = relativeDateKey(1);

  await createEventType(request, eventTypeId, name, 30);

  // Гость: выбор типа → день → слот → форма → бронирование
  await page.goto(`/booking/${eventTypeId}`);
  await expect(page.getByRole('heading', { name })).toBeVisible();
  await openDay(page, day);
  await expect(page.getByText(longDateLabel(day))).toBeVisible();
  await expect(page.getByText(/Свободные слоты/)).toBeVisible();

  await page.getByRole('button', { name: '08:00', exact: true }).click();
  await page.getByLabel('Имя').fill('Иван Петров');
  await page.getByLabel('Контакт').fill('ivan@example.com');
  await page.getByRole('button', { name: 'Забронировать', exact: true }).click();

  await expect(page.getByText('Забронировано!')).toBeVisible();

  // Бэк подтверждает создание брони
  const upcomingResponse = await request.get(apiUrl('/admin'));
  expect(upcomingResponse.status()).toBe(200);
  const upcoming = (await upcomingResponse.json()).bookings as Array<{
    eventTypeId: string;
    guestName: string;
  }>;
  expect(
    upcoming.some((item) => item.eventTypeId === eventTypeId && item.guestName === 'Иван Петров'),
  ).toBeTruthy();

  // Владелец: слот дня отмечен как занятый с данными гостя
  const dayResponse = await request.get(apiUrl(`/admin/${day}`));
  expect(dayResponse.status()).toBe(200);
  const slots = (await dayResponse.json()).slots as Array<{
    startsAt: string;
    status: string;
    booking?: { guestName: string };
  }>;
  const eight = slots.find((slot) => slot.startsAt.includes('08:00'));
  expect(eight?.status).toBe('booked');
  expect(eight?.booking?.guestName).toBe('Иван Петров');

  // Владелец: встреча видна на дашборде
  await page.goto('/admin');
  await expect(page.getByText('Иван Петров')).toBeVisible();
  await expect(page.getByText('ivan@example.com')).toBeVisible();
});

test('S2+S5: повторная бронь занятого слота → 409, слот в «Занятых»', async ({
  page,
  request,
}) => {
  const eventTypeId = `e2e-meeting-${Date.now()}`;
  const day = relativeDateKey(1);

  await createEventType(request, eventTypeId, 'Встреча', 60);

  const first = await bookSlot(request, day, eventTypeId, '10:00');
  expect(first.status()).toBe(201);

  const second = await bookSlot(request, day, eventTypeId, '10:00');
  expect(second.status()).toBe(409);

  // Гость повторно открывает день: слот недоступен для выбора
  await page.goto(`/booking/${eventTypeId}`);
  await openDay(page, day);
  await expect(page.getByText(longDateLabel(day))).toBeVisible();
  await expect(page.getByText(/Свободные слоты/)).toBeVisible();
  await expect(page.getByText('Занятые')).toBeVisible();
  await expect(page.getByRole('button', { name: '10:00', exact: true })).toHaveCount(0);
  await expect(page.getByText('10:00', { exact: true }).first()).toBeVisible();
});

test('S3: владелец создаёт тип события через UI', async ({ page, request }) => {
  const eventTypeId = `e2e-created-${Date.now()}`;
  const name = 'Разбор кода';

  await page.goto('/admin/event-types/new');
  await page.getByLabel('ID').fill(eventTypeId);
  await page.getByLabel('Название').fill(name);
  await page.getByRole('button', { name: 'Создать', exact: true }).click();

  await expect(page).toHaveURL(/\/admin$/);

  const typesResponse = await request.get(apiUrl('/event-types'));
  expect(typesResponse.status()).toBe(200);
  const types = (await typesResponse.json()) as Array<{ id: string; name: string }>;
  expect(types.some((item) => item.id === eventTypeId && item.name === name)).toBeTruthy();

  // Тип события виден на странице владельца
  await page.goto('/admin/event-types');
  await expect(page.getByText(name)).toBeVisible();
});