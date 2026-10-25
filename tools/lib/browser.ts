// Chromium for diagram capture and the browser tests, via playwright-core (an optional dependency).
import { chromium } from 'playwright-core';
import type { Browser } from 'playwright-core';
import { existsSync, readdirSync } from 'node:fs';

function executable(): string | undefined {
  if (process.env.CHROMIUM_EXECUTABLE_PATH) return process.env.CHROMIUM_EXECUTABLE_PATH;
  // Any installed Playwright Chromium will do, newest first, on Linux or macOS.
  const bases = process.env.PLAYWRIGHT_BROWSERS_PATH
    ? [process.env.PLAYWRIGHT_BROWSERS_PATH]
    : [`${process.env.HOME}/.cache/ms-playwright`, `${process.env.HOME}/Library/Caches/ms-playwright`];
  const binaries = [
    'chrome-linux/chrome',
    'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
    'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium',
  ];
  for (const base of bases) {
    if (!existsSync(base)) continue;
    const dirs = readdirSync(base)
      .filter((d) => /^chromium-\d+$/.test(d) && existsSync(`${base}/${d}/INSTALLATION_COMPLETE`))
      .sort((a, b) => Number(b.slice(9)) - Number(a.slice(9)));
    for (const dir of dirs)
      for (const bin of binaries) if (existsSync(`${base}/${dir}/${bin}`)) return `${base}/${dir}/${bin}`;
  }
  return undefined; // let playwright find its own
}

export const launch = (): Promise<Browser> => chromium.launch({ executablePath: executable() });
