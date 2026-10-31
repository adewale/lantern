import { Group } from '../../../../src/index.ts';
import { find, run, PROMPTS_PER_COMMAND } from '../2password.ts';
import { flow, label, table } from '../reader-drawing.ts';
import type { ReaderFrame } from '../reader-drawing.ts';
export function frames(auth: 'desktop' | 'service'): ReaderFrame[] {
  const found = find(['cloud api']),
    ref = found.matches[0]!.ref,
    launched = run(auth, { API_KEY: ref }, ['app']);
  return [
    {
      id: 'reader-boundary',
      title: 'Who gets the secret value?',
      line: 'Discovery returns a reference; op resolves it for the child.',
      caption:
        'The agent discovers an op:// reference, not the concealed value. At execution, op resolves that reference and starts the application with the secret in its environment. This reduces accidental disclosure in discovery output; it does not prevent the application itself from reading or printing its environment.',
      values: { ref, agentHasValue: false, childHasValue: !!launched.childEnv.API_KEY },
      draw: (s) =>
        new Group(
          flow(s, ['Agent', 'op CLI', 'Application']),
          label('op:// reference', -2.6, 2.25, s.emphasis, 0.65),
          label('secret value', 2.6, 2.25, s.emphasis, 0.65),
          label('Discover a reference; deliver a value', 0, -1.8, s.palette.ink, 0.7),
        ),
    },
    {
      id: 'reader-auth',
      title: 'Does the service token reach the app?',
      line: `Authentication: ${auth === 'desktop' ? 'desktop approval' : 'service account'}.`,
      caption:
        auth === 'service'
          ? 'The op process receives the service-account token. Its child command unsets OP_SERVICE_ACCOUNT_TOKEN, while receiving the resolved API key. Removing that one variable is not an environment sandbox: other inherited variables still pass through.'
          : 'Desktop mode asks for approval once per command in the upstream README’s model. There is no service-account token in this example. The application still receives the resolved API key; discovery’s reference-only output is not a promise that secrets never enter another process.',
      values: {
        auth,
        prompts: PROMPTS_PER_COMMAND[auth],
        opToken: 'OP_SERVICE_ACCOUNT_TOKEN' in launched.opEnv,
        childToken: 'OP_SERVICE_ACCOUNT_TOKEN' in launched.childEnv,
      },
      draw: (s) =>
        table(
          ['Process', 'Service token', 'Resolved key'],
          [
            ['Agent', 'not shown', 'no'],
            ['op CLI', auth === 'service' ? 'yes' : 'no', 'resolves'],
            ['Application', 'no', 'yes'],
          ],
          s,
          { xs: [-5.4, 0, 5.1], y: 2.6, gap: 1.5 },
        ),
    },
  ];
}
