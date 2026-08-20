import { useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Divider,
  Group,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import { useAdminDaySlots } from '../../api/endpoints';
import { isNotFoundError } from '../../api/client';
import { buildBookingWindow, formatDateKey, formatTime, todayKey } from '../../lib/date';

export function AdminDayPage() {
  const windowDates = useMemo(() => buildBookingWindow(), []);
  const minDate = windowDates[0];
  const maxDate = windowDates[windowDates.length - 1];
  const [selected, setSelected] = useState<string | null>(todayKey());

  const dateKey = selected ?? undefined;
  const { data, isPending, isError, error } = useAdminDaySlots(dateKey);

  return (
    <Stack gap="md">
      <Title order={2}>Слоты по дням</Title>

      <DatePicker
        value={selected}
        onChange={setSelected}
        minDate={minDate}
        maxDate={maxDate}
        defaultDate={minDate}
        getDayAriaLabel={(date) => formatDateKey(new Date(date))}
      />

      <Text fw={600} size="sm" c="dimmed">
        {dateKey}
      </Text>

      {isPending && (
        <Stack gap="xs">
          <Skeleton height={36} />
          <Skeleton height={36} />
        </Stack>
      )}

      {isError && (
        <Alert color="red" title="Не удалось загрузить слоты">
          {isNotFoundError(error) ? 'Дата вне окна бронирования.' : error.message}
        </Alert>
      )}

      {data && (
        <Stack gap="xs">
          {data.slots.map((slot) => {
            const start = new Date(slot.startsAt);
            const booked = slot.status === 'booked';
            return (
              <div key={slot.startsAt}>
                <Group justify="space-between" wrap="wrap">
                  <Group gap="sm">
                    <Badge size="lg" color={booked ? 'red' : 'green'} variant="light">
                      {formatTime(start)}
                    </Badge>
                    <Text size="sm" c={booked ? 'dark' : 'dimmed'}>
                      {booked ? 'Занято' : 'Свободно'}
                    </Text>
                  </Group>
                  {booked && slot.booking && (
                    <Text size="sm" c="dimmed">
                      {slot.booking.eventType.name} · {slot.booking.guestName} ·{' '}
                      {slot.booking.guestContact}
                    </Text>
                  )}
                </Group>
                <Divider mt={6} />
              </div>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}