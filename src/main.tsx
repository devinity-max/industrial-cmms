import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createCmmsAdapter } from './lib/data/supabase';
import { MachineWorkspace } from './pages/MachineWorkspace';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('Application root is missing.');
const root = createRoot(container);

// The browser entry owns the adapter. StrictMode may remount its subscribers.
function mount() {
  try {
    const adapter = createCmmsAdapter(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY);
    root.render(<StrictMode><MachineWorkspace adapter={adapter} /></StrictMode>);
    return () => { root.unmount(); adapter.dispose(); };
  } catch {
    root.render(<main><h1>Workspace unavailable</h1>
      <p role="alert">Check the development project configuration and browser storage, then reload.</p></main>);
    return () => root.unmount();
  }
}
const dispose = mount();
if (import.meta.hot) import.meta.hot.dispose(dispose);
