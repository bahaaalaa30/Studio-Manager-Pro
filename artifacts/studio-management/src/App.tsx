import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, Redirect } from 'wouter';

import { Layout } from '@/components/layout/Layout';

import Reception from '@/pages/Reception';
import Photography from '@/pages/Photography';
import Editing from '@/pages/Editing';
import Printing from '@/pages/Printing';
import Delivery from '@/pages/Delivery';
import Admin from '@/pages/Admin';
import Track from '@/pages/Track';

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/">
          <Redirect to="/reception" />
        </Route>
        <Route path="/reception" component={Reception} />
        <Route path="/photography" component={Photography} />
        <Route path="/editing" component={Editing} />
        <Route path="/printing" component={Printing} />
        <Route path="/delivery" component={Delivery} />
        <Route path="/admin" component={Admin} />
        <Route path="/track" component={Track} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function CopyTrackingLinkHandler() {
  useEffect(() => {
    const handleClick = async (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest<HTMLButtonElement>('.print-receipt button');

      if (!button || !button.querySelector('.lucide-copy')) return;

      const link = button.parentElement?.querySelector('span.font-mono')?.textContent?.trim();
      if (!link) return;

      try {
        await navigator.clipboard.writeText(link);
      } catch {
        const textArea = document.createElement('textarea');
        textArea.value = link;
        textArea.setAttribute('readonly', '');
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }

      const previousTitle = button.title;
      button.title = 'Copied!';
      window.setTimeout(() => {
        button.title = previousTitle;
      }, 1500);
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <CopyTrackingLinkHandler />
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
