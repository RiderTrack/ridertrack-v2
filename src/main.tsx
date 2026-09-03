import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
// 🎨 F3.51 — Estudio de Temas: el motor se importa ANTES de render
// (aplica el tema guardado al <html> al evaluar el módulo → la app
// nunca arranca con el tema equivocado ni parpadea) y el provider
// mantiene la config viva para toda la app.
import { TemaProvider } from './theme/TemaProvider.tsx';
import './theme/motor.ts';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TemaProvider>
      <App />
    </TemaProvider>
  </StrictMode>,
);
