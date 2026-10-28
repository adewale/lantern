# Releasing the npm package

This is the maintainer's npm release procedure. [Publishing](PUBLISHING.md) covers an author's HTML pages.

The package is not published yet. The `rayner` name returned a registry 404 during preparation; that does not reserve it or prove ownership. Do not announce an installable version until the registry confirms it.

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

1. Confirm repository Actions are enabled and that a pull-request run and a main run pass. GitHub disables workflows on new forks until an owner enables them; issue #9 records that setup problem. The session integration cannot change the repository's Actions setting.
2. Establish npm package ownership for the first publication using a maintainer account with 2FA. npm trusted-publisher configuration is a package setting, so its initial setup requires an existing package. Complete that bootstrap deliberately; this PR does not publish a package or set account permissions. If the bootstrap publishes 0.1.0, use the workflow for the next version. To try trusted publishing for 0.1.0 itself, first bootstrap a separately tested prerelease such as 0.1.0-rc.0, then configure the publisher and prepare the stable version. Never republish the bootstrap version.
3. In npm's package settings, add GitHub Actions as a trusted publisher for owner `adewale`, repository `rayner`, workflow `publish.yml`, environment `npm-publish`. Permit direct `npm publish` for this workflow. Do not create a long-lived publish token.
4. Create the GitHub environment `npm-publish` with required reviewers and release-tag deployment restrictions before enabling the publishing workflow. Naming an environment in YAML does not configure those protections.

Trusted publishing requires npm 11.5.1+; the workflow checks that floor and uses Node 24. Its publishing job alone gets `id-token: write`. The normal CI jobs have read-only repository access. The archive gate also runs on Node 24.0.0 to check the declared minimum; the full browser and capture gates run on the current Node 24 release. npm automatically generates provenance for trusted publishing; `repository.url` must match this public repository.

## Publish a tested version

Update the package and lockfile versions together and record the changes in the changelog. Merge and validate the release commit, then create its matching `v<version>` git tag. Dispatch **publish** on that tag, selecting `next` for an initial candidate or `latest` for the default install.

The workflow runs the reusable CI job, uploads the exact tested archive, waits for the `npm-publish` environment, and downloads that archive into its publishing job. Before calling npm it verifies the git tag, source SHA, clean checkout, package name, required gates and archive integrity. It publishes the tarball directly; no second build occurs.

After publication, confirm the version and dist-tag with `npm view rayner version dist-tags dist.integrity --json`, and try installation in a fresh author project. For a candidate, ask an outside author to follow the tutorial before promoting it with `npm dist-tag add rayner@<version> latest`. The README's install section reads the same before and after publication, because npm shows the README from the archive and a published archive cannot change; do not add or remove an "unpublished" note around a release. A published name/version pair cannot be reused, so correct mistakes in a new version.

Sources: [npm publish](https://docs.npmjs.com/cli/v11/commands/npm-publish), [trusted publishing](https://docs.npmjs.com/trusted-publishers), [provenance](https://docs.npmjs.com/generating-provenance-statements).
