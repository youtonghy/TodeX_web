// Keep the public website independent of workspace state and backend connections.
// Each entry loads its own styles; /application is not a workbench route.
// /demo is the scripted, backend-free workbench the landing page embeds.
const path = window.location.pathname;
const entry = /^\/app(?:\/|$)/.test(path)
  ? import('./workbench')
  : /^\/demo\/?$/.test(path)
    ? import('./demo/entry')
    : import('./site/entry');

void entry.catch((error: unknown) => {
  console.error('Unable to load TodeX', error);
  const root = document.getElementById('root');
  if (root) root.textContent = '页面加载失败，请刷新重试。 / Failed to load TodeX, please refresh.';
});
