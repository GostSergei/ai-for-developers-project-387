import re
from datetime import date, datetime, time, timedelta

from fastapi import HTTPException

from app.schemas import (
    AdminDaySlots,
    AdminSlot,
    AvailabilityRequest,
    AvailabilityResponse,
    Booking,
    BookingInfo,
    BookingRequest,
    DaySlots,
    EventType,
    EventTypeInput,
    Slot,
    ValidationErrorItem,
)
from app.store import Store

WORK_START = time(8, 0)
WORK_END = time(20, 0)
GRID_MINUTES = 30
BOOKING_WINDOW_DAYS = 14

TIME_RE = re.compile(r"^([01]\d|2[0-3]):([0-5]\d)$")


def day_cells(d: date) -> list[datetime]:
    cells = []
    t = datetime.combine(d, WORK_START)
    end = datetime.combine(d, WORK_END)
    while t < end:
        cells.append(t)
        t += timedelta(minutes=GRID_MINUTES)
    return cells


def is_within_window(d: date, now: datetime) -> bool:
    today = now.date()
    last_day = today + timedelta(days=BOOKING_WINDOW_DAYS - 1)
    return today <= d <= last_day


def parse_time(value: str) -> time | None:
    if not TIME_RE.match(value):
        return None
    hours, minutes = value.split(":")
    return time(int(hours), int(minutes))


def overlaps(existing: Booking, new_start: datetime, new_end: datetime) -> bool:
    return existing.startsAt < new_end and new_start < existing.endsAt


def booking_for_cell(cell_start: datetime, bookings: list[Booking]) -> Booking | None:
    for booking in bookings:
        if booking.startsAt <= cell_start < booking.endsAt:
            return booking
    return None


def validate_event_type_input(data: EventTypeInput) -> list[ValidationErrorItem]:
    errors = []

    if data.id is None:
        errors.append(ValidationErrorItem(field="id", message="Field is required"))
    elif not data.id.strip():
        errors.append(ValidationErrorItem(field="id", message="Field must not be empty"))
    elif len(data.id) > 50:
        errors.append(ValidationErrorItem(field="id", message="Must be at most 50 characters"))

    if data.name is None:
        errors.append(ValidationErrorItem(field="name", message="Field is required"))
    elif not data.name.strip():
        errors.append(ValidationErrorItem(field="name", message="Field must not be empty"))
    elif len(data.name) > 100:
        errors.append(ValidationErrorItem(field="name", message="Must be at most 100 characters"))

    if data.duration is None:
        errors.append(ValidationErrorItem(field="duration", message="Field is required"))
    elif data.duration <= 0:
        errors.append(ValidationErrorItem(field="duration", message="Must be a positive number"))
    elif data.duration % GRID_MINUTES != 0:
        errors.append(
            ValidationErrorItem(field="duration", message="Must be a multiple of 30")
        )

    if data.description is not None and len(data.description) > 1000:
        errors.append(
            ValidationErrorItem(field="description", message="Must be at most 1000 characters")
        )

    return errors


def create_event_type(store: Store, data: EventTypeInput) -> EventType:
    errors = validate_event_type_input(data)
    if errors:
        raise HTTPException(422, {"errors": [e.model_dump() for e in errors]})

    if data.id in store.event_types:
        raise HTTPException(409, {"error": "Event type with this id already exists"})

    return store.add_event_type(
        EventType(
            id=data.id,
            name=data.name,
            description=data.description,
            duration=data.duration,
        )
    )


def get_day_slots(store: Store, d: date, event_type_id: str, now: datetime) -> DaySlots:
    event_type = store.event_type(event_type_id)
    if event_type is None:
        raise HTTPException(404, {"error": "Event type not found"})
    if not is_within_window(d, now):
        raise HTTPException(404, {"error": "Date is out of booking window"})

    work_end = datetime.combine(d, WORK_END)
    slots = []
    for cell in day_cells(d):
        if cell <= now:
            continue
        if booking_for_cell(cell, store.bookings) is not None:
            slots.append(Slot(startsAt=cell, status="booked"))
            continue
        candidate_end = cell + timedelta(minutes=event_type.duration)
        if candidate_end > work_end:
            continue
        if any(overlaps(existing, cell, candidate_end) for existing in store.bookings):
            continue
        slots.append(Slot(startsAt=cell, status="free"))

    return DaySlots(date=d, eventType=event_type, slots=slots)


