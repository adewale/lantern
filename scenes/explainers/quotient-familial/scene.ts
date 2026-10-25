import { Scene } from '../../../src/index.ts';
import { stage, settingsOf, regionBox } from '../../../explain/index.ts';
import { impot, bareme, BAREME, PARAMS, euros, nombre, pourcent, partsTexte, NNBSP } from '../lib/quotient-familial.ts';
import type { Impot } from '../lib/quotient-familial.ts';

// Every rule is read from openfisca-france at tag 176.1.3 (commit 5cc6563); the model in
// ../lib/quotient-familial.ts quotes file and line for each one.
const OF =
  'https://github.com/openfisca/openfisca-france/blob/5cc6563749b88254b479ef89c98099cb9513d6cb/openfisca_france/';
const STYLE = 'pen-and-ink';
const nb = NNBSP;
/** French « » with narrow no-break spaces inside. */
const guillemets = (t: string) => `«${nb}${t}${nb}»`;
/** A French colon, semicolon or question mark takes a narrow no-break space before it. */
const deux = `${nb}:`,
  pv = `${nb};`;
/**
 * Card values are set in JetBrains Mono, which has no U+202F; every space in a monospaced face
 * is one cell wide anyway, so values take the plain no-break space instead.
 */
const mono = (t: string) => t.replace(/\u202f/g, '\u00a0');
const ENFANTS = ['sans enfant', 'un enfant', 'deux enfants', 'trois enfants'];
const RANG = ['1er enfant', '2e enfant', '3e enfant'];

// The pipeline the steps walk along: ir_brut, ir_ss_qf, ir_plaf_qf, decote and ip_net in ir.py.
// Tighter ranks than Mermaid's default and two-line labels keep its 13 px labels near 18 px on the stage.
const FLOW = [
  '---\nconfig:\n  flowchart:\n    rankSpacing: 24\n    nodeSpacing: 16\n---',
  'graph LR',
  'RNI["Revenu net<br/>imposable"] --> QUOT["÷ parts"]',
  'QUOT --> BAR["Barème"]',
  'BAR --> FOIS["× parts"]',
  'FOIS --> PLAF["Plafonnement"]',
  'RNI --> REF["Sans enfants<br/>2 parts"]',
  'REF --> PLAF',
  'PLAF --> DEC["Décote"]',
  'DEC --> IMP["Impôt"]',
].join('\n');

// bareme.yaml, the four thresholds' 2024-01-01 entries, then with the 2025-01-01 entries commit
// a59104153d added (lines 134–137, 290–293, 448–451, 608–611 at 176.1.3). The first tranche starts at 0 since 1945.
const yaml = (year: 2024 | 2025) =>
  BAREME[2024]
    .slice(1)
    .flatMap((b, i) => [
      '- threshold:',
      '    2024-01-01:',
      `      value: ${b.from}`,
      ...(year === 2025 ? ['    2025-01-01:', `      value: ${BAREME[2025][i + 1]!.from}`] : []),
    ]);

/** A round top for a value axis: 1, 2 or 5 times a power of ten, at least 100. */
const arrondi = (v: number) => {
  const p = 10 ** Math.floor(Math.log10(Math.max(v, 100)));
  return [1, 2, 5, 10].map((k) => k * p).find((t) => t >= v) ?? 10 * p;
};
/** A bar chart source with a fixed canvas, so its labels keep their size on the stage, and a value axis from 0. */
const chart = (opts: { width: number; height: number; x: string[]; y: string; bars: number[]; line?: number[] }) =>
  `---\nconfig:\n  xyChart:\n    width: ${opts.width}\n    height: ${opts.height}\n---\n` +
  `xychart-beta\n x-axis [${opts.x.map((x) => `"${x}"`).join(', ')}]\n y-axis "${opts.y}" 0 --> ${arrondi(Math.max(...opts.bars, ...(opts.line ?? [])))}\n` +
  ` bar [${opts.bars.map((v) => v.toFixed(2)).join(', ')}]` +
  (opts.line ? `\n line [${opts.line.map((v) => v.toFixed(2)).join(', ')}]` : '');

