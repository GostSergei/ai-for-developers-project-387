import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { http, HttpResponse } from 'msw';

import { renderWithProviders } from '../../test/test-utils';
import { server } from '../../test/mocks/server';
import { CreateEventTypePage } from './CreateEventTypePage';

function renderCreateForm() {
  return renderWithProviders(
    <Routes>
      <Route path="/admin/event-types/new" element={<CreateEventTypePage />} />
      <Route path="/admin" element={<div>admin-dashboard-placeholder</div>} />
    </Routes>,
    { initialEntries: ['/admin/event-types/new'] },
  );
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/ID/), 'new-event');
  await user.type(screen.getByLabelText(/Название/), 'Новое событие');
  await user.type(screen.getByLabelText(/Описание/), 'Описание события');
}

describe('CreateEventTypePage (владелец: новый тип события)', () => {
  it('успешно создаёт тип события и переходит на дашборд', async () => {
    const user = userEvent.setup();
    renderCreateForm();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Создать' }));

    expect(await screen.findByText('admin-dashboard-placeholder')).toBeInTheDocument();
  });

  it('клиентская валидация блокирует пустую форму', async () => {
    const user = userEvent.setup();
    renderCreateForm();

    await user.click(screen.getByRole('button', { name: 'Создать' }));

    expect(await screen.findAllByText('Обязательное поле')).toHaveLength(2);
  });

  it('показывает конфликт 409 при повторном id', async () => {
    server.use(
      http.post('*/admin/event-types', () =>
        HttpResponse.json({ error: 'Event type with this id already exists' }, { status: 409 }),
      ),
    );

    const user = userEvent.setup();
    renderCreateForm();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Создать' }));

    expect(await screen.findByText('Тип события с таким id уже существует.')).toBeInTheDocument();
  });

  it('показывает серверные ошибки валидации 422 по полям', async () => {
    server.use(
      http.post('*/admin/event-types', () =>
        HttpResponse.json(
          { errors: [{ field: 'id', message: 'Не более 50 символов' }] },
          { status: 422 },
        ),
      ),
    );

    const user = userEvent.setup();
    renderCreateForm();

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'Создать' }));

    expect(await screen.findByText('Не более 50 символов')).toBeInTheDocument();
  });
});