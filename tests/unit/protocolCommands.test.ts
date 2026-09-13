import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProtocolCommands } from '../../src/renderer/session/protocolCommands';

const command = { id: 'prompt-1', type: 'conversation.prompt', payload: { text: 'hello' } };
afterEach(() => vi.useRealTimers());

describe('protocol command acknowledgement', () => {
  it('queues only an unsent request and resolves its ACK', async () => {
    const send = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
    const commands = new ProtocolCommands(send);
    const result = commands.request(command);
    commands.flush();
    commands.flush();
    expect(send).toHaveBeenCalledTimes(2);
    commands.resolve(command.id, { turnId: 'turn-1' });
    await expect(result).resolves.toEqual({ turnId: 'turn-1' });
  });

  it('never resends an accepted-but-unacknowledged command on reconnect', async () => {
    const send = vi.fn(() => true);
    const commands = new ProtocolCommands(send);
    const result = commands.request(command);
    commands.disconnect();
    commands.flush();
    await expect(result).rejects.toMatchObject({ state: 'unknown', requestId: command.id });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('distinguishes an ACK timeout from a request that never left the client', async () => {
    vi.useFakeTimers();
    const sent = new ProtocolCommands(() => true).request(command, 100);
    const unsent = new ProtocolCommands(() => false).request(command, 100);
    const sentAssertion = expect(sent).rejects.toMatchObject({ state: 'unknown' });
    const unsentAssertion = expect(unsent).rejects.toMatchObject({ state: 'not-sent' });
    await vi.advanceTimersByTimeAsync(100);
    await Promise.all([sentAssertion, unsentAssertion]);
  });

  it('reports a server rejection distinctly and ignores duplicate responses', async () => {
    const commands = new ProtocolCommands(() => true);
    const result = commands.request(command);
    expect(commands.reject(command.id, 'permission configuration is unsupported')).toBe(true);
    expect(commands.resolve(command.id, {})).toBe(false);
    await expect(result).rejects.toMatchObject({ state: 'rejected' });
  });
});

it('retains unknown delivery for native control transport failures', async () => {
  const commands = new ProtocolCommands(() => true);
  const pending = commands.request({ id: 'control', type: 'conversation.control', payload: {} });
  commands.reject('control', 'Provider disconnected after send', 'PROVIDER_UNAVAILABLE');
  await expect(pending).rejects.toMatchObject({ state: 'unknown', requestId: 'control' });
});