def get_admin_day_slots(store: Store, d: date, now: datetime) -> AdminDaySlots:
    if not is_within_window(d, now):
        raise HTTPException(404, {"error": "Date is out of booking window"})

    slots = []
    for cell in day_cells(d):
        booking = booking_for_cell(cell, store.bookings)
        if booking is None:
            slots.append(AdminSlot(startsAt=cell, status="free"))
        else:
            slots.append(
                AdminSlot(
                    startsAt=cell,
                    status="booked",
                    booking=BookingInfo(
                        id=booking.id,
                        eventType=store.event_type(booking.eventTypeId),
                        guestName=booking.guestName,
                        guestContact=booking.guestContact,
                    ),
                )
            )

    return AdminDaySlots(date=d, slots=slots)


def availability(
    store: Store, d: date, data: AvailabilityRequest, now: datetime
) -> AvailabilityResponse:
    event_type = store.event_type(data.eventTypeId or "")
    if event_type is None:
        raise HTTPException(404, {"error": "Event type not found"})

    if not is_within_window(d, now):
        return AvailabilityResponse(available=False, reason="out-of-window")

    parsed = parse_time(data.time or "")
    if parsed is None or parsed.minute % GRID_MINUTES != 0:
        return AvailabilityResponse(available=False, reason="invalid-grid")

    starts_at = datetime.combine(d, parsed)
    ends_at = starts_at + timedelta(minutes=event_type.duration)

    if starts_at < datetime.combine(d, WORK_START) or ends_at > datetime.combine(d, WORK_END):
        return AvailabilityResponse(available=False, reason="out-of-hours")

    if starts_at <= now:
        return AvailabilityResponse(available=False, reason="already-passed")

    for existing in store.bookings:
        if overlaps(existing, starts_at, ends_at):
            return AvailabilityResponse(available=False, reason="booked")

    return AvailabilityResponse(available=True)


def build_booking(store: Store, d: date, data: BookingRequest, now: datetime) -> Booking:
    event_type = store.event_type(data.eventTypeId or "")
    if event_type is None:
        raise HTTPException(404, {"error": "Event type not found"})

    errors = []
    for field in ("time", "eventTypeId", "guestName", "guestContact"):
        value = getattr(data, field)
        if value is None:
            errors.append(ValidationErrorItem(field=field, message="Field is required"))
        elif not value.strip():
            errors.append(ValidationErrorItem(field=field, message="Field must not be empty"))
    if errors:
        raise HTTPException(422, {"errors": [e.model_dump() for e in errors]})

    if not is_within_window(d, now):
        raise HTTPException(
            422, {"errors": [{"field": "date", "message": "Date is out of booking window"}]}
        )

    parsed = parse_time(data.time)
    if parsed is None:
        raise HTTPException(
            422, {"errors": [{"field": "time", "message": "Time must be in HH:MM format"}]}
        )
    if parsed.minute % GRID_MINUTES != 0:
        raise HTTPException(
            422,
            {"errors": [{"field": "time", "message": "Time must fall on a 30-minute grid boundary"}]},
        )

    starts_at = datetime.combine(d, parsed)
    ends_at = starts_at + timedelta(minutes=event_type.duration)

    if starts_at < datetime.combine(d, WORK_START) or ends_at > datetime.combine(d, WORK_END):
        raise HTTPException(
            422,
            {
                "errors": [
                    {"field": "time", "message": "Meeting must fit within working hours 08:00-20:00"}
                ]
            },
        )

    if starts_at <= now:
        raise HTTPException(
            422, {"errors": [{"field": "time", "message": "Slot start time has already passed"}]}
        )

    for existing in store.bookings:
        if overlaps(existing, starts_at, ends_at):
            raise HTTPException(409, {"error": "Slot is already booked"})

    return store.add_booking(
        Booking(
            id=store.next_booking_id,
            eventTypeId=event_type.id,
            eventTypeName=event_type.name,
            duration=event_type.duration,
            guestName=data.guestName.strip(),
            guestContact=data.guestContact.strip(),
            startsAt=starts_at,
            endsAt=ends_at,
        )
    )


def get_meetings(store: Store, now: datetime) -> list[Booking]:
    start_of_today = datetime.combine(now.date(), time.min)
    return sorted(
        (booking for booking in store.bookings if booking.startsAt >= start_of_today),
        key=lambda booking: booking.startsAt,
    )