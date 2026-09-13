import { describe, expect, it } from 'vitest';
import { prepareBrowserSnapshot } from '../../src/renderer/lib/browserSnapshot';

describe('browser snapshot isolation', () => {
  it('removes active content and resolves relative resources against the fetched URL', () => {
    const html = prepareBrowserSnapshot(
      '<html><head><meta http-equiv="refresh" content="0;url=https://bad.example"></head><body><script>alert(1)</script><img src="asset.png"></body></html>',
      'http://127.0.0.1:7345/docs/index.html',
    );
    expect(html).not.toContain('<script');
    expect(html).not.toContain('http-equiv="refresh"');
    expect(html).toContain('<base href="http://127.0.0.1:7345/docs/index.html">');
  });
});
