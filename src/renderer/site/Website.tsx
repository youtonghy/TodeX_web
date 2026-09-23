import { useEffect, useState } from 'react';
import { Button } from '@heroui/react';
import { buttonVariants } from '@heroui/styles';
import { RiAddLine, RiArrowDownLine, RiArrowRightLine, RiArrowRightUpLine, RiCheckLine, RiCloseLine, RiCodeSSlashLine, RiCommandLine, RiComputerLine, RiFileCopyLine, RiFileTextLine, RiFolder3Line, RiGitBranchLine, RiGithubLine, RiGlobalLine, RiMenuLine, RiMoreLine, RiServerLine, RiShieldCheckLine, RiTerminalBoxLine } from '@remixicon/react';
import { ProviderIcon } from '../components/ProviderIcon';
import { useLocale, useT } from '../i18n';
import brand from '../assets/brand/t-icon-light.png';
import { Downloads } from './Downloads';
import { LanguageSwitcher } from './LanguageSwitcher';

const repository = 'https://github.com/youtonghy/TodeX_desktop';
const backendRepository = 'https://github.com/youtonghy/TodeX_backend';
// Mirrors the backend provider drivers (TodeX_backend/src/provider); ACP is rendered separately with a generic icon.
const supportedAgents = [{ id: 'codex', label: 'Codex' }, { id: 'claude', label: 'Claude Code' }, { id: 'pi', label: 'Pi' }, { id: 'grok', label: 'Grok Build' }, { id: 'devin', label: 'Devin' }, { id: 'opencode', label: 'OpenCode' }];

function Brand({ footer = false }: { footer?: boolean }) {
  const t = useT();
  return <a className={`site-brand${footer ? ' footer-brand' : ''}`} href="/" aria-label={t('site.brand.home')}><img src={brand} alt="" width="36" height="36" /><span>Tode<span className="brand-x">X</span><span className="brand-period">.</span></span></a>;
}

function Navigation() {
  const t = useT();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  const links = [{ href: '#possibilities', label: t('site.nav.possibilities') }, { href: '#how-it-works', label: t('site.nav.how') }, { href: '#downloads', label: t('site.nav.downloads') }];
  return <header className="site-header">
    <nav className="site-nav" aria-label={t('site.nav.main')}><Brand /><div className="desktop-nav-links">{links.map((link) => <a href={link.href} key={link.href}>{link.label}</a>)}</div><div className="nav-actions"><LanguageSwitcher /><a href="/app" className={`${buttonVariants({ variant: 'primary' })} site-button nav-app`}>{t('site.nav.openApp')} <RiArrowRightUpLine size={16} /></a><Button variant="ghost" isIconOnly className="mobile-menu-button" aria-label={open ? t('site.nav.closeMenu') : t('site.nav.openMenu')} aria-expanded={open} aria-controls="mobile-navigation" onPress={() => setOpen(!open)}>{open ? <RiCloseLine size={21} /> : <RiMenuLine size={21} />}</Button></div></nav>
    {open && <nav id="mobile-navigation" className="mobile-navigation" aria-label={t('site.nav.mobile')}><LanguageSwitcher className="mobile-language-switcher" />{links.map((link) => <a href={link.href} key={link.href} onClick={() => setOpen(false)}>{link.label}<RiArrowRightUpLine size={17} /></a>)}<a href={repository} target="_blank" rel="noreferrer">GitHub<RiGithubLine size={17} /></a></nav>}
  </header>;
}

