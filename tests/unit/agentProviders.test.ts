import { describe, expect, it } from 'vitest';
import {
  MASKED_SECRET,
  buildSettingsConfig,
  defaultEfforts,
  emptyModelEntry,
  extractFormValues,
  validateModelForm,
  type ModelFormEntry,
} from '../../src/renderer/lib/agentProviders';

const piSource = (settings: Record<string, unknown>) => ({ name: 'Pi Co', settingsConfig: settings });

describe('pi model entries', () => {
  it('extracts context, limits and thinking levels per model', () => {
    const form = extractFormValues('pi', piSource({
      baseUrl: 'https://x/v1',
      apiKey: MASKED_SECRET,
      api: 'openai-responses',
      models: [
        {
          id: 'glm-5.3',
          name: 'GLM 5.3',
          reasoning: true,
          thinkingLevelMap: { off: null, low: 'low', high: 'high', max: 'max' },
          contextWindow: 1000000,
          maxTokens: 131072,
        },
        { id: 'plain' },
      ],
    }));
    expect(form.models).toHaveLength(2);
    const glm = form.models[0];
    expect(glm).toMatchObject({
      id: 'glm-5.3',
      name: 'GLM 5.3',
      contextWindow: '1000000',
      maxTokens: '131072',
      reasoning: true,
    });
    // off:null disables; xhigh absent stays off; max declared stays on.
    expect(glm.efforts).toEqual(['minimal', 'low', 'medium', 'high', 'max']);
    expect(form.models[1]).toMatchObject({ id: 'plain', reasoning: false, efforts: [] });
  });

  it('builds thinkingLevelMap with nulls for disabled levels and keeps custom mappings', () => {
    const existing = piSource({
      models: [{
        id: 'm',
        reasoning: true,
        thinkingLevelMap: { high: 'xhigh' }, // remapped provider value
        cost: { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 },
        apiKey: MASKED_SECRET,
      }],
    });
    const form = extractFormValues('pi', existing);
    const model = form.models[0];
    expect(model.efforts).toContain('high');
    const next = buildSettingsConfig('pi', {
      ...form,
      models: [{
        ...model,
        contextWindow: '200000',
        efforts: model.efforts.filter((level) => level !== 'minimal'),
      }],
    }, existing);
    const entry = (next.models as Record<string, unknown>[])[0];
    expect(entry.contextWindow).toBe(200000);
    expect(entry.thinkingLevelMap).toMatchObject({
      minimal: null, // unchecked
      high: 'xhigh', // existing mapping preserved, not rewritten to 'high'
      off: 'off', // enabled without prior mapping gets the identity value
    });
    expect(entry.cost).toEqual({ input: 1, output: 2, cacheRead: 0, cacheWrite: 0 });
    expect(entry.apiKey).toBe(MASKED_SECRET); // masked secrets pass through
  });

  it('keeps the map but flags reasoning:false when thinking is turned off', () => {
    const existing = piSource({
      models: [{ id: 'm', reasoning: true, thinkingLevelMap: { low: 'low' } }],
    });
    const form = extractFormValues('pi', existing);
    const next = buildSettingsConfig('pi', {
      ...form,
      models: [{ ...form.models[0], reasoning: false, efforts: [] }],
    }, existing);
    const entry = (next.models as Record<string, unknown>[])[0];
    expect(entry.reasoning).toBe(false);
    expect(entry.thinkingLevelMap).toEqual({ low: 'low' });
  });

  it('writes bare {id} entries for unconfigured models and appends new ids', () => {
    const existing = piSource({ models: [{ id: 'a' }] });
    const form = extractFormValues('pi', existing);
    const next = buildSettingsConfig('pi', {
      ...form,
      models: [...form.models, emptyModelEntry('b')],
    }, existing);
    expect(next.models).toEqual([{ id: 'a' }, { id: 'b' }]);
  });
});

