import { useEffect, useState } from 'react';
import { Button, ListBox, Select, Skeleton } from '@heroui/react';
import { buttonVariants } from '@heroui/styles';
import { RiAppleFill, RiArrowDownLine, RiArrowRightUpLine, RiComputerLine, RiDownloadLine, RiServerLine, RiWindowsFill } from '@remixicon/react';
import { useLocale, useT } from '../i18n';
import { loadReleaseCatalog, type Release, type ReleaseAsset, type ReleaseCatalog } from './releases';

type Platform = 'macos' | 'windows' | 'linux';
type Product = 'desktop' | 'backend';
type CatalogState = { status: 'loading' } | { status: 'ready'; catalog: ReleaseCatalog } | { status: 'error' };

const platforms = [
  { id: 'macos' as const, label: 'macOS', Icon: RiAppleFill },
  { id: 'windows' as const, label: 'Windows', Icon: RiWindowsFill },
  { id: 'linux' as const, label: 'Linux', Icon: RiComputerLine },
];

const productRepositories: Record<Product, string> = {
  desktop: 'https://github.com/youtonghy/TodeX_desktop',
  backend: 'https://github.com/youtonghy/TodeX_backend',
};

function initialPlatform(): Platform {
  const agent = navigator.userAgent.toLowerCase();
  if (agent.includes('windows')) return 'windows';
  if (agent.includes('linux') && !agent.includes('android')) return 'linux';
  return 'macos';
}

function packageLabel(asset: ReleaseAsset, t: (key: 'site.downloads.universal') => string) {
  const architecture = asset.name.includes('arm64') ? 'ARM64' : /x64|x86_64/.test(asset.name) ? 'x64' : t('site.downloads.universal');
  const format = asset.name.endsWith('.tar.gz') ? 'tar.gz' : asset.name.split('.').at(-1);
  return { architecture, format, size: `${(asset.size / 1024 / 1024).toFixed(1)} MB` };
}

function DownloadCard({ product, platform, releases }: { product: Product; platform: Platform; releases: Release[] }) {
  const t = useT();
  const [version, setVersion] = useState(releases[0]?.version ?? '');
  const release = releases.find((item) => item.version === version) ?? releases[0];
  const desktop = product === 'desktop';
  const productName = desktop ? 'Desktop' : 'Backend';
  const assets = release?.assets.filter((asset) => asset.name.includes(`-${platform}-`)
    && (desktop ? /\.(dmg|exe|AppImage)$/.test(asset.name) : /\.(tar\.gz|zip)$/.test(asset.name))) ?? [];
  const checksums = release?.assets.find((asset) => asset.name === 'SHA256SUMS');
  const Icon = desktop ? RiComputerLine : RiServerLine;

  return (
    <article className="download-card" aria-label={t('site.downloads.cardLabel', { product: productName })}>
      <div className="download-card-top"><span className="product-symbol"><Icon size={23} /></span><span className="mono">{desktop ? '01 / YOUR WORKSPACE' : '02 / YOUR ENGINE'}</span></div>
      <h3>TodeX {productName}</h3>
      <p className="download-description">{t(desktop ? 'site.downloads.desktopDescription' : 'site.downloads.backendDescription')}</p>
      {release ? <>
        <div className="release-control">
          <Select aria-label={t('site.downloads.versionLabel', { product: productName })} value={version} onChange={(value) => { if (typeof value === 'string') setVersion(value); }} className="release-select">
            <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
            <Select.Popover className="website-select-popover"><ListBox>
              {releases.map((item) => <ListBox.Item key={item.version} id={item.version} textValue={item.version}>{item.version}<ListBox.ItemIndicator /></ListBox.Item>)}
            </ListBox></Select.Popover>
          </Select>
          <span className="release-status"><i />{version === releases[0]?.version ? t('site.downloads.stable') : t('site.downloads.history')}</span>
        </div>
        <div className="download-assets" aria-live="polite">
          {assets.length ? assets.map((asset) => {
            const info = packageLabel(asset, t);
            return <a className="download-asset" key={asset.name} href={asset.url} aria-label={t('site.downloads.assetLabel', { product: productName, version, platform, architecture: info.architecture })}>
              <span><strong>{platform === 'macos' ? 'Apple Silicon' : info.architecture}</strong><small>{info.format} <span>·</span> {info.size}</small></span>
              <span className="asset-download-icon"><RiArrowDownLine size={19} /></span>
            </a>;
          }) : <p className="download-unavailable">{t('site.downloads.unavailable')}</p>}
        </div>
        <div className="download-card-footer"><a href={release.url} target="_blank" rel="noreferrer">{t('site.downloads.releaseNotes')} <RiArrowRightUpLine size={14} /></a>{checksums && <a href={checksums.url}>{t('site.downloads.checksum')} <RiArrowRightUpLine size={14} /></a>}</div>
      </> : <p className="download-unavailable">{t('site.downloads.unavailable')}</p>}
    </article>
  );
}

