# Dataspecer Specification Reader

Dataspecer Specification Reader is a web application for exploring published semantic
data specifications through an overview, an introductory view and a detailed explorer.

**[Open the application](https://betse.github.io/dataspecer-specification-reader/)** ·
**[User guide](docs/user-guide.md)** · **[Developer guide](docs/developer-guide.md)**

## About the project

Published semantic data specifications often contain large amounts of technical information spread across documentation pages, diagrams, vocabularies, application profiles, schemas, and validation artifacts. While these resources provide comprehensive information, navigating and understanding them can be challenging, especially for users who are unfamiliar with the specification or its underlying technologies.

The goal of this project is to investigate alternative interaction and exploration workflows that improve the user experience of published semantic data specifications. The project focuses on helping users understand specification purpose, relationships, structure, and implementation details through dedicated exploration views and progressive disclosure of complexity.

## Intended users

The reader supports three overlapping perspectives:

- **Beginner** – users who need guidance, explanations, and a clear entry point into a specification.
- **Experienced user** – users who are familiar with semantic specifications and need to explore structure, relationships, profiles, and reusable concepts.
- **Developer** – users who need technical details such as IRIs, constraints, schemas, validation artifacts, and implementation-oriented representations.

These are use cases, not access roles or a ranking of ability. Anyone can use every view.

## Views

The application is organized into several focused exploration modules:

### Specification loader

Entry point for loading and selecting specifications.

### Spec-to-Spec

Provides an overview of the selected specification and its relationships to other specifications, vocabularies, and profiles.

### Primer

Provides a guided introduction to the most important concepts and relationships within a specification.

### Specification Explorer

Provides detailed exploration of classes, properties, constraints, and implementation-oriented information.



## Getting started

1. [Open the reader](https://betse.github.io/dataspecer-specification-reader/).
2. Choose a **preloaded specification**, or paste the URL of a **Dataspecer-generated HTML publication** into the specification URL field.
3. Open **Spec-to-Spec** to understand the publication and its relationships.
4. Continue to **Primer** for an introduction or **Specification Explorer** for class/property details and code output.

The preloaded DCAT-AP example is a useful starting point. A supported publication needs accessible embedded JSON-LD for metadata; semantic views additionally depend on advertised RDF resources. Network and browser cross-origin restrictions can affect loading.

For step-by-step instructions on using the application, see the [user guide](docs/user-guide.md).

## Development quick start

**Prerequisites:** Node.js 22 and npm.

```bash
npm ci
npm run dev
```

Open the local address printed by Vite, including the configured application base path.

```bash
npm run typecheck
npm run build
npm run preview
```

The application uses Vue 3, TypeScript, Vite, N3 for RDF parsing, and D3 for relationship visualization. It is deployed as a static site on GitHub Pages; no application backend or database is required.

See the [developer guide](docs/developer-guide.md) for tests, contribution workflows, and maintenance, and [architecture](docs/architecture.md) for the loading pipeline and component boundaries.

## Documentation

| Document | Audience | Contents |
| --- | --- | --- |
| [User guide](docs/user-guide.md) | Readers and evaluators | Loading, navigating, interpreting information, using code view, troubleshooting |
| [Developer guide](docs/developer-guide.md) | Contributors | Setup, commands, tests, maintenance workflows |
| [Architecture](docs/architecture.md) | Contributors and reviewers | Components, data flow, state, and design decisions. |
| [Known limitations](docs/limitations.md) | All users | Supported inputs, SVG matching, reused terms, and generated code. |

## Deployment

The repository's `.github/workflows/build.yml` builds pull requests targeting `main` and deploys pushes to `main`; it also supports manual runs. GitHub Pages must be configured to use **GitHub Actions** as its deployment source. The Vite base path is `/dataspecer-specification-reader/` for the current repository deployment.

Hash-based routing enables direct view links on static hosting. The workflow builds the application but does **not** run every test suite; run the checks in the [developer guide](docs/developer-guide.md) before releasing changes.

## Project scope

This project investigates the usability of published data specifications through different exploration workflows. The reader presents information derived from available published artifacts; completeness and accuracy depend on those artifacts and the supported parsing and presentation features. See [known limitations](docs/limitations.md) for precise boundaries.



