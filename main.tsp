import "@typespec/http";

using TypeSpec.Http;

@service({ title: "Call Calendar API" })
namespace CallCalendar;

// ---------- Shared models ----------

@doc("Тип события: метка события с длительностью.")
model EventType {
  @doc("Задаётся владельцем, уникальная строка, не более 50 символов.")
  id: string;

  @doc("Название, не более 100 символов.")
  name: string;

  @doc("Описание, не более 1000 символов.")
  description?: string;

  @doc("Длительность в минутах, кратна 30.")
  duration: int32;
}

@doc("Тело запроса на создание типа события.")
model EventTypeInput {
  @doc("Уникальный идентификатор, задаётся владельцем.")
  id: string;

  name: string;
  description?: string;
  duration: int32;
}

@doc("Статус 30-минутного слота. Единый для гостя и владельца.")
enum SlotStatus {
  @doc("Слот свободен.")
  free,

  @doc("Слот занят бронью.")
  booked,
}

@doc("30-минутная ячейка сетки.")
model Slot {
  @doc("Начало ячейки, ISO 8601.")
  startsAt: utcDateTime;
  status: SlotStatus;
}

@doc("Слот с деталями брони (вид владельца).")
model AdminSlot {
  startsAt: utcDateTime;
  status: SlotStatus;
  booking?: BookingInfo;
}

@doc("Информация о брони внутри слота.")
model BookingInfo {
  id: int32;
  eventType: EventType;
  guestName: string;
  guestContact: string;
}

@doc("Бронирование.")
model Booking {
  id: int32;
  eventTypeId: string;
  eventTypeName: string;
  duration: int32;
  guestName: string;
  guestContact: string;
  startsAt: utcDateTime;

  @doc("Вычисляется как startsAt + duration.")
  endsAt: utcDateTime;
}

// ---------- Request/response DTOs ----------

@doc("Ответ: слоты за день для выбранного типа события (гость).")
model DaySlots {
  date: plainDate;
  eventType: EventType;
  slots: Slot[];
}

@doc("Ответ: все слоты и брони за день (владелец).")
model AdminDaySlots {
  date: plainDate;
  slots: AdminSlot[];
}

@doc("Список встреч: все брони начиная с начала сегодняшнего дня.")
model BookingsList {
  bookings: Booking[];
}

@doc("Проверка доступности слота.")
model AvailabilityRequest {
  @doc("Время начала, формат HH:MM.")
  time: string;
  eventTypeId: string;
}

enum AvailabilityReason {
  @doc("Слот занят.")
  booked,

  @doc("Дата вне окна 14 дней.")
  "out-of-window",

  @doc("Встреча выходит за рабочие часы 08:00–20:00.")
  "out-of-hours",

  @doc("Время не попадает на границу сетки 30 минут.")
  "invalid-grid",

  @doc("Время уже наступило.")
  "already-passed",
}

model AvailabilityResponse {
  available: boolean;
  reason?: AvailabilityReason;
}

@doc("Создание бронирования.")
model BookingRequest {
  @doc("Время начала, формат HH:MM.")
  time: string;
  eventTypeId: string;
  guestName: string;
  guestContact: string;
}

// ---------- Errors ----------

@error
model NotFoundError {
  @statusCode status: 404;
  error: string;
}

@error
model ConflictError {
  @statusCode status: 409;
  error: string;
}

@error
model ValidationError {
  @statusCode status: 422;
  errors: ValidationErrorItem[];
}

model ValidationErrorItem {
  field: string;
  message: string;
}

@error
model BadRequestError {
  @statusCode status: 400;
  error: string;
}

@doc("Ответ 201 Created: бронирование.")
model BookingCreated {
  @statusCode status: 201;
  ...Booking;
}

@doc("Ответ 201 Created: тип события.")
model EventTypeCreated {
  @statusCode status: 201;
  ...EventType;
}

// ---------- Common endpoints ----------

@route("/event-types")
@doc("Список типов событий: доступен гостю и владельцу.")
namespace EventTypes {
  @get
  @doc("Вернуть все типы событий.")
  op list(): EventType[];
}

