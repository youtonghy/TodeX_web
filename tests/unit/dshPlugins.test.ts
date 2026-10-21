import { describe, expect, it } from 'vitest';
import type { DshPluginRow } from '@todex/protocol/v2';
import { DSH_PLUGIN_PAGES, dshRowSourceLabel, filterDshRows, isDshPluginConfigId } from '../../src/renderer/lib/dshPlugins';

const row = (id: string, source: string, sourceLayer: DshPluginRow['sourceLayer']): DshPluginRow => ({
  id, name: `@deepseek-ai/dsh-${id}`, state: { kind: 'enabled' }, source, sourceLayer,
  locked: false, overridden: false, toggleable: true, configurable: false,
});

describe('dsh plugin rows', () => {
  it('groups by bundle or the tail of the patch file path', () => {
    expect(dshRowSourceLabel(row('web', '@deepseek-ai/dsh-base', 'bundle'))).toBe('@deepseek-ai/dsh-base');
    expect(dshRowSourceLabel(row('mine', '/home/u/.dsh/profiles/acp/cordis.patch.yml', 'profile'))).toBe('profiles/acp/cordis.patch.yml');
  });

  it('filters on id, module and source', () => {
    const rows = [row('web', '@deepseek-ai/dsh-base', 'bundle'), row('tool-todo', '@x/bundle', 'bundle')];
    expect(filterDshRows(rows, '  ')).toHaveLength(2);
    expect(filterDshRows(rows, 'TODO').map((item) => item.id)).toEqual(['tool-todo']);
    expect(filterDshRows(rows, '@x/').map((item) => item.id)).toEqual(['tool-todo']);
  });

  it('knows which rows have settings pages', () => {
    expect(isDshPluginConfigId('web')).toBe(true);
    expect(isDshPluginConfigId('tool-todo')).toBe(false);
    expect(isDshPluginConfigId(undefined)).toBe(false);
    expect(DSH_PLUGIN_PAGES.web.groups[0].fields.map((field) => field.path[0])).toEqual(['searchProvider', 'fetchProvider']);
  });
});
