from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.schemas import Booking, EventType
from app.store import Store

FIXED_NOW = datetime(2026, 8, 18, 12, 0, 0)


def test_store_persists_to_yaml(tmp_path):
    data_file = tmp_path / "store.yaml"
    first = Store(data_file=data_file)
    first.add_event_type(EventType(id="consultation", name="Консультация", duration=30))
    booking = first.add_booking(
        Booking(
            id=first.next_booking_id,
            eventTypeId="consultation",
            eventTypeName="Консультация",
            duration=30,
            guestName="Иван Петров",
            guestContact="ivan@example.com",
            startsAt=datetime(2026, 8, 18, 13, 0),
            endsAt=datetime(2026, 8, 18, 13, 30),
        )
    )
    assert data_file.exists()
    content = data_file.read_text(encoding="utf-8")
    assert content.startswith("event_types:")
    assert "Иван Петров" in content

    second = Store(data_file=data_file)
    assert second.event_types["consultation"].name == "Консультация"
    assert second.bookings[0].id == booking.id
    assert second.next_booking_id == booking.id + 1


@pytest.fixture
def client():
    app = create_app(store=Store(), now_provider=lambda: FIXED_NOW)
    with TestClient(app) as test_client:
        yield test_client


def create_event_type(client, event_type_id="consultation", duration=30, name="Консультация"):
    return client.post(
        "/admin/event-types",
        json={"id": event_type_id, "name": name, "duration": duration},
    )


def create_booking(client, time="13:00", event_type_id="consultation", **kwargs):
    payload = {
        "time": time,
        "eventTypeId": event_type_id,
        "guestName": kwargs.get("guestName", "Иван Петров"),
        "guestContact": kwargs.get("guestContact", "ivan@example.com"),
    }
    return client.post("/guest/2026-08-18/booking", json=payload)


def has_field(errors, field):
    return any(item["field"] == field for item in errors)


# ---------- Event types ----------


def test_list_event_types_empty(client):
    response = client.get("/event-types")
    assert response.status_code == 200
    assert response.json() == []


def test_create_event_type(client):
    response = create_event_type(client)
    assert response.status_code == 201
    body = response.json()
    assert body == {"id": "consultation", "name": "Консультация", "duration": 30}

    listed = client.get("/event-types")
    assert listed.status_code == 200
    assert listed.json() == [body]


def test_create_event_type_conflict(client):
    create_event_type(client)
    response = create_event_type(client)
    assert response.status_code == 409
    assert response.json() == {"error": "Event type with this id already exists"}


def test_create_event_type_invalid_duration(client):
    response = create_event_type(client, duration=15)
    assert response.status_code == 422
    assert has_field(response.json()["errors"], "duration")


def test_create_event_type_zero_duration(client):
    response = create_event_type(client, duration=0)
    assert response.status_code == 422


def test_create_event_type_missing_fields(client):
    response = client.post("/admin/event-types", json={})
    assert response.status_code == 422
    fields = {item["field"] for item in response.json()["errors"]}
    assert fields == {"id", "name", "duration"}


def test_create_event_type_empty_name(client):
    response = client.post(
        "/admin/event-types", json={"id": "x", "name": "", "duration": 30}
    )
    assert response.status_code == 422


def test_create_event_type_long_id(client):
    response = client.post(
        "/admin/event-types", json={"id": "a" * 51, "name": "x", "duration": 30}
    )
    assert response.status_code == 422
    assert has_field(response.json()["errors"], "id")


def test_create_event_type_wrong_type(client):
    response = client.post(
        "/admin/event-types", json={"id": "x", "name": "y", "duration": "abc"}
    )
    assert response.status_code == 400
    assert response.json() == {"error": "Invalid request"}


# ---------- Guest day slots ----------


def test_guest_day_slots(client):
    create_event_type(client)
    response = client.get("/guest/2026-08-18", params={"eventType": "consultation"})
    assert response.status_code == 200
    body = response.json()
    assert body["date"] == "2026-08-18"
    assert body["eventType"]["id"] == "consultation"
    starts = [slot["startsAt"] for slot in body["slots"]]
    assert starts[0] == "2026-08-18T12:30:00"
    assert starts[-1] == "2026-08-18T19:30:00"
    assert all(slot["status"] == "free" for slot in body["slots"])