// ---------- Guest endpoints ----------

@doc("Гостевые endpoints: просмотр и бронирование слотов.")
namespace Guest {
  @route("/guest/{date}")
  @get
  @doc("Слоты за день для выбранного типа события.")
  op daySlots(
    @path date: plainDate,
    @query eventType: string,
  ): DaySlots | NotFoundError;

  @route("/guest/{date}/availability")
  @post
  @doc("Проверка доступности слота без создания брони.")
  op availability(
    @path date: plainDate,
    @body body: AvailabilityRequest,
  ): AvailabilityResponse | NotFoundError;

  @route("/guest/{date}/booking")
  @post
  @doc("Создание бронирования.")
  op createBooking(
    @path date: plainDate,
    @body body: BookingRequest,
  ): BookingCreated | NotFoundError | ConflictError | ValidationError | BadRequestError;
}

// ---------- Owner endpoints ----------

@doc("Endpoints владельца календаря.")
namespace Admin {
  @route("/admin/event-types")
  @post
  @doc("Создать тип события.")
  op createEventType(
    @body body: EventTypeInput,
  ): EventTypeCreated | ConflictError | ValidationError;

  @route("/admin/{date}")
  @get
  @doc("Все слоты за день со всеми типами и бронями.")
  op daySlots(
    @path date: plainDate,
  ): AdminDaySlots | NotFoundError;

  @route("/admin")
  @get
  @doc("Встречи: все брони всех типов, начиная с начала сегодняшнего дня, по возрастанию.")
  op meetings(): BookingsList;
}

// ---------- Examples (для Prism mock: реалистичная статичная выдача) ----------

@@example(CallCalendar.EventType, #{
  id: "consultation",
  name: "Консультация",
  description: "Разбор проекта",
  duration: 30
});

@@example(CallCalendar.Slot, #{
  startsAt: utcDateTime.fromISO("2026-08-18T08:00:00Z"),
  status: CallCalendar.SlotStatus.free
});

@@example(CallCalendar.DaySlots, #{
  date: plainDate.fromISO("2026-08-18"),
  eventType: #{
    id: "consultation",
    name: "Консультация",
    description: "Разбор проекта",
    duration: 30
  },
  slots: #[
    #{ startsAt: utcDateTime.fromISO("2026-08-18T08:00:00Z"), status: CallCalendar.SlotStatus.free },
    #{ startsAt: utcDateTime.fromISO("2026-08-18T08:30:00Z"), status: CallCalendar.SlotStatus.free },
    #{ startsAt: utcDateTime.fromISO("2026-08-18T09:00:00Z"), status: CallCalendar.SlotStatus.free },
    #{ startsAt: utcDateTime.fromISO("2026-08-18T09:30:00Z"), status: CallCalendar.SlotStatus.booked },
    #{ startsAt: utcDateTime.fromISO("2026-08-18T10:00:00Z"), status: CallCalendar.SlotStatus.free },
    #{ startsAt: utcDateTime.fromISO("2026-08-18T10:30:00Z"), status: CallCalendar.SlotStatus.free },
    #{ startsAt: utcDateTime.fromISO("2026-08-18T11:00:00Z"), status: CallCalendar.SlotStatus.booked },
    #{ startsAt: utcDateTime.fromISO("2026-08-18T11:30:00Z"), status: CallCalendar.SlotStatus.free },
    #{ startsAt: utcDateTime.fromISO("2026-08-18T12:00:00Z"), status: CallCalendar.SlotStatus.booked },
    #{ startsAt: utcDateTime.fromISO("2026-08-18T12:30:00Z"), status: CallCalendar.SlotStatus.free },
    #{ startsAt: utcDateTime.fromISO("2026-08-18T13:00:00Z"), status: CallCalendar.SlotStatus.free },
    #{ startsAt: utcDateTime.fromISO("2026-08-18T13:30:00Z"), status: CallCalendar.SlotStatus.free },
    #{ startsAt: utcDateTime.fromISO("2026-08-18T14:00:00Z"), status: CallCalendar.SlotStatus.free },
    #{ startsAt: utcDateTime.fromISO("2026-08-18T14:30:00Z"), status: CallCalendar.SlotStatus.booked },
    #{ startsAt: utcDateTime.fromISO("2026-08-18T15:00:00Z"), status: CallCalendar.SlotStatus.free },
    #{ startsAt: utcDateTime.fromISO("2026-08-18T15:30:00Z"), status: CallCalendar.SlotStatus.free },
    #{ startsAt: utcDateTime.fromISO("2026-08-18T16:00:00Z"), status: CallCalendar.SlotStatus.booked },
    #{ startsAt: utcDateTime.fromISO("2026-08-18T16:30:00Z"), status: CallCalendar.SlotStatus.free },
    #{ startsAt: utcDateTime.fromISO("2026-08-18T17:00:00Z"), status: CallCalendar.SlotStatus.free },
    #{ startsAt: utcDateTime.fromISO("2026-08-18T17:30:00Z"), status: CallCalendar.SlotStatus.free },
    #{ startsAt: utcDateTime.fromISO("2026-08-18T18:00:00Z"), status: CallCalendar.SlotStatus.free },
    #{ startsAt: utcDateTime.fromISO("2026-08-18T18:30:00Z"), status: CallCalendar.SlotStatus.booked },
    #{ startsAt: utcDateTime.fromISO("2026-08-18T19:00:00Z"), status: CallCalendar.SlotStatus.free },
    #{ startsAt: utcDateTime.fromISO("2026-08-18T19:30:00Z"), status: CallCalendar.SlotStatus.free }
  ]
});

