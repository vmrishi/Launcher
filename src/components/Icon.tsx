import {
  AppWindow,
  Folder,
  Calculator,
  FileText,
  Github,
  Figma,
  Play,
  Settings,
  Globe,
  Code2,
  Music,
  Mail,
  Terminal,
  Layers,
  Image,
  Gamepad2,
  Coffee,
  Monitor,
} from 'lucide-react';
import type { Entry } from '../types';
export const glyphs = [
  'app',
  'folder',
  'calculator',
  'file',
  'github',
  'figma',
  'play',
  'settings',
  'globe',
  'code',
  'music',
  'mail',
  'terminal',
  'layers',
  'image',
  'game',
  'coffee',
  'monitor',
];
const icons: Record<string, typeof AppWindow> = {
  app: AppWindow,
  folder: Folder,
  calculator: Calculator,
  file: FileText,
  github: Github,
  figma: Figma,
  play: Play,
  settings: Settings,
  globe: Globe,
  code: Code2,
  music: Music,
  mail: Mail,
  terminal: Terminal,
  layers: Layers,
  image: Image,
  game: Gamepad2,
  coffee: Coffee,
  monitor: Monitor,
};
export function EntryIcon({
  entry,
  size = 22,
  bare = false,
}: {
  entry: Pick<Entry, 'icon' | 'glyph' | 'color' | 'name'>;
  size?: number;
  bare?: boolean;
}) {
  const Glyph = icons[entry.glyph] ?? AppWindow;
  return (
    <span
      className={bare ? 'entry-icon bare' : 'entry-icon'}
      style={
        {
          '--entry-color': entry.color,
          width: bare ? size : size + 22,
          height: bare ? size : size + 22,
        } as React.CSSProperties
      }
    >
      {entry.icon ? (
        <img src={entry.icon} alt="" width={size} height={size} />
      ) : (
        <Glyph size={size} strokeWidth={1.8} />
      )}
    </span>
  );
}
