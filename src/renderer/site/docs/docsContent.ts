// Docs content: a locale-independent structure (ids, slugs, hierarchy — these
// are the URLs) plus per-locale content packs providing titles, descriptions,
// and markdown bodies. getDocsContent(locale) assembles the localized bundle;
// missing pages/sections fall back to English so a partial translation never
// breaks navigation.
import type { Locale } from '../../i18n';
import { enDocs } from './docsContent.en';
import { zhCNDocs } from './docsContent.zh-CN';
import { jaDocs } from './docsContent.ja';
import { koDocs } from './docsContent.ko';

export type DocNavNode = {
  /** Unique tree key. For nodes with a page this is also the URL slug. */
  id: string;
  title: string;
  /** Slug of the page rendered when this node is activated. */
  page?: string;
  children?: DocNavNode[];
};

export type DocPage = {
  slug: string;
  title: string;
  description: string;
  /** Markdown body; the page header renders `title`/`description` above it. */
  body: string;
};

// One locale's content: section heading titles plus every page. Leaf nav
// titles are the page titles — no separate duplication.
export type DocsLocalePack = {
  sections: Record<string, string>;
  pages: Record<string, DocPage>;
};

// The shape of the docs tree. Language-independent: ids are also URL slugs, so
// they must stay identical across locales.
type DocNavSeed = {
  id: string;
  page?: string;
  children?: DocNavSeed[];
};

const docNavSeed: DocNavSeed[] = [
  {
    id: 'section-introduction',
    children: [
      { id: 'introduction', page: 'introduction' },
      { id: 'introduction/quick-start', page: 'introduction/quick-start' },
      { id: 'introduction/concepts', page: 'introduction/concepts' },
    ],
  },
  {
    id: 'section-backend',
    children: [
      { id: 'backend', page: 'backend' },
      { id: 'backend/install', page: 'backend/install' },
      { id: 'backend/configuration', page: 'backend/configuration' },
      { id: 'backend/security', page: 'backend/security' },
      { id: 'backend/api', page: 'backend/api' },
      { id: 'backend/external-api', page: 'backend/external-api' },
    ],
  },
  {
    id: 'section-desktop',
    children: [
      { id: 'desktop', page: 'desktop' },
      { id: 'desktop/setup', page: 'desktop/setup' },
      { id: 'desktop/connect', page: 'desktop/connect' },
      { id: 'desktop/workbench', page: 'desktop/workbench' },
    ],
  },
  {
    id: 'section-mobile',
    children: [{ id: 'mobile', page: 'mobile' }],
  },
];

const packs: Record<Locale, DocsLocalePack> = {
  en: enDocs,
  'zh-CN': zhCNDocs,
  ja: jaDocs,
  ko: koDocs,
};

export const defaultDocSlug = 'introduction';

// ---------- structure-derived data (locale-independent) ----------

// Flattened page order for previous/next navigation.
export const docPageOrder: string[] = [];
for (const node of docNavSeed) {
  const walk = (n: DocNavSeed) => {
    if (n.page) docPageOrder.push(n.page);
    n.children?.forEach(walk);
  };
  node.children?.forEach(walk);
}

// Ancestor keys (branch ids) that must be expanded for a slug to be visible.
function findAncestors(slug: string, nodes: DocNavSeed[], trail: string[]): string[] | null {
  for (const node of nodes) {
    if (node.id === slug || node.page === slug) return trail;
    if (node.children) {
      const hit = findAncestors(slug, node.children, [...trail, node.id]);
      if (hit) return hit;
    }
  }
  return null;
}

export function ancestorsOf(slug: string): string[] {
  return findAncestors(slug, docNavSeed, []) ?? [];
}

export const docsRootId = 'docs-root';

export const docSectionIds: string[] = docNavSeed.map((section) => section.id);

// slug → nav item id. Today ids equal page slugs, but keep the lookup so the
// two can diverge without breaking selection.
export const pageToItemId: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  const walk = (node: DocNavSeed) => {
    if (node.page) map.set(node.page, node.id);
    node.children?.forEach(walk);
  };
  docNavSeed.forEach(walk);
  return map;
})();

export function isDocSlug(slug: string): boolean {
  return pageToItemId.has(slug);
}