describe('opencode model entries', () => {
  it('extracts limit and variants into the normalized row', () => {
    const form = extractFormValues('opencode', {
      name: 'OC',
      settingsConfig: {
        options: { baseURL: 'https://x/v1', apiKey: MASKED_SECRET },
        models: {
          'm-pro': {
            name: 'Pro',
            reasoning: true,
            limit: { context: 200000, output: 8192 },
            variants: { low: { reasoningEffort: 'low' }, high: { reasoningEffort: 'high', disabled: true } },
            options: { custom: 'keep' },
          },
        },
      },
    });
    expect(form.models[0]).toMatchObject({
      id: 'm-pro',
      name: 'Pro',
      contextWindow: '200000',
      maxTokens: '8192',
      reasoning: true,
      efforts: ['low'],
    });
  });

  it('builds limit pairs and disabled variants without dropping custom options', () => {
    const existing = {
      settingsConfig: {
        models: {
          'm-pro': { options: { custom: 'keep' }, variants: { low: { reasoningEffort: 'low' }, turbo: { x: 1 } } },
        },
      },
    };
    const model: ModelFormEntry = {
      id: 'm-pro', name: '', contextWindow: '128000', maxTokens: '4096',
      reasoning: true, efforts: ['high'],
    };
    const next = buildSettingsConfig('opencode', {
      ...extractFormValues('opencode', existing),
      models: [model],
    }, existing);
    const entry = (next.models as Record<string, Record<string, unknown>>)['m-pro'];
    expect(entry.limit).toEqual({ context: 128000, output: 4096 });
    expect(entry.variants).toEqual({
      turbo: { x: 1 },
      low: { reasoningEffort: 'low', disabled: true },
      high: { reasoningEffort: 'high' },
    });
    expect(entry.options).toEqual({ custom: 'keep' });
  });

  it('reuses the stored half of a limit pair and validates incomplete pairs', () => {
    const existing = {
      settingsConfig: { models: { m: { limit: { context: 100000, output: 8000 } } } },
    };
    const form = extractFormValues('opencode', existing);
    const model = { ...form.models[0], contextWindow: '64000', maxTokens: '' };
    expect(validateModelForm('opencode', { ...form, models: [model] }, existing)).toBeNull();
    const next = buildSettingsConfig('opencode', { ...form, models: [model] }, existing);
    expect((next.models as Record<string, { limit: unknown }>).m.limit)
      .toEqual({ context: 64000, output: 8000 });

    const fresh = { ...form, models: [{ ...emptyModelEntry('new'), contextWindow: '100' }] };
    expect(validateModelForm('opencode', fresh, existing)).toBe('ap.outputRequired');
    expect(validateModelForm('opencode', {
      ...form, models: [{ ...emptyModelEntry('bad'), contextWindow: 'abc' }],
    }, existing)).toBe('ap.invalidNumber');
  });
});

describe('codex context window', () => {
  it('reads and patches model_context_window as a bare TOML number', () => {
    const existing = {
      settingsConfig: {
        auth: { OPENAI_API_KEY: MASKED_SECRET },
        config: 'model_provider = "custom"\nmodel = "gpt-5"\nmodel_context_window = 272000\n\n[model_providers.custom]\nbase_url = "https://x/v1"\n',
      },
    };
    const form = extractFormValues('codex', existing);
    expect(form.contextWindow).toBe('272000');
    const next = buildSettingsConfig('codex', { ...form, contextWindow: '400000' }, existing);
    expect(next.config as string).toContain('model_context_window = 400000');
    expect(next.config as string).not.toContain('"400000"');
    expect(next.auth).toEqual({ OPENAI_API_KEY: MASKED_SECRET });
  });

  it('inserts the key for configs that lack it and validates input', () => {
    const form = extractFormValues('codex', { settingsConfig: { config: 'model = "gpt-5"\n' } });
    const next = buildSettingsConfig('codex', { ...form, contextWindow: '128000' });
    expect(next.config as string).toMatch(/^model_context_window = 128000\n/);
    expect(validateModelForm('codex', { ...form, contextWindow: '12.5' })).toBe('ap.invalidNumber');
    expect(validateModelForm('codex', { ...form, contextWindow: '' })).toBeNull();
  });
});

describe('defaultEfforts', () => {
  it('matches each agent\'s default thinking level set', () => {
    expect(defaultEfforts('pi')).toEqual(['off', 'minimal', 'low', 'medium', 'high']);
    expect(defaultEfforts('opencode')).toEqual(['low', 'medium', 'high']);
  });
});
