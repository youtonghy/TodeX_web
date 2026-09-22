import { describe, expect, it } from 'vitest';
import {
  MASKED_SECRET,
  buildSettingsConfig,
  defaultEfforts,
  emptyModelEntry,
  extractFormValues,
  providerBaseUrl,
  providerModelIds,
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

describe('grok build providers', () => {
  const session = {
    'https://auth.x.ai': { key: MASKED_SECRET, auth_mode: 'oidc', user_id: 'u1', email: 'u1@example.com' },
  };

  it('builds an API profile with a per-model key targeting the xAI API by default', () => {
    const form = extractFormValues('grok-build');
    expect(form.authMode).toBe('api');
    expect(validateModelForm('grok-build', form)).toBe('ap.modelRequired');
    const next = buildSettingsConfig('grok-build', {
      ...form, name: 'xAI', apiKey: 'xai-k', model: 'grok-4.7', apiKind: 'responses',
    });
    expect(next.auth).toBeNull();
    const config = next.config as string;
    expect(config).toContain('[models]\ndefault = "grok-4.7"');
    expect(config).toContain('[model."grok-4.7"]');
    expect(config).toContain('base_url = "https://api.x.ai/v1"');
    expect(config).toContain('api_key = "xai-k"');
    expect(config).toContain('api_backend = "responses"');
    expect(providerModelIds('grok-build', next)).toEqual(['grok-4.7']);
    expect(providerBaseUrl('grok-build', next)).toBe('https://api.x.ai/v1');
  });

  it('keeps the catalog key and masked key when only the model id changes', () => {
    const existing = {
      settingsConfig: {
        auth: null,
        config: '[ui]\ntheme = "auto"\n\n[models]\ndefault = "gw"\n\n[model.gw]\nmodel = "m1"\nbase_url = "https://gw.example.com/v1"\napi_key = "__TODEX_MASKED__"\n',
      },
    };
    const form = extractFormValues('grok-build', existing);
    expect(form).toMatchObject({ authMode: 'api', model: 'm1', apiKey: MASKED_SECRET, baseUrl: 'https://gw.example.com/v1' });
    const config = buildSettingsConfig('grok-build', { ...form, model: 'm2' }, existing).config as string;
    expect(config).toContain('default = "gw"');
    expect(config).toContain('model = "m2"');
    expect(config).toContain(`api_key = "${MASKED_SECRET}"`);
    expect(config).toContain('theme = "auto"');
    expect(config.match(/\[model\.gw\]/g)).toHaveLength(1);
  });

  it('keeps the session for subscription profiles and drops a per-model key', () => {
    const existing = {
      settingsConfig: {
        auth: session,
        config: '[models]\ndefault = "grok-build"\n\n[model.grok-build]\napi_key = "__TODEX_MASKED__"\ntemperature = 0.5\n',
      },
    };
    const form = extractFormValues('grok-build', existing);
    expect(form.authMode).toBe('subscription');
    expect(validateModelForm('grok-build', form)).toBeNull();
    const next = buildSettingsConfig('grok-build', form, existing);
    expect(next.auth).toEqual(session);
    expect(next.config as string).not.toContain('api_key');
    expect(next.config as string).toContain('temperature = 0.5');
    expect(providerBaseUrl('grok-build', next)).toBe('u1@example.com');
  });

  it('switching a subscription profile to an API key drops the session', () => {
    const existing = { settingsConfig: { auth: session, config: '' } };
    const form = extractFormValues('grok-build', existing);
    const next = buildSettingsConfig('grok-build', { ...form, authMode: 'api', apiKey: 'xai-k', model: 'grok-4.7' }, existing);
    expect(next.auth).toBeNull();
    expect(next.config as string).toContain('api_key = "xai-k"');
  });

  it('keeps an unchanged `grok login --api-key` scope in auth.json', () => {
    const auth = { 'xai::api_key': { key: MASKED_SECRET, auth_mode: 'api_key', user_id: '' } };
    const existing = { settingsConfig: { auth, config: '' } };
    const form = extractFormValues('grok-build', existing);
    expect(form).toMatchObject({ authMode: 'api', apiKey: MASKED_SECRET });
    const next = buildSettingsConfig('grok-build', { ...form, model: 'grok-4.7' }, existing);
    expect(next.auth).toEqual(auth);
    expect(next.config as string).not.toContain('api_key');
  });
});
