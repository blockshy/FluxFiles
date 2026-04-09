import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import App from './App';
import { LocaleProvider } from './features/i18n/LocaleProvider';
import { ThemeProvider } from './features/theme/ThemeProvider';
import { UserAuthProvider } from './features/user/AuthProvider';
import { appBasename } from './lib/base';
import './styles/global.css';

dayjs.locale('zh-cn');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LocaleProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter basename={appBasename}>
            <UserAuthProvider>
              <App />
            </UserAuthProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </ThemeProvider>
    </LocaleProvider>
  </React.StrictMode>,
);
