import { useState } from 'react';
import { ChevronLeft, ChevronRight, Orbit } from 'lucide-react';
import { EntryIcon } from './Icon';
import type { Entry, Settings, Profile } from '../types';
function point(radius: number, angle: number) {
  const a = (angle * Math.PI) / 180;
  return [220 + radius * Math.cos(a), 220 + radius * Math.sin(a)];
}
function slice(start: number, end: number, r = 0) {
  if (!r)
    return `M ${point(204, start)} A 204 204 0 0 1 ${point(204, end)} L ${point(91, end)} A 91 91 0 0 0 ${point(91, start)} Z`;
  const outer = ((r / 204) * 180) / Math.PI,
    inner = ((r / 91) * 180) / Math.PI;
  return `M ${point(204, start + outer)} A 204 204 0 0 1 ${point(204, end - outer)} Q ${point(204, end)} ${point(204 - r, end)} L ${point(91 + r, end)} Q ${point(91, end)} ${point(91, end - inner)} A 91 91 0 0 0 ${point(91, start + inner)} Q ${point(91, start)} ${point(91 + r, start)} L ${point(204 - r, start)} Q ${point(204, start)} ${point(204, start + outer)} Z`;
}
export default function Donut({
  entries,
  profile,
  settings,
  onActivate,
  onDrop,
  editable = false,
  small = false,
}: {
  entries: Entry[];
  profile: Profile;
  settings: Settings;
  onActivate: (id: string) => void;
  onDrop?: (id: string, index: number) => void;
  editable?: boolean;
  small?: boolean;
}) {
  const [face, setFace] = useState(0),
    [hover, setHover] = useState<string | null>(null);
  const all = profile.entries
    .map((id) => entries.find((a) => a.id === id))
    .filter((a): a is Entry => !!a);
  const pages = Math.max(1, Math.ceil(all.length / settings.perFace));
  const current = Math.min(face, pages - 1);
  const shown = all.slice(current * settings.perFace, (current + 1) * settings.perFace);
  const count = Math.max(4, shown.length),
    angle = 360 / count;
  const hovered = entries.find((a) => a.id === hover);
  function flip(step: number) {
    setFace((current + step + pages) % pages);
  }
  return (
    <div className={`donut-wrap ${small ? 'small' : ''}`}>
      <div
        className="donut-stage"
        onWheel={(e) => {
          if (pages > 1) {
            e.stopPropagation();
            flip(e.deltaY > 0 ? 1 : -1);
          }
        }}
      >
        <svg
          viewBox="0 0 440 440"
          className="donut"
          aria-label={`${profile.name} donut toolbar`}
          style={
            {
              '--donut-opacity': settings.opacity / 100,
              '--donut-font-size': `${settings.donutFontSize ?? 16}px`,
            } as React.CSSProperties
          }
        >
          <defs>
            <filter id={`shadow-${small ? 's' : 'l'}`} x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="5" stdDeviation="7" floodOpacity=".13" />
            </filter>
          </defs>
          <g filter={`url(#shadow-${small ? 's' : 'l'})`}>
            {Array.from({ length: count }, (_, i) => {
              const item = shown[i];
              const start = -90 - angle / 2 + i * angle + settings.rotation + 0.6,
                end = start + angle - 1.2;
              const [x, y] = point(147, (start + end) / 2);
              return (
                <g
                  key={item?.id ?? `empty-${i}`}
                  className={`donut-slice ${hover === item?.id ? 'hovered' : ''} ${!item ? 'empty' : ''}`}
                  role={item ? 'button' : undefined}
                  tabIndex={item ? 0 : undefined}
                  aria-label={item ? `${editable ? 'Edit' : 'Launch'} ${item.name}` : undefined}
                  onMouseEnter={() => setHover(item?.id ?? null)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(item?.id ?? null)}
                  onBlur={() => setHover(null)}
                  onClick={() => item && onActivate(item.id)}
                  onKeyDown={(e) => {
                    if (item && ['Enter', ' '].includes(e.key)) {
                      e.preventDefault();
                      onActivate(item.id);
                    }
                    if (e.key === 'PageDown') flip(1);
                    if (e.key === 'PageUp') flip(-1);
                  }}
                  onContextMenu={(e) => {
                    if (editable && item) {
                      e.preventDefault();
                      onActivate(item.id);
                    }
                  }}
                  onDragOver={(e) => {
                    if (onDrop && e.dataTransfer.types.includes('application/orbit-entry')) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                  onDrop={(e) => {
                    const id = e.dataTransfer.getData('application/orbit-entry');
                    if (onDrop && id) {
                      e.preventDefault();
                      e.stopPropagation();
                      onDrop(id, current * settings.perFace + i);
                    }
                  }}
                >
                  <path d={slice(start, end, settings.sliceRadius ?? 0)} />
                  <foreignObject
                    x={x - 48}
                    y={y - 40}
                    width="96"
                    height="80"
                    style={{ pointerEvents: 'none' }}
                  >
                    <div
                      className="slice-label"
                      style={{ pointerEvents: editable ? 'auto' : 'none' }}
                      draggable={editable && !!item}
                      onDragStart={(e) => {
                        if (item) {
                          e.dataTransfer.setData('application/orbit-entry', item.id);
                          e.dataTransfer.setData('application/orbit-source', 'donut');
                          e.dataTransfer.effectAllowed = 'move';
                        }
                      }}
                    >
                      {item ? (
                        <>
                          {settings.display !== 'name' && (
                            <EntryIcon
                              entry={item}
                              size={settings.display === 'icon' ? 29 : 23}
                              bare
                            />
                          )}
                          {settings.display !== 'icon' && <span>{item.name}</span>}
                        </>
                      ) : (
                        <span className="empty-plus">+</span>
                      )}
                    </div>
                  </foreignObject>
                </g>
              );
            })}
          </g>
          <circle cx="220" cy="220" r="83" className="donut-center" />
          <foreignObject x="144" y="161" width="152" height="118">
            <div className="center-label">
              <Orbit size={20} />
              <strong>{hovered?.name ?? profile.name}</strong>
              <span>
                {hovered
                  ? hovered.type === 'group'
                    ? `${hovered.members.length} apps · one click`
                    : editable
                      ? 'Click to edit'
                      : 'Click to launch'
                  : `${all.length} applications`}
              </span>
            </div>
          </foreignObject>
        </svg>
      </div>
      {pages > 1 && (
        <div className="face-controls">
          <button className="icon-button" aria-label="Previous donut face" onClick={() => flip(-1)}>
            <ChevronLeft size={15} />
          </button>
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              className={`face-pill ${current === i ? 'selected' : ''}`}
              onClick={() => setFace(i)}
            >
              {i === 0 ? 'Front' : i === 1 ? 'Back' : `Face ${i + 1}`}
            </button>
          ))}
          <button className="icon-button" aria-label="Next donut face" onClick={() => flip(1)}>
            <ChevronRight size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
