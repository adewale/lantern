# Releasing the npm package

This is the maintainer's npm release procedure. [Publishing](PUBLISHING.md) covers an author's HTML pages.

`rayner@0.1.0` was published on 29 October 2026. Its npm archive and `v0.1.0` tag are immutable. Use a new version for changes; never repack or replace the first release to correct its old “unreleased” changelog heading.

## Validate the archive

Use Node 24 and a clean checkout of the release commit. Install the optional Chromium, Python and font dependencies listed in the CI workflow and [lettering guide](LETTERING.md), then run:

```sh
npm ci
npm run check
npm run test:full
npm run test:embeds
npm run demos:check
EXPLAIN_BROWSER=1 EXPLAIN_LETTERING=1 npm run release:check
npm run demos:review
```

`release:check` packs once, installs that tarball in a temporary author project, compiles the public TypeScript API and exercises the CLI. It checks committed Arabic, Devanagari, maths and replacement-face snapshots without Python or source fonts. With `EXPLAIN_LETTERING=1`, it also captures new Arabic and maths through the installed package. The browser flag checks installed diagram capture.

The command retains `out/release/rayner-<version>.tgz` and `manifest.json`, which records the archive's SHA-512 integrity, source commit, dirty-tree status, file list and gates run. A dirty checkout can be tested locally, but cannot be published by the workflow. Review the file list and licence notices. Do not repack after testing.

`pack:smoke -- --archive <path>` can retest an existing archive without packing again. Consumer installs compile no package source and download no fonts; capture and PNG dependencies are included.

The compatibility job checks Node 24 on macOS as well as Ubuntu, including an installed starter preview with the normal authoring dependencies. A configured matrix is not evidence of a successful Mac run: require both platforms to pass before tagging.

Video export is deferred to 0.3 in [PR #36](https://github.com/adewale/rayner/pull/36). It is absent from the 0.1 CLI and archive.

## Enable publishing

Before using `.github/workflows/publish.yml`:

1. Require the nine CI contexts on main: `check`, `catalog`, `story` and the six minimum/current compatibility checks. All must pass on the release commit.
2. The 0.1.0 manual publication completed package ownership bootstrap. Subsequent versions use npm trusted publishing for owner `adewale`, repository `rayner`, workflow `publish.yml`, environment `npm-publish`. Keep the npm account protected with 2FA; do not create a long-lived publishing token.
3. The owner configured `npm-publish` with Ade as required reviewer, no admin bypass and a `v*` tag deployment policy. Self-review is allowed because Ade is the sole reviewer. Verify those settings before relying on them; naming an environment in YAML alone does not create its protections.

Trusted publishing requires npm 11.5.1+; the workflow checks that floor and uses Node 24. Its publishing job alone gets `id-token: write`. The normal CI jobs have read-only repository access. The archive gate also runs on Node 24.0.0 to check the declared minimum; the full browser and capture gates run on the current Node 24 release. npm automatically generates provenance for trusted publishing; `repository.url` must match this public repository.

## Publish a tested version

Update the package and lockfile versions together and date the changelog entry. Merge and validate the release commit, then create its matching `v<version>` git tag. Dispatch **publish** on that tag with operation `publish`, selecting `next` for an initial candidate or `latest` for the default install. Approve its protected `npm-publish` deployment after reviewing the tested commit and archive.

The workflow runs reusable CI, retains the exact tested archive for 90 days, waits for the protected environment, and downloads that archive into its publishing job. It verifies the tag, source SHA, clean checkout, package name, gates and integrity. It also refuses an existing npm version and an undated changelog entry. Before publishing, it uploads the tested tarball, manifest, served-story review, size/startup report and WebKit/Safari records to a draft GitHub Release. Every report must name the tagged source commit. It publishes that tarball directly, checks the registry serves the same integrity, then exposes the release. No second build occurs. GitHub Release assets have no Actions-artifact expiration.

If npm succeeds but final release promotion fails, inspect the draft, compare its manifest with `npm view rayner@<version> dist.integrity`, then expose that draft. Do not publish the version again. A failed npm publication leaves the draft and tested bytes available for inspection.

## Preserve an existing publication

For the manual 0.1.0 bootstrap, use the `archive` operation on a branch containing the current workflow:

```sh
gh workflow run publish.yml --ref main -f operation=archive -f version=0.1.0
```

The archive job checks out the existing version tag, downloads the original public npm tarball, checks its registry SHA-512, and runs the tagged installed-package gate with browser and lettering capture enabled. It preserves those exact bytes, a manifest and the validation log on GitHub Releases. This is explicitly retrospective validation, not original publication provenance. It does not call `npm publish`, move a tag, overwrite assets or alter an existing public release.

After publication, confirm the version and dist-tag with `npm view rayner version dist-tags dist.integrity --json`, and try installation in a fresh author project. For a candidate, ask an outside author to follow the tutorial before promoting it with `npm dist-tag add rayner@<version> latest`. The README's install section reads the same before and after publication, because npm shows the README from the archive and a published archive cannot change; do not add or remove an "unpublished" note around a release. A published name/version pair cannot be reused, so correct mistakes in a new version.

Sources: [npm publish](https://docs.npmjs.com/cli/v11/commands/npm-publish), [trusted publishing](https://docs.npmjs.com/trusted-publishers), [provenance](https://docs.npmjs.com/generating-provenance-statements).
