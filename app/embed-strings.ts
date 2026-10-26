// The page's own words (player controls, notices, transcript headings), by the language of
// the scene (`meta.lang`). A language without a table here gets English. The generated picture
// descriptions have their own vocabulary (explain/words.ts); a page in a language it lacks
// shows them in English and marks them lang="en".
import type { ExplainerClass, Settings } from '../explain/index.ts';
import { describedIn, primaryLanguage } from '../explain/words.ts';

/** What is wrong with a URL's settings, so each language can say it in its own words. */
export type SettingsProblem =
  | { kind: 'option'; id: string; label: string; value: string }
  | { kind: 'setting'; id: string }
  /** Anything else the validator refuses, with its (English) message. */
  | { kind: 'other'; message: string };

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
  /** On a narrow stage: open each step on a close-up again, after Fit. */
  closeUp: string;
  /** The corner map's name: the step's next close-up, i of n. */
  nextCloseUp: (i: number, n: number) => string;
  replay: string;
  stop: string;
  copy: string;
  enlarge: string;
  exitFullScreen: string;
  /** Accessible name of the list of steps. */
  stepList: string;
  newTab: string;
  /** The loader's name for the frame when the host gives none. */
  frame: string;
  reducedMotion: string;
  copied: string;
  /** A notice when the URL names a step this case does not have. */
  noStep: (step: string) => string;
  /** A notice when the URL's settings are invalid. */
  fallback: (problem: SettingsProblem) => string;
  /** The stage's accessible name: the explainer's title, the step's, and the line under it. */
  stageLabel: (title: string, step: string, line: string) => string;
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
  closeUp: 'Close-up of each step',
  nextCloseUp: (i, n) => `Next close-up of this step (${i} of ${n})`,
  replay: 'Replay step',
  stop: 'Stop animation',
  copy: 'Copy link',
  enlarge: 'Enlarge',
  exitFullScreen: 'Exit full screen',
  stepList: 'Steps in this explainer',
  newTab: 'Open in a new tab',
  frame: 'Interactive explainer',
  reducedMotion: 'Reduced motion is on, so the finished step is shown.',
  copied: 'Link copied.',
  noStep: (step) => `This case has no “${step}” step, so it opens at the first step.`,
  fallback: (p) =>
    `${p.kind === 'option' ? `Unknown ${p.id} option: ${p.value}` : p.kind === 'setting' ? `Unknown setting: ${p.id}` : p.message}. Showing the default case.`,
  stageLabel: (title, step, line) => `${title}: ${step}${line ? ` — ${line}` : ''}`,
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
  closeUp: 'Gros plan sur chaque étape',
  nextCloseUp: (i, n) => `Gros plan suivant de cette étape (${i} sur ${n})`,
  replay: 'Rejouer l’étape',
  stop: 'Arrêter l’animation',
  copy: 'Copier le lien',
  enlarge: 'Plein écran',
  exitFullScreen: 'Quitter le plein écran',
  stepList: 'Étapes de cette explication',
  newTab: 'Ouvrir dans un nouvel onglet',
  frame: 'Explication interactive',
  reducedMotion: 'Les animations sont réduites : l’étape s’affiche terminée.',
  copied: 'Lien copié.',
  noStep: (step) => `Ce cas n’a pas d’étape « ${step} » : il s’ouvre à la première étape.`,
  fallback: (p) =>
    `${
      p.kind === 'option'
        ? `Le réglage « ${p.label} » n’a pas d’option « ${p.value} »`
        : p.kind === 'setting'
          ? `Cette explication n’a pas de réglage « ${p.id} »`
          : 'Les réglages de l’adresse ne sont pas valides'
    }. Le cas par défaut est affiché.`,
  stageLabel: (title, step, line) => `${title} : ${step}${line ? ` — ${line}` : ''}`,
  setting: (label, option) => `${label} : ${option}`,
  transcript: 'Transcription',
  sources: 'Sources',
  failed: 'Le lecteur interactif n’a pas pu démarrer. La transcription se trouve plus bas.',
};
export const CHROME: Readonly<Record<string, Chrome>> = { en: EN, fr: FR };

/** The words for `lang`, or English when there is no table for it. */
export function chromeFor(lang = 'en'): Chrome {
  const primary = primaryLanguage(lang);
  return Object.hasOwn(CHROME, primary) ? CHROME[primary]! : EN;
}
/**
 * The lang attribute an element holding generated descriptions needs on a page in `lang`:
 * "en" when the descriptions have no words in that language, else none.
 */
export const descriptionsLang = (lang = 'en'): string | undefined =>
  describedIn(lang) === primaryLanguage(lang) ? undefined : describedIn(lang);
/** ` lang="en"` for an element holding generated descriptions in a language the page is not in, else nothing. */
export const descriptionLang = (lang = 'en') => {
  const tag = descriptionsLang(lang);
  return tag ? ` lang="${tag}"` : '';
};
/**
 * Why `resolveSettings` refused a URL's `values`, found the way it checks them: a declared
 * setting's unknown option first, then an undeclared setting.
 */
export function settingsProblem(Scene: ExplainerClass, values: Settings, error: unknown): SettingsProblem {
  for (const s of Scene.settings ?? []) {
    const value = Object.hasOwn(values, s.id) ? values[s.id]! : undefined;
    if (value !== undefined && !s.options.some((o) => o.value === value)) return { kind: 'option', id: s.id, label: s.label, value };
  }
  const declared = new Set((Scene.settings ?? []).map((s) => s.id));
  const unknown = Object.keys(values).find((id) => !declared.has(id));
  return unknown !== undefined ? { kind: 'setting', id: unknown } : { kind: 'other', message: String((error as Error)?.message ?? error) };
}
/** A case's name, "Label: option · Label: option", with the language's punctuation. */
export function caseNameIn(lang: string, Scene: ExplainerClass, values: Settings): string {
  const t = chromeFor(lang);
  return (Scene.settings ?? [])
    .map((s) => t.setting(s.label, s.options.find((o) => o.value === values[s.id])?.label ?? values[s.id]!))
    .join(' · ');
}
