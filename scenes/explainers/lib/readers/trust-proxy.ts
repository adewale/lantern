import { Group } from '../../../../src/index.ts';
import { REQUESTS, TRUSTS, atExpress, readAddresses, answer, TRUST_LABEL } from '../trust-proxy.ts';
import type { TrustKey, RequestKey } from '../trust-proxy.ts';
import { flow, label, table } from '../reader-drawing.ts';
import type { ReaderFrame } from '../reader-drawing.ts';
export function frames(trustKey: TrustKey, requestKey: RequestKey): ReaderFrame[] {
  const r = REQUESTS[requestKey],
    got = atExpress(r),
    read = readAddresses(got.socket, got.xff, TRUSTS[trustKey]),
    out = answer(trustKey, requestKey);
  return [
    {
      id: 'reader-path',
      title: 'Whose address reaches Express?',
      line: `Trust setting: ${TRUST_LABEL[trustKey]}.`,
      caption: `The request reaches Express through ${r.via.length} proxy hop${r.via.length === 1 ? '' : 's'}. The socket address is the nearest peer, not necessarily the original sender. X-Forwarded-For adds claims made earlier in the path; accepting every claim can accept an attacker’s address.`,
      values: { requestKey, trustKey, socket: got.socket, xff: got.xff },
      draw: (s) =>
        new Group(
          flow(s, [r.sender.name, ...r.via.map((h) => h.name), 'Express']),
          label(`Socket peer: ${got.socket}`, 0, -1.4, s.palette.ink, 0.7),
          label('Read addresses from the nearest peer outward', 0, -3, s.soft, 0.65),
        ),
    },
    {
      id: 'reader-answer',
      title: 'Where does the trust walk stop?',
      line: 'Read nearest first; stop at an untrusted proxy or the list’s end.',
      caption: `Express reads the list in the order shown. It skips trusted proxy addresses until the first untrusted address or the end of the list. That endpoint becomes req.ip; later entries, if any, are unread. The final address is not tested as another proxy. Here req.ip is ${out.ip}, ${out.whose}. Change the request path as well as the trust setting: a hop count is safe only when every permitted path has the expected length.`,
      values: { read, answer: out },
      draw: (s) =>
        table(
          ['Order', 'Address', 'Decision'],
          read.map((v, i) => {
            const hop = [r.sender, ...r.via].find((h) => h.addr === v.addr);
            const role = hop?.id === 'balancer' ? 'LB' : hop?.id === 'edge' ? 'CDN' : hop?.id ?? 'forged';
            return [`${i}: ${role}`, v.addr, v.verdict === 'answer' ? 'req.ip' : v.verdict];
          }),
          s,
          { xs: [-6, -1.2, 5.4], y: 2.7, gap: 1.45 },
        ),
    },
  ];
}
