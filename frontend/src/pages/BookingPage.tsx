import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Badge,
  Box,
  Container,
  Grid,
  Group,
  Select,
  Skeleton,
  Stack,
  Text,
  Title,
} from '@mantine/core';
import { DatePicker } from '@mantine/dates';
import { useEventTypes, useGuestDaySlots } from '../api/endpoints';
import type { Slot } from '../api/types';
import { isNotFoundError } from '../api/client';
import { buildBookingWindow, formatDateKey, formatDateLong, todayKey } from '../lib/date';
import { SlotGrid } from '../components/guest/SlotGrid';
import { BookingModal } from '../components/guest/BookingModal';

export function BookingPage() {
  const { eventTypeId } = useParams();
  const navigate = useNavigate();

  const windowDates = useMemo(() => buildBookingWindow(), []);
  const minDate = windowDates[0];
  const maxDate = windowDates[windowDates.length - 1];

  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(eventTypeId ?? null);
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey());
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  useEffect(() => {
    if (eventTypeId) {
      setSelectedTypeId(eventTypeId);
      setSelectedSlot(null);
    }
  }, [eventTypeId]);

  const eventTypesQuery = useEventTypes();
  const daySlotsQuery = useGuestDaySlots(selectedDateKey, selectedTypeId ?? undefined);

  useEffect(() => {
    const types = eventTypesQuery.data;
    if (types && types.length > 0 && selectedTypeId === null) {
      setSelectedTypeId(types[0].id);
    }
  }, [eventTypesQuery.data, selectedTypeId]);

  const eventType = eventTypesQuery.data?.find((item) => item.id === selectedTypeId) ?? null;
  const notFound = eventTypesQuery.isSuccess && selectedTypeId !== null && !eventType;

  const selectedDate = useMemo(
    () => windowDates.find((d) => formatDateKey(d) === selectedDateKey) ?? windowDates[0],
    [windowDates, selectedDateKey],
  );

  const selectData = (eventTypesQuery.data ?? []).map((item) => ({
    value: item.id,
    label: `${item.name} · ${item.duration} мин`,
  }));

  return (
    <Container size="md" py="xl">
      <Stack gap="lg">
        <div>
          <Title order={1}>Календарь звонков</Title>
          <Text c="dimmed" mt={4}>
            Выберите тип события, затем день и свободный слот. Без регистрации, на ближайшие 14 дней.
          </Text>
        </div>

        <Select
          label="Тип события"
          placeholder={eventTypesQuery.isPending ? 'Загрузка…' : 'Выберите тип события'}
          data={selectData}
          value={selectedTypeId}
          onChange={(value) => {
            if (value) navigate(`/booking/${value}`);
          }}
          searchable
          nothingFoundMessage="Нет доступных типов"
        />

        {eventTypesQuery.isPending && <Skeleton height={240} radius="md" />}

        {eventTypesQuery.isError && (
          <Alert color="red" title="Не удалось загрузить типы событий">
            {eventTypesQuery.error instanceof Error
              ? eventTypesQuery.error.message
              : 'Попробуйте позже.'}
          </Alert>
        )}

        {eventTypesQuery.isSuccess && eventTypesQuery.data.length === 0 && (
          <Alert color="gray" title="Пока нет доступных типов событий">
            Владелец ещё не настроил календарь.
          </Alert>
        )}

        {notFound && (
          <Alert color="red" title="Тип события не найден">
            Такой тип события не существует. Выберите другой.
          </Alert>
        )}

        {eventType && (
          <>
            <Grid align="flex-start">
              <Grid.Col span={{ base: 12, sm: 6 }}>
                <div>
                  <Group gap="sm" align="center">
                    <Title order={2}>{eventType.name}</Title>
                    <Badge variant="light">{eventType.duration} мин</Badge>
                  </Group>
                  {eventType.description && (
                    <Text c="dimmed" mt={4}>
                      {eventType.description}
                    </Text>
                  )}
                </div>

                <DatePicker
                  mt="lg"
                  value={selectedDateKey}
                  onChange={(value) => {
                    if (!value) return;
                    setSelectedDateKey(value);
                    setSelectedSlot(null);
                  }}
                  minDate={minDate}
                  maxDate={maxDate}
                  defaultDate={minDate}
                  getDayAriaLabel={(date) => formatDateKey(new Date(date))}
                />
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6 }}>
                <Text fw={600}>{formatDateLong(selectedDate)}</Text>

                {daySlotsQuery.isPending && (
                  <Stack gap="sm" mt="md">
                    <Skeleton height={36} />
                    <Skeleton height={36} />
                  </Stack>
                )}

                {daySlotsQuery.isError && (
                  <Alert color="red" title="Не удалось загрузить слоты" mt="md">
                    {isNotFoundError(daySlotsQuery.error)
                      ? 'Дата вне окна бронирования или тип события не найден.'
                      : daySlotsQuery.error.message}
                  </Alert>
                )}

                {daySlotsQuery.data && (
                  <Box mt="md">
                    <SlotGrid
                      slots={daySlotsQuery.data.slots}
                      duration={eventType.duration}
                      onSelect={(slot) => setSelectedSlot(slot)}
                    />
                  </Box>
                )}
              </Grid.Col>
            </Grid>

            <BookingModal
              opened={selectedSlot !== null}
              onClose={() => setSelectedSlot(null)}
              date={selectedDate}
              slot={selectedSlot}
              eventType={eventType}
            />
          </>
        )}
      </Stack>
    </Container>
  );
}