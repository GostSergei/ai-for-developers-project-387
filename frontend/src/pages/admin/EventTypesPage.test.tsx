import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { renderWithProviders } from '../../test/test-utils';
import { getDb, seedBooking, seedEventType } from '../../test/mocks/db';
import { EventTypesPage } from './EventTypesPage';

describe('EventTypesPage (владелец: типы событий)', () => {
  it('отображает существующие типы событий из GET /event-types', async () => {
    renderWithProviders(<EventTypesPage />);

    expect(await screen.findByText('Консультация')).toBeInTheDocument();
    expect(screen.getByText('Встреча')).toBeInTheDocument();
    expect(screen.getByText('30 мин')).toBeInTheDocument();
    expect(screen.getByText('60 мин')).toBeInTheDocument();
    expect(screen.getByText('consultation')).toBeInTheDocument();
    expect(screen.getByText('Разбор проекта')).toBeInTheDocument();
  });

  it('показывает пустое состояние, когда типов нет', async () => {
    getDb().eventTypes = [];

    renderWithProviders(<EventTypesPage />);

    expect(await screen.findByText('Пока нет типов событий')).toBeInTheDocument();
  });

  it('отображает добавленный владельцем тип события', async () => {
    seedEventType({
      id: 'demo',
      name: 'Демо-звонок',
      description: 'Короткая демонстрация',
      duration: 15,
    });

    renderWithProviders(<EventTypesPage />);

    expect(await screen.findByText('Демо-звонок')).toBeInTheDocument();
    expect(screen.getByText('demo')).toBeInTheDocument();
    expect(screen.getByText('15 мин')).toBeInTheDocument();
  });

  it('отображает кнопки действий «изменить» и «удалить» для каждого типа', async () => {
    renderWithProviders(<EventTypesPage />);

    expect(await screen.findByText('Консультация')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Изменить тип «consultation»' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Удалить тип «consultation»' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Изменить тип «meeting»' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Удалить тип «meeting»' })).toBeInTheDocument();
  });

  it('изменяет название и длительность типа через модальное окно', async () => {
    const user = userEvent.setup();
    renderWithProviders(<EventTypesPage />);

    expect(await screen.findByText('Консультация')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Изменить тип «consultation»' }));

    expect(await screen.findByRole('heading', { name: 'Изменить тип «consultation»' })).toBeInTheDocument();

    const nameInput = screen.getByDisplayValue('Консультация');
    await user.clear(nameInput);
    await user.type(nameInput, 'Консультация Pro');

    await user.click(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      const updated = getDb().eventTypes.find((type) => type.id === 'consultation');
      expect(updated?.name).toBe('Консультация Pro');
      expect(screen.queryByText('Консультация')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Консультация Pro')).toBeInTheDocument();
  });

  it('удаляет тип события через диалог подтверждения', async () => {
    const user = userEvent.setup();
    seedEventType({
      id: 'demo',
      name: 'Демо-звонок',
      description: 'Короткая демонстрация',
      duration: 15,
    });
    renderWithProviders(<EventTypesPage />);

    expect(await screen.findByText('Демо-звонок')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Удалить тип «demo»' }));

    expect(await screen.findByRole('heading', { name: 'Удалить тип события' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Удалить' }));

    await waitFor(() => {
      expect(getDb().eventTypes.some((type) => type.id === 'demo')).toBe(false);
      expect(screen.queryByText('Демо-звонок')).not.toBeInTheDocument();
    });
    expect(getDb().eventTypes.some((type) => type.id === 'consultation')).toBe(true);
  });

  it('показывает ошибку 409 при удалении типа с бронями', async () => {
    const user = userEvent.setup();
    seedBooking({ dateKey: '2026-08-25', time: '10:00', eventTypeId: 'consultation' });
    renderWithProviders(<EventTypesPage />);

    expect(await screen.findByText('Консультация')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Удалить тип «consultation»' }));

    expect(await screen.findByRole('heading', { name: 'Удалить тип события' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Удалить' }));

    expect(await screen.findByText('Нельзя удалить: у этого типа события есть брони.')).toBeInTheDocument();
    expect(getDb().eventTypes.some((type) => type.id === 'consultation')).toBe(true);
  });
});