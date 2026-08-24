import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Loader, Center } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

import { AppLayout } from './components/AppLayout';
import { BookingPage } from './pages/BookingPage';

const AdminLayout = lazy(() =>
  import('./pages/admin/AdminLayout').then((m) => ({ default: m.AdminLayout })),
);
const DashboardPage = lazy(() =>
  import('./pages/admin/DashboardPage').then((m) => ({ default: m.DashboardPage })),
);
const AdminDayPage = lazy(() =>
  import('./pages/admin/AdminDayPage').then((m) => ({ default: m.AdminDayPage })),
);
const EventTypesPage = lazy(() =>
  import('./pages/admin/EventTypesPage').then((m) => ({ default: m.EventTypesPage })),
);
const CreateEventTypePage = lazy(() =>
  import('./pages/admin/CreateEventTypePage').then((m) => ({ default: m.CreateEventTypePage })),
);

function AdminFallback() {
  return (
    <Center h={200}>
      <Loader />
    </Center>
  );
}

export default function App() {
  return (
    <>
      <Notifications />
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<BookingPage />} />
          <Route path="booking/:eventTypeId" element={<BookingPage />} />
          <Route
            path="admin"
            element={
              <Suspense fallback={<AdminFallback />}>
                <AdminLayout />
              </Suspense>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="day" element={<AdminDayPage />} />
            <Route path="event-types" element={<EventTypesPage />} />
            <Route path="event-types/new" element={<CreateEventTypePage />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}
