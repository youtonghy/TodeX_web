import { describe, expect, it } from 'vitest';
import { DEMO_SCENES, demoSceneUrl, isDemoScene } from '../../src/renderer/demo/playback';
import { SUPPORTED_LOCALES, translate, type MessageKey } from '../../src/renderer/i18n';
import {
  docPageOrder,
  extractDemoDirectives,
  getDocsContent,
  isDocSlug,
  parseDocSegments,
} from '../../src/renderer/site/docs/docsContent';

function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[`*_~]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

function extractHeadingSlugs(markdown: string): Set<string> {
  const ids = new Set<string>();
  let inFence = false;
  for (const line of markdown.split('\n')) {
    if (line.trimStart().startsWith('```')) inFence = !inFence;
    if (inFence) continue;
    const match = /^(#{2,3})\s+(.+?)\s*#*$/.exec(line);
    if (match) ids.add(slugifyHeading(match[2]));
  }
  return ids;
}

describe('docsContent', () => {
  it('defines non-empty pages for every slug across all supported locales', () => {
    for (const locale of SUPPORTED_LOCALES) {
      const content = getDocsContent(locale);
      for (const slug of docPageOrder) {
        const page = content.pages[slug];
        expect(page, `Missing page ${slug} for ${locale}`).toBeDefined();
        expect(page.slug).toBe(slug);
        expect(page.title.trim().length).toBeGreaterThan(0);
        expect(page.description.trim().length).toBeGreaterThan(0);
        expect(page.body.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('uses only valid demo scenes and keeps scene embeds consistent across locales', () => {
    const baseline = getDocsContent('en');

    for (const locale of SUPPORTED_LOCALES) {
      const content = getDocsContent(locale);
      for (const slug of docPageOrder) {
        const directives = extractDemoDirectives(content.pages[slug].body);
        for (const directive of directives) {
          expect(
            directive.valid,
            `Invalid demo directive "${directive.raw ?? ''}" in ${locale}/${slug}`,
          ).toBe(true);
          expect(isDemoScene(directive.scene)).toBe(true);
        }

        const expectedScenes = extractDemoDirectives(baseline.pages[slug].body).map(
          (item) => item.scene,
        );
        const actualScenes = directives.map((item) => item.scene);
        expect(actualScenes, `Scene mismatch in ${locale}/${slug}`).toEqual(expectedScenes);
      }
    }
  });

  it('keeps internal /docs links and section anchors valid across locales', () => {
    const linkPattern = /\[[^\]]+\]\(\/docs\/([^)\s]+)\)/g;
    for (const locale of SUPPORTED_LOCALES) {
      const content = getDocsContent(locale);
      for (const slug of docPageOrder) {
        const body = content.pages[slug].body;
        let inFence = false;
        for (const line of body.split('\n')) {
          if (line.trimStart().startsWith('```')) inFence = !inFence;
          if (inFence) continue;
          for (const match of line.matchAll(linkPattern)) {
            const target = match[1];
            const [targetSlug, anchor] = target.split('#');
            expect(isDocSlug(targetSlug), `Broken doc slug link /docs/${target} in ${locale}/${slug}`).toBe(true);
            if (anchor) {
              const targetPage = content.pages[targetSlug];
              const headings = extractHeadingSlugs(targetPage.body);
              expect(
                headings.has(anchor),
                `Missing heading anchor #${anchor} on /docs/${targetSlug} (linked from ${locale}/${slug})`,
              ).toBe(true);
            }
          }
        }
      }
    }
  });

  it('provides localized i18n titles and captions for every demo scene', () => {
    for (const locale of SUPPORTED_LOCALES) {
      expect(translate(locale, 'docs.demo.interactiveBadge').trim().length).toBeGreaterThan(0);
      expect(translate(locale, 'docs.demo.resetScene').trim().length).toBeGreaterThan(0);
      for (const scene of DEMO_SCENES) {
        const titleKey = `docs.demo.scene.${scene}.title` as MessageKey;
        const captionKey = `docs.demo.scene.${scene}.caption` as MessageKey;
        expect(translate(locale, titleKey).trim().length).toBeGreaterThan(0);
        expect(translate(locale, captionKey).trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('parses :::demo directives outside fenced code blocks and builds scene URLs', () => {
    const sample = [
      'Intro paragraph.',
      '',
      ':::demo mesh',
      '',
      '```markdown',
      ':::demo smart',
      '```',
      '',
      ':::demo',
      '',
      'Outro paragraph.',
    ].join('\n');

    const segments = parseDocSegments(sample);
    expect(segments.map((segment) => (
      segment.kind === 'markdown'
        ? { kind: 'markdown', content: segment.content.trim() }
        : segment
    ))).toEqual([
      { kind: 'markdown', content: 'Intro paragraph.' },
      { kind: 'demo', scene: 'mesh' },
      { kind: 'markdown', content: '```markdown\n:::demo smart\n```' },
      { kind: 'demo', scene: 'walkthrough' },
      { kind: 'markdown', content: 'Outro paragraph.' },
    ]);

    expect(demoSceneUrl('walkthrough', 'zh-CN')).toBe('/demo?lang=zh-CN&autoplay&controls');
    expect(demoSceneUrl('mesh', 'en')).toBe('/demo?lang=en&scene=mesh&mesh=1');
    expect(demoSceneUrl('smart', 'ja')).toBe('/demo?lang=ja&scene=smart');
    expect(demoSceneUrl('offline-sidebar', 'ko')).toBe('/demo?lang=ko&scene=offline-sidebar&backends=offline');
    expect(isDemoScene('smart')).toBe(true);
    expect(isDemoScene('unknown-scene')).toBe(false);
  });
});
