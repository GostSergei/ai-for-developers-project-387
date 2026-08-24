import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import type { Booking, BookingUpdate } from '../../api/types';
import { useEventTypes, useUpdateBooking } from '../../api/endpoints';
import { ApiError, isConflictError, isValidationError } from '../../api/client';
import {
  buildBookingWindow,
  formatDateKey,
  formatTime,
  pad2,
} from '../../lib/date';

interface EditBookingModalProps {
  booking: Booking | null;
  onClose: () => void;
}

function buildTimeOptions(): string[] {
  const options: string[] = [];
  for (let hour = 8; hour < 20; hour += 1) {
    options.push(`${pad2(hour)}:00`);
    options.push(`${pad2(hour)}:30`);
  }
  return options;
}

export function EditBookingModal({ booking, onClose }: EditBookingModalProps) {
  const opened = booking !== null;

  const windowDates = useMemo(() => buildBookingWindow(), []);
  const minDate = windowDates[0];
  const maxDate = windowDates[windowDates.length - 1];

  const eventTypesQuery = useEventTypes();
  const updateBookingMutation = useUpdateBooking();

  const [dateKey, setDateKey] = useState<string>(() => (booking ? formatDateKey(new Date(booking.startsAt)) : ''));
  const [time, setTime] = useState<string>(() => (booking ? formatTime(new Date(booking.startsAt)) : ''));
  const [eventTypeId, setEventTypeId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState('');
  const [guestContact, setGuestContact] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (booking) {
      setDateKey(formatDateKey(new Date(booking.startsAt)));
      setTime(formatTime(new Date(booking.startsAt)));
      setEventTypeId(booking.eventTypeId);
      setGuestName(booking.guestName);
      setGuestContact(booking.guestContact);
      setFieldErrors({});
      setSubmitError(null);
      updateBookingMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking]);

  const eventTypeSelectData = (eventTypesQuery.data ?? []).map((item) => ({
    value: item.id,
    label: `${item.name} · ${item.duration} мин`,
  }));

  const timeOptions = useMemo(() => buildTimeOptions(), []);

  const handleSubmit = async () => {
    if (!booking) return;
    setSubmitError(null);
    setFieldErrors({});
    try {
      const body: BookingUpdate = {
        date: dateKey,
        time,
        eventTypeId: eventTypeId ?? undefined,
        guestName,
        guestContact,
      };
      await updateBookingMutation.mutateAsync({ id: booking.id, body });
      notifications.show({
        title: 'Встреча обновлена',
        message: `#${booking.id} · ${formatDateKey(new Date(dateKey))} ${time}`,
        color: 'green',
      });
      onClose();
    } catch (error) {
      if (isValidationError(error)) {
        const errors: Record<string, string> = {};
        for (const item of error.payload.errors) {
          errors[item.field] = item.message;
        }
        setFieldErrors(errors);
      } else if (isConflictError(error)) {
        setSubmitError('Выбранный слот занят другой встречей.');
      } else if (error instanceof ApiError && error.status === 404) {
        setSubmitError('Встреча или тип события не найдены.');
      } else if (error instanceof Error) {
        setSubmitError(error.message);
      }
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={booking ? `Изменить встречу #${booking.id}` : ''} centered>
      {booking && (
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Перенесите время или тип, либо исправьте данные гостя.
          </Text>

          <Stack gap={6}>
            <Text size="sm" fw={500}>
              Дата
            </Text>
            <DatePicker
              value={dateKey}
              onChange={(value) => value && setDateKey(value)}
              minDate={minDate}
              maxDate={maxDate}
              getDayAriaLabel={(date) => formatDateKey(new Date(date))}
            />
          </Stack>

          <Select
            label="Время начала"
            data={timeOptions}
            value={time}
            onChange={(value) => value && setTime(value)}
            error={fieldErrors.time}
            searchable
          />

          <Select
            label="Тип события"
            placeholder={eventTypesQuery.isPending ? 'Загрузка…' : 'Выберите тип события'}
            data={eventTypeSelectData}
            value={eventTypeId}
            onChange={(value) => setEventTypeId(value)}
            searchable
            nothingFoundMessage="Нет доступных типов"
          />

          <TextInput
            label="Имя гостя"
            required
            value={guestName}
            onChange={(event) => setGuestName(event.currentTarget.value)}
            error={fieldErrors.guestName}
          />
          <TextInput
            label="Контакт гостя"
            required
            value={guestContact}
            onChange={(event) => setGuestContact(event.currentTarget.value)}
            error={fieldErrors.guestContact}
          />

          {submitError && <Alert color="red">{submitError}</Alert>}

          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" onClick={onClose}>
              Отмена
            </Button>
            <Button onClick={handleSubmit} loading={updateBookingMutation.isPending}>
              Сохранить
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
