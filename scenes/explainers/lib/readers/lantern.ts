import { Group, Circle, Arrow } from '../../../../src/index.ts';
import { label, flow } from '../reader-drawing.ts';
import type { ReaderFrame } from '../reader-drawing.ts';
export function frames(): ReaderFrame[] {
  return [
    {
      id: 'reader-object',
      title: 'What happens to one circle over time?',
      line: 'The scene is a program; the clock samples its animations.',
      caption:
        'A scene creates an object and asks an animation to change it. The three circles illustrate samples of one move, rather than three objects in the scene. The clock evaluates the program at fixed time steps and gives each resulting picture to a sink. The detailed example runs a real transform and compares played and seeked SVG.',
      values: {
        samples: [
          { t: 0, x: -4 },
          { t: 0.5, x: 0 },
          { t: 1, x: 4 },
        ],
      },
      draw: (s) =>
        new Group(
          ...[-4, 0, 4].map(
            (x, i) =>
              new Group(
                new Circle({
                  radius: 0.7,
                  fill: s.emphasis,
                  fillOpacity: 0.2,
                  stroke: s.emphasis,
                  strokeWidth: 0.05,
                }).moveTo([x, 0.6]),
                label(['0 s', '0.5 s', '1 s'][i]!, x, -1, s.palette.ink, 0.75),
              ),
          ),
          label('One move, sampled at three times', 0, 2.7, s.palette.ink, 0.7),
        ),
    },
    {
      id: 'reader-outputs',
      title: 'Must the page and still use different scenes?',
      line: 'One scene and clock feed several outputs.',
      caption:
        'The browser sink displays SVG frames. A still captures a frame at a chosen time. The trace records step boundaries and descriptions. These outputs share the scene program, which makes it possible to compare a played frame with the same frame reached by seeking. It still takes tests to prove those paths agree.',
      values: { outputs: ['Browser', 'SVG still', 'Trace'] },
      draw: (s) =>
        new Group(
          flow(s, ['Scene', 'Fixed clock', 'Sink']),
          label('Browser  /  SVG still  /  Trace', 0, -1.6, s.palette.ink, 0.75),
          label('One program; several outputs', 0, -3, s.soft, 0.65),
        ),
    },
  ];
}
