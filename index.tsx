import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ClerkProvider } from '@clerk/clerk-react';
import './src/index.css';

const AppRoot: React.FC = () => {
  const [publishableKey, setPublishableKey] = useState<string>(() => {
    return (
      ((import.meta as any).env?.VITE_CLERK_PUBLISHABLE_KEY as string) ||
      (typeof process !== 'undefined' ? (process.env?.VITE_CLERK_PUBLISHABLE_KEY as string) : '') ||
      localStorage.getItem('clerk_publishable_key') ||
      ''
    );
  });

  const isLocalOrPreview =
    typeof window !== 'undefined' &&
    window.location.hostname !== 'ai.foldedpage.in' &&
    !window.location.hostname.endsWith('.ai.foldedpage.in');

  const isProdKeyOnNonProdDomain =
    publishableKey.startsWith('pk_live_') && isLocalOrPreview;

  // If key is missing OR is a production key on non-production domain,
  // do not mount ClerkProvider (to avoid Clerk's fatal domain error)
  if (!publishableKey || isProdKeyOnNonProdDomain) {
    return (
      <App
        publishableKey=""
        domainMismatchKey={isProdKeyOnNonProdDomain ? publishableKey : undefined}
        onKeyConfigured={setPublishableKey}
      />
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <App publishableKey={publishableKey} onKeyConfigured={setPublishableKey} />
    </ClerkProvider>
  );
};

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppRoot />
    </ErrorBoundary>
  </React.StrictMode>
);
