/** True when a keyboard event comes from a text field, so global shortcuts must stay out of the way. */
export function isEditableTarget(t: EventTarget | null): boolean {
  const e = t as HTMLElement | null;
  if (!e) return false;
  return e.tagName === 'INPUT' || e.tagName === 'TEXTAREA' || e.tagName === 'SELECT' || !!e.isContentEditable;
}
