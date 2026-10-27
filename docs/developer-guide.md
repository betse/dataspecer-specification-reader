# Developer guide

[Project home](../README.md) · [Architecture](architecture.md) · [Known limitations](limitations.md)

This guide covers **developing, testing, and maintaining** the Dataspecer Specification Reader. For data flow and module responsibilities, start with [architecture](architecture.md). For using the UI, see the [user guide](user-guide.md).

## Local development

**Requirements:** Node.js 22 and npm (matching the deployment workflow).

```bash
npm ci
npm run dev
```

Open the address printed by Vite, including the configured base path. No application backend, database, or API credentials are required. The browser still needs network access to published specifications and their artifacts.

```bash
npm run typecheck
npm run build
npm run preview
```

The build checks Vue/TypeScript and writes static files to `dist/`; `preview` serves that build locally. Do not edit generated `dist/` output to change source behavior.

## Where to make changes

| Change | Start here |
| --- | --- |
| Loading a published URL | `src/data/loading/` |
| Normalizing embedded JSON-LD | `src/data/normalization/` and `src/data/model/` |
| RDF parsing or reuse resolution | `src/data/semantic/` and `src/data/loading/load-semantic-specification.ts` |
| Spec-to-Spec presentation | `src/pages/spec-to-spec` and its S2S page model |
| Primer presentation, key concepts or SVG matching | `src/pages/primer/` and its primer page model |
| Explorer presentation, selection, filters, and output | `src/pages/spec-explorer/` and its explorer page model |
| Routing and shared state | `src/app/router.ts`, `src/app/App.vue`, `src/state/specification-state.ts` |
| Preloaded publications | `src/pages/spec-loader/default-specifications.ts` |

The [architecture document](architecture.md) describes the exact data boundaries; this table is a maintenance index.

## Development principles

- **Keep source acquisition separate from presentation.** Metadata-only Spec-to-Spec should not trigger RDF parsing merely to display an overview. Primer and Explorer request semantic data when needed.
- **Use IRIs for identity.** Labels can be translated, duplicated, or synthesized and are not stable keys.
- **Preserve uncertainty.** Missing fields are unknown; do not infer requirements, value types, or definitions without source evidence. Requirement level and cardinality are separate properties.
- **Preserve local class identity.** Reused values from internal dependency publications can enrich descriptions but must not replace the current publication's class list.
- **Keep filters and inclusion separate.** Explorer table/search filters and Code view checklist filters should not silently change which properties are included in generated output.
- **Avoid unrestricted external fetching.** Dependency discovery currently has explicit boundaries; expanding them requires decisions about supported formats, error handling, provenance, and network cost.

## Common changes

### Add a preloaded publication

1. Edit `src/pages/spec-loader/default-specifications.ts` and supply a unique ID, title, description, HTML publication URL, and existing presentation fields.
2. Verify that selecting the card loads the publication directly.
3. Check that the publication advertises reachable semantic artifacts and that Primer/Explorer handle the result or report limitations clearly.

### Add a field to a view

1. Determine whether it comes from embedded publication JSON-LD or semantic RDF.
2. Check whether the existing normalized/semantic model already contains it; extend source parsing only if necessary.
3. Map it into the relevant page model, preserving localized strings and missing-value behavior.
4. Add UI rendering or filtering and a regression test for the data/model behavior.
5. Check simple/detailed modes, both themes, and a narrow viewport.

For a new relationship predicate, update normalization and tests before changing graph presentation.

### Change SVG interaction

`src/pages/primer/InteractiveSvgDiagram.vue` handles the diagram UI; `src/pages/primer/model/match-diagram-term.ts` handles term matching. Prefer exact identifiers, then unique normalized labels. Do not use substring matching or a parent node's IRI as a child's identity. Keep a diagram-only fallback for unmatched nodes. Verify behavior in a browser: unit tests cannot establish that arbitrary exported SVGs have correct event and layout behavior.

### Change code generation

TypeScript, JSON Schema, and Turtle generation currently reside in `src/pages/spec-explorer/SpecExplorerView.vue` (`createTypeScriptInterface`, `createJsonSchema`, `createTurtleExample`). Property-inclusion and referenced-class helpers live in its model directory.

Test missing and multiple ranges, cardinality variants, unresolved references, excluded mandatory properties, and changes in active class selection. Do not describe generated output as validated unless validation is implemented and tested. See [limitations](limitations.md#generated-code-is-a-starting-point-not-validated-output).

### Update adapted Dataspecer semantic code

The vocabulary and application-profile models/parsers under `src/data/semantic/`
originated from Dataspecer and are maintained locally, not automatically synchronized
through a package dependency. Before importing another upstream change, compare it
with the local N3 adapter and reader integration. Record the upstream source/revision
and adaptations when known, retain applicable notices, and check upstream licensing
before redistributing copied material.

## Automated checks

Run the relevant focused tests during development, then the broader checks before release:

```bash
npm run test:data
npm run test:language
npm run test:s2s-models
npm run test:primer-model
npm run test:explorer-model
node --import tsx --test src/pages/spec-explorer/model/code-property-selection.test.ts src/pages/spec-explorer/model/referenced-classes.test.ts
npm run typecheck
npm run lint
npm run format:check
npm run build
```

`test:data` covers loading, normalization, semantic loading/reuse, and parsers. Focused scripts such as `test:loading`, `test:semantic`, and `test:parsers` are useful when changing one layer. Tests use Node's test runner with `tsx`.

Use checked-in snapshots in `src/data/testing/fixtures/` for representative published input, and small synthetic cases for missing data, ambiguous labels, malformed responses, and cycles. Mock remote requests so automated tests do not depend on live services. Document why a fixture or expected result changes.

`npm run format` rewrites the whole repository; prefer formatting only touched files when possible.

## Browser verification before release

Automated model tests do not replace browser testing. Verify at least:

- A preloaded publication, a pasted publication URL, and a failed request.
- Refresh/direct links to each reader view, including the no-specification state.
- A vocabulary-only publication and an application profile.
- Relationship navigation, graph interaction, and diagram nodes that match or do not match RDF terms.
- Explorer class selection, search, filters, property details, and column controls.
- Code view inclusion, format switching, warnings, and copying.
- Simple/detailed modes, light/dark themes, and narrow/wide layouts.

## Deployment and handoff

`.github/workflows/build.yml` builds pull requests to `main` and deploys pushes to `main`; manual runs are supported. GitHub Pages should use **GitHub Actions** as its source, and the base path in `vite.config.ts` must match the deployment directory. The workflow currently builds but does not execute the complete test suite.

Before handoff, update the [user guide](user-guide.md) when interactions change, [architecture](architecture.md) when ownership or data flow changes, and limitations when a documented restriction is resolved or added.
Keep the README as the documentation entry point. Record unresolved issues honestly
and identify the submitted commit or release so reviewers can reproduce that version.