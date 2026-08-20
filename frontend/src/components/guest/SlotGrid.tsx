import { Badge, Button, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import type { Slot } from '../../api/types';
import { formatTime } from '../../lib/date';

interface SlotGridProps {
  slots: Slot[];
  duration: number;
  onSelect: (slot: Slot) => void;
}

export function SlotGrid({ slots, duration, onSelect }: SlotGridProps) {
  const freeSlots = slots.filter((slot) => slot.status === 'free');
  const bookedSlots = slots.filter((slot) => slot.status === 'booked');

  return (
    <Stack gap="md">
      <div>
        <Text fw={600} mb={8}>
          Свободные слоты ({freeSlots.length}) · {duration} мин
        </Text>
        {freeSlots.length === 0 ? (
          <Text c="dimmed" size="sm">
            На этот день свободных слотов нет.
          </Text>
        ) : (
          <SimpleGrid cols={{ base: 2, xs: 3, sm: 4, md: 5 }}>
            {freeSlots.map((slot) => (
              <Button key={slot.startsAt} variant="light" onClick={() => onSelect(slot)}>
                {formatTime(new Date(slot.startsAt))}
              </Button>
            ))}
          </SimpleGrid>
        )}
      </div>

      {bookedSlots.length > 0 && (
        <div>
          <Text fw={600} mb={8}>
            Занятые
          </Text>
          <Group gap="xs">
            {bookedSlots.map((slot) => (
              <Badge key={slot.startsAt} color="gray" variant="light" size="lg">
                {formatTime(new Date(slot.startsAt))}
              </Badge>
            ))}
          </Group>
        </div>
      )}
    </Stack>
  );
}