def test_guest_day_slots_unknown_type(client):
    response = client.get("/guest/2026-08-18", params={"eventType": "nope"})
    assert response.status_code == 404
    assert response.json() == {"error": "Event type not found"}


def test_guest_day_slots_out_of_window(client):
    create_event_type(client)
    response = client.get("/guest/2026-09-01", params={"eventType": "consultation"})
    assert response.status_code == 404
    assert response.json() == {"error": "Date is out of booking window"}


def test_guest_day_slots_marks_booked_cells(client):
    create_event_type(client)
    create_booking(client, time="13:00")
    response = client.get("/guest/2026-08-18", params={"eventType": "consultation"})
    slots = {slot["startsAt"]: slot["status"] for slot in response.json()["slots"]}
    assert slots["2026-08-18T13:00:00"] == "booked"
    assert slots["2026-08-18T13:30:00"] == "free"


def test_guest_day_slots_long_booking_covers_all_cells(client):
    create_event_type(client, duration=90)
    create_booking(client, time="13:00")
    response = client.get("/guest/2026-08-18", params={"eventType": "consultation"})
    slots = {slot["startsAt"]: slot["status"] for slot in response.json()["slots"]}
    assert slots["2026-08-18T13:00:00"] == "booked"
    assert slots["2026-08-18T13:30:00"] == "booked"
    assert slots["2026-08-18T14:00:00"] == "booked"
    assert slots["2026-08-18T14:30:00"] == "free"


def test_guest_day_slots_hourly_type_omits_tail(client):
    create_event_type(client, event_type_id="meeting", duration=60, name="Встреча")
    response = client.get("/guest/2026-08-18", params={"eventType": "meeting"})
    assert response.status_code == 200
    starts = [slot["startsAt"] for slot in response.json()["slots"]]
    assert starts[-1] == "2026-08-18T19:00:00"
    assert "2026-08-18T19:30:00" not in starts
    assert all(slot["status"] == "free" for slot in response.json()["slots"])


def test_guest_day_slots_hourly_type_skips_overlapping_cell(client):
    create_event_type(client)
    create_event_type(client, event_type_id="meeting", duration=60, name="Встреча")
    create_booking(client, time="17:00")
    response = client.get("/guest/2026-08-18", params={"eventType": "meeting"})
    assert response.status_code == 200
    slots = {slot["startsAt"]: slot["status"] for slot in response.json()["slots"]}
    assert "2026-08-18T16:30:00" not in slots
    assert slots["2026-08-18T16:00:00"] == "free"
    assert slots["2026-08-18T17:00:00"] == "booked"
    assert slots["2026-08-18T17:30:00"] == "free"


# ---------- Availability ----------


def availability(client, date="2026-08-18", **kwargs):
    payload = {"time": kwargs.get("time", "13:00"), "eventTypeId": kwargs.get("eventTypeId", "consultation")}
    return client.post(f"/guest/{date}/availability", json=payload)


def test_availability_true(client):
    create_event_type(client)
    response = availability(client, time="13:00")
    assert response.status_code == 200
    assert response.json() == {"available": True}


def test_availability_booked(client):
    create_event_type(client)
    create_booking(client, time="13:00")
    response = availability(client, time="13:00")
    assert response.status_code == 200
    assert response.json() == {"available": False, "reason": "booked"}


def test_availability_out_of_window(client):
    create_event_type(client)
    response = availability(client, date="2026-09-01", time="13:00")
    assert response.status_code == 200
    assert response.json() == {"available": False, "reason": "out-of-window"}


def test_availability_out_of_hours(client):
    create_event_type(client, duration=60)
    response = availability(client, time="19:30")
    assert response.status_code == 200
    assert response.json() == {"available": False, "reason": "out-of-hours"}


