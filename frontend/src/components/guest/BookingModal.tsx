import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Group,
  Modal,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
} from '@mantine/core';
import { IconCheck } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import type { AvailabilityResponse, Booking, EventType, Slot } from '../../api/types';
import { useCheckAvailability, useCreateBooking } from '../../api/endpoints';
import { ApiError, isConflictError, isValidationError } from '../../api/client';
import { endsAt, formatDateKey, formatTime } from '../../lib/date';

interface BookingModalProps {
  opened: boolean;
  onClose: () => void;
  date: Date;
  slot: Slot | null;
  eventType: EventType;
}

const AVAILABILITY_REASON_LABELS: Record<string, string> = {
  booked: 'Слот уже занят.',
  'out-of-window': 'Дата вне окна бронирования (14 дней).',
  'out-of-hours': 'Встреча выходит за рабочие часы 08:00–20:00.',
  'invalid-grid': 'Время не попадает на границу сетки 30 минут.',
  'already-passed': 'Время уже наступило.',
};

export function BookingModal({ opened, onClose, date, slot, eventType }: BookingModalProps) {
  const [guestName, setGuestName] = useState('');
  const [guestContact, setGuestContact] = useState('');
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [created, setCreated] = useState<Booking | null>(null);

  const checkAvailabilityMutation = useCheckAvailability();
  const createBookingMutation = useCreateBooking();

  const dateKey = useMemo(() => formatDateKey(date), [date]);
  const start = slot ? new Date(slot.startsAt) : null;
  const end = slot ? endsAt(start!, eventType.duration) : null;

  useEffect(() => {
    if (!opened) {
      setGuestName('');
      setGuestContact('');
      setAvailability(null);
      setFieldErrors({});
      setSubmitError(null);
      setCreated(null);
      checkAvailabilityMutation.reset();
      createBookingMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened]);

  const handleCheckAvailability = async () => {
    if (!slot) return;
    setSubmitError(null);
    try {
      const result = await checkAvailabilityMutation.mutateAsync({
        date: dateKey,
        body: { time: formatTime(start!), eventTypeId: eventType.id },
      });
      setAvailability(result);
    } catch (error) {
      if (isConflictError(error)) {
        setSubmitError('Слот был только что занят. Обновите список.');
      } else if (error instanceof Error) {
        setSubmitError(error.message);
      }
    }
  };

  const handleSubmit = async () => {
    if (!slot) return;
    setSubmitError(null);
    setFieldErrors({});
    try {
      const booking = await createBookingMutation.mutateAsync({
        date: dateKey,
        body: {
          time: formatTime(start!),
          eventTypeId: eventType.id,
          guestName,
          guestContact,
        },
      });
      setCreated(booking);
      notifications.show({ title: 'Слот забронирован', message: `${eventType.name}, ${formatTime(new Date(booking.startsAt))}`, color: 'green' });
    } catch (error) {
      if (isValidationError(error)) {
        const errors: Record<string, string> = {};
        for (const item of error.payload.errors) {
          errors[item.field] = item.message;
        }
        setFieldErrors(errors);
      } else if (isConflictError(error)) {
        setSubmitError('Слот уже занят. Обновите список и выберите другой слот.');
      } else if (error instanceof ApiError && error.status === 404) {
        setSubmitError('Тип события не найден.');
      } else if (error instanceof Error) {
        setSubmitError(error.message);
      }
    }
  };

  const availabilityReasonLabel = availability?.available === false && availability.reason
    ? AVAILABILITY_REASON_LABELS[availability.reason]
    : null;

  return (
    <Modal opened={opened} onClose={onClose} title={`Бронирование · ${eventType.name}`} centered>
      {created ? (
        <Stack align="center" gap="sm" py="md">
          <ThemeIcon size={52} radius="xl" color="green">
            <IconCheck size={28} />
          </ThemeIcon>
          <Title order={3}>Забронировано!</Title>
          <Text c="dimmed" ta="center">
            {eventType.name} · {dateKey}
            <br />
            {start && <>{formatTime(start)} – {end && formatTime(end)}</>}
          </Text>
          <Text size="sm" c="dimmed">
            Код брони: <b>#{created.id}</b>. Подтверждение отправлено на {created.guestContact}.
          </Text>
          <Button onClick={onClose} fullWidth>
            Готово
          </Button>
        </Stack>
      ) : (
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            {dateKey}, {start && formatTime(start)} – {end && formatTime(end)} · {eventType.duration} мин
          </Text>

          <TextInput
            label="Имя"
            placeholder="Как к вам обращаться"
            required
            value={guestName}
            onChange={(event) => setGuestName(event.currentTarget.value)}
            error={fieldErrors.guestName}
          />
          <TextInput
            label="Контакт"
            placeholder="email, телефон или telegram"
            required
            value={guestContact}
            onChange={(event) => setGuestContact(event.currentTarget.value)}
            error={fieldErrors.guestContact}
          />

          {availability && (
            <Alert
              color={availability.available ? 'green' : 'red'}
              title={availability.available ? 'Слот доступен' : 'Слот недоступен'}
            >
              {availabilityReasonLabel ?? (availability.available ? 'Можно бронировать.' : '')}
            </Alert>
          )}

          {submitError && (
            <Alert color="red">{submitError}</Alert>
          )}

          {fieldErrors.time && <Alert color="red">{fieldErrors.time}</Alert>}

          <Group justify="space-between" gap="sm" wrap="wrap">
            <Button
              variant="subtle"
              onClick={handleCheckAvailability}
              loading={checkAvailabilityMutation.isPending}
              disabled={!slot}
            >
              Проверить доступность
            </Button>
            <Button
              onClick={handleSubmit}
              loading={createBookingMutation.isPending}
              disabled={!guestName.trim() || !guestContact.trim() || !slot}
            >
              Забронировать
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}