from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict

SlotStatus = Literal["free", "booked"]

AvailabilityReason = Literal[
    "booked",
    "out-of-window",
    "out-of-hours",
    "invalid-grid",
    "already-passed",
]


class EventType(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    duration: int


class EventTypeInput(BaseModel):
    model_config = ConfigDict(strict=True)

    id: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    duration: Optional[int] = None


class Slot(BaseModel):
    startsAt: datetime
    status: SlotStatus


class BookingInfo(BaseModel):
    id: int
    eventType: EventType
    guestName: str
    guestContact: str


class AdminSlot(BaseModel):
    startsAt: datetime
    status: SlotStatus
    booking: Optional[BookingInfo] = None


class Booking(BaseModel):
    id: int
    eventTypeId: str
    eventTypeName: str
    duration: int
    guestName: str
    guestContact: str
    startsAt: datetime
    endsAt: datetime


class DaySlots(BaseModel):
    date: date
    eventType: EventType
    slots: list[Slot]


class AdminDaySlots(BaseModel):
    date: date
    slots: list[AdminSlot]


class BookingsList(BaseModel):
    bookings: list[Booking]


class AvailabilityRequest(BaseModel):
    model_config = ConfigDict(strict=True)

    time: Optional[str] = None
    eventTypeId: Optional[str] = None


class AvailabilityResponse(BaseModel):
    available: bool
    reason: Optional[AvailabilityReason] = None


class BookingRequest(BaseModel):
    model_config = ConfigDict(strict=True)

    time: Optional[str] = None
    eventTypeId: Optional[str] = None
    guestName: Optional[str] = None
    guestContact: Optional[str] = None


class ValidationErrorItem(BaseModel):
    field: str
    message: str


class ValidationError(BaseModel):
    errors: list[ValidationErrorItem]


class ErrorResponse(BaseModel):
    error: str