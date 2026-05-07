import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import { useCapabilities } from '../../hooks/api/useAuth';

interface RoleGuardProps {
  allowedRoles?: string[];
  allowedCapabilities?: string[];
  children: ReactNode;
}

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuthContext();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function hasAnyCapability(current: string[] = [], required: string[] = []) {
  return required.length > 0 && required.some((capability) => current.includes(capability));
}

export function RoleGuard({ allowedRoles = [], allowedCapabilities = [], children }: RoleGuardProps) {
  const { user } = useAuthContext();
  const { data: capabilitiesData } = useCapabilities();
  const capabilities = capabilitiesData?.capabilities ?? [];

  if (!user) {
    return null;
  }

  if (allowedCapabilities.length > 0 && hasAnyCapability(capabilities, allowedCapabilities)) {
    return <>{children}</>;
  }

  if (allowedCapabilities.length > 0 && allowedRoles.length === 0) {
    return null;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return null;
  }

  return <>{children}</>;
}

export function RoleRoute({ allowedRoles = [], allowedCapabilities = [], children }: RoleGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuthContext();
  const capabilitiesQuery = useCapabilities();
  const capabilities = capabilitiesQuery.data?.capabilities ?? [];

  if (isLoading || (allowedCapabilities.length > 0 && capabilitiesQuery.isLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const allowedByCapability =
    allowedCapabilities.length > 0 && hasAnyCapability(capabilities, allowedCapabilities);
  const hasCapabilityRule = allowedCapabilities.length > 0;
  const hasRoleRule = allowedRoles.length > 0;
  const allowedByRole = hasRoleRule && !!user && allowedRoles.includes(user.role);
  const hasNoAccessRule = !hasCapabilityRule && !hasRoleRule;

  if (!user || (!hasNoAccessRule && !allowedByCapability && !allowedByRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
