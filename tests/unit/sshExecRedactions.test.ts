import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import * as React from 'react';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { SshExecRun } from '@todex/protocol/ssh';
import { SshExecPane } from '../../src/renderer/components/ssh/SshExecPane';
import { setLocale } from '../../src/renderer/i18n';

describe('SshExecPane redactions', () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;
  beforeAll(() => {
    Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true });
    globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
  });
  afterEach(() => {
    if (root) act(() => root!.unmount());
    host?.remove();
    root = undefined;
  });

  const render = async (runs: SshExecRun[]) => {
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root!.render(createElement(SshExecPane, { conversationId: 'c-redactions', runs, isActive: true })); });
    return host;
  };

  const run = (id: string, redactions?: SshExecRun['redactions']): SshExecRun => ({
    id, host: 'web', command: 'cat .env', status: 'completed', exitCode: 0, durationMs: 5,
    output: [{ stream: 'stdout', data: 'TOKEN=abc\n' }], ...(redactions ? { redactions } : {}),
  });

  it('sums hidden values and lists categories in canonical order', async () => {
    setLocale('en');
    const element = await render([run('a', { credential: 2, privateKey: 1 }), run('b')]);
    const lines = element.querySelectorAll('[data-ssh-redactions]');
    expect(lines).toHaveLength(1);
    expect(lines[0].textContent).toBe('Hidden from the agent: 3 sensitive items (private keys 1, passwords & tokens 2)');
  });
});
