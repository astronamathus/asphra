/**
 * Shows a full-screen error message (used when the track data is missing or invalid).
 * Returns a function that removes the message again.
 */
export function showFatalError(container: HTMLElement, title: string, details: string): () => void {
  const box = document.createElement('div');
  box.style.cssText = [
    'position:absolute',
    'inset:0',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'justify-content:center',
    'gap:12px',
    'padding:32px',
    'box-sizing:border-box',
    'background:#1c1f24',
    'color:#fff',
    'font-family:system-ui,sans-serif',
    'text-align:center',
  ].join(';');

  const heading = document.createElement('div');
  heading.textContent = title;
  heading.style.cssText = 'font-size:24px;font-weight:700';

  const message = document.createElement('pre');
  message.textContent = details;
  message.style.cssText =
    'max-width:900px;white-space:pre-wrap;font-size:15px;line-height:1.5;color:#ffb4a8;margin:0';

  box.append(heading, message);
  container.appendChild(box);
  return () => box.remove();
}