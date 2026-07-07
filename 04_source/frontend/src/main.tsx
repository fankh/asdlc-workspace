import { ConfigProvider } from 'antd';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ConfigProvider theme={{ token: { colorPrimary: '#0958d9', colorLink: '#0958d9', colorTextSecondary: '#595959', colorTextDescription: '#595959' } }}>
        <App />
      </ConfigProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
