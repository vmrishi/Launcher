import { defaults } from './defaults';
import type { Config } from './types';
const key = 'orbit-launcher-preview-v1';
export const desktop = !!window.launcher;
export async function load(): Promise<Config> {
  if (window.launcher) {
    const existing = await window.launcher.load();
    if (existing) return existing;
    const config = defaults();
    config.activeProfile = config.profiles[0].id;
    return window.launcher.save(config);
  }
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const c = JSON.parse(raw);
      c.settings = {
        showProfileSelector: true,
        autoCheckUpdates: true,
        autoInstallUpdates: false,
        uiFontScale: 118,
        donutFontSize: 16,
        sliceRadius: 0,
        ...c.settings,
      };
      return c;
    }
  } catch {
    /* Fall back to fresh preview. */
  }
  const config = defaults();
  config.activeProfile = config.profiles[0].id;
  localStorage.setItem(key, JSON.stringify(config));
  return config;
}
export async function save(config: Config): Promise<Config> {
  if (window.launcher) return window.launcher.save(config);
  localStorage.setItem(key, JSON.stringify(config));
  return config;
}
