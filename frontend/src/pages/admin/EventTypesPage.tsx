import { useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  Skeleton,
  Stack,
  Table,
  Text,
  Title,
} from '@mantine/core';
import { IconEdit, IconTrash } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useDeleteEventType, useEventTypes } from '../../api/endpoints';
import type { EventType } from '../../api/types';
import { isConflictError, isNotFoundError } from '../../api/client';
import { EditEventTypeModal } from '../../components/admin/EditEventTypeModal';

export function EventTypesPage() {
  const { data, isPending, isError, error } = useEventTypes();
  const deleteEventTypeMutation = useDeleteEventType();

  const [editingType, setEditingType] = useState<EventType | null>(null);
  const [typeToDelete, setTypeToDelete] = useState<EventType | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!typeToDelete) return;
    setDeleteError(null);
    try {
      await deleteEventTypeMutation.mutateAsync(typeToDelete.id);
      notifications.show({
        title: 'Тип события удалён',
        message: `«${typeToDelete.name}» удалён.`,
        color: 'green',
      });
      setTypeToDelete(null);
    } catch (error) {
      if (isConflictError(error)) {
        setDeleteError('Нельзя удалить: у этого типа события есть брони.');
      } else if (isNotFoundError(error)) {
        setDeleteError('Тип события уже удалён. Обновите список.');
      } else if (error instanceof Error) {
        setDeleteError(error.message);
      }
    }
  };

  return (
    <Stack gap="md">
      <Title order={2}>Типы событий</Title>

      {isPending && (
        <Stack gap="xs">
          <Skeleton height={40} />
          <Skeleton height={40} />
          <Skeleton height={40} />
        </Stack>
      )}

      {isError && (
        <Alert color="red" title="Не удалось загрузить типы событий">
          {error instanceof Error ? error.message : 'Попробуйте позже.'}
        </Alert>
      )}

      {data && data.length === 0 && (
        <Alert color="gray" title="Пока нет типов событий">
          Создайте первый тип события, чтобы гости могли записаться.
        </Alert>
      )}

      {data && data.length > 0 && (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>ID</Table.Th>
              <Table.Th>Название</Table.Th>
              <Table.Th>Длительность</Table.Th>
              <Table.Th>Описание</Table.Th>
              <Table.Th>Действия</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.map((type) => (
              <Table.Tr key={type.id}>
                <Table.Td>
                  <Badge variant="light" size="md">
                    {type.id}
                  </Badge>
                </Table.Td>
                <Table.Td>{type.name}</Table.Td>
                <Table.Td>{type.duration} мин</Table.Td>
                <Table.Td>{type.description || '—'}</Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon
                      variant="light"
                      color="blue"
                      aria-label={`Изменить тип «${type.id}»`}
                      onClick={() => setEditingType(type)}
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="light"
                      color="red"
                      aria-label={`Удалить тип «${type.id}»`}
                      onClick={() => {
                        setDeleteError(null);
                        setTypeToDelete(type);
                      }}
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <EditEventTypeModal eventType={editingType} onClose={() => setEditingType(null)} />

      <Modal
        opened={typeToDelete !== null}
        onClose={() => setTypeToDelete(null)}
        title="Удалить тип события"
        centered
      >
        {typeToDelete && (
          <Stack gap="md">
            <Text>
              Удалить тип события <b>«{typeToDelete.name}»</b> ({typeToDelete.id})? Брони этого типа также нельзя
              будет создать.
            </Text>

            {deleteError && <Alert color="red">{deleteError}</Alert>}

            <Group justify="flex-end" gap="sm">
              <Button variant="subtle" onClick={() => setTypeToDelete(null)}>
                Нет
              </Button>
              <Button color="red" onClick={handleDelete} loading={deleteEventTypeMutation.isPending}>
                Удалить
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
