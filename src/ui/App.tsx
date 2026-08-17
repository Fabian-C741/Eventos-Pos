import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AppShell } from './components/layout/AppShell';
import { Spinner } from './components/common/ui';
import { LoginScreen } from './screens/Login/LoginScreen';
import { PosScreen } from './screens/Pos/PosScreen';
import { DashboardScreen } from './screens/Dashboard/DashboardScreen';
import { EventsScreen } from './screens/Events/EventsScreen';
import { ProductsScreen } from './screens/Products/ProductsScreen';
import { TicketsScreen } from './screens/Tickets/TicketsScreen';
import { BoxesScreen } from './screens/Boxes/BoxesScreen';
import { UsersScreen } from './screens/Users/UsersScreen';
import { SalesScreen } from './screens/Sales/SalesScreen';
import { ClosesScreen } from './screens/Closes/ClosesScreen';
import { ReportsScreen } from './screens/Reports/ReportsScreen';
import { BackupsScreen } from './screens/Backups/BackupsScreen';
import { LogsScreen } from './screens/Logs/LogsScreen';
import { ConfigScreen } from './screens/Config/ConfigScreen';
import type { ReactNode } from 'react';

function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'cajero') return <Navigate to="/cajero" replace />;
  return <AppShell>{children}</AppShell>;
}

function SuperadminRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'superadmin') return <Navigate to="/dashboard" replace />;
  return <AppShell>{children}</AppShell>;
}

function PosRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export function App() {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;

  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route
        path="/"
        element={
          user ? (
            user.role === 'cajero' ? (
              <Navigate to="/cajero" replace />
            ) : (
              <Navigate to="/dashboard" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/cajero"
        element={
          <PosRoute>
            <PosScreen />
          </PosRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <AdminRoute>
            <DashboardScreen />
          </AdminRoute>
        }
      />
      <Route
        path="/eventos"
        element={
          <AdminRoute>
            <EventsScreen />
          </AdminRoute>
        }
      />
      <Route
        path="/productos"
        element={
          <AdminRoute>
            <ProductsScreen />
          </AdminRoute>
        }
      />
      <Route
        path="/entradas"
        element={
          <AdminRoute>
            <TicketsScreen />
          </AdminRoute>
        }
      />
      <Route
        path="/cajas"
        element={
          <AdminRoute>
            <BoxesScreen />
          </AdminRoute>
        }
      />
      <Route
        path="/usuarios"
        element={
          <AdminRoute>
            <UsersScreen />
          </AdminRoute>
        }
      />
      <Route
        path="/ventas"
        element={
          <AdminRoute>
            <SalesScreen />
          </AdminRoute>
        }
      />
      <Route
        path="/cierres"
        element={
          <AdminRoute>
            <ClosesScreen />
          </AdminRoute>
        }
      />
      <Route
        path="/reportes"
        element={
          <AdminRoute>
            <ReportsScreen />
          </AdminRoute>
        }
      />
      <Route
        path="/backups"
        element={
          <SuperadminRoute>
            <BackupsScreen />
          </SuperadminRoute>
        }
      />
      <Route
        path="/logs"
        element={
          <SuperadminRoute>
            <LogsScreen />
          </SuperadminRoute>
        }
      />
      <Route
        path="/config"
        element={
          <SuperadminRoute>
            <ConfigScreen />
          </SuperadminRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}