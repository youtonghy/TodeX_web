import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '@heroui/react';
import { useTree } from '@headless-tree/react';
import { hotkeysCoreFeature, selectionFeature, syncDataLoaderFeature } from '@headless-tree/core';
import { Markdown, type MarkdownProps } from '@heroui-pro/react/markdown';
import { RiArrowLeftLine, RiArrowRightLine, RiArrowRightUpLine, RiBookOpenLine, RiCloseLine, RiGithubLine, RiMenuLine, RiSearchLine } from '@remixicon/react';
import { baseMarkdownComponents } from '../../components/markdownComponents';
import { Tree, TreeItem, TreeItemLabel } from '../../components/reui/tree';
import { useLocale, useT, type Locale } from '../../i18n';
import brand from '../../assets/brand/t-icon-light.png';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { ancestorsOf, defaultDocSlug, docPageOrder, docSectionIds, docsRootId, getDocsContent, isDocSlug, pageToItemId, type DocTreeItem } from './docsContent';
import './docs.css';

const repository = 'https://github.com/youtonghy/TodeX_desktop';

function slugFromPath(pathname: string): string {
  const slug = pathname.replace(/^\/docs\/?/, '').replace(/\/+$/, '');
  return isDocSlug(slug) ? slug : defaultDocSlug;
}

function docsPath(slug: string) {
  return `/docs/${slug}`;
}

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[`*_~]/g, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
}

function textOf(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (typeof node === 'object' && 'props' in node) return textOf((node.props as { children?: ReactNode }).children);
  return '';
}

type TocEntry = { id: string; text: string; depth: 2 | 3 };

function tocOf(markdown: string): TocEntry[] {
  const entries: TocEntry[] = [];
  let inFence = false;
  for (const line of markdown.split('\n')) {
    if (line.trimStart().startsWith('```')) inFence = !inFence;
    if (inFence) continue;
    const match = /^(#{2,3})\s+(.+?)\s*#*$/.exec(line);
    if (match) entries.push({ id: slugify(match[2]), text: match[2], depth: match[1].length as 2 | 3 });
  }
  return entries;
}

export function DocsPage() {
  const locale = useLocale();
  // Remount on locale change: useTree captures the dataLoader (and its items
  // map) at creation, so a fresh instance is what relocalizes nav titles.
  // The current page survives the remount via the URL.
  return <DocsPageView key={locale} locale={locale} />;
}

