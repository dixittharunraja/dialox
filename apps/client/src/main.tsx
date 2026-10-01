import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router';
import './index.css';

// Each surface is its own chunk: phones never download the Gmail client and vice versa.
const MobileApp = lazy(() => import('@/mobile/MobileApp').then((m) => ({ default: m.MobileApp })));
const WebApp = lazy(() => import('@/web/WebApp').then((m) => ({ default: m.WebApp })));
const RegisterPortal = lazy(() => import('@/register/RegisterPortal').then((m) => ({ default: m.RegisterPortal })));
const Simulator = lazy(() => import('@/simulator/Simulator').then((m) => ({ default: m.Simulator })));
const Terms = lazy(() => import('@/terms/Terms').then((m) => ({ default: m.Terms })));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: true, staleTime: 5_000 } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/web/*" element={<WebApp />} />
            <Route path="/register" element={<RegisterPortal />} />
            <Route path="/simulator" element={<Simulator />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/*" element={<MobileApp />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
