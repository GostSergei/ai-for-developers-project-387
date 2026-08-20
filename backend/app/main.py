import os
from datetime import date, datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app import services
from app.schemas import (
    AdminDaySlots,
    AvailabilityRequest,
    AvailabilityResponse,
    Booking,
    BookingRequest,
    BookingsList,
    DaySlots,
    EventType,
    EventTypeInput,
)
from app.store import DEFAULT_DATA_FILE, Store

FRONTEND_DIST = Path(__file__).resolve().parent.parent / "static"
HAS_FRONTEND = FRONTEND_DIST.exists()

DEFAULT_EVENT_TYPES = [
    EventType(
        id="consultation",
        name="Консультация",
        description="Разбор проекта",
        duration=30,
    ),
    EventType(
        id="meeting",
        name="Встреча",
        description="Обычная встреча",
        duration=60,
    ),
]


def _is_html_request(request: Request) -> bool:
    return "text/html" in request.headers.get("accept", "")


def _seed_default_event_types(store: Store) -> None:
    if store.data_file is None or store.event_types:
        return
    for event_type in DEFAULT_EVENT_TYPES:
        store.add_event_type(event_type)


def _index_html_response() -> FileResponse:
    return FileResponse(FRONTEND_DIST / "index.html", headers={"Vary": "Accept"})


def create_app(
    store: Store | None = None,
    now_provider=None,
) -> FastAPI:
    app = FastAPI(title="Call Calendar API", version="1.0.0")
    app.state.store = store or Store(
        data_file=os.environ.get("DATA_FILE", DEFAULT_DATA_FILE)
    )
    _seed_default_event_types(app.state.store)
    app.state.now_provider = now_provider or datetime.now

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.exception_handler(RequestValidationError)
    async def on_request_validation_error(request: Request, exc: RequestValidationError):
        return JSONResponse(status_code=400, content={"error": "Invalid request"})

    @app.exception_handler(StarletteHTTPException)
    async def on_http_error(request: Request, exc: StarletteHTTPException):
        if isinstance(exc.detail, dict):
            return JSONResponse(status_code=exc.status_code, content=exc.detail)
        return JSONResponse(status_code=exc.status_code, content={"error": str(exc.detail)})

    @app.get(
        "/event-types",
        response_model=list[EventType],
        response_model_exclude_none=True,
    )
    def list_event_types():
        return list(app.state.store.event_types.values())

    @app.get(
        "/guest/{date}",
        response_model=DaySlots,
        response_model_exclude_none=True,
    )
    def guest_day_slots(date: date, eventType: str):
        store = app.state.store
        now = app.state.now_provider()
        return services.get_day_slots(store, date, eventType, now)

    @app.post(
        "/guest/{date}/availability",
        response_model=AvailabilityResponse,
        response_model_exclude_none=True,
    )
    def guest_availability(date: date, body: AvailabilityRequest):
        store = app.state.store
        now = app.state.now_provider()
        return services.availability(store, date, body, now)

    @app.post(
        "/guest/{date}/booking",
        response_model=Booking,
        response_model_exclude_none=True,
        status_code=201,
    )
    def guest_create_booking(date: date, body: BookingRequest):
        store = app.state.store
        now = app.state.now_provider()
        return services.build_booking(store, date, body, now)

    @app.post(
        "/admin/event-types",
        response_model=EventType,
        response_model_exclude_none=True,
        status_code=201,
    )
    def admin_create_event_type(body: EventTypeInput):
        return services.create_event_type(app.state.store, body)

    @app.get(
        "/admin/{date}",
        response_model=AdminDaySlots,
        response_model_exclude_none=True,
    )
    def admin_day_slots(request: Request, date: str):
        if HAS_FRONTEND and _is_html_request(request):
            return _index_html_response()
        try:
            day = datetime.fromisoformat(date).date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid request")
        store = app.state.store
        now = app.state.now_provider()
        return services.get_admin_day_slots(store, day, now)

    @app.get(
        "/admin",
        response_model=BookingsList,
        response_model_exclude_none=True,
    )
    @app.get(
        "/admin/",
        response_model=BookingsList,
        response_model_exclude_none=True,
        include_in_schema=False,
    )
    def admin_upcoming(request: Request):
        if HAS_FRONTEND and _is_html_request(request):
            return _index_html_response()
        store = app.state.store
        now = app.state.now_provider()
        return BookingsList(bookings=services.get_meetings(store, now))

    @app.get("/{path:path}", include_in_schema=False)
    def spa_fallback(request: Request, path: str):
        if not HAS_FRONTEND:
            raise HTTPException(status_code=404, detail="Not found")
        if path:
            candidate = (FRONTEND_DIST / path).resolve()
            if candidate.is_file() and FRONTEND_DIST.resolve() in candidate.parents:
                return FileResponse(candidate)
        if _is_html_request(request) or path == "":
            return _index_html_response()
        raise HTTPException(status_code=404, detail="Not found")

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port)