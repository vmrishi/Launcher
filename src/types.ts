export type EntryType = 'app' | 'url' | 'folder' | 'group';
export interface Entry {
  id: string;
  name: string;
  type: EntryType;
  target: string;
  args: string[];
  cwd: string;
  color: string;
  glyph: string;
  icon?: string;
  members: string[];
  delay: number;
  favorite: boolean;
  hotkey: string;
}
export interface Profile {
  id: string;
  name: string;
  description: string;
  entries: string[];
}
export interface Settings {
  theme: 'light' | 'dark' | 'system';
  style: 'soft' | 'material';
  accent: string;
  radius: number;
  uiFontScale: number;
  donutFontSize: number;
  sliceRadius: number;
  opacity: number;
  motion: boolean;
  display: 'both' | 'icon' | 'name';
  donutSize: number;
  perFace: number;
  rotation: number;
  hotkey: string;
  launchAtLogin: boolean;
  startMinimized: boolean;
  closeToTray: boolean;
  autoHide: boolean;
  showRecent: boolean;
  showProfileSelector: boolean;
  autoCheckUpdates: boolean;
  autoInstallUpdates: boolean;
}
export interface LaunchRecord {
  id: string;
  entryId: string;
  name: string;
  time: number;
  success: boolean;
  detail: string;
}
export interface Config {
  version: 1;
  entries: Entry[];
  profiles: Profile[];
  activeProfile: string;
  settings: Settings;
  history: LaunchRecord[];
}
export interface LaunchResult {
  success: boolean;
  message: string;
  results?: { name: string; success: boolean; error?: string }[];
}
export interface Discovery {
  name: string;
  target: string;
  icon?: string;
  type?: EntryType;
}
export interface DesktopAPI {
  desktop: true;
  updateAction(action: 'status' | 'check' | 'install'): Promise<UpdateStatus>;
  saveUpdateToken(token: string): Promise<UpdateStatus>;
  openRepository(): Promise<void>;
  captureShortcut(active: boolean): Promise<void>;
  clearHistory(): Promise<void>;
  load(): Promise<Config>;
  save(config: Config): Promise<Config>;
  launch(id: string): Promise<LaunchResult>;
  browse(kind: 'app' | 'folder' | 'icon'): Promise<Discovery | null>;
  describe(paths: string[]): Promise<Discovery[]>;
  scan(): Promise<Discovery[]>;
  filePath(file: File): string;
  showDonut(): Promise<void>;
  hideDonut(): Promise<void>;
  openSettings(): Promise<void>;
  exportConfig(): Promise<boolean>;
  importConfig(): Promise<Config | null>;
  window(action: 'minimize' | 'maximize' | 'close' | 'quit'): void;
  onConfig(callback: (config: Config) => void): () => void;
  onDonut(callback: () => void): () => void;
}
declare global {
  interface Window {
    launcher?: DesktopAPI;
  }
}

export interface UpdateStatus {
  state: 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'current' | 'error';
  message: string;
  version?: string;
  tokenStored: boolean;
  currentVersion: string;
}
