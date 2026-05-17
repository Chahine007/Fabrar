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
    // #region agent log
    fetch('http://127.0.0.1:7699/ingest/dc878b05-bf22-4ecc-b058-58a7c0170030',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'93ee36'},body:JSON.stringify({sessionId:'93ee36',runId:'initial',hypothesisId:'H1',location:'RoleGuard.tsx:user-null',message:'RoleGuard blocked render because user is null',data:{allowedRolesCount:allowedRoles.length,allowedCapabilitiesCount:allowedCapabilities.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return null;
  }

  if (allowedCapabilities.length > 0 && capabilitiesQuery.isLoading) {
    // #region agent log
    fetch('http://127.0.0.1:7699/ingest/dc878b05-bf22-4ecc-b058-58a7c0170030',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'93ee36'},body:JSON.stringify({sessionId:'93ee36',runId:'initial',hypothesisId:'H2',location:'RoleGuard.tsx:capabilities-loading',message:'RoleGuard waiting capabilities query',data:{allowedCapabilities,queryLoading:capabilitiesQuery.isLoading},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7699/ingest/dc878b05-bf22-4ecc-b058-58a7c0170030',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'93ee36'},body:JSON.stringify({sessionId:'93ee36',runId:'initial',hypothesisId:'H2',location:'RoleGuard.tsx:role-route-loading',message:'RoleRoute showing loader while waiting auth/capabilities',data:{isLoading,capabilitiesLoading:capabilitiesQuery.isLoading,allowedCapabilitiesCount:allowedCapabilities.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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

  // #region agent log
  fetch('http://127.0.0.1:7699/ingest/dc878b05-bf22-4ecc-b058-58a7c0170030',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'93ee36'},body:JSON.stringify({sessionId:'93ee36',runId:'initial',hypothesisId:'H3',location:'RoleGuard.tsx:role-route-decision',message:'RoleRoute access decision computed',data:{userRole:user?.role ?? null,allowedRoles,allowedCapabilities,hasCapabilityContract,allowedByCapability,allowedByRole,hasNoAccessRule,isAllowed,capabilitiesCount:capabilities.length},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  if (!user || !isAllowed) {
    // #region agent log
    fetch('http://127.0.0.1:7699/ingest/dc878b05-bf22-4ecc-b058-58a7c0170030',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'93ee36'},body:JSON.stringify({sessionId:'93ee36',runId:'initial',hypothesisId:'H4',location:'RoleGuard.tsx:role-route-redirect',message:'RoleRoute redirecting to root due to denied access',data:{userPresent:Boolean(user),isAllowed},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
