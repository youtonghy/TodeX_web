import { writeFile } from 'node:fs/promises';

// Run explicitly when preparing a website release. Browsers never need to
// contact the GitHub API or expose credentials to load the download catalog.
const products = ['desktop', 'backend'];
const catalog = { checkedAt: new Date().toISOString().slice(0, 10), desktop: [], backend: [] };

for (const product of products) {
  const repository = `youtonghy/TodeX_${product}`;
  const response = await fetch(`https://api.github.com/repos/${repository}/releases?per_page=100`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'TodeX-website' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`${repository}: GitHub returned ${response.status}`);
  const releases = await response.json();
  catalog[product] = releases
    .filter((release) => !release.draft && !release.prerelease && /^v\d+\.\d+\.\d+$/.test(release.tag_name))
    .sort((a, b) => b.tag_name.localeCompare(a.tag_name, undefined, { numeric: true }))
    .map((release) => ({
      version: release.tag_name,
      url: release.html_url,
      assets: release.assets.map((asset) => {
        if (!asset.browser_download_url.startsWith(`https://github.com/${repository}/releases/download/`)) {
          throw new Error(`Unexpected asset URL for ${asset.name}`);
        }
        return { name: asset.name, url: asset.browser_download_url, size: asset.size };
      }),
    }));
  if (!catalog[product].length) throw new Error(`No stable releases for ${repository}`);
}

await writeFile(new URL('../src/renderer/site/releases.json', import.meta.url), `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`Updated download catalog: Desktop ${catalog.desktop[0].version}, Backend ${catalog.backend[0].version}`);
