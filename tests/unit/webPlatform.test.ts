import { beforeEach, describe, expect, it } from 'vitest';
import { clearWebStorage, insecureBackendReason, readLocalStorage, writeLocalStorage } from '../../src/renderer/lib/webPlatform';

describe('web local storage', () => {
  beforeEach(() => window.localStorage.clear());

  it('round-trips structured values', () => {
    writeLocalStorage('todex.web.settings.v1', { theme: 'dark' });
    expect(readLocalStorage('todex.web.settings.v1')).toEqual({ theme: 'dark' });
  });

  it('clears only TodeX keys', () => {
    window.localStorage.setItem('todex.web.token.v1', 'secret');
    window.localStorage.setItem('todex.notificationFeed.v1', '[]');
    window.localStorage.setItem('todex.locale', 'en');
    window.localStorage.setItem('another.application', 'keep');
    window.localStorage.setItem('todexish', 'keep');
    clearWebStorage();
    expect(window.localStorage.getItem('todex.web.token.v1')).toBeNull();
    expect(window.localStorage.getItem('todex.notificationFeed.v1')).toBeNull();
    expect(window.localStorage.getItem('todex.locale')).toBeNull();
    expect(window.localStorage.getItem('todexish')).toBe('keep');
    expect(window.localStorage.getItem('another.application')).toBe('keep');
  });
});

describe('backend transport policy', () => {
  it('rejects plaintext remote backends from a public HTTPS page', () => {
    expect(insecureBackendReason('http://192.168.1.8:7345', 'https:')).toContain('HTTPS/WSS');
  });

  it('allows HTTPS and loopback backends', () => {
    expect(insecureBackendReason('https://agent.example.com', 'https:')).toBeNull();
    expect(insecureBackendReason('http://127.0.0.1:7345', 'https:')).toBeNull();
    expect(insecureBackendReason('http://[::1]:7345', 'https:')).toBeNull();
    expect(insecureBackendReason('http://localhost:7345', 'https:')).toBeNull();
  });
});
