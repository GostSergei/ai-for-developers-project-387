import os
from pathlib import Path
from threading import Lock

import yaml

from app.schemas import Booking, EventType

DEFAULT_DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "store.yaml"


class Store:
    def __init__(self, data_file: str | Path | None = None) -> None:
        self.data_file = Path(data_file) if data_file is not None else None
        self._lock = Lock()
        self.event_types: dict[str, EventType] = {}
        self.bookings: list[Booking] = []
        self._next_booking_id = 1
        self._load()

    def _load(self) -> None:
        if self.data_file is None or not self.data_file.exists():
            return
        with self.data_file.open(encoding="utf-8") as handle:
            raw = yaml.safe_load(handle) or {}
        self.event_types = {
            key: EventType.model_validate(value)
            for key, value in raw.get("event_types", {}).items()
        }
        self.bookings = [
            Booking.model_validate(value) for value in raw.get("bookings", [])
        ]
        self._next_booking_id = max((b.id for b in self.bookings), default=0) + 1

    def _save(self) -> None:
        if self.data_file is None:
            return
        data = {
            "event_types": {
                key: value.model_dump(mode="json")
                for key, value in self.event_types.items()
            },
            "bookings": [value.model_dump(mode="json") for value in self.bookings],
        }
        self.data_file.parent.mkdir(parents=True, exist_ok=True)
        tmp_file = self.data_file.with_suffix(".tmp")
        with tmp_file.open("w", encoding="utf-8") as handle:
            yaml.safe_dump(
                data,
                handle,
                allow_unicode=True,
                sort_keys=False,
                default_flow_style=False,
            )
        os.replace(tmp_file, self.data_file)

    def event_type(self, event_type_id: str) -> EventType | None:
        return self.event_types.get(event_type_id)

    def add_event_type(self, event_type: EventType) -> EventType:
        with self._lock:
            self.event_types[event_type.id] = event_type
            self._save()
        return event_type

    @property
    def next_booking_id(self) -> int:
        return self._next_booking_id

    def add_booking(self, booking: Booking) -> Booking:
        with self._lock:
            booking.id = self._next_booking_id
            self._next_booking_id += 1
            self.bookings.append(booking)
            self._save()
        return booking