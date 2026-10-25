export function dragEntry(e: React.DragEvent, id: string, source = 'library') {
  e.dataTransfer.setData('application/orbit-entry', id);
  e.dataTransfer.setData('application/orbit-source', source);
  e.dataTransfer.setData('text/plain', `orbit-entry:${source}:${id}`);
  e.dataTransfer.effectAllowed = 'copyMove';
}
export function droppedEntry(e: React.DragEvent) {
  const fallback = e.dataTransfer
    .getData('text/plain')
    .match(/^orbit-entry:(library|donut):([a-zA-Z0-9_-]+)$/);
  return {
    id: e.dataTransfer.getData('application/orbit-entry') || fallback?.[2] || '',
    source: e.dataTransfer.getData('application/orbit-source') || fallback?.[1] || '',
  };
}
