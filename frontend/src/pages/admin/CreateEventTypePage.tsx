import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Button,
  Select,
  Stack,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useCreateEventType } from '../../api/endpoints';
import { isConflictError, isValidationError } from '../../api/client';
import { durationLabels } from '../../lib/date';

interface FormState {
  id: string;
  name: string;
  description: string;
  duration: string;
}

const EMPTY: FormState = { id: '', name: '', description: '', duration: '30' };

export function CreateEventTypePage() {
  const navigate = useNavigate();
  const createEventTypeMutation = useCreateEventType();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const setField = (field: keyof FormState) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!(field in prev)) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.id.trim()) errors.id = 'Обязательное поле';
    else if (form.id.length > 50) errors.id = 'Не более 50 символов';
    if (!form.name.trim()) errors.name = 'Обязательное поле';
    else if (form.name.length > 100) errors.name = 'Не более 100 символов';
    if (form.description.length > 1000) errors.description = 'Не более 1000 символов';
    const duration = Number(form.duration);
    if (!Number.isInteger(duration) || duration <= 0 || duration % 30 !== 0) {
      errors.duration = 'Длительность должна быть кратна 30 минутам';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    if (!validate()) return;

    try {
      const created = await createEventTypeMutation.mutateAsync({
        id: form.id.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        duration: Number(form.duration),
      });
      notifications.show({
        title: 'Тип события создан',
        message: `${created.name} · ${created.duration} мин`,
        color: 'green',
      });
      navigate('/admin');
    } catch (error) {
      if (isValidationError(error)) {
        const errors: Record<string, string> = {};
        for (const item of error.payload.errors) {
          errors[item.field] = item.message;
        }
        setFieldErrors(errors);
      } else if (isConflictError(error)) {
        setSubmitError('Тип события с таким id уже существует.');
      } else if (error instanceof Error) {
        setSubmitError(error.message);
      }
    }
  };

  return (
    <Stack gap="md" maw={480}>
      <Title order={2}>Новый тип события</Title>

      {submitError && <Alert color="red">{submitError}</Alert>}

      <TextInput
        label="ID"
        description="Уникальный идентификатор, например consultation"
        required
        value={form.id}
        onChange={(event) => setField('id')(event.currentTarget.value)}
        error={fieldErrors.id}
      />
      <TextInput
        label="Название"
        required
        value={form.name}
        onChange={(event) => setField('name')(event.currentTarget.value)}
        error={fieldErrors.name}
      />
      <Textarea
        label="Описание"
        autosize
        minRows={2}
        value={form.description}
        onChange={(event) => setField('description')(event.currentTarget.value)}
        error={fieldErrors.description}
      />
      <Select
        label="Длительность"
        required
        data={durationLabels.map((value) => ({
          value: String(value),
          label: `${value} мин`,
        }))}
        value={form.duration}
        onChange={(value) => setField('duration')(value ?? '')}
        error={fieldErrors.duration}
      />

      <Button onClick={handleSubmit} loading={createEventTypeMutation.isPending}>
        Создать
      </Button>
    </Stack>
  );
}