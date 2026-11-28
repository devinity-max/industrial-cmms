import { cwd } from 'node:process';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, cwd(), ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY']);
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const configured = url === 'https://fgawjraoekdnhdbqqrvm.supabase.co' &&
    typeof key === 'string' && /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  return {
    // Only validated public configuration may cross the Vite/browser boundary.
    envPrefix: [],
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(configured ? url : ''),
      'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(configured ? key : ''),
    },
  };
});
