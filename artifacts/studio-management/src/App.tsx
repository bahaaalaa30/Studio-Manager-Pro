import { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, Redirect, useLocation } from 'wouter';
import { Layout } from '@/components/layout/Layout';
import Reception from '@/pages/Reception';
import Photography from '@/pages/Photography';
import Editing from '@/pages/Editing';
import Printing from '@/pages/Printing';
import Delivery from '@/pages/Delivery';
import Admin from '@/pages/Admin';
import AdminManagement from '@/pages/AdminManagement';
import Archive from '@/pages/Archive';
import Track from '@/pages/Track';
import Login from '@/pages/Login';
import SettingsHome from '@/pages/SettingsHome';

const queryClient = new QueryClient();
type CopiedTooltip = { x: number; y: number };
type AuthState = 'checking' | 'authenticated' | 'unauthenticated';
const AUTH_EVENT = 'smp-authenticated';
const LOGOUT_EVENT = 'smp-logout';
type PermissionSet = Set<string>;

const ROUTE_PERMISSIONS: Record<string, string> = {
  '/reception': 'reception.view', '/photography': 'photography.view', '/editing': 'editing.view', '/printing': 'printing.view',
  '/delivery': 'delivery.view', '/analytics': 'analytics.view', '/archive': 'archive.view', '/track': 'track.view',
  '/settings': 'admin.access', '/admin': 'admin.access',
  '/admin/users': 'users.view', '/admin/branches': 'branches.view', '/admin/roles': 'roles.view', '/admin/permissions': 'permissions.view',
  '/admin/services': 'services.view', '/admin/packages': 'packages.view', '/admin/inventory': 'inventory.view',
};

const ADMIN_ROUTES = ['/admin/users', '/admin/branches', '/admin/roles', '/admin/permissions', '/admin/services', '/admin/packages', '/admin/inventory'];

function getSafeRoute(permissions: PermissionSet) {
  const preferredRoutes = ['/reception', '/archive', '/track', '/photography', '/editing', '/printing', '/delivery', '/analytics', ...ADMIN_ROUTES];
  return preferredRoutes.find((route) => permissions.has(ROUTE_PERMISSIONS[route])) ?? '/login';
}

function getSafeAdminRoute(permissions: PermissionSet) {
  return ADMIN_ROUTES.find((route) => permissions.has(ROUTE_PERMISSIONS[route])) ?? '/settings';
}

function ProtectedRoutes({ permissions }: { permissions: PermissionSet }) {
  const [location] = useLocation();
  const requiredPermission = ROUTE_PERMISSIONS[location];

  if (requiredPermission && !permissions.has(requiredPermission)) {
    const safeRoute = location === '/settings' || location === '/admin'
      ? getSafeRoute(permissions)
      : getSafeRoute(permissions);
    return safeRoute === '/login' ? <Redirect to="/login" /> : <Redirect to={safeRoute} />;
  }

  return <Layout><Switch>
    <Route path="/"><Redirect to={getSafeRoute(permissions)} /></Route>
    <Route path="/reception" component={Reception} /><Route path="/photography" component={Photography} />
    <Route path="/editing" component={Editing} /><Route path="/printing" component={Printing} />
    <Route path="/delivery" component={Delivery} />
    <Route path="/analytics" component={Admin} />
    <Route path="/settings"><SettingsHome /></Route>
    <Route path="/admin"><Redirect to="/settings" /></Route>
    <Route path="/admin/users"><AdminManagement resource="users" /></Route>
    <Route path="/admin/branches"><AdminManagement resource="branches" /></Route>
    <Route path="/admin/roles"><AdminManagement resource="roles" /></Route>
    <Route path="/admin/permissions"><AdminManagement resource="permissions" /></Route>
    <Route path="/admin/services"><AdminManagement resource="services" /></Route>
    <Route path="/admin/packages"><AdminManagement resource="packages" /></Route>
    <Route path="/admin/inventory"><AdminManagement resource="inventory" /></Route>
    <Route path="/archive" component={Archive} /><Route path="/track" component={Track} /><Route component={NotFound} />
  </Switch></Layout>;
}

function buildPermissionSet(rawPermissions: unknown): PermissionSet {
  const nextPermissions = new Set<string>();
  if (!Array.isArray(rawPermissions)) return nextPermissions;
  for (const permission of rawPermissions) {
    if (typeof permission === 'string') { nextPermissions.add(permission.trim()); continue; }
    if (!permission || typeof permission !== 'object') continue;
    const item = permission as { key?: unknown; module?: unknown; action?: unknown };
    if (typeof item.key === 'string' && item.key.trim()) nextPermissions.add(item.key.trim());
    if (typeof item.module === 'string' && typeof item.action === 'string' && item.module.trim() && item.action.trim()) nextPermissions.add(`${item.module.trim()}.${item.action.trim()}`);
  }
  return nextPermissions;
}

