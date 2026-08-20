import { Container, NavLink, Stack } from '@mantine/core';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

const LINKS = [
  { label: 'Встречи', to: '/admin' },
  { label: 'Слоты по дням', to: '/admin/day' },
  { label: 'Типы событий', to: '/admin/event-types' },
  { label: 'Новый тип события', to: '/admin/event-types/new' },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Container size="md" py="xl">
      <Stack gap="md">
        <Stack gap={0}>
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              label={link.label}
              active={location.pathname === link.to}
              onClick={() => navigate(link.to)}
            />
          ))}
        </Stack>
        <Outlet />
      </Stack>
    </Container>
  );
}