import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'wanted-sans/fonts/webfonts/variable/split/WantedSansVariable.css';
import './styles/tokens.css';
import { App } from './App';
import { createStorage } from './storage/storage';

const storage = createStorage(window.localStorage);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App storage={storage} />
  </StrictMode>,
);
