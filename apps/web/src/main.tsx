import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Providers } from '@/components/providers';
import { RootLayout } from '@/components/root-layout';
import { LandingPage } from '@/components/landing-page';
import { AppShell } from '@/components/app-shell';
import { LoginPage } from '@/components/login-page';
import { PrivacyPage } from '@/components/privacy-page';
import { NotFound } from '@/components/not-found';
import '@/styles/globals.css';

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <LandingPage /> },
      { path: '/app', element: <AppShell /> },
      { path: '/login', element: <LoginPage /> },
      { path: '/privacy', element: <PrivacyPage /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element not found');

createRoot(rootEl).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>
);
