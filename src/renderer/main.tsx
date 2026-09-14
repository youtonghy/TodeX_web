// Keep the public website independent of workspace state and backend connections.
// Each entry loads its own styles; /application is not a workbench route.
const entry = /^\/app(?:\/|$)/.test(window.location.pathname)
  ? import('./workbench')
  : import('./site/entry');

void entry.catch((error: unknown) => {
  console.error('Unable to load TodeX', error);
  const root = document.getElementById('root');
  if (root) root.textContent = '页面加载失败，请刷新重试。 / Failed to load TodeX, please refresh.';
});