@@example(CallCalendar.Booking, #{
  id: 12,
  eventTypeId: "consultation",
  eventTypeName: "Консультация",
  duration: 30,
  guestName: "Иван Петров",
  guestContact: "ivan@example.com",
  startsAt: utcDateTime.fromISO("2026-08-25T08:00:00Z"),
  endsAt: utcDateTime.fromISO("2026-08-25T08:30:00Z")
});

@@example(CallCalendar.BookingsList, #{
  bookings: #[
    #{
      id: 12,
      eventTypeId: "consultation",
      eventTypeName: "Консультация",
      duration: 30,
      guestName: "Иван Петров",
      guestContact: "ivan@example.com",
      startsAt: utcDateTime.fromISO("2026-08-25T08:00:00Z"),
      endsAt: utcDateTime.fromISO("2026-08-25T08:30:00Z")
    },
    #{
      id: 13,
      eventTypeId: "meeting",
      eventTypeName: "Встреча",
      duration: 60,
      guestName: "Мария Иванова",
      guestContact: "maria@example.com",
      startsAt: utcDateTime.fromISO("2026-09-02T10:00:00Z"),
      endsAt: utcDateTime.fromISO("2026-09-02T11:00:00Z")
    }
  ]
});

@@example(CallCalendar.AdminSlot, #{
  startsAt: utcDateTime.fromISO("2026-08-18T08:30:00Z"),
  status: CallCalendar.SlotStatus.booked,
  booking: #{
    id: 12,
    eventType: #{ id: "consultation", name: "Консультация", duration: 30 },
    guestName: "Иван Петров",
    guestContact: "ivan@example.com"
  }
});

@@example(CallCalendar.AdminDaySlots, #{
  date: plainDate.fromISO("2026-08-18"),
  slots: #[
    #{ startsAt: utcDateTime.fromISO("2026-08-18T08:00:00Z"), status: CallCalendar.SlotStatus.free },
    #{
      startsAt: utcDateTime.fromISO("2026-08-18T08:30:00Z"),
      status: CallCalendar.SlotStatus.booked,
      booking: #{
        id: 12,
        eventType: #{ id: "consultation", name: "Консультация", duration: 30 },
        guestName: "Иван Петров",
        guestContact: "ivan@example.com"
      }
    },
    #{ startsAt: utcDateTime.fromISO("2026-08-18T09:00:00Z"), status: CallCalendar.SlotStatus.free }
  ]
});

@@example(CallCalendar.AvailabilityResponse, #{ available: true });
