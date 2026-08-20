import { Box, Group, Text } from '@mantine/core';
import { Link, Outlet, useLocation } from 'react-router-dom';

function isAdminPath(pathname: string): boolean {
  return pathname.startsWith('/admin');
}

export function AppLayout() {
  const location = useLocation();
  const admin = isAdminPath(location.pathname);

  return (
    <>
      <Box
        component="header"
        h={56}
        px="md"
        style={(theme) => ({
          borderBottom: `1px solid ${theme.colors.gray[2]}`,
          background: theme.colors.gray[0],
          position: 'sticky',
          top: 0,
          zIndex: 100,
        })}
      >
        <Group h="100%" justify="space-between">
          <Text component={Link} to="/" fw={700} size="lg">
            Календарь звонков
          </Text>
          <Group gap="lg">
            <Text component={Link} to="/" fw={admin ? 400 : 700}>
              Запись
            </Text>
            <Text component={Link} to="/admin" fw={admin ? 700 : 400}>
              Владелец
            </Text>
          </Group>
        </Group>
      </Box>
      <main key={admin ? 'admin' : 'guest'}>
        <Outlet />
      </main>
    </>
  );
}