import { Group } from '../../../../src/index.ts';
import { impot, euros, partsTexte } from '../quotient-familial.ts';
import { flow, label, table } from '../reader-drawing.ts';
import type { ReaderFrame } from '../reader-drawing.ts';
export function frames(revenu: number, enfants: number): ReaderFrame[] {
  const r = impot(revenu, enfants),
    no = impot(revenu, 0);
  return [
    {
      id: 'reader-quotient',
      title: 'Pourquoi diviser le revenu ?',
      line: `Couple marié ou pacsé, ${enfants} enfant${enfants > 1 ? 's' : ''} à charge.`,
      caption: `Pour les revenus 2024, le modèle divise ${euros(revenu)} par ${partsTexte(r.parts)} parts, soit ${euros(r.quotient, 2)} par part. Le barème progressif s’applique à ce quotient. On multiplie ensuite l’impôt par part par le nombre de parts. Le revenu entier n’est pas taxé au taux de la tranche la plus haute.`,
      values: { revenu, enfants, parts: r.parts, quotient: r.quotient, brut: r.brut },
      draw: (s) =>
        new Group(
          flow(s, ['Revenu', '÷ parts', 'Barème', '× parts']),
          label(`${euros(revenu)} ÷ ${partsTexte(r.parts)} = ${euros(r.quotient, 2)}`, 0, -1.2, s.palette.ink, 0.7),
          label(`Avant plafonnement : ${euros(r.brut, 2)}`, 0, -2.8, s.palette.ink, 0.7),
        ),
    },
    {
      id: 'reader-cap',
      title: 'Les parts donnent-elles une réduction illimitée ?',
      line: 'Comparer le calcul avec enfants au même couple sans enfant.',
      caption: `Non. L’avantage lié aux enfants est plafonné. Ici, le calcul brut donne ${euros(r.brut, 2)}, contre ${euros(no.brut, 2)} sans enfant. Le plafond ${r.plafonne ? 'limite' : 'ne limite pas'} cet avantage. Après plafonnement et décote, l’impôt du modèle est ${euros(r.impot)}. Il reste avant réductions, crédits et seuil de recouvrement ; ce n’est pas un simulateur fiscal complet.`,
      values: {
        sansEnfants: r.sansEnfants,
        plafond: r.plafond,
        plafonne: r.plafonne,
        decote: r.decoteGain,
        impot: r.impot,
      },
      draw: (s) =>
        table(
          ['Étape', 'Montant'],
          [
            ['Calcul brut', euros(r.brut, 2)],
            ['Après plafond', euros(r.plafQf, 2)],
            ['Après décote', euros(r.impot)],
          ],
          s,
          { xs: [-3.4, 4.3], y: 2.6, gap: 1.55 },
        ),
    },
  ];
}
