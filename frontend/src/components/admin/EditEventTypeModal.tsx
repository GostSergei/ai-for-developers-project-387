import { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { EventType, EventTypeInputUpdate } from '../../api/types';
import { useUpdateEventType } from '../../api/endpoints';
import { ApiError, isValidationError } from '../../api/client';
import { durationLabels } from '../../lib/date';

interface EditEventTypeModalProps {
  eventType: EventType | null;
  onClose: () => void;
}

export function EditEventTypeModal({ eventType, onClose }: EditEventTypeModalProps) {
  const opened = eventType !== null;

  const updateEventTypeMutation = useUpdateEventType();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState('30');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (eventType) {
      setName(eventType.name);
      setDescription(eventType.description ?? '');
      setDuration(String(eventType.duration));
      setFieldErrors({});
      setSubmitError(null);
      updateEventTypeMutation.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventType]);

  const handleSubmit = async () => {
    if (!eventType) return;
    setSubmitError(null);
    setFieldErrors({});
    try {
      const body: EventTypeInputUpdate = {
        name: name.trim(),
        description: description.trim() || undefined,
        duration: Number(duration),
      };
      const updated = await updateEventTypeMutation.mutateAsync({ id: eventType.id, body });
      notifications.show({
        title: 'Тип события обновлён',
        message: `${updated.name} · ${updated.duration} мин`,
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
      } else if (error instanceof ApiError && error.status === 404) {
        setSubmitError('Тип события не найден.');
      } else if (error instanceof Error) {
        setSubmitError(error.message);
      }
    }
  };

  return (
    <Modal opened={opened} onClose={onClose} title={eventType ? `Изменить тип «${eventType.id}»` : ''} centered>
      {eventType && (
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            ID изменить нельзя. Обновите название, описание или длительность.
          </Text>

          <TextInput label="ID" value={eventType.id} readOnly />
          <TextInput
            label="Название"
            required
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            error={fieldErrors.name}
          />
          <Textarea
            label="Описание"
            autosize
            minRows={2}
            value={description}
            onChange={(event) => setDescription(event.currentTarget.value)}
            error={fieldErrors.description}
          />
          <Select
            label="Длительность"
            required
            data={durationLabels.map((value) => ({
              value: String(value),
              label: `${value} мин`,
            }))}
            value={duration}
            onChange={(value) => setDuration(value ?? '')}
            error={fieldErrors.duration}
          />

          {submitError && <Alert color="red">{submitError}</Alert>}

          <Group justify="flex-end" gap="sm">
            <Button variant="subtle" onClick={onClose}>
              Отмена
            </Button>
            <Button onClick={handleSubmit} loading={updateEventTypeMutation.isPending}>
              Сохранить
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
