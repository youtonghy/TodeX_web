export function prepareBrowserSnapshot(html: string, sourceUrl: string): string {
  const documentSnapshot = new DOMParser().parseFromString(html, 'text/html');
  documentSnapshot.querySelectorAll('script, meta[http-equiv="refresh"]').forEach((element) => element.remove());
  const base = documentSnapshot.createElement('base');
  base.href = sourceUrl;
  documentSnapshot.head.prepend(base);
  return `<!doctype html>${documentSnapshot.documentElement.outerHTML}`;
}
