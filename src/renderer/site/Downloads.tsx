import { useState } from 'react';
import { Button, ListBox, Select } from '@heroui/react';
import { buttonVariants } from '@heroui/styles';
import { RiAppleFill, RiArrowDownLine, RiArrowRightUpLine, RiComputerLine, RiDownloadLine, RiServerLine, RiWindowsFill } from '@remixicon/react';
import catalog from './releases.json';

type Platform = 'macos' | 'windows' | 'linux';
type Product = 'desktop' | 'backend';
type Asset = typeof catalog.desktop[number]['assets'][number];

const platforms = [
  { id: 'macos' as const, label: 'macOS', Icon: RiAppleFill },
  { id: 'windows' as const, label: 'Windows', Icon: RiWindowsFill },
  { id: 'linux' as const, label: 'Linux', Icon: RiComputerLine },
];

function initialPlatform(): Platform {
  const agent = navigator.userAgent.toLowerCase();
  if (agent.includes('windows')) return 'windows';
  if (agent.includes('linux') && !agent.includes('android')) return 'linux';
  return 'macos';
}

function packageLabel(asset: Asset) {
  const architecture = asset.name.includes('arm64') ? 'ARM64' : /x64|x86_64/.test(asset.name) ? 'x64' : '通用安装包';
  const format = asset.name.endsWith('.tar.gz') ? 'tar.gz' : asset.name.split('.').at(-1);
  return { architecture, format, size: `${(asset.size / 1024 / 1024).toFixed(1)} MB` };
}

function DownloadCard({ product, platform }: { product: Product; platform: Platform }) {
  const releases = catalog[product];
  const [version, setVersion] = useState(releases[0].version);
  const release = releases.find((item) => item.version === version) ?? releases[0];
  const desktop = product === 'desktop';
  const assets = release.assets.filter((asset) => asset.name.includes(`-${platform}-`)
    && (desktop ? /\.(dmg|exe|AppImage)$/.test(asset.name) : /\.(tar\.gz|zip)$/.test(asset.name)));
  const checksums = release.assets.find((asset) => asset.name === 'SHA256SUMS');
  const Icon = desktop ? RiComputerLine : RiServerLine;

  return (
    <article className="download-card" aria-label={desktop ? 'Desktop 下载' : 'Backend 下载'}>
      <div className="download-card-top"><span className="product-symbol"><Icon size={23} /></span><span className="mono">{desktop ? '01 / YOUR WORKSPACE' : '02 / YOUR ENGINE'}</span></div>
      <h3>TodeX {desktop ? 'Desktop' : 'Backend'}</h3>
      <p className="download-description">{desktop ? '为专注而生的桌面工作台。对话、代码与终端，在同一个窗口。' : '运行在你自己的电脑或服务器上，为每一端提供统一的智能体运行环境。'}</p>
      <div className="release-control">
        <Select aria-label={`${desktop ? 'Desktop' : 'Backend'} 版本`} value={version} onChange={(value) => { if (typeof value === 'string') setVersion(value); }} className="release-select">
          <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
          <Select.Popover className="website-select-popover"><ListBox>
            {releases.map((item) => <ListBox.Item key={item.version} id={item.version} textValue={item.version}>{item.version}<ListBox.ItemIndicator /></ListBox.Item>)}
          </ListBox></Select.Popover>
        </Select>
        <span className="release-status"><i />{version === releases[0].version ? '稳定版本' : '历史版本'}</span>
      </div>
      <div className="download-assets" aria-live="polite">
        {assets.length ? assets.map((asset) => {
          const info = packageLabel(asset);
          return <a className="download-asset" key={asset.name} href={asset.url} aria-label={`下载 ${desktop ? 'Desktop' : 'Backend'} ${version} ${platform} ${info.architecture}`}>
            <span><strong>{platform === 'macos' ? 'Apple Silicon' : info.architecture}</strong><small>{info.format} <span>·</span> {info.size}</small></span>
            <span className="asset-download-icon"><RiArrowDownLine size={19} /></span>
          </a>;
        }) : <p className="download-unavailable">此版本暂无该平台安装包。请切换平台或查看发布记录。</p>}
      </div>
      <div className="download-card-footer"><a href={release.url} target="_blank" rel="noreferrer">版本说明 <RiArrowRightUpLine size={14} /></a>{checksums && <a href={checksums.url}>SHA256 校验 <RiArrowRightUpLine size={14} /></a>}</div>
    </article>
  );
}

export function Downloads() {
  const [platform, setPlatform] = useState<Platform>(initialPlatform);
  return (
    <section className="downloads section-width" id="downloads" aria-labelledby="download-heading">
      <div className="section-heading centered"><span className="eyebrow"><span /> READY WHEN YOU ARE</span><h2 id="download-heading">准备好，让创造发生。</h2><p>选择你的平台。安装 Backend，再用 Desktop 或浏览器连接。</p></div>
      <div className="platform-picker" role="group" aria-label="下载平台">
        {platforms.map(({ id, label, Icon }) => <Button key={id} variant="ghost" aria-pressed={platform === id} className={platform === id ? 'platform-button selected' : 'platform-button'} onPress={() => setPlatform(id)}><Icon size={18} />{label}</Button>)}
      </div>
      <div className="download-grid"><DownloadCard product="desktop" platform={platform} /><DownloadCard product="backend" platform={platform} /></div>
      <div className="download-extras"><p><RiDownloadLine size={16} /> 所有安装包均来自官方 GitHub Releases</p><span className="mono">更新于 {catalog.checkedAt}</span></div>
      <div className="mobile-release"><div><span className="mobile-release-icon">↗</span><span><strong>下一站，移动端。</strong><small>把工作区装进口袋。TodeX App 正在准备中。</small></span></div><span className="coming-soon mono">暂缓发布 / COMING LATER</span></div>
      <p className="browser-alternative">已经有 Backend？<a href="/app" className={buttonVariants({ variant: 'ghost' })}>直接打开网页版 <RiArrowRightUpLine size={16} /></a></p>
    </section>
  );
}
