import React from 'react';
import ReactDOM from 'react-dom/client';
import AdminApp from './AdminApp';

const apiBaseUrl = 'http://localhost:4000';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AdminApp apiBaseUrl={apiBaseUrl} />
  </React.StrictMode>
);
