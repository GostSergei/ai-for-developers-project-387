import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminDaySlots,
  AvailabilityRequest,
  AvailabilityResponse,
  Booking,
  BookingRequest,
  BookingUpdate,
  BookingsList,
  DaySlots,
  EventType,
  EventTypeInput,
  EventTypeInputUpdate,
} from './types';
import { apiRequest } from './client';

// ---------- Raw API functions ----------

export async function getEventTypes(): Promise<EventType[]> {
  return apiRequest<EventType[]>('/event-types');
}

export async function getGuestDaySlots(date: string, eventType: string): Promise<DaySlots> {
  return apiRequest<DaySlots>(`/guest/${date}`, { query: { eventType } });
}

export async function checkAvailability(date: string, body: AvailabilityRequest): Promise<AvailabilityResponse> {
  return apiRequest<AvailabilityResponse>(`/guest/${date}/availability`, { method: 'POST', body });
}

export async function createBooking(date: string, body: BookingRequest): Promise<Booking> {
  return apiRequest<Booking>(`/guest/${date}/booking`, { method: 'POST', body });
}

export async function updateBooking(id: number, body: BookingUpdate): Promise<Booking> {
  return apiRequest<Booking>(`/admin/bookings/${id}`, { method: 'PATCH', body });
}

export async function deleteBooking(id: number): Promise<void> {
  return apiRequest<void>(`/admin/bookings/${id}`, { method: 'DELETE' });
}

export async function getAdminMeetings(): Promise<BookingsList> {
  return apiRequest<BookingsList>('/admin');
}

export async function getAdminDaySlots(date: string): Promise<AdminDaySlots> {
  return apiRequest<AdminDaySlots>(`/admin/${date}`);
}

export async function createEventType(body: EventTypeInput): Promise<EventType> {
  return apiRequest<EventType>('/admin/event-types', { method: 'POST', body });
}

export async function updateEventType(id: string, body: EventTypeInputUpdate): Promise<EventType> {
  return apiRequest<EventType>(`/admin/event-types/${id}`, { method: 'PATCH', body });
}

export async function deleteEventType(id: string): Promise<void> {
  return apiRequest<void>(`/admin/event-types/${id}`, { method: 'DELETE' });
}

// ---------- React Query hooks ----------

export function useEventTypes() {
  return useQuery({
    queryKey: ['event-types'],
    queryFn: getEventTypes,
  });
}

export function useGuestDaySlots(date: string | undefined, eventTypeId: string | undefined) {
  return useQuery({
    queryKey: ['guest-slots', date, eventTypeId],
    queryFn: () => getGuestDaySlots(date!, eventTypeId!),
    enabled: Boolean(date && eventTypeId),
  });
}

export function useAdminMeetings() {
  return useQuery({
    queryKey: ['admin-meetings'],
    queryFn: getAdminMeetings,
  });
}

export function useAdminDaySlots(date: string | undefined) {
  return useQuery({
    queryKey: ['admin-day', date],
    queryFn: () => getAdminDaySlots(date!),
    enabled: Boolean(date),
  });
}

export function useCheckAvailability() {
  return useMutation({
    mutationFn: ({ date, body }: { date: string; body: AvailabilityRequest }) => checkAvailability(date, body),
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ date, body }: { date: string; body: BookingRequest }) => createBooking(date, body),
    onSuccess: (_booking, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['guest-slots', variables.date] });
      void queryClient.invalidateQueries({ queryKey: ['admin-meetings'] });
    },
  });
}

export function useCreateEventType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createEventType,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['event-types'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-meetings'] });
    },
  });
}

export function useUpdateEventType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: EventTypeInputUpdate }) => updateEventType(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['event-types'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-meetings'] });
    },
  });
}

export function useDeleteEventType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteEventType(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['event-types'] });
      void queryClient.invalidateQueries({ queryKey: ['admin-meetings'] });
    },
  });
}

export function useUpdateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: BookingUpdate }) => updateBooking(id, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-meetings'] });
    },
  });
}

export function useDeleteBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteBooking(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-meetings'] });
    },
  });
}