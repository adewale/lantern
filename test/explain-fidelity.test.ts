import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXPLAINERS } from '../scenes/explainers/catalog.ts';
import { collectProject } from '../tools/lib/explain-project.ts';
import { assertStepState } from './lib/explainer-state.ts';
import {
  reduceSession,
  sessionAttempt,
  TokenBucket,
  ringStory,
  exec,
  sunlight,
  daylightYear,
} from '../scenes/explainers/lib/models.ts';
import { find, run } from '../scenes/explainers/2password/model.ts';
import { Text, loadFonts } from '../src/index.ts';
import { Repo, AUTHOR } from '../scenes/lib/gitmodel.ts';

for (const entry of EXPLAINERS)
  test(`${entry.id}: every authored case exposes the program's answers at step boundaries`, async () => {
    const project = await collectProject(`scenes/explainers/${entry.id}`, { write: false });
    for (const variant of project.variants) {
      const { values, trace } = variant,
        last = trace.steps.at(-1)!;
      // Every visible token (including sequence build-ins) names a link in a captured diagram.
      const links = Object.values(project.store)
        .flatMap((s) => s.parts)
        .filter((p) => p.from && p.to);
      const walks = (last.after?.walks ?? []) as { step: string; from: string; to: string; edge: string }[];
      for (const walk of walks)
        assert.ok(
          links.some((p) => p.id === walk.edge && p.from === walk.from && p.to === walk.to),
          `Trace invents link ${walk.from}->${walk.to}`,
        );
      switch (entry.id) {
        case 'pap': {
          assertStepState(trace, 'boundary', { signin: values.signin });
          const messages = walks.filter((w) => w.step === 'sign-in');
          assert.equal(messages.length, values.signin === 'direct' ? 5 : 6);
          break;
        }
        case 'seasons': {
          const lat = ({ tromso: 69.65, london: 51.5, quito: 0, sydney: -33.87 } as Record<string, number>)[
            values.place!
          ]!;
          assertStepState(trace, 'june', { latitude: lat, june: sunlight(lat, 23.44) });
          assertStepState(trace, 'december', { december: sunlight(lat, -23.44) });
          assertStepState(trace, 'year', { daylight: daylightYear(lat) });
          break;
        }
        case 'oauth-pkce':
          assertStepState(trace, 'exchange', {
            challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
            accepted: true,
          });
          if (values.attacker === 'yes') assertStepState(trace, 'attack', { attackerAccepted: false });
          break;
        case 'mr-cache':
          assertStepState(trace, 'request', {
            request: values.request,
            reads: values.request === 'hit' ? 0 : 1,
          });
          assert.equal(walks.filter((w) => w.step === 'request').length, values.request === 'hit' ? 3 : 4);
          break;
        case 'lantern':
          assertStepState(trace, 'seek', { seekContract: 'played SVG equals seeked SVG' });
          assert.ok(walks.some((w) => w.from === 'Clock' && w.to === 'Browser'));
          assert.ok(walks.some((w) => w.from === 'Clock' && w.to === 'Trace'));
          break;
        case 'agentic-mermaid': {
          const warnings = trace.steps.find((s) => s.step === 'verify')!.after!.warnings as unknown[];
          assert.equal(warnings.length, values.edit === 'missing' ? 2 : 0);
          assertStepState(trace, 'evidence', { finalWarnings: 0 });
          break;
        }
        case '2password': {
          const launched = run(
            values.auth as 'desktop' | 'service',
            { API_KEY: 'op://Personal/Cloud API/credential' },
            ['app'],
          );
          assertStepState(trace, 'match', { matches: { 'cloud api': ['Cloud API'], databse: [] } });
          assertStepState(trace, 'suggest', { found: find(['cloud api', 'databse']) });
          assertStepState(trace, 'run', { argv: launched.argv, childEnv: launched.childEnv });
          break;
        }
        case 'state-machine': {
          let state = 'idle';
          for (const event of values.events === 'success'
            ? ['CONNECT', 'OPENED', 'CLOSE']
            : ['CONNECT', 'ERROR']) {
            state = reduceSession(state, event);
            assertStepState(trace, event.toLowerCase(), { session: state, event });
          }
          assertStepState(trace, 'terminal', { invalid: sessionAttempt(state, 'OPENED') });
          break;
        }
        case 'token-bucket': {
          const bucket = new TokenBucket(Number(values.rate)),
            balances: number[] = [];
          const responses = [0, 0, 0, 0, 0, 0, 0.5, 1, 1, 2].map((at) => {
            const ok = bucket.allow(at);
            balances.push(bucket.tokens);
            return ok ? 200 : 429;
          });
          assertStepState(trace, 'trace', { tokens: bucket.tokens, lastRefill: 2, responses });
          assert.ok(
            Object.values(project.store).some((s) =>
              s.spec.source.includes('bar [' + balances.join(',') + ']'),
            ),
          );
          break;
        }
        case 'ring-buffer': {
          const result = ringStory(values.operations!).at(-1)!;
          assertStepState(trace, 'result', {
            ...result.result,
            error: result.error ?? null,
            operation: result.operation,
          });
          break;
        }
        case 'exgit': {
          const repo = new Repo(),
            hello = repo.blob('hello\n'),
            t1 = repo.tree([['100644', 'hello.txt', hello]]),
            c1 = repo.commit({ tree: t1, author: AUTHOR, message: 'first\n' }),
            nextBlob = repo.blob(values.change === 'add' ? 'world\n' : 'hello again\n'),
            t2 = repo.tree(
              values.change === 'add'
                ? [
                    ['100644', 'hello.txt', hello],
                    ['100644', 'world.txt', nextBlob],
                  ]
                : [['100644', 'hello.txt', nextBlob]],
            ),
            c2 = repo.commit({ tree: t2, parents: [c1], author: AUTHOR, message: 'second\n' });
          assertStepState(trace, 'hashes', {
            hello,
            t1,
            c1,
            nextBlob,
            t2,
            c2,
            head: c2,
            shared: values.change === 'add',
          });
          break;
        }
        case 'just-bash': {
          const original = { fs: {}, steps: 0 },
            run = exec(
              original,
              [
                ['echo', 'hello'],
                ['tr', 'a-z', 'A-Z'],
              ],
              'shout.txt',
            ),
            cat = exec(values.shell === 'new' ? run.shell : original, [['cat', 'shout.txt']]);
          assertStepState(trace, 'cat', { oldShell: original, newShell: run.shell, cat: cat.stdout });
          break;
        }
        case 'pyex-limits':
          assertStepState(
            trace,
            'failure',
            values.limit === '3'
              ? { steps: 3, memory: 15000, status: 'step limit' }
              : { steps: 6, memory: 30000, status: 'memory limit' },
          );
          break;
        case 'glyph':
          await loadFonts();
          assertStepState(trace, 'measure', {
            font: values.font,
            width: new Text('Hello, outlines', {
              font: values.font as 'sans' | 'mono',
              fontSize: 0.9,
            }).advance(),
          });
          break;
      }
    }
  });
