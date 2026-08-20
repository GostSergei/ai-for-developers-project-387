import { Routes, Route } from 'react-router-dom';
import { Notifications } from '@mantine/notifications';

import { AppLayout } from './components/AppLayout';
import { BookingPage } from './pages/BookingPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { DashboardPage } from './pages/admin/DashboardPage';
import { CreateEventTypePage } from './pages/admin/CreateEventTypePage';
import { EventTypesPage } from './pages/admin/EventTypesPage';
import { AdminDayPage } from './pages/admin/AdminDayPage';

export default function App() {
  return (
    <>
      <Notifications />
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<BookingPage />} />
          <Route path="booking/:eventTypeId" element={<BookingPage />} />
          <Route path="admin" element={<AdminLayout />}>
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