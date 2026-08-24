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
import { useAdminMeetings, useDeleteBooking } from '../../api/endpoints';
import type { Booking } from '../../api/types';
import { isNotFoundError } from '../../api/client';
import { formatDateTime, formatTime } from '../../lib/date';
import { EditBookingModal } from '../../components/admin/EditBookingModal';

export function DashboardPage() {
  const { data, isPending, isError, error } = useAdminMeetings();
  const deleteBookingMutation = useDeleteBooking();

  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [bookingToDelete, setBookingToDelete] = useState<Booking | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!bookingToDelete) return;
    setDeleteError(null);
    try {
      await deleteBookingMutation.mutateAsync(bookingToDelete.id);
      notifications.show({
        title: 'Встреча отменена',
        message: `#${bookingToDelete.id} · ${formatDateTime(new Date(bookingToDelete.startsAt))}`,
        color: 'green',
      });
      setBookingToDelete(null);
    } catch (error) {
      if (isNotFoundError(error)) {
        setDeleteError('Встреча уже удалена. Обновите список.');
      } else if (error instanceof Error) {
        setDeleteError(error.message);
      }
    }
  };

  return (
    <Stack gap="md">
      <Title order={2}>Встречи</Title>

      {isPending && (
        <Stack gap="xs">
          <Skeleton height={40} />
          <Skeleton height={40} />
          <Skeleton height={40} />
        </Stack>
      )}

      {isError && (
        <Alert color="red" title="Не удалось загрузить встречи">
          {error instanceof Error ? error.message : 'Попробуйте позже.'}
        </Alert>
      )}

      {data && data.bookings.length === 0 && (
        <Alert color="gray" title="Нет встреч">
          Встречи на сегодня и ближайшие дни появятся здесь.
        </Alert>
      )}

      {data && data.bookings.length > 0 && (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Время</Table.Th>
              <Table.Th>Тип события</Table.Th>
              <Table.Th>Длительность</Table.Th>
              <Table.Th>Гость</Table.Th>
              <Table.Th>Контакт</Table.Th>
              <Table.Th>Действия</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.bookings.map((booking) => (
              <Table.Tr key={booking.id}>
                <Table.Td>
                  <Group gap="xs">
                    <Badge variant="light">{formatTime(new Date(booking.startsAt))}</Badge>
                    <Text size="sm" c="dimmed">
                      {formatDateTime(new Date(booking.startsAt))}
                    </Text>
                  </Group>
                </Table.Td>
                <Table.Td>{booking.eventTypeName}</Table.Td>
                <Table.Td>{booking.duration} мин</Table.Td>
                <Table.Td>{booking.guestName}</Table.Td>
                <Table.Td>{booking.guestContact}</Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <ActionIcon
                      variant="light"
                      color="blue"
                      aria-label={`Изменить встречу #${booking.id}`}
                      onClick={() => setEditingBooking(booking)}
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="light"
                      color="red"
                      aria-label={`Отменить встречу #${booking.id}`}
                      onClick={() => {
                        setDeleteError(null);
                        setBookingToDelete(booking);
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

      <EditBookingModal booking={editingBooking} onClose={() => setEditingBooking(null)} />

      <Modal
        opened={bookingToDelete !== null}
        onClose={() => setBookingToDelete(null)}
        title="Отменить встречу"
        centered
      >
        {bookingToDelete && (
          <Stack gap="md">
            <Text>
              Отменить встречу <b>#{bookingToDelete.id}</b> · {bookingToDelete.eventTypeName} ·{' '}
              {formatDateTime(new Date(bookingToDelete.startsAt))} с {bookingToDelete.guestName}?
            </Text>

            {deleteError && <Alert color="red">{deleteError}</Alert>}

            <Group justify="flex-end" gap="sm">
              <Button variant="subtle" onClick={() => setBookingToDelete(null)}>
                Нет
              </Button>
              <Button color="red" onClick={handleDelete} loading={deleteBookingMutation.isPending}>
                Отменить
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
