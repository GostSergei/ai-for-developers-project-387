import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import { renderWithProviders } from '../../test/test-utils';
import { seedBooking } from '../../test/mocks/db';
import { todayKey } from '../../lib/date';
import { AdminDayPage } from './AdminDayPage';

describe('AdminDayPage (владелец: слоты по дням)', () => {
  it('отображает слоты дня и детали броней', async () => {
    seedBooking({
      dateKey: todayKey(),
      time: '08:00',
      eventTypeId: 'consultation',
      guestName: 'Пётр Сидоров',
      guestContact: 'petr@example.com',
    });

    renderWithProviders(<AdminDayPage />);

    expect(await screen.findByText('08:00')).toBeInTheDocument();
    expect(screen.getByText('Занято')).toBeInTheDocument();
    expect(screen.getByText('Консультация · Пётр Сидоров · petr@example.com')).toBeInTheDocument();
    expect(screen.getAllByText('Свободно').length).toBeGreaterThan(0);
  });

  it('показывает день без броней как свободные слоты', async () => {
    renderWithProviders(<AdminDayPage />);

    expect(await screen.findByText('08:00')).toBeInTheDocument();
    expect(screen.getAllByText('Свободно').length).toBeGreaterThan(0);
    expect(screen.queryByText('Занято')).not.toBeInTheDocument();
  });
});