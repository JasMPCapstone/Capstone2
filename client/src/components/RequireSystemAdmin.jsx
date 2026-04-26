import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isSystemAdmin } from '../lib/roles';

/** Renders child routes only for system administrators. */
export default function RequireSystemAdmin() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!isSystemAdmin(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