export default class QuotientFamilialExplainer extends Scene {
  static meta = {
    id: 'quotient-familial',
    title: 'Le quotient familial divise le revenu avant le barème, et son plafond reprend l’excédent',
    lang: 'fr',
    sources: [
      OF + 'parameters/impot_revenu/bareme_ir_depuis_1945/bareme.yaml',
      OF + 'parameters/impot_revenu/calcul_impot_revenu/plaf_qf/plafond_avantages_procures_par_demi_part/general.yaml',
      OF + 'parameters/impot_revenu/calcul_impot_revenu/plaf_qf/decote/seuil_couple.yaml',
      OF + 'parameters/impot_revenu/calcul_impot_revenu/plaf_qf/decote/taux.yaml',
      OF + 'model/prelevements_obligatoires/impot_revenu/ir.py#L1326-L1403',
      OF + 'model/prelevements_obligatoires/impot_revenu/ir.py#L1499-L1554',
      OF + 'model/prelevements_obligatoires/impot_revenu/ir.py#L1615-L1652',
      OF + 'model/prelevements_obligatoires/impot_revenu/ir.py#L3744-L3830',
      'https://github.com/openfisca/openfisca-france/commit/a59104153d67db9c269ad02b57dcefb10206e034',
      'https://github.com/openfisca/openfisca-france/tree/5cc6563749b88254b479ef89c98099cb9513d6cb/tests/leximpact/2024',
    ],
  };
  static settings = [
    {
      id: 'enfants',
      label: 'Enfants à charge',
      default: '1',
      options: [
        { value: '0', label: '0' },
        { value: '1', label: '1' },
        { value: '2', label: '2' },
        { value: '3', label: '3' },
      ],
    },
    {
      id: 'revenu',
      label: 'Revenu net imposable',
      default: '65673.88',
      options: [
        { value: '30000', label: euros(30000) },
        { value: '65673.88', label: euros(65673.88, 2) },
        { value: '150000', label: euros(150000) },
      ],
    },
  ];
  override async construct() {
    const values = settingsOf(this),
      enfants = Number(values.enfants),
      rni = Number(values.revenu);
    const r: Impot = impot(rni, enfants),
      tous = [0, 1, 2, 3].map((n) => impot(rni, n)),
      r25 = impot(rni, enfants, 2025);
    const s = stage(this, { style: STYLE, headingSize: 0.5 });
    type Rows = Parameters<typeof s.card>[0];
    const card = (rows: Rows, opts: Parameters<typeof s.card>[1]) =>
      s.card(
        rows.map(([label, value]) => [label, mono(String(value))] as const),
        opts,
      );
    const eur2 = (x: number) => euros(x, 2);
    const rniTexte = Number.isInteger(rni) ? euros(rni) : eur2(rni);

    // The pipeline sits on top for the first nine steps; each step's picture is below it.
    const TOP = regionBox('top', { bottom: -0.3 }),
      BELOW = regionBox('bottom', { top: -0.5 }),
      LEFT = regionBox(BELOW, { right: 1.2 }),
      RIGHT = regionBox(BELOW, { left: 1.5 });

    // ------------------------------------------------------------- revenu
    await this.step('revenu', {
      title: `Un couple déclare ${rniTexte} de revenu imposable`,
      caption: `Un couple marié ou pacsé, ${ENFANTS[enfants]}, déclare ${rniTexte} de revenu net imposable pour 2024. Le calcul reprend celui d’OpenFisca France 176.1.3, réduit aux étapes du schéma${deux} il s’arrête avant les réductions et crédits d’impôt, et ignore le seuil de 61 € sous lequel l’impôt n’est pas recouvré.`,
    });
    const flow = await s.show({ source: FLOW }, { box: TOP });
    await flow.mark(['RNI'], { as: 'this step' });
    await card(
      [
        ['Foyer', 'couple marié ou pacsé'],
        ['Enfants à charge', String(enfants)],
        ['Revenu net imposable', rniTexte],
        ['Revenus de l’année', '2024'],
      ],
      { at: LEFT, title: 'Ce foyer' },
    );
    await card(
      [
        ['Réductions, crédits d’impôt', 'non'],
        ['Seuil de recouvrement de 61 €', 'non'],
        ['Célibataires, veufs, invalidité', 'non'],
      ],
      { at: RIGHT, title: 'Hors du modèle' },
    );
    this.state = { rni, enfants };

    // -------------------------------------------------------------- parts
    await this.step('parts', {
      title: `${ENFANTS[enfants]![0]!.toUpperCase() + ENFANTS[enfants]!.slice(1)}${deux} ${partsTexte(r.parts)} parts`,
      caption:
        'Le couple compte pour deux parts. Les deux premiers enfants à charge ajoutent une demi-part chacun, et chaque enfant à partir du troisième une part entière. ' +
        (enfants
          ? `Avec ${ENFANTS[enfants]}, ce foyer a ${partsTexte(r.parts)} parts.`
          : 'Sans enfant, ce foyer en reste à deux parts.'),
    });
    await s.clearOverlays();
    await flow.unmark();
    await flow.mark(['QUOT'], { as: 'this step' });
    await card(
      [
        ['Couple', '2'],
        ...RANG.slice(0, enfants).map((rang, i) => [rang, i < 2 ? '0,5' : '1'] as const),
        ['Nombre de parts', partsTexte(r.parts)],
      ],
      {
        at: regionBox(BELOW, { left: -3.5, right: 3.5 }),
        title: 'Parts du foyer',
      },
    ).then((c) => c.mark('Nombre de parts'));
    this.state.parts = r.parts;

    // ----------------------------------------------------------- quotient
    await this.step('quotient', {
      title: `Le quotient${deux} ${eur2(r.quotient)} par part`,
      caption: `Le barème s’applique au revenu d’une seule part, le quotient${deux} ${rniTexte} ÷ ${partsTexte(r.parts)} = ${eur2(r.quotient)}. Plus le foyer a de parts, plus ce quotient est bas, et plus il reste dans les tranches du bas.`,
    });
    await s.clearOverlays();
    await flow.unmark();
    await flow.walk([['RNI', 'QUOT']], { trail: true });
    await card(
      [
        ['Revenu net imposable', rniTexte],
        ['÷ nombre de parts', partsTexte(r.parts)],
        ['= quotient', eur2(r.quotient)],
      ],
      { at: regionBox(BELOW, { left: -3.5, right: 3.5 }) },
    ).then((c) => c.mark('= quotient'));
    this.state.quotient = r.quotient;

    // ------------------------------------------------------------ barème
    const b = bareme(r.quotient),
      TRANCHES = BAREME[2024].map((x) => pourcent(x.rate)),
      reached = b.slices.filter((x) => x.base > 0),
      top = reached.at(-1)!;
    const sliceLabel = (x: (typeof b.slices)[number]) =>
      `${pourcent(x.rate)} de ${nombre(x.from)} à ${x.to == null ? '…' : nombre(x.to)}`;
    await this.step('bareme', {
      title: 'Le barème taxe chaque tranche à son propre taux',
      caption: `Le barème des revenus 2024 a cinq tranches, de 0 à 45${nb}%. Chaque barre est l’impôt d’une tranche sur ce quotient de ${eur2(r.quotient)}${deux} ${reached
        .map((x) => `${euros(x.base)} à ${pourcent(x.rate)}`)
        .join(', ')}. Leur somme, ${eur2(b.total)}, est l’impôt d’une part.`,
    });
    await s.clearOverlays();
    await flow.unmark();
    await flow.walk([['QUOT', 'BAR']], { trail: true });
    const bars = await s.show(
      {
        source: chart({
          width: 540,
          height: 250,
          x: TRANCHES,
          y: 'Impôt sur une part (€)',
          bars: b.slices.map((x) => x.tax),
        }),
      },
      { box: LEFT },
    );
    const parTranche = await card(
      [...reached.map((x) => [sliceLabel(x), eur2(x.tax)] as const), ['Impôt pour une part', eur2(b.total)]],
      { at: RIGHT, title: `Quotient de ${eur2(r.quotient)}` },
    );
    await parTranche.mark('Impôt pour une part');
    this.state.parPart = r.parPart;

    // -------------------------------------------------------------- taux
    const moyen = r.parPart / r.quotient;
    await this.step('taux', {
      title:
        top.rate > 0
          ? `La tranche à ${pourcent(top.rate)} ne taxe que l’excédent`
          : `Un quotient sous ${euros(BAREME[2024][1]!.from)} ne paie rien`,
      caption:
        top.rate > 0
          ? `Ce quotient atteint la tranche à ${pourcent(top.rate)}, mais seuls ses ${eur2(top.base)} au-dessus de ${euros(top.from)} y sont taxés${deux} ${guillemets(`passer dans la tranche à ${pourcent(top.rate)}`)} ne change rien aux euros d’en dessous. L’impôt d’une part vaut ${pourcent(moyen, 1)} du quotient${deux} c’est le taux moyen.`
          : `Ce quotient de ${eur2(r.quotient)} reste dans la première tranche, taxée à 0${nb}%. Aucune barre ne monte et l’impôt d’une part est nul${pv} les parts des enfants ont fait descendre le quotient sous ${euros(BAREME[2024][1]!.from)}.`,
    });
    const topBar = `bar:0:${pourcent(top.rate)}`;
    await bars.mark([topBar], { as: 'top tranche' });
    await parTranche.mark(sliceLabel(top), { as: 'top tranche' });
    this.state.tranche = top.rate;
    this.state.tauxMoyenPart = moyen;

    // --------------------------------------------------------- multiplie
    await this.step('multiplie', {
      title: `${partsTexte(r.parts)} parts × ${euros(r.parPart)}${deux} ${euros(r.brut)}`,
      caption: `L’impôt d’une part est multiplié par le nombre de parts${deux} ${partsTexte(r.parts)} × ${eur2(r.parPart)} = ${eur2(r.brut)}, la variable ir_brut d’OpenFisca. Chaque part repart du bas du barème, donc diviser puis multiplier donne moins d’impôt que d’appliquer le barème au revenu entier.`,
    });
    await s.clearOverlays();
    await bars.hide();
    await flow.unmark();
    await flow.dim(['RNI', 'QUOT', 'BAR', 'FOIS']);
    await flow.walk([['BAR', 'FOIS']], { trail: true });
    const enGros = bareme(rni).total;
    await card(
      [
        ['Impôt pour une part', eur2(r.parPart)],
        ['× nombre de parts', partsTexte(r.parts)],
        ['= impôt avec quotient', eur2(r.brut)],
        ['Barème sur le revenu entier', eur2(enGros)],
      ],
      { at: regionBox(BELOW, { left: -3.8, right: 3.8 }) },
    ).then((c) => c.mark('= impôt avec quotient'));
    this.state.brut = r.brut;

    // --------------------------------------------------------- reference
    await this.step('reference', {
      title: enfants
        ? `Sans enfants, ce revenu paierait ${euros(r.sansEnfants)}`
        : 'Sans enfant, la référence est ce calcul',
      caption: enfants
        ? `Pour borner l’effet des enfants, OpenFisca refait le calcul du couple sur deux parts seulement${deux} 2 × barème(${eur2(rni / 2)}) = ${eur2(r.sansEnfants)}, la variable ir_ss_qf. L’écart avec l’impôt sur ${partsTexte(r.parts)} parts, ${eur2(r.avantage)}, est ce que les enfants font gagner.`
        : `Pour borner l’effet des enfants, OpenFisca refait le calcul du couple sur deux parts seulement (ir_ss_qf). Sans enfant, ce foyer a déjà deux parts${deux} les deux calculs donnent ${eur2(r.sansEnfants)} et l’écart est nul.`,
    });
    await s.clearOverlays();
    await flow.dim(['RNI', 'REF', 'QUOT', 'BAR', 'FOIS', 'PLAF']);
    await flow.walk([['RNI', 'REF']], { trail: true });
    await card(
      [
        ['Impôt sur 2 parts (sans enfants)', eur2(r.sansEnfants)],
        [`Impôt sur ${partsTexte(r.parts)} parts`, eur2(r.brut)],
        ['Avantage des enfants', eur2(r.avantage)],
      ],
      { at: regionBox(BELOW, { left: -3.8, right: 3.8 }) },
    ).then((c) => c.mark('Avantage des enfants'));
    this.state.sansEnfants = r.sansEnfants;
    this.state.avantage = r.avantage;

    // ----------------------------------------------------------- plafond
    const lies = tous.filter((t) => t.plafonne).map((t) => t.enfants);
    const liesTexte = !lies.length
      ? 'Pour ce revenu, aucune barre ne dépasse la ligne.'
      : `Pour ce revenu, la barre dépasse la ligne avec ${lies.join(', ').replace(/, (\d)$/, ' et $1')} enfant${lies.length > 1 || lies[0]! > 1 ? 's' : ''}.`;
    const plafondTexte = euros(PARAMS[2024].plafond);
    await this.step('plafond', {
      title: !enfants
        ? 'Sans enfant, le plafond n’a rien à reprendre'
        : r.plafonne
          ? `Le plafond reprend ${eur2(r.avantage - r.plafond)}`
          : `L’avantage reste sous le plafond de ${euros(r.plafond)}`,
      caption:
        `Les enfants ne peuvent réduire l’impôt de plus de ${plafondTexte} par demi-part au-delà des deux du couple. Les barres sont l’avantage des enfants, la ligne est ce plafond. ${liesTexte}` +
        (!enfants
          ? ''
          : ' ' +
            (r.plafonne
              ? `Ici l’impôt retenu est ${eur2(r.sansEnfants)} − ${euros(r.plafond)} = ${eur2(r.plafQf)}.`
              : `Ici l’impôt sur ${partsTexte(r.parts)} parts, ${eur2(r.brut)}, est retenu.`)),
    });
    await s.clearOverlays();
    await flow.dim(['REF', 'FOIS', 'PLAF']);
    await flow.walk(
      [
        ['FOIS', 'PLAF'],
        ['REF', 'PLAF'],
      ],
      { parallel: true, trail: true },
    );
    const COUNTS = ['0 enfant', '1 enfant', '2 enfants', '3 enfants'];
    const cap = await s.show(
      {
        source: chart({
          width: 540,
          height: 250,
          x: COUNTS,
          y: 'Avantage (barres), plafond (ligne), €',
          bars: tous.map((t) => t.avantage),
          line: tous.map((t) => t.plafond),
        }),
      },
      { box: LEFT, build: 'frame' },
    );
    // The y-axis title names the bars and the line, so the renderer's legend ("Bar 1", "Line 1") stays out.
    await cap.reveal(cap.order.filter((id) => id !== 'legend' && !cap.visible.has(id)));
    await cap.mark([`bar:0:${COUNTS[enfants]}`], { as: 'this household' });
    await card(
      [
        [`Plafond (${r.demiParts} demi-part${r.demiParts > 1 ? 's' : ''} × ${plafondTexte})`, euros(r.plafond)],
        ['Avantage des enfants', eur2(r.avantage)],
        ['Impôt après plafonnement', eur2(r.plafQf)],
      ],
      { at: RIGHT },
    ).then((c) => c.mark('Impôt après plafonnement'));
    this.state.plafond = r.plafond;
    this.state.plafonne = r.plafonne;
    this.state.plafQf = r.plafQf;

    // ------------------------------------------------------------ décote
    const seuil = PARAMS[2024].decoteSeuil,
      taux = PARAMS[2024].decoteTaux,
      // around(1 470 − 0,4525 × impôt) is 0 once the impôt passes 1 469,5 / 0,4525 = 3 247,51 €.
      fin = Math.ceil((seuil - 0.5) / taux);
    await this.step('decote', {
      title:
        r.plafQf === 0
          ? 'Pas d’impôt, rien à décoter'
          : r.decoteGain > 0 && r.impot === 0
            ? 'La décote annule l’impôt'
            : r.decoteGain > 0
              ? `La décote retire ${euros(r.decoteGain)}${deux} impôt ${euros(r.impot)}`
              : `Pas de décote${deux} impôt ${euros(r.impot)}`,
      caption: `La décote allège les petits impôts${deux} ${euros(seuil)} moins ${pourcent(taux)} de l’impôt, sans dépasser l’impôt lui-même. Elle vaut zéro dès ${euros(fin)} d’impôt. ${
        r.plafQf === 0
          ? 'Ici l’impôt est déjà nul.'
          : r.decoteGain > 0
            ? `Ici elle retire ${euros(r.decoteGain)}, et l’impôt est de ${euros(r.impot)}.`
            : `Ici l’impôt de ${eur2(r.plafQf)} est au-dessus${deux} il reste ${euros(r.impot)}.`
      } Le tableau donne l’impôt de ce revenu pour chaque nombre d’enfants.`,
    });
    await s.clearOverlays();
    await cap.hide();
    await flow.dim(['PLAF', 'DEC', 'IMP']);
    await flow.walk(
      [
        ['PLAF', 'DEC'],
        ['DEC', 'IMP'],
      ],
      { trail: true },
    );
    await card(
      [
        ['Impôt après plafonnement', eur2(r.plafQf)],
        ['Décote', '− ' + euros(r.decoteGain)],
        ['Impôt', euros(r.impot)],
        ['Part du revenu', pourcent(r.tauxMoyen, 1)],
      ],
      { at: LEFT, title: 'Ce foyer' },
    ).then((c) => c.mark('Impôt'));
    await card(
      tous.map((t) => [COUNTS[t.enfants]!, euros(t.impot)] as const),
      { at: RIGHT, title: `Impôt, revenu de ${rniTexte}` },
    ).then((c) => c.mark(COUNTS[enfants]!, { as: 'this household' }));
    this.state.decote = r.decoteGain;
    this.state.impot = r.impot;
    this.state.parEnfants = tous.map((t) => t.impot);

    // ----------------------------------------------------- revenus 2025
    // Each threshold rises by 0,896 % to 0,901 %; the title names the rounded figure only if all four share it.
    const hausses = [1, 2, 3, 4].map((i) => pourcent(BAREME[2025][i]!.from / BAREME[2024][i]!.from - 1, 1)),
      hausse = hausses.every((h) => h === hausses[0]) ? hausses[0]! : `${hausses[0]} à ${hausses.at(-1)}`;
    await this.step('revenus-2025', {
      title: `Pour les revenus 2025, les seuils montent de ${hausse}`,
      caption: `Le commit a59104153d, ${guillemets('Barème 2026')}, ajoute à chacun des quatre seuils de bareme.yaml une valeur au 1er janvier 2025${pv} les taux ne changent pas. Avec aussi le plafond (${euros(PARAMS[2025].plafond)}) et la décote (${euros(PARAMS[2025].decoteSeuil)}) de 2025, le même revenu paierait ${r25.impot === r.impot ? `le même impôt, ${euros(r.impot)}` : `${euros(r25.impot)} au lieu de ${euros(r.impot)}`}.`,
    });
    await s.clear();
    const code = await s.code(yaml(2024), {
      at: regionBox('full', { right: 0.2 }),
      align: 'top',
      fontSize: 0.21,
    });
    await code.morph(yaml(2025), { markAdded: true });
    await card(
      [
        ['Seuils', '+' + hausse],
        ['Taux', 'inchangés'],
        ['Plafond par demi-part', `${euros(PARAMS[2024].plafond)} → ${euros(PARAMS[2025].plafond)}`],
        ['Décote, couple', `${euros(PARAMS[2024].decoteSeuil)} → ${euros(PARAMS[2025].decoteSeuil)}`],
        ['Impôt de ce foyer', `${euros(r.impot)} → ${euros(r25.impot)}`],
      ],
      { at: regionBox('full', { left: 0.6 }), title: 'bareme.yaml et paramètres, 2024 → 2025' },
    ).then((c) => c.mark('Impôt de ce foyer'));
    this.state.impot2025 = r25.impot;
  }
}