def test_availability_invalid_grid(client):
    create_event_type(client)
    response = availability(client, time="08:15")
    assert response.status_code == 200
    assert response.json() == {"available": False, "reason": "invalid-grid"}


def test_availability_malformed_time(client):
    create_event_type(client)
    response = availability(client, time="8:00")
    assert response.status_code == 200
    assert response.json() == {"available": False, "reason": "invalid-grid"}


def test_availability_already_passed(client):
    create_event_type(client)
    response = availability(client, time="11:00")
    assert response.status_code == 200
    assert response.json() == {"available": False, "reason": "already-passed"}


def test_availability_unknown_type(client):
    response = availability(client, eventTypeId="nope")
    assert response.status_code == 404
    assert response.json() == {"error": "Event type not found"}


# ---------- Booking creation ----------


def test_create_booking(client):
    create_event_type(client)
    response = create_booking(client, time="13:00")
    assert response.status_code == 201
    assert response.json() == {
        "id": 1,
        "eventTypeId": "consultation",
        "eventTypeName": "Консультация",
        "duration": 30,
        "guestName": "Иван Петров",
        "guestContact": "ivan@example.com",
        "startsAt": "2026-08-18T13:00:00",
        "endsAt": "2026-08-18T13:30:00",
    }


def test_create_booking_ids_increment(client):
    create_event_type(client)
    create_event_type(client, event_type_id="meeting", duration=60, name="Встреча")
    first = create_booking(client, time="13:00")
    second = create_booking(client, time="14:00", event_type_id="meeting")
    assert first.json()["id"] == 1
    assert second.json()["id"] == 2
    assert second.json()["endsAt"] == "2026-08-18T15:00:00"


def test_create_booking_slot_conflict(client):
    create_event_type(client)
    create_booking(client, time="13:00")
    response = create_booking(client, time="13:00")
    assert response.status_code == 409
    assert response.json() == {"error": "Slot is already booked"}


def test_create_booking_overlap_conflict(client):
    create_event_type(client, duration=60)
    create_booking(client, time="13:30")
    response = create_booking(client, time="13:00", event_type_id="consultation")
    assert response.status_code == 409
    assert response.json() == {"error": "Slot is already booked"}


def test_create_booking_adjacent_slots_allowed(client):
    create_event_type(client)
    create_booking(client, time="13:00")
    response = create_booking(client, time="13:30")
    assert response.status_code == 201


def test_create_booking_unknown_type(client):
    response = create_booking(client, event_type_id="nope")
    assert response.status_code == 404
    assert response.json() == {"error": "Event type not found"}


def test_create_booking_missing_fields(client):
    create_event_type(client)
    response = client.post(
        "/guest/2026-08-18/booking", json={"time": "13:00", "eventTypeId": "consultation"}
    )
    assert response.status_code == 422
    fields = {item["field"] for item in response.json()["errors"]}
    assert fields == {"guestName", "guestContact"}


def test_create_booking_empty_fields(client):
    create_event_type(client)
    response = client.post(
        "/guest/2026-08-18/booking",
        json={"time": "13:00", "eventTypeId": "consultation", "guestName": "", "guestContact": " "},
    )
    assert response.status_code == 422


def test_create_booking_out_of_window(client):
    create_event_type(client)
    response = client.post(
        "/guest/2026-09-01/booking",
        json={"time": "13:00", "eventTypeId": "consultation", "guestName": "x", "guestContact": "y"},
    )
    assert response.status_code == 422
    assert has_field(response.json()["errors"], "date")


def test_create_booking_invalid_time_format(client):
    create_event_type(client)
    response = create_booking(client, time="8:00")
    assert response.status_code == 422
    assert has_field(response.json()["errors"], "time")


def test_create_booking_off_grid(client):
    create_event_type(client)
    response = create_booking(client, time="08:15")
    assert response.status_code == 422
    assert has_field(response.json()["errors"], "time")


def test_create_booking_out_of_hours(client):
    create_event_type(client, duration=60)
    response = create_booking(client, time="19:30")
    assert response.status_code == 422
    assert has_field(response.json()["errors"], "time")