// ---------- localized bundle ----------

export type DocTreeItem = {
  title: string;
  page?: string;
  /** Group headers render plain (never collapsible, never navigable). */
  isSection?: boolean;
  children?: string[];
};

export type DocsContent = {
  /** Localized nav tree (section + page titles in the active locale). */
  nav: DocNavNode[];
  /** slug → localized page, with English fallback for untranslated pages. */
  pages: Record<string, DocPage>;
  /** Flat id → item map the tree's dataLoader reads. */
  treeItems: Record<string, DocTreeItem>;
  /** slug → { title, trail } for breadcrumbs. */
  navIndex: ReadonlyMap<string, { title: string; trail: string[] }>;
  /** Prunes nav to nodes matching `query`, flattened for the dataLoader. */
  filterTree: (query: string) => { items: Record<string, DocTreeItem>; expandedIds: string[] };
};

function buildNav(pack: DocsLocalePack): DocNavNode[] {
  const titleOf = (seed: DocNavSeed): string => {
    if (seed.page) return pack.pages[seed.page]?.title ?? enDocs.pages[seed.page]?.title ?? seed.id;
    return pack.sections[seed.id] ?? enDocs.sections[seed.id] ?? seed.id;
  };
  const map = (seed: DocNavSeed): DocNavNode => ({
    id: seed.id,
    title: titleOf(seed),
    page: seed.page,
    children: seed.children?.map(map),
  });
  return docNavSeed.map(map);
}

function buildContent(locale: Locale): DocsContent {
  const pack = packs[locale] ?? enDocs;
  // Per-page fallback: an untranslated page degrades to English instead of a hole.
  const pages: Record<string, DocPage> = { ...enDocs.pages, ...pack.pages };
  const nav = buildNav(pack);

  const treeItems: Record<string, DocTreeItem> = {
    [docsRootId]: { title: 'Docs', children: nav.map((section) => section.id) },
  };
  const navIndex = new Map<string, { title: string; trail: string[] }>();
  for (const section of nav) {
    treeItems[section.id] = {
      title: section.title,
      isSection: true,
      children: section.children?.map((child) => child.id) ?? [],
    };
    const walk = (node: DocNavNode, trail: string[]) => {
      treeItems[node.id] = {
        title: node.title,
        page: node.page,
        children: node.children?.map((child) => child.id),
      };
      const next = [...trail, node.title];
      if (node.page) navIndex.set(node.page, { title: node.title, trail: next });
      node.children?.forEach((child) => walk(child, next));
    };
    section.children?.forEach((child) => walk(child, [section.title]));
  }

  // A matching node keeps its whole subtree so context is preserved;
  // `expandedIds` lists every kept item so the filtered tree renders fully
  // expanded.
  const filterTree = (query: string) => {
    const q = query.trim().toLowerCase();
    const items: Record<string, DocTreeItem> = { [docsRootId]: { title: 'Docs', children: [] } };

    const prune = (node: DocNavNode): DocNavNode | null => {
      const children = node.children?.map(prune).filter((k): k is DocNavNode => k !== null);
      if (node.title.toLowerCase().includes(q)) return node;
      if (children?.length) return { ...node, children };
      return null;
    };

    const register = (node: DocNavNode) => {
      items[node.id] = { title: node.title, page: node.page, children: node.children?.map((c) => c.id) };
      node.children?.forEach(register);
    };

    for (const section of nav) {
      const kept = section.title.toLowerCase().includes(q)
        ? section.children
        : section.children?.map(prune).filter((k): k is DocNavNode => k !== null);
      if (!kept?.length) continue;
      items[docsRootId].children!.push(section.id);
      items[section.id] = { title: section.title, isSection: true, children: kept.map((c) => c.id) };
      kept.forEach(register);
    }

    return { items, expandedIds: Object.keys(items).filter((id) => id !== docsRootId) };
  };

  return { nav, pages, treeItems, navIndex, filterTree };
}

const contentCache = new Map<Locale, DocsContent>();

export function getDocsContent(locale: Locale): DocsContent {
  let content = contentCache.get(locale);
  if (!content) {
    content = buildContent(locale);
    contentCache.set(locale, content);
  }
  return content;
}
