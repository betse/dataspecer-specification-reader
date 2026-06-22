# Dataspecer Specification Reader

This directory contains the implementation for the Dataspecer Specification Reader, A web application for improving the exploration and usability of published semantic data specifications.


## Overview

Published semantic data specifications often contain large amounts of technical information spread across documentation pages, diagrams, vocabularies, application profiles, schemas, and validation artifacts. While these resources provide comprehensive information, navigating and understanding them can be challenging, especially for users who are unfamiliar with the specification or its underlying technologies.

The goal of this project is to investigate alternative interaction and exploration workflows that improve the user experience of published semantic data specifications. The project focuses on helping users understand specification purpose, relationships, structure, and implementation details through dedicated exploration views and progressive disclosure of complexity.


## Target Users

The proposed reader considers three broad groups of users:

* **Beginner Reader** – users who need guidance, explanations, and a clear entry point into a specification.
* **Specification Analyst** – users who are familiar with semantic specifications and need to explore structure, relationships, profiles, and reusable concepts.
* **Developer / Implementer** – users who need technical details such as IRIs, constraints, schemas, validation artifacts, and implementation-oriented representations.

## Proposed Views

The application is organized into several focused exploration modules:

### specification loader

Entry point for loading and selecting specifications.

### Specification overview and  Relationship Explorer (Spec-to-Spec)

Provides an overview of the selected specification and its relationships to other specifications, vocabularies, and profiles.

### Primer

Provides a guided introduction to the most important concepts and relationships within a specification.

### Specification Explorer

Provides detailed exploration of classes, properties, constraints, and implementation-oriented information.

## Project Status

Current stage:

* Project specification document completed
* Initial architecture defined
* Repository and project structure being established

The project is currently under active development.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Architecture Direction

The application follows the single-container architecture described in the project
specification. Each view is implemented as an internal module of the same client-side
application. This keeps deployment simple while allowing the views to remain independent
enough for gradual development and discussion.