def test_create_booking_already_passed(client):
    create_event_type(client)
    response = create_booking(client, time="11:00")
    assert response.status_code == 422
    assert has_field(response.json()["errors"], "time")


def test_create_booking_bad_json(client):
    create_event_type(client)
    response = client.post(
        "/guest/2026-08-18/booking",
        content="{bad json",
        headers={"content-type": "application/json"},
    )
    assert response.status_code == 400
    assert response.json() == {"error": "Invalid request"}


def test_create_booking_wrong_type(client):
    create_event_type(client)
    response = client.post(
        "/guest/2026-08-18/booking",
        json={"time": "13:00", "eventTypeId": "consultation", "guestName": 123, "guestContact": "y"},
    )
    assert response.status_code == 400
    assert response.json() == {"error": "Invalid request"}


def test_create_booking_bad_date_path(client):
    create_event_type(client)
    response = client.post(
        "/guest/2026-13-40/booking",
        json={"time": "13:00", "eventTypeId": "consultation", "guestName": "x", "guestContact": "y"},
    )
    assert response.status_code == 400
    assert response.json() == {"error": "Invalid request"}


# ---------- Admin ----------


def test_admin_day_slots(client):
    create_event_type(client)
    create_booking(client, time="13:00")
    response = client.get("/admin/2026-08-18")
    assert response.status_code == 200
    body = response.json()
    assert body["date"] == "2026-08-18"
    assert len(body["slots"]) == 24
    assert body["slots"][0] == {"startsAt": "2026-08-18T08:00:00", "status": "free"}
    booked = body["slots"][10]
    assert booked["status"] == "booked"
    assert booked["booking"]["id"] == 1
    assert booked["booking"]["guestName"] == "Иван Петров"
    assert booked["booking"]["eventType"]["id"] == "consultation"


def test_admin_day_slots_free_cells_have_no_booking(client):
    create_event_type(client)
    response = client.get("/admin/2026-08-18")
    free = response.json()["slots"][0]
    assert "booking" not in free


def test_admin_day_slots_out_of_window(client):
    response = client.get("/admin/2026-09-01")
    assert response.status_code == 404
    assert response.json() == {"error": "Date is out of booking window"}


def test_admin_upcoming_sorted(client):
    create_event_type(client)
    create_booking(client, time="14:00")
    create_booking(client, time="13:00")
    response = client.get("/admin")
    assert response.status_code == 200
    bookings = response.json()["bookings"]
    assert [b["startsAt"] for b in bookings] == [
        "2026-08-18T13:00:00",
        "2026-08-18T14:00:00",
    ]


def test_admin_upcoming_trailing_slash(client):
    create_event_type(client)
    create_booking(client, time="13:00")
    response = client.get("/admin/")
    assert response.status_code == 200
    assert len(response.json()["bookings"]) == 1


def test_admin_upcoming_filters_out_past_days(client):
    create_event_type(client)
    create_booking(client, time="14:00")

    store = client.app.state.store
    booking_model = type(store.bookings[0])

    store.bookings.append(
        booking_model(
            id=99,
            eventTypeId="consultation",
            eventTypeName="Консультация",
            duration=30,
            guestName="Сегодня-прошлое",
            guestContact="today-past@example.com",
            startsAt=datetime(2026, 8, 18, 9, 0),
            endsAt=datetime(2026, 8, 18, 9, 30),
        )
    )
    store.bookings.append(
        booking_model(
            id=100,
            eventTypeId="consultation",
            eventTypeName="Консультация",
            duration=30,
            guestName="Вчера",
            guestContact="yesterday@example.com",
            startsAt=datetime(2026, 8, 17, 18, 0),
            endsAt=datetime(2026, 8, 17, 18, 30),
        )
    )

    response = client.get("/admin")
    assert response.status_code == 200
    bookings = response.json()["bookings"]
    assert [b["guestName"] for b in bookings] == ["Сегодня-прошлое", "Иван Петров"]
    assert [b["startsAt"] for b in bookings] == [
        "2026-08-18T09:00:00",
        "2026-08-18T14:00:00",
    ]