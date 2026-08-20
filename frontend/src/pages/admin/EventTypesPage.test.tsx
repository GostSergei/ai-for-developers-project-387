import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '../../test/test-utils';
import { getDb, seedEventType } from '../../test/mocks/db';
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
});