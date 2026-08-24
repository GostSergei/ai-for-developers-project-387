import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../../test/test-utils';
import { getDb, seedBooking } from '../../test/mocks/db';
import { DashboardPage } from './DashboardPage';

async function seedFutureBookings() {
  seedBooking({ dateKey: '2026-08-25', time: '10:00', eventTypeId: 'consultation', guestName: 'Иван Петров', guestContact: 'ivan@example.com' });
  seedBooking({ dateKey: '2026-08-25', time: '11:00', eventTypeId: 'meeting', guestName: 'Мария Иванова', guestContact: 'maria@example.com' });
}

describe('DashboardPage (владелец: встречи)', () => {
  it('отображает кнопки действий «изменить» и «отменить» для каждой встречи', async () => {
    await seedFutureBookings();
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('Иван Петров')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Изменить встречу #1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Отменить встречу #1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Изменить встречу #2/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Отменить встречу #2/ })).toBeInTheDocument();
  });

  it('отменяет встречу через диалог подтверждения', async () => {
    const user = userEvent.setup();
    await seedFutureBookings();
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('Иван Петров')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Отменить встречу #1/ }));

    expect(await screen.findByRole('heading', { name: 'Отменить встречу' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Отменить' }));

    await waitFor(() => {
      expect(getDb().bookings.some((booking) => booking.id === 1)).toBe(false);
      expect(screen.queryByText('Иван Петров')).not.toBeInTheDocument();
    });
    expect(getDb().bookings.some((booking) => booking.id === 2)).toBe(true);
  });

  it('изменяет имя гостя через модальное окно редактирования', async () => {
    const user = userEvent.setup();
    await seedFutureBookings();
    renderWithProviders(<DashboardPage />);

    expect(await screen.findByText('Иван Петров')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Изменить встречу #1/ }));

    expect(await screen.findByRole('heading', { name: 'Изменить встречу #1' })).toBeInTheDocument();

    const nameInput = screen.getByDisplayValue('Иван Петров');
    await user.clear(nameInput);
    await user.type(nameInput, 'Новый гость');

    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      const updated = getDb().bookings.find((booking) => booking.id === 1);
      expect(updated?.guestName).toBe('Новый гость');
      expect(screen.queryByText('Иван Петров')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Новый гость')).toBeInTheDocument();
  });
});
