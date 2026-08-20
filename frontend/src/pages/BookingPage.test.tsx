import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import { renderWithProviders } from '../test/test-utils';
import { server } from '../test/mocks/server';
import { futureDateKey, seedBooking } from '../test/mocks/db';
import { addDays, formatDateKey } from '../lib/date';
import { BookingPage } from './BookingPage';

const tomorrowKey = formatDateKey(addDays(new Date(), 1));

function renderBookingPage(eventTypeId?: string) {
  const entry = eventTypeId ? `/booking/${eventTypeId}` : '/';
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<BookingPage />} />
      <Route path="/booking/:eventTypeId" element={<BookingPage />} />
    </Routes>,
    { initialEntries: [entry] },
  );
}

async function openTomorrow() {
  const user = userEvent.setup();
  renderBookingPage('consultation');

  await screen.findByText('Консультация');
  await user.click(screen.getByRole('button', { name: tomorrowKey }));
  await screen.findByText(/Свободные слоты/);
  return user;
}

async function openBookingModal() {
  const user = await openTomorrow();
  await user.click(screen.getByRole('button', { name: '08:00' }));
  await screen.findByLabelText(/Имя/);
  return user;
}

describe('BookingPage (гость: тип события → календарь → слоты)', () => {
  it('отображает выбранный тип события и свободные слоты за день', async () => {
    await openTomorrow();

    expect(screen.getByText('Консультация')).toBeInTheDocument();
    expect(screen.getByText('30 мин')).toBeInTheDocument();
    expect(screen.getByText('08:00')).toBeInTheDocument();
  });

  it('автовыбирает первый тип события на корневом маршруте', async () => {
    renderBookingPage();

    expect(await screen.findByText('Консультация')).toBeInTheDocument();
    expect(screen.getByText('30 мин')).toBeInTheDocument();
  });

  it('позволяет переключить тип события из списка', async () => {
    const user = userEvent.setup();
    renderBookingPage();

    await screen.findByText('Консультация');
    await user.click(screen.getByRole('combobox'));
    await user.click(await screen.findByRole('option', { name: /Встреча/ }));

    expect(await screen.findByText('Встреча')).toBeInTheDocument();
    expect(screen.getByText('60 мин')).toBeInTheDocument();
  });

  it('отмечает занятые слоты отдельной секцией', async () => {
    seedBooking({ dateKey: futureDateKey(1), time: '08:00', eventTypeId: 'consultation' });

    const user = userEvent.setup();
    renderBookingPage('consultation');

    await screen.findByText('Консультация');
    await user.click(screen.getByRole('button', { name: tomorrowKey }));

    expect(await screen.findByText('Занятые')).toBeInTheDocument();
    expect(screen.getByText(/Свободные слоты/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '08:00' })).not.toBeInTheDocument();
  });

  it('проверка доступности свободного слота возвращает «Слот доступен»', async () => {
    const user = await openBookingModal();

    await user.click(screen.getByRole('button', { name: 'Проверить доступность' }));

    expect(await screen.findByText('Слот доступен')).toBeInTheDocument();
  });

  it('успешное бронирование показывает детали брони', async () => {
    const user = await openBookingModal();

    await user.type(screen.getByLabelText(/Имя/), 'Иван Петров');
    await user.type(screen.getByLabelText(/Контакт/), 'ivan@example.com');
    await user.click(screen.getByRole('button', { name: 'Забронировать' }));

    expect(await screen.findByText('Забронировано!')).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText(/ivan@example\.com/)).toBeInTheDocument();
  });

  it('конфликт 409 показывает сообщение «Слот уже занят»', async () => {
    server.use(
      http.post('*/guest/:date/booking', () =>
        HttpResponse.json({ error: 'Slot is already booked' }, { status: 409 }),
      ),
    );

    const user = await openBookingModal();
    await user.type(screen.getByLabelText(/Имя/), 'Иван Петров');
    await user.type(screen.getByLabelText(/Контакт/), 'ivan@example.com');
    await user.click(screen.getByRole('button', { name: 'Забронировать' }));

    expect(
      await screen.findByText('Слот уже занят. Обновите список и выберите другой слот.'),
    ).toBeInTheDocument();
  });

  it('ошибка валидации 422 показывается под полем', async () => {
    server.use(
      http.post('*/guest/:date/booking', () =>
        HttpResponse.json(
          { errors: [{ field: 'guestName', message: 'Имя слишком короткое' }] },
          { status: 422 },
        ),
      ),
    );

    const user = await openBookingModal();
    await user.type(screen.getByLabelText(/Имя/), 'А');
    await user.type(screen.getByLabelText(/Контакт/), 'ivan@example.com');
    await user.click(screen.getByRole('button', { name: 'Забронировать' }));

    expect(await screen.findByText('Имя слишком короткое')).toBeInTheDocument();
  });

  it('показывает «Тип события не найден» для неизвестного id', async () => {
    renderBookingPage('unknown');

    expect(await screen.findByText('Тип события не найден')).toBeInTheDocument();
  });

  it('не даёт отправить форму с пустыми полями', async () => {
    await openBookingModal();

    const modal = screen.getByRole('dialog');
    const submitButton = within(modal).getByRole('button', { name: 'Забронировать' });
    expect(submitButton).toBeDisabled();
  });
});