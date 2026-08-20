import { Alert, Badge, Group, Skeleton, Stack, Table, Text, Title } from '@mantine/core';
import { useAdminMeetings } from '../../api/endpoints';
import { formatDateTime, formatTime } from '../../lib/date';

export function DashboardPage() {
  const { data, isPending, isError, error } = useAdminMeetings();

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
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}