import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  SYMBOLS, POSITIONS, MEASURED_EXCEPTIONS, MEASURED_UP_TO, GROUP_NAMES,
  predicted, measured, counted, position, membersOf, gaps, periodLength, configText, shorthand, symbolOf,
} from '../scenes/explainers/lib/periodic-groups.ts';
import type { Subshell } from '../scenes/explainers/lib/periodic-groups.ts';

// The IUPAC periodic table (2021 recommendation: Sc, Y, Lu and Lr in group 3), typed
// row by row from the published table and independent of the model's rules. '.' is
// an empty column; the f rows are La-Yb and Ac-No, which have no group number.
const IUPAC_ROWS = [
  'H  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  He',
  'Li Be .  .  .  .  .  .  .  .  .  .  B  C  N  O  F  Ne',
  'Na Mg .  .  .  .  .  .  .  .  .  .  Al Si P  S  Cl Ar',
  'K  Ca Sc Ti V  Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr',
  'Rb Sr Y  Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I  Xe',
  'Cs Ba Lu Hf Ta W  Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn',
  'Fr Ra Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og',
].map((row) => row.split(/\s+/));
const IUPAC_F_ROWS = [
  'La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb',
  'Ac Th Pa U  Np Pu Am Cm Bk Cf Es Fm Md No',
].map((row) => row.split(/\s+/));

const NIST = JSON.parse(readFileSync(new URL('./fixtures/periodic-groups/nist-ground.json', import.meta.url), 'utf8')) as {
  elements: Record<string, { symbol: string; configuration: string }>;
};
const asText = (config: readonly Subshell[]) =>
  [...config].sort((a, b) => a.n - b.n || 'spdf'.indexOf(a.l) - 'spdf'.indexOf(b.l)).map((s) => `${s.n}${s.l}${s.electrons}`).join(' ');

test('the IUPAC rows hold each of the 118 elements once', () => {
  const placed = [...IUPAC_ROWS.flat(), ...IUPAC_F_ROWS.flat()].filter((s) => s !== '.');
  assert.equal(placed.length, 118);
  assert.deepEqual([...placed].sort(), [...SYMBOLS].sort());
});

test('every computed position matches the IUPAC table: period, group and f-block column', () => {
  let checked = 0;
  IUPAC_ROWS.forEach((row, r) =>
    row.forEach((symbol, c) => {
      if (symbol === '.') return;
      const p = POSITIONS.find((x) => x.symbol === symbol)!;
      assert.deepEqual({ period: p.period, group: p.group, fColumn: p.fColumn }, { period: r + 1, group: c + 1, fColumn: null }, symbol);
      checked++;
    }),
  );
  IUPAC_F_ROWS.forEach((row, r) =>
    row.forEach((symbol, c) => {
      const p = POSITIONS.find((x) => x.symbol === symbol)!;
      assert.deepEqual({ period: p.period, group: p.group, fColumn: p.fColumn, block: p.block }, { period: r + 6, group: null, fColumn: c + 1, block: 'f' }, symbol);
      checked++;
    }),
  );
  assert.equal(checked, 118);
});

test('only helium and the period 2 and 3 p block need more than the electron count to find their column', () => {
  const adjusted = POSITIONS.filter((p) => p.adjustment !== 'none');
  assert.deepEqual(adjusted.filter((p) => p.adjustment === 'closed shell').map((p) => p.symbol), ['He']);
  assert.deepEqual(adjusted.filter((p) => p.adjustment === 'no d subshell yet').map((p) => p.symbol), ['B', 'C', 'N', 'O', 'F', 'Ne', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar']);
  const he = position(2);
  assert.equal(he.count, 2, 'helium has two s electrons, which would count to group 2');
  assert.equal(he.group, 18);
  assert.equal(position(17).count, 7);
  assert.equal(position(17).group, 17);
});

test('the model reproduces every NIST ground configuration from element 1 to 103', () => {
  assert.equal(Object.keys(NIST.elements).length, MEASURED_UP_TO);
  for (let z = 1; z <= MEASURED_UP_TO; z++) {
    const nist = NIST.elements[String(z)]!;
    assert.equal(nist.symbol, symbolOf(z));
    assert.equal(asText(measured(z)), nist.configuration, `${symbolOf(z)} (${z})`);
  }
});

test('the stored exceptions are exactly the elements where NIST differs from the filling rule', () => {
  const differs = [];
  for (let z = 1; z <= MEASURED_UP_TO; z++)
    if (asText(predicted(z)) !== NIST.elements[String(z)]!.configuration) differs.push(z);
  assert.deepEqual(differs, Object.keys(MEASURED_EXCEPTIONS).map(Number));
  assert.equal(differs.length, 20);
});

test('measured configurations keep the group count of every d-block exception', () => {
  // Chromium, copper, palladium, gold and the rest move an s electron into d or back:
  // the s + d total beyond the core, and so the column, is unchanged.
  for (const z of Object.keys(MEASURED_EXCEPTIONS).map(Number)) {
    const p = position(z);
    if (p.block === 'f') continue;
    assert.equal(counted(measured(z), z), p.group, symbolOf(z));
  }
  assert.equal(shorthand(predicted(29), 29), '[Ar] 4s² 3d⁹');
  assert.equal(shorthand(measured(29), 29), '[Ar] 3d¹⁰ 4s¹');
});

test('down a group, each jump in atomic number is one whole period', () => {
  for (let g = 1; g <= 18; g++) {
    const members = membersOf(g);
    gaps(g).forEach((gap, i) => {
      const upper = members[i]!, lower = members[i + 1]!;
      // From the s block the next member is the rest of this period away; from the
      // d and p blocks, it is as far as the next period is long.
      assert.equal(gap, periodLength(upper.block === 's' && upper.group! <= 2 ? upper.period : lower.period), `group ${g}`);
    });
  }
  assert.deepEqual(gaps(1), [2, 8, 8, 18, 18, 32]);
  assert.deepEqual(gaps(17), [8, 18, 18, 32, 32]);
});

test('group names follow the IUPAC 1 to 18 order with the CAS and old IUPAC letters', () => {
  assert.deepEqual(GROUP_NAMES.map((g) => g.group), Array.from({ length: 18 }, (_, i) => i + 1));
  const at = (g: number) => GROUP_NAMES[g - 1]!;
  assert.deepEqual([at(1).cas, at(1).oldIupac], ['IA', 'IA']);
  assert.deepEqual([at(3).cas, at(3).oldIupac], ['IIIB', 'IIIA']);
  assert.deepEqual([at(17).cas, at(17).oldIupac, at(17).trivial], ['VIIA', 'VIIB', 'halogens']);
  assert.deepEqual([at(18).cas, at(18).oldIupac, at(18).trivial], ['VIIIA', '0', 'noble gases']);
  assert.equal(configText(predicted(11)), '1s² 2s² 2p⁶ 3s¹');
});
