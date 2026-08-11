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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
