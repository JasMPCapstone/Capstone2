import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isClientAdmin } from '../lib/roles';
import Spinner from './Spinner';

/** Renders child routes only for client admins (CLIENT_ADMIN). */
export default function RequireClientAdmin() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!isClientAdmin(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
