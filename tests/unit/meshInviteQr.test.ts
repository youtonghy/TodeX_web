import { expect, it } from 'vitest';
import jsQR from 'jsqr';
import { encodeMeshInviteForQr, parseMeshInvite, type MeshInviteNode } from '@todex/protocol/mesh';
import { encodeQrCode } from '@todex/protocol/qrCode';

const GROUP_ID = 'grp_AAAAAAAAAAAAAAAAAAAAAA';

function scan(text: string): string | undefined {
  const qr = encodeQrCode(text);
  const scale = 3;
  const quiet = 4;
  const dim = (qr.size + quiet * 2) * scale;
  const pixels = new Uint8ClampedArray(dim * dim * 4).fill(255);
  qr.modules.forEach((row, y) => row.forEach((dark, x) => {
    if (!dark) return;
    for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
      const index = (((y + quiet) * scale + dy) * dim + (x + quiet) * scale + dx) * 4;
      pixels[index] = pixels[index + 1] = pixels[index + 2] = 0;
    }
  }));
  return jsQR(pixels, dim, dim)?.data;
}

const node = (index: number, urls: number): MeshInviteNode => ({
  nodeId: `node_${String(index).padStart(16, 'A')}`,
  name: `后端 ${index}`,
  urls: Array.from({ length: urls }, (_, at) => `http://192.168.${index}.${at + 10}:7345`),
});

it('a group invite QR code scans back to an invite that parses', () => {
  for (const nodes of [[node(1, 1)], [node(1, 2), node(2, 2), node(3, 2)]]) {
    const qr = encodeMeshInviteForQr({ groupId: GROUP_ID, name: '家里', nodes });
    expect(qr?.trimmed).toBe(false);
    const scanned = scan(qr?.text ?? '');
    expect(parseMeshInvite(scanned ?? '').nodes).toEqual(nodes);
  }
});

it('a group too large for one code still scans, with each backend\'s first address', () => {
  const nodes = Array.from({ length: 5 }, (_, index) => node(index, 6));
  const qr = encodeMeshInviteForQr({ groupId: GROUP_ID, name: '实验室', nodes });
  expect(qr?.trimmed).toBe(true);
  const invite = parseMeshInvite(scan(qr?.text ?? '') ?? '');
  expect(invite.nodes.map((entry) => entry.urls[0])).toEqual(nodes.map((entry) => entry.urls[0]));
});
