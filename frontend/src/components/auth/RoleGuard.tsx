import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthContext } from '../../context/AuthContext';
import { useCapabilities } from '../../hooks/api/useAuth';
import { FullPageLoader } from '../ui';

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
    return <FullPageLoader label="Caricamento sessione..." />;
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
  const capabilitiesQuery = useCapabilities();
  const capabilitiesData = capabilitiesQuery.data;
  const capabilities = capabilitiesData?.capabilities ?? [];
  const hasCapabilityContract = allowedCapabilities.length > 0 && !!capabilitiesData;

  if (!user) {
    return null;
  }

  if (allowedCapabilities.length > 0 && capabilitiesQuery.isLoading) {
    return null;
  }

  if (hasCapabilityContract) {
    return hasAnyCapability(capabilities, allowedCapabilities) ? <>{children}</> : null;
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
  const capabilitiesData = capabilitiesQuery.data;
  const capabilities = capabilitiesData?.capabilities ?? [];

  if (isLoading || (allowedCapabilities.length > 0 && capabilitiesQuery.isLoading)) {
    return <FullPageLoader label="Verifica permessi..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const allowedByCapability =
    allowedCapabilities.length > 0 && hasAnyCapability(capabilities, allowedCapabilities);
  const hasCapabilityContract = allowedCapabilities.length > 0 && !!capabilitiesData;
  const hasCapabilityRule = allowedCapabilities.length > 0;
  const hasRoleRule = allowedRoles.length > 0;
  const allowedByRole = hasRoleRule && !!user && allowedRoles.includes(user.role);
  const hasNoAccessRule = !hasCapabilityRule && !hasRoleRule;
  const isAllowed = hasCapabilityContract
    ? allowedByCapability
    : allowedByCapability || allowedByRole || hasNoAccessRule;

  if (!user || !isAllowed) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