function DownloadCardSkeleton({ product }: { product: Product }) {
  const t = useT();
  const desktop = product === 'desktop';
  const Icon = desktop ? RiComputerLine : RiServerLine;
  return (
    <article className="download-card" aria-label={t('site.downloads.cardLabel', { product: desktop ? 'Desktop' : 'Backend' })} aria-busy="true">
      <div className="download-card-top"><span className="product-symbol"><Icon size={23} /></span><span className="mono">{desktop ? '01 / YOUR WORKSPACE' : '02 / YOUR ENGINE'}</span></div>
      <h3>TodeX {desktop ? 'Desktop' : 'Backend'}</h3>
      <p className="download-description">{t(desktop ? 'site.downloads.desktopDescription' : 'site.downloads.backendDescription')}</p>
      <div className="release-control"><Skeleton className="download-skeleton download-skeleton-select" /><Skeleton className="download-skeleton download-skeleton-status" /></div>
      <div className="download-assets"><Skeleton className="download-skeleton download-skeleton-asset" /><Skeleton className="download-skeleton download-skeleton-asset" /></div>
      <span className="download-loading-text">{t('site.downloads.loading')}</span>
    </article>
  );
}

export function Downloads() {
  const t = useT();
  const locale = useLocale();
  const [platform, setPlatform] = useState<Platform>(initialPlatform);
  const [state, setState] = useState<CatalogState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    loadReleaseCatalog(controller.signal)
      .then((catalog) => { if (!controller.signal.aborted) setState({ status: 'ready', catalog }); })
      .catch(() => { if (!controller.signal.aborted) setState({ status: 'error' }); });
    return () => controller.abort();
  }, [attempt]);

  return (
    <section className="downloads section-width" id="downloads" aria-labelledby="download-heading">
      <div className="section-heading centered"><span className="eyebrow"><span /> READY WHEN YOU ARE</span><h2 id="download-heading">{t('site.downloads.title')}</h2><p>{t('site.downloads.subtitle')}</p></div>
      <div className="platform-picker" role="group" aria-label={t('site.downloads.platformLabel')}>
        {platforms.map(({ id, label, Icon }) => <Button key={id} variant="ghost" aria-pressed={platform === id} className={platform === id ? 'platform-button selected' : 'platform-button'} onPress={() => setPlatform(id)}><Icon size={18} />{label}</Button>)}
      </div>
      {state.status === 'error' ? (
        <div className="download-unavailable-panel" role="alert">
          <p>{t('site.downloads.error')}</p>
          <div className="download-unavailable-actions">
            <Button variant="primary" onPress={() => setAttempt((count) => count + 1)}>{t('site.downloads.retry')}</Button>
            <a href={`${productRepositories.desktop}/releases`} target="_blank" rel="noreferrer">Desktop <RiArrowRightUpLine size={14} /></a>
            <a href={`${productRepositories.backend}/releases`} target="_blank" rel="noreferrer">Backend <RiArrowRightUpLine size={14} /></a>
          </div>
        </div>
      ) : (
        <div className="download-grid">
          {state.status === 'ready'
            ? <><DownloadCard key={`desktop-${state.catalog.checkedAt}`} product="desktop" platform={platform} releases={state.catalog.desktop} /><DownloadCard key={`backend-${state.catalog.checkedAt}`} product="backend" platform={platform} releases={state.catalog.backend} /></>
            : <><DownloadCardSkeleton product="desktop" /><DownloadCardSkeleton product="backend" /></>}
        </div>
      )}
      <div className="download-extras"><p><RiDownloadLine size={16} /> {t('site.downloads.source')}</p>{state.status === 'ready' && <span className="mono">{t('site.downloads.updated', { date: new Date(state.catalog.checkedAt).toLocaleDateString(locale) })}</span>}</div>
      <div className="mobile-release"><div><span className="mobile-release-icon">↗</span><span><strong>{t('site.downloads.mobileTitle')}</strong><small>{t('site.downloads.mobileBody')}</small></span></div><span className="coming-soon mono">{t('site.downloads.mobileStatus')}</span></div>
      <p className="browser-alternative">{t('site.downloads.hasBackend')}<a href="/app" className={buttonVariants({ variant: 'ghost' })}>{t('site.downloads.openWeb')} <RiArrowRightUpLine size={16} /></a></p>
    </section>
  );
}
