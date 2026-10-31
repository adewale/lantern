import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wrappedLines, wordsReport, PHONE_CHARS } from '../tools/lib/explain-words.ts';

test('wrappedLines wraps at word boundaries and breaks a word longer than the line', () => {
  assert.equal(wrappedLines('', 10), 0);
  assert.equal(wrappedLines('   ', 10), 0);
  assert.equal(wrappedLines('one two', 10), 1);
  assert.equal(wrappedLines('one two three', 10), 2, '"one two" then "three"');
  assert.equal(wrappedLines('abcdefghij', 10), 1, 'a word exactly the width fits');
  assert.equal(wrappedLines('abcdefghijk', 10), 2, 'a longer word breaks');
  assert.equal(wrappedLines('ab abcdefghijklmnopqrstu', 10), 4, '"ab", then 21 letters over three lines');
});

test('wordsReport names the steps whose length sets the room for the rest', () => {
  const short = 'A short caption that fits on one line.';
  const long = Array.from({ length: 6 }, () => 'This sentence runs to about one phone line.').join(' ');
  const steps = [
    { step: 'a', title: 'Short title', line: 'Notice this', caption: short },
    { step: 'b', title: 'Short title', line: '', caption: short },
    { step: 'c', title: 'A title long enough that a phone wraps it onto a second line', line: 'Notice this', caption: short },
    { step: 'd', title: 'Short title', line: 'A line that has grown into a second caption and runs past one phone line', caption: long },
  ];
  const r = wordsReport(steps);
  assert.deepEqual(r.phoneLines.map((l) => l.step), ['a', 'b', 'c', 'd']);
  assert.equal(r.phoneLines[1]!.line, 0, 'no line, no room');
  assert.deepEqual(r.caption.outliers, ['d']);
  assert.equal(r.caption.median, 1);
  assert.equal(r.caption.slackLines, r.caption.tallest - 1);
  assert.equal(r.phoneLines[2]!.title, 2, 'a long title takes two phone lines');
  assert.deepEqual(r.title.outliers, [], 'one extra title line is within the allowance');
  assert.deepEqual(r.line.outliers, [], 'one extra line is within the allowance for lines');
  assert.equal(r.line.median, 1, 'the median line counts only steps that have one');
});

test('wordsReport on a case of even steps reports no slack and no outliers', () => {
  const steps = ['a', 'b', 'c'].map((step) => ({ step, title: 'Title', line: 'Line', caption: 'x'.repeat(PHONE_CHARS.caption) }));
  const r = wordsReport(steps);
  for (const role of ['title', 'line', 'caption'] as const) {
    assert.equal(r[role].slackLines, 0, role);
    assert.deepEqual(r[role].outliers, [], role);
  }
});
