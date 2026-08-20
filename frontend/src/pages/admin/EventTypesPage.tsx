import { Alert, Badge, Skeleton, Stack, Table, Title } from '@mantine/core';
import { useEventTypes } from '../../api/endpoints';

export function EventTypesPage() {
  const { data, isPending, isError, error } = useEventTypes();

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
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}