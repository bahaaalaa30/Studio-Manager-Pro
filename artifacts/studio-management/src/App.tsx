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

const queryClient = new QueryClient();
type CopiedTooltip = { x: number; y: number };
type AuthState = 'checking' | 'authenticated' | 'unauthenticated';

const AUTH_EVENT = 'smp-authenticated';

function ProtectedRoutes() {
  return <Layout><Switch>
    <Route path="/"><Redirect to="/reception" /></Route>
    <Route path="/reception" component={Reception} /><Route path="/photography" component={Photography} />
    <Route path="/editing" component={Editing} /><Route path="/printing" component={Printing} />
    <Route path="/delivery" component={Delivery} />
    <Route path="/analytics" component={Admin} />
    <Route path="/admin"><Redirect to="/settings" /></Route>
    <Route path="/settings"><Redirect to="/admin/users" /></Route>
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

function AuthGate() {
  const [location, navigate] = useLocation();
  const [authState, setAuthState] = useState<AuthState>(() => location === '/login' ? 'unauthenticated' : 'checking');

  useEffect(() => {
    if (location === '/login') return;

    let cancelled = false;
    const checkSession = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          method: 'GET',
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!cancelled) setAuthState(response.ok ? 'authenticated' : 'unauthenticated');
      } catch {
        if (!cancelled) setAuthState('unauthenticated');
      }
    };

    void checkSession();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const handleAuthenticated = () => {
      setAuthState('authenticated');
      if (location === '/login') navigate('/reception', { replace: true });
    };
    window.addEventListener(AUTH_EVENT, handleAuthenticated);
    return () => window.removeEventListener(AUTH_EVENT, handleAuthenticated);
  }, [location, navigate]);

  useEffect(() => {
    if (authState === 'unauthenticated' && location !== '/login') {
      navigate('/login', { replace: true });
    }
  }, [authState, location, navigate]);

  if (location === '/login') {
    if (authState === 'authenticated') {
      navigate('/reception', { replace: true });
      return null;
    }
    return <Login />;
  }

  if (authState === 'checking') {
    return <div className="min-h-[100dvh] bg-[#07111f] flex items-center justify-center"><div className="h-8 w-8 rounded-full border-2 border-white/20 border-t-[#FF6B00] animate-spin" /></div>;
  }

  if (authState === 'unauthenticated') return null;

  return <ProtectedRoutes />;
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
      try { await navigator.clipboard.writeText(link); } catch {
        const textArea = document.createElement('textarea'); textArea.value = link; textArea.setAttribute('readonly', ''); textArea.style.position = 'fixed'; textArea.style.opacity = '0'; document.body.appendChild(textArea); textArea.select(); document.execCommand('copy'); textArea.remove();
      }
      const rect = button.getBoundingClientRect(); setCopiedTooltip({ x: rect.left + rect.width / 2, y: rect.top });
      if (hideTimer) window.clearTimeout(hideTimer); hideTimer = window.setTimeout(() => setCopiedTooltip(null), 1500);
    };
    document.addEventListener('click', handleClick); return () => { document.removeEventListener('click', handleClick); if (hideTimer) window.clearTimeout(hideTimer); };
  }, []);
  return copiedTooltip ? <div role="status" aria-live="polite" className="pointer-events-none fixed z-[9999] -translate-x-1/2 -translate-y-full rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white shadow-lg" style={{ left: copiedTooltip.x, top: copiedTooltip.y - 8 }}>Copied!<span className="absolute left-1/2 top-full -translate-x-1/2 border-x-4 border-t-4 border-x-transparent border-t-slate-900" /></div> : null;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><CopyTrackingLinkHandler /><WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}><AuthGate /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}
export default App;