function WorkbenchPreview() {
  const t = useT();
  return <div className="workbench-preview" role="img" aria-label={t('site.preview.ariaLabel')}>
    <div className="preview-titlebar"><div className="window-dots"><i /><i /><i /></div><span><img src={brand} alt="" /> TodeX <span className="preview-title-slash">/</span> your next big idea</span><span className="preview-demo-label">{t('site.preview.demoLabel')}</span></div>
    <div className="preview-content">
      <aside className="preview-sidebar"><div className="preview-sidebar-heading">{t('site.preview.workspace')} <RiAddLine size={14} /></div><div className="preview-project"><RiFolder3Line size={17} /> my-next-project <RiMoreLine size={14} /></div><div className="preview-thread active"><span className="thread-dot" />{t('site.preview.thread1')}</div><div className="preview-thread"><span className="thread-dot muted" />{t('site.preview.thread2')}</div><div className="preview-thread"><span className="thread-dot muted" />{t('site.preview.thread3')}</div><div className="preview-sidebar-heading recent-heading">{t('site.preview.agents')}</div>{[{ id: 'codex', label: 'Codex' }, { id: 'claude', label: 'Claude Code' }, { id: 'pi', label: 'Pi' }].map((provider) => <div className="preview-provider" key={provider.id}><ProviderIcon provider={provider.id} className="size-4" />{provider.label}<i /></div>)}<div className="preview-connection"><span /> {t('site.preview.backend')} <RiShieldCheckLine size={13} /></div></aside>
      <div className="preview-chat"><div className="preview-chat-heading"><span>{t('site.preview.thread1')} <span className="preview-model-label">Codex</span></span><RiMoreLine size={18} /></div><div className="preview-chat-body"><div className="preview-user-message">{t('site.preview.userMessage')}</div><div className="preview-agent-heading"><ProviderIcon provider="codex" className="size-5" /><strong>Codex</strong><span>{t('site.preview.agentRole')}</span></div><p>{t('site.preview.agentIntro1')}<br />{t('site.preview.agentIntro2')}</p><div className="preview-tool"><RiCheckLine size={14} /><span>{t('site.preview.tool1')}</span><span className="mono">3 files</span></div><div className="preview-tool"><RiCheckLine size={14} /><span>{t('site.preview.tool2')}</span><span className="mono">+128 −16</span></div><p className="preview-finish">{t('site.preview.finish')}</p></div><div className="preview-composer"><span>{t('site.preview.composer')}</span><div><span><RiAddLine size={15} /><span>Codex</span><span className="preview-reasoning">{t('site.preview.reasoning')}</span></span><span className="preview-send"><RiArrowRightLine size={14} /></span></div></div></div>
      <aside className="preview-workbench"><div className="preview-workbench-tabs"><span className="active"><RiGitBranchLine size={13} /> {t('site.preview.tabChanges')}</span><span><RiTerminalBoxLine size={13} /> {t('site.preview.tabTerminal')}</span></div><div className="preview-file"><RiFileTextLine size={14} /> src / App.tsx <span>+24 −8</span></div><div className="preview-code"><div><span>01</span> <em>export default</em> function App() {'{'}</div><div><span>02</span> &nbsp; return (</div><div className="added"><span>03</span> + &nbsp; &lt;YourNextIdea</div><div className="added"><span>04</span> + &nbsp; &nbsp; possibilities="endless"</div><div className="added"><span>05</span> + &nbsp; &nbsp; workspace="anywhere"</div><div className="added"><span>06</span> + &nbsp; /&gt;</div><div><span>07</span> &nbsp; );</div><div><span>08</span> {'}'}</div></div><div className="preview-terminal"><span><RiTerminalBoxLine size={13} /> TERMINAL</span><p><b>❯</b> pnpm dev</p><p className="terminal-success">✓ Ready. Let's build something.</p><p>Local: &nbsp; http://localhost:5173/</p></div></aside>
    </div>
  </div>;
}

function CopyCommand() {
  const t = useT();
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  useEffect(() => { if (status === 'idle') return; const timer = window.setTimeout(() => setStatus('idle'), 2400); return () => clearTimeout(timer); }, [status]);
  return <div className="setup-command"><code><span>$</span> todex-agentd tui</code><Button isIconOnly variant="ghost" aria-label={status === 'copied' ? t('site.how.copy.copied') : t('site.how.copy.label')} onPress={async () => { try { await navigator.clipboard.writeText('todex-agentd tui'); setStatus('copied'); } catch { setStatus('failed'); } }}>{status === 'copied' ? <RiCheckLine size={16} /> : <RiFileCopyLine size={16} />}</Button><span className="copy-status" role="status">{status === 'copied' ? t('site.how.copy.done') : status === 'failed' ? t('site.how.copy.failed') : ''}</span></div>;
}