function DocsPageView({ locale }: { locale: Locale }) {
  const t = useT();
  const docs = getDocsContent(locale);
  const [slug, setSlug] = useState(() => slugFromPath(window.location.pathname));
  // Folders the user opened/closed. Section ids always stay expanded (they are
  // non-folder group headers whose children render while the id is expanded).
  const [expanded, setExpanded] = useState<string[]>(() => [
    ...new Set([...docSectionIds, ...ancestorsOf(slugFromPath(window.location.pathname))]),
  ]);
  const [query, setQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeHeading, setActiveHeading] = useState('');
  const contentRef = useRef<HTMLElement>(null);

  const page = docs.pages[slug] ?? docs.pages[defaultDocSlug];
  const toc = useMemo(() => tocOf(page.body), [page.body]);
  const index = docPageOrder.indexOf(page.slug);
  const prev = index > 0 ? docs.pages[docPageOrder[index - 1]] : null;
  const next = index >= 0 && index < docPageOrder.length - 1 ? docs.pages[docPageOrder[index + 1]] : null;
  const crumbs = docs.navIndex.get(page.slug)?.trail ?? [page.title];
  const searching = query.trim().length > 0;
  const filtered = useMemo(() => (searching ? docs.filterTree(query) : null), [docs, searching, query]);
  const items = filtered?.items ?? docs.treeItems;
  const expandedItems = filtered?.expandedIds ?? expanded;
  const selectedItems = useMemo(() => [pageToItemId.get(page.slug) ?? page.slug], [page.slug]);

  const navigate = useCallback((target: string) => {
    if (!isDocSlug(target)) return;
    window.history.pushState(null, '', docsPath(target));
    setSlug(target);
    setExpanded((prev) => [...new Set([...prev, ...ancestorsOf(target)])]);
    setDrawerOpen(false);
    window.scrollTo({ top: 0 });
  }, []);

  const tree = useTree<DocTreeItem>({
    rootItemId: docsRootId,
    state: { expandedItems, selectedItems },
    setExpandedItems: (ids) => {
      if (!searching) setExpanded(ids);
    },
    getItemName: (item) => item.getItemData()?.title ?? '',
    isItemFolder: (item) => !item.getItemData()?.isSection && (item.getItemData()?.children?.length ?? 0) > 0,
    dataLoader: {
      getItem: (itemId) => items[itemId],
      getChildren: (itemId) => items[itemId]?.children ?? [],
    },
    onPrimaryAction: (item) => {
      const target = item.getItemData()?.page;
      if (target) navigate(target);
    },
    features: [syncDataLoaderFeature, selectionFeature, hotkeysCoreFeature],
  });

  useEffect(() => {
    const onPop = () => {
      const next = slugFromPath(window.location.pathname);
      setSlug(next);
      setExpanded((prev) => [...new Set([...prev, ...ancestorsOf(next)])]);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    document.title = t('docs.meta.title', { page: page.title });
    setActiveHeading('');
    // Deep links: restore the anchor once the new page has rendered.
    const anchor = window.location.hash.slice(1);
    if (anchor) requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView());
  }, [page.slug, page.title, t]);

  // "/" focuses the docs search, like most documentation sites.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== '/' || target?.closest('input, textarea, [contenteditable="true"]')) return;
      event.preventDefault();
      document.querySelector<HTMLInputElement>('.docs-search input')?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Scroll-spy for the right-hand outline.
  useEffect(() => {
    const root = contentRef.current;
    if (!root || !toc.length) return;
    const headings = toc
      .map((entry) => root.querySelector<HTMLElement>(`#${CSS.escape(entry.id)}`))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!headings.length) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) setActiveHeading(entry.target.id);
    }, { rootMargin: '-96px 0px -70% 0px' });
    headings.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [page.slug, toc]);

  const markdownComponents = useMemo<NonNullable<MarkdownProps['components']>>(() => ({
    ...baseMarkdownComponents,
    h2: ({ children, node: _node, ...props }) => <h2 id={slugify(textOf(children))} {...props}>{children}</h2>,
    h3: ({ children, node: _node, ...props }) => <h3 id={slugify(textOf(children))} {...props}>{children}</h3>,
    a: ({ href, children, node: _node, ref: _ref, ...props }) => {
      const internal = href?.startsWith('/docs/') ? href.replace(/^\/docs\/?/, '') : null;
      return (
        <a {...props} href={href} target={href?.startsWith('http') ? '_blank' : undefined} rel={href?.startsWith('http') ? 'noreferrer' : undefined}
          onClick={internal ? (event) => { event.preventDefault(); navigate(internal); } : undefined}>
          {children}
        </a>
      );
    },
  }), [navigate]);

  // Escape closes the mobile nav drawer.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const nav = (
    <>
      <label className="docs-search">
        <RiSearchLine size={14} />
        <input type="search" value={query} placeholder={t('docs.search.placeholder')} aria-label={t('docs.search.placeholder')}
          onChange={(event) => setQuery(event.target.value)} />
        <kbd>/</kbd>
      </label>
      {searching && !filtered?.expandedIds.length ? <p className="docs-no-results">{t('docs.nav.noResults')}</p> : null}
      <Tree tree={tree} indent={16} toggleIconType="chevron" className="docs-tree" aria-label={t('docs.nav.main')}>
        {tree.getItems().map((item) => {
          const data = item.getItemData();
          return (
            <TreeItem
              key={item.getId()}
              item={item}
              className={data.isSection ? 'docs-tree-section' : undefined}
              aria-current={data.page === page.slug ? 'page' : undefined}
            >
              <TreeItemLabel>{data.title}</TreeItemLabel>
            </TreeItem>
          );
        })}
      </Tree>
    </>
  );

  return (
    <div className="docs-page">
      <header className="docs-header">
        <a className="docs-brand" href="/" aria-label={t('site.brand.home')}>
          <img src={brand} alt="" width="26" height="26" />
          <span>Tode<span className="brand-x">X</span><span className="brand-period">.</span></span>
        </a>
        <span className="docs-brand-divider" aria-hidden="true">/</span>
        <a className="docs-section-link" href="/docs"><RiBookOpenLine size={14} /> {t('docs.brand')}</a>
        <div className="docs-header-actions">
          <LanguageSwitcher />
          <a className="docs-header-link" href={repository} target="_blank" rel="noreferrer" aria-label="GitHub"><RiGithubLine size={17} /></a>
          <a href="/app" className="docs-open-app">{t('site.nav.openApp')} <RiArrowRightUpLine size={13} /></a>
          <Button variant="ghost" isIconOnly className="docs-nav-toggle" aria-label={drawerOpen ? t('site.nav.closeMenu') : t('site.nav.openMenu')}
            aria-expanded={drawerOpen} onPress={() => setDrawerOpen(!drawerOpen)}>
            {drawerOpen ? <RiCloseLine size={19} /> : <RiMenuLine size={19} />}
          </Button>
        </div>
      </header>

      <div className="docs-layout">
        {/* One <aside> serves both layouts: sticky sidebar on desktop, fixed
            drawer on mobile — the headless-tree instance must mount in exactly
            one place, so the nav is not duplicated across containers. */}
        <aside className={`docs-sidebar${drawerOpen ? ' open' : ''}`} aria-label={t('docs.nav.main')}>
          <div className="docs-drawer-head">
            <span>{t('docs.brand')}</span>
            <Button variant="ghost" isIconOnly aria-label={t('site.nav.closeMenu')} onPress={() => setDrawerOpen(false)}>
              <RiCloseLine size={18} />
            </Button>
          </div>
          <nav className="docs-nav">{nav}</nav>
        </aside>

        <main className="docs-content" ref={contentRef}>
          <nav className="docs-breadcrumb" aria-label={t('docs.breadcrumb.label')}>
            {crumbs.slice(0, -1).map((crumb) => <span key={crumb}>{crumb}</span>)}
            <span className="docs-crumb-current">{crumbs[crumbs.length - 1]}</span>
          </nav>
          <h1 className="docs-title">{page.title}</h1>
          <p className="docs-description">{page.description}</p>
          <Markdown id={page.slug} components={markdownComponents}>{page.body}</Markdown>
          <nav className="docs-prev-next" aria-label={t('docs.pagination.label')}>
            {prev ? (
              <a className="docs-pager prev" href={docsPath(prev.slug)} onClick={(event) => { event.preventDefault(); navigate(prev.slug); }}>
                <RiArrowLeftLine size={15} />
                <span><small>{t('docs.pager.prev')}</small>{prev.title}</span>
              </a>
            ) : <span />}
            {next ? (
              <a className="docs-pager next" href={docsPath(next.slug)} onClick={(event) => { event.preventDefault(); navigate(next.slug); }}>
                <span><small>{t('docs.pager.next')}</small>{next.title}</span>
                <RiArrowRightLine size={15} />
              </a>
            ) : null}
          </nav>
        </main>

        <aside className="docs-toc" aria-label={t('docs.toc.label')}>
          {toc.length ? (
            <>
              <p className="docs-toc-title">{t('docs.toc.label')}</p>
              <ul>
                {toc.map((entry) => (
                  <li key={entry.id} className={entry.depth === 3 ? 'depth-3' : undefined}>
                    <a href={`#${entry.id}`} className={activeHeading === entry.id ? 'active' : undefined}
                      onClick={(event) => {
                        event.preventDefault();
                        document.getElementById(entry.id)?.scrollIntoView({ behavior: 'smooth' });
                        window.history.replaceState(null, '', `#${entry.id}`);
                      }}>
                      {entry.text}
                    </a>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </aside>
      </div>

      {drawerOpen ? (
        <div className="docs-nav-overlay" role="presentation" onClick={() => setDrawerOpen(false)} />
      ) : null}
    </div>
  );
}
