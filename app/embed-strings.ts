// The page's own words (player controls, notices, transcript headings), by the language of
// the scene (`meta.lang`). A language without a table here gets English. The generated picture
// descriptions are English in every language; a page in another language marks them lang="en".
import type { ExplainerClass, Settings } from '../explain/index.ts';

export interface Chrome {
  /** Accessible name of the player section. */
  player: string;
  /** The disclosure under the caption that lists what the picture shows. */
  picture: string;
  /** Accessible name of the controls. */
  controls: string;
  previous: string;
  nextLabel: string;
  /** The visible word on the Next button. */
  next: string;
  zoomOut: string;
  zoomIn: string;
  fit: string;
  replay: string;
  stop: string;
  copy: string;
  enlarge: string;
  exitFullScreen: string;
  /** Accessible name of the list of steps. */
  stepList: string;
  newTab: string;
  reducedMotion: string;
  copied: string;
  /** A notice when the URL names a step this case does not have. */
  noStep: (step: string) => string;
  /** A notice when the URL's settings are invalid; `problem` is the validator's (English) message. */
  fallback: (problem: string) => string;
  /** The stage's accessible name: the explainer's title and the step's. */
  stageLabel: (title: string, step: string) => string;
  /** "Label: option", the way a case is named in headings. */
  setting: (label: string, option: string) => string;
  transcript: string;
  sources: string;
  /** Shown when the player cannot start, above the transcript. */
  failed: string;
}

const EN: Chrome = {
  player: 'Explainer',
  picture: 'What the picture shows',
  controls: 'Steps',
  previous: 'Previous step',
  nextLabel: 'Next step',
  next: 'Next',
  zoomOut: 'Zoom out',
  zoomIn: 'Zoom in',
  fit: 'Fit stage',
  replay: 'Replay step',
  stop: 'Stop animation',
  copy: 'Copy link',
  enlarge: 'Enlarge',
  exitFullScreen: 'Exit full screen',
  stepList: 'Steps in this explainer',
  newTab: 'Open in a new tab',
  reducedMotion: 'Reduced motion is on, so the finished step is shown.',
  copied: 'Link copied.',
  noStep: (step) => `This case has no “${step}” step, so it opens at the first step.`,
  fallback: (problem) => `${problem}. Showing the default case.`,
  stageLabel: (title, step) => `${title}: ${step}`,
  setting: (label, option) => `${label}: ${option}`,
  transcript: 'Transcript',
  sources: 'Sources',
  failed: 'The interactive player could not start. The transcript is available below.',
};
/** French typography: a narrow no-break space (U+202F) before : ; ! ? and inside « ». */
const FR: Chrome = {
  player: 'Explication',
  picture: 'Ce que montre l’image',
  controls: 'Étapes',
  previous: 'Étape précédente',
  nextLabel: 'Étape suivante',
  next: 'Suivant',
  zoomOut: 'Zoom arrière',
  zoomIn: 'Zoom avant',
  fit: 'Adapter à la page',
  replay: 'Rejouer l’étape',
  stop: 'Arrêter l’animation',
  copy: 'Copier le lien',
  enlarge: 'Plein écran',
  exitFullScreen: 'Quitter le plein écran',
  stepList: 'Étapes de cette explication',
  newTab: 'Ouvrir dans un nouvel onglet',
  reducedMotion: 'Les animations sont réduites : l’étape s’affiche terminée.',
  copied: 'Lien copié.',
  noStep: (step) => `Ce cas n’a pas d’étape « ${step} » : il s’ouvre à la première étape.`,
  fallback: (problem) => `${problem}. Le cas par défaut est affiché.`,
  stageLabel: (title, step) => `${title} : ${step}`,
  setting: (label, option) => `${label} : ${option}`,
  transcript: 'Transcription',
  sources: 'Sources',
  failed: 'Le lecteur interactif n’a pas pu démarrer. La transcription se trouve plus bas.',
};
export const CHROME: Readonly<Record<string, Chrome>> = { en: EN, fr: FR };

/** The primary subtag of a BCP 47 tag, lower case: "fr-CA" → "fr". */
const primary = (lang: string) => lang.split('-')[0]!.toLowerCase();
/** The words for `lang`, or English when there is no table for it. */
export function chromeFor(lang = 'en'): Chrome {
  return CHROME[primary(lang)] ?? EN;
}
/** True when `lang` is English, the language of the generated picture descriptions. */
export const isEnglish = (lang = 'en') => primary(lang) === 'en';
/** ` lang="en"` for an element holding generated descriptions on a page in another language, else nothing. */
export const descriptionLang = (lang = 'en') => (isEnglish(lang) ? '' : ' lang="en"');
/** A case's name, "Label: option · Label: option", with the language's punctuation. */
export function caseNameIn(lang: string, Scene: ExplainerClass, values: Settings): string {
  const t = chromeFor(lang);
  return (Scene.settings ?? [])
    .map((s) => t.setting(s.label, s.options.find((o) => o.value === values[s.id])?.label ?? values[s.id]!))
    .join(' · ');
}