function AuthGate() {
  const [location, navigate] = useLocation();
  const [authState, setAuthState] = useState<AuthState>(() => location === '/login' ? 'unauthenticated' : 'checking');
  const [permissions, setPermissions] = useState<PermissionSet>(new Set());

  useEffect(() => {
    if (location === '/login') return;
    let cancelled = false;
    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/me', { method: 'GET', headers: { Accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store' });
        if (!response.ok) { if (!cancelled) { setPermissions(new Set()); setAuthState('unauthenticated'); } return; }
        const data = await response.json().catch(() => null);
        const rawPermissions = Array.isArray(data?.user?.permissions) ? data.user.permissions : Array.isArray(data?.permissions) ? data.permissions : [];
        const nextPermissions = buildPermissionSet(rawPermissions);
        if (!cancelled) { setPermissions(nextPermissions); setAuthState('authenticated'); }
      } catch { if (!cancelled) { setPermissions(new Set()); setAuthState('unauthenticated'); } }
    };
    void checkSession();
    return () => { cancelled = true; };
  }, [location]);

  useEffect(() => {
    const handleAuthenticated = () => { setAuthState('checking'); setPermissions(new Set()); navigate('/reception', { replace: true }); };
    const handleLogout = () => { setPermissions(new Set()); setAuthState('unauthenticated'); navigate('/login', { replace: true }); };
    window.addEventListener(AUTH_EVENT, handleAuthenticated); window.addEventListener(LOGOUT_EVENT, handleLogout);
    return () => { window.removeEventListener(AUTH_EVENT, handleAuthenticated); window.removeEventListener(LOGOUT_EVENT, handleLogout); };
  }, [navigate]);

  useEffect(() => {
    if (authState === 'unauthenticated' && location !== '/login') navigate('/login', { replace: true });
    if (authState === 'authenticated' && location === '/login') navigate(getSafeRoute(permissions), { replace: true });
  }, [authState, location, navigate, permissions]);

  if (location === '/login') {
    if (authState === 'authenticated') return <div className="min-h-[100dvh] bg-[#07111f] flex items-center justify-center"><div className="h-8 w-8 rounded-full border-2 border-white/20 border-t-[#FF6B00] animate-spin" /></div>;
    return <Login />;
  }
  if (authState === 'checking') return <div className="min-h-[100dvh] bg-[#07111f] flex items-center justify-center"><div className="h-8 w-8 rounded-full border-2 border-white/20 border-t-[#FF6B00] animate-spin" /></div>;
  if (authState === 'unauthenticated') return null;
  return <ProtectedRoutes permissions={permissions} />;
}

function CopyTrackingLinkHandler() {
  const [copiedTooltip, setCopiedTooltip] = useState<CopiedTooltip | null>(null);
  useEffect(() => {
    let hideTimer: ReturnType<typeof window.setTimeout> | undefined;
    const handleClick = async (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>('.print-receipt button');
      if (!button || !button.querySelector('.lucide-copy')) return;
      const link = button.parentElement?.querySelector('span.font-mono')?.textContent?.trim();
      if (!link) return;
      try { await navigator.clipboard.writeText(link); } catch { const textArea = document.createElement('textarea'); textArea.value = link; textArea.setAttribute('readonly', ''); textArea.style.position = 'fixed'; textArea.style.opacity = '0'; document.body.appendChild(textArea); textArea.select(); document.execCommand('copy'); textArea.remove(); }
      const rect = button.getBoundingClientRect(); setCopiedTooltip({ x: rect.left + rect.width / 2, y: rect.top });
      if (hideTimer) window.clearTimeout(hideTimer); hideTimer = window.setTimeout(() => setCopiedTooltip(null), 1500);
    };
    document.addEventListener('click', handleClick); return () => { document.removeEventListener('click', handleClick); if (hideTimer) window.clearTimeout(hideTimer); };
  }, []);
  return copiedTooltip ? <div role="status" aria-live="polite" className="pointer-events-none fixed z-[9999] -translate-x-1/2 -translate-y-full rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg" style={{ left: copiedTooltip.x, top: copiedTooltip.y - 8 }}>Copied!<span className="absolute left-1/2 top-full -translate-x-1/2 border-x-4 border-t-4 border-x-transparent border-t-slate-900" /></div> : null;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter><AuthGate /><CopyTrackingLinkHandler /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