export function Website() {
  const t = useT();
  const locale = useLocale();
  useEffect(() => {
    document.title = t('site.meta.title');
    document.querySelector('meta[name="description"]')?.setAttribute('content', t('site.meta.description'));
  }, [t, locale]);
  useEffect(() => {
    // The page is a deferred entry, so restore direct section links after mount.
    const section = document.getElementById(window.location.hash.slice(1));
    section?.scrollIntoView({ behavior: 'instant' });
  }, []);
  return <div className="website">
    <a href="#main-content" className="skip-link">{t('site.skip')}</a>
    <div className="hero-sky" aria-hidden="true" />
    <Navigation />
    <main id="main-content">
      <section className="hero" aria-labelledby="hero-heading">
        <a href="#downloads" className="hero-badge mono"><span /> TODEX 2.0 <span className="badge-divider">/</span> {t('site.hero.badge')} <RiArrowRightUpLine size={12} /></a>
        <h1 id="hero-heading">{t('site.hero.title1')}<br />{t('site.hero.title2')}<span className="hero-highlight">{t('site.hero.titleHighlight')}<svg viewBox="0 0 360 18" preserveAspectRatio="none" aria-hidden="true"><path d="M3 13Q130-2 353 8M46 16Q216 7 357 14" /></svg></span>{t('site.hero.title3')}</h1>
        <p className="hero-description">{t('site.hero.description')}<br /><span>{t('site.hero.subtitle')}</span></p>
        <div className="hero-actions"><a href="#downloads" className={`${buttonVariants({ variant: 'primary', size: 'lg' })} site-button hero-download`}><RiArrowDownLine size={18} /> {t('site.hero.download')} <RiArrowRightUpLine size={17} /></a><a href="/app" className="hero-secondary">{t('site.hero.openBrowser')} <RiArrowRightLine size={17} /></a></div>
        <div className="hero-footnotes"><span><RiGithubLine size={14} /> {t('site.hero.footnote')}</span><a href="#workspace">{t('site.hero.explore')} <RiArrowDownLine size={13} /></a><span className="mono">BUILT FOR YOUR NEXT IDEA ↗</span></div>
      </section>
      <section className="workspace-section section-width" id="workspace" aria-label={t('site.preview.sectionLabel')}><WorkbenchPreview /><div className="preview-caption"><span><span className="tiny-dot" /> ONE WORKSPACE. EVERY POSSIBILITY.</span><p>{t('site.preview.caption')}</p></div></section>
      <section className="providers section-width" aria-label={t('site.providers.label')}><p className="mono">YOUR FAVORITE AGENTS.<br /><span>ONE CONNECTED WORKSPACE.</span></p><div className="provider-marquee"><div className="provider-track">{[false, true].map((duplicate) => <div className="provider-group" key={String(duplicate)} aria-hidden={duplicate || undefined}>{supportedAgents.map((provider) => <span className="provider-wordmark" key={provider.id}><ProviderIcon provider={provider.id} className="site-provider-icon" />{provider.label}</span>)}<span className="provider-wordmark"><RiCodeSSlashLine size={26} /> ACP</span></div>)}</div></div></section>
      <section className="possibilities section-width" id="possibilities" aria-labelledby="possibilities-heading"><div className="section-heading split-heading"><div><span className="eyebrow"><span /> LESS FRICTION. MORE CREATION.</span><h2 id="possibilities-heading">{t('site.features.title1')}<br /><span>{t('site.features.title2')}</span></h2></div><p>{t('site.features.lede1')}<br />{t('site.features.lede2')}<br />{t('site.features.lede3')}</p></div>
        <div className="features-grid">
          <article className="feature-card feature-agents"><div className="feature-visual agents-visual" aria-hidden="true"><div className="agent-orbit orbit-outer" /><div className="agent-orbit orbit-inner" /><span className="orbit-center"><img src={brand} alt="" /></span><span className="orbit-node orbit-codex"><ProviderIcon provider="codex" className="size-7" /></span><span className="orbit-node orbit-claude"><ProviderIcon provider="claude" className="size-7" /></span><span className="orbit-node orbit-pi"><ProviderIcon provider="pi" className="size-6" /></span><span className="orbit-node orbit-code"><RiCodeSSlashLine size={25} /></span></div><div className="feature-copy"><span className="mono feature-number">01 / CONNECT</span><h3>{t('site.features.agents.title')}</h3><p>{t('site.features.agents.body')}</p><a href={`${backendRepository}#key-features`} target="_blank" rel="noreferrer">{t('site.features.agents.link')} <RiArrowRightUpLine size={16} /></a></div></article>
          <article className="feature-card"><div className="feature-visual tools-visual" aria-hidden="true"><div className="tool-stack stack-back"><RiTerminalBoxLine size={17} /><span>Terminal</span><span className="tool-key">⌘ 3</span></div><div className="tool-stack stack-middle"><RiGitBranchLine size={17} /><span>Git changes</span><span className="tool-diff">+128 −16</span></div><div className="tool-stack stack-front"><RiCommandLine size={17} /><span>Skills & MCP</span><span className="tool-key">⌘ K</span></div></div><div className="feature-copy"><span className="mono feature-number">02 / CREATE</span><h3>{t('site.features.tools.title')}</h3><p>{t('site.features.tools.body')}</p><a href="/app">{t('site.features.tools.link')} <RiArrowRightUpLine size={16} /></a></div></article>
          <article className="feature-card"><div className="feature-visual privacy-visual" aria-hidden="true"><div className="privacy-ring"><RiShieldCheckLine size={49} strokeWidth={0.3} /></div><div className="privacy-tag mono"><span /> YOUR MACHINE. YOUR RULES.</div><span className="privacy-spark spark-one">+</span><span className="privacy-spark spark-two">+</span></div><div className="feature-copy"><span className="mono feature-number">03 / OWN</span><h3>{t('site.features.privacy.title')}</h3><p>{t('site.features.privacy.body')}</p><a href={`${backendRepository}#key-features`} target="_blank" rel="noreferrer">{t('site.features.privacy.link')} <RiArrowRightUpLine size={16} /></a></div></article>
        </div>
      </section>
      <section className="how-section" id="how-it-works" aria-labelledby="how-heading"><div className="section-width how-inner"><div className="how-intro"><span className="eyebrow"><span /> LOCAL ROOTS. LIMITLESS REACH.</span><h2 id="how-heading">{t('site.how.title1')}<br />{t('site.how.title2')}</h2><p>{t('site.how.lede1')}<br />{t('site.how.lede2')}</p><a href={`${backendRepository}#quick-start`} target="_blank" rel="noreferrer" className="text-link">{t('site.how.guide')} <RiArrowRightUpLine size={17} /></a><div className="connection-map" aria-label={t('site.how.mapLabel')}><div className="connection-clients"><span><RiComputerLine size={20} /> Desktop</span><span><RiGlobalLine size={20} /> Web</span></div><div className="connection-lines" aria-hidden="true"><span /><span /></div><div className="connection-backend"><RiServerLine size={24} /><span>{t('site.how.backend')}<small>{t('site.how.backendSub')}</small></span><i /></div></div></div><ol className="setup-steps"><li><span className="step-number mono">01</span><div><h3>{t('site.how.step1.title')}</h3><p>{t('site.how.step1.body')}</p><CopyCommand /></div></li><li><span className="step-number mono">02</span><div><h3>{t('site.how.step2.title')}</h3><p>{t('site.how.step2.body')}</p><span className="step-note"><RiShieldCheckLine size={14} /> {t('site.how.step2.note')}</span></div></li><li><span className="step-number mono">03</span><div><h3>{t('site.how.step3.title')}</h3><p>{t('site.how.step3.body')}</p><a href="/app" className="text-link">{t('site.how.step3.link')} <RiArrowRightLine size={16} /></a></div></li></ol></div></section>
      <Downloads />
      <section className="closing-section"><span className="eyebrow"><span /> THE NEXT CHAPTER IS YOURS</span><h2>{t('site.closing.title')}</h2><p>{t('site.closing.body')}</p><a href="/app" className={`${buttonVariants({ variant: 'primary', size: 'lg' })} site-button`}>{t('site.closing.cta')} <RiArrowRightUpLine size={18} /></a><span className="closing-coordinate mono" aria-hidden="true">IDEA → BUILD → WHAT'S NEXT?</span></section>
    </main>
    <footer className="site-footer section-width"><div className="footer-top"><div><Brand footer /><p>{t('site.footer.tagline')}<br /><span className="mono">AN OPEN WORKSPACE FOR OPEN POSSIBILITIES.</span></p></div><div className="footer-links"><div><span className="mono">PRODUCT</span><a href="#possibilities">{t('site.nav.possibilities')}</a><a href="#downloads">{t('site.footer.download')}</a><a href="/app">{t('site.footer.workbench')}</a></div><div><span className="mono">RESOURCES</span><a href={`${backendRepository}#quick-start`} target="_blank" rel="noreferrer">{t('site.footer.quickstart')} <RiArrowRightUpLine size={12} /></a><a href={`${repository}/blob/main/${locale === 'zh-CN' ? 'README.zh-CN.md' : 'README.md'}`} target="_blank" rel="noreferrer">{t('site.footer.docs')} <RiArrowRightUpLine size={12} /></a><a href={`${repository}/issues`} target="_blank" rel="noreferrer">{t('site.footer.issues')} <RiArrowRightUpLine size={12} /></a></div><div><span className="mono">OPEN SOURCE</span><a href={repository} target="_blank" rel="noreferrer">Desktop <RiArrowRightUpLine size={12} /></a><a href={backendRepository} target="_blank" rel="noreferrer">Backend <RiArrowRightUpLine size={12} /></a><span className="footer-mobile-status">{t('site.footer.mobile')}</span></div></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} TodeX. <span className="footer-license">Released under the MIT License.</span></span><a href={repository} target="_blank" rel="noreferrer"><RiGithubLine size={15} /> {t('site.footer.open')} <RiArrowRightUpLine size={13} /></a></div></footer>
  </div>;
}
