# Known limitations

These limitations describe the current implementation, not limitations of RDF or
Dataspecer in general. They were checked against the code paths linked below.

## SVG diagrams are not complete semantic models

A published SVG is a visual artifact. It may contain readable labels, descriptions,
node identifiers or IRIs, but the reader cannot assume it contains complete,
machine-readable class/property identities, relationships and constraints.
It would be too strong to say that every SVG contains no semantic information.

The reader loads RDF separately, then tries to connect each diagram node to a term:
first by exact IRI, otherwise by an unambiguous normalized heading. Duplicate labels,
missing identifiers, different languages or unsupported SVG layouts can prevent a
reliable match. Ambiguous matches are deliberately rejected rather than assigning
another class's details. A diagram-only selection can show available SVG text but
cannot reliably supply the full semantic property list. Without an SVG, there is
currently no generated semantic mini-graph fallback.

Implementation: [InteractiveSvgDiagram.vue](../src/pages/primer/InteractiveSvgDiagram.vue)
and [match-diagram-term.ts](../src/pages/primer/model/match-diagram-term.ts).

## Reused terms from external vocabularies

The application does not automatically dereference arbitrary term IRIs or maintain
a registry mapping external vocabularies such as FOAF, SKOS or DCTERMS to RDF downloads.
A term IRI alone is therefore insufficient to retrieve its definition.

For explicit DSV reuse declarations, the loader can fetch advertised RDF artifacts
from related Dataspecer publications classified as published specifications. The
resolver reads labels, definitions and usage notes from the downloaded documents,
including reuse chains. It does not add dependency classes to the current class list.
This depends on discoverable publication links, available artifacts and supported
reuse predicates; it is not unrestricted semantic inference.

If a reused value exists only in an external vocabulary that was not downloaded,
its details remain unresolved. The UI may show missing information or a label derived
from the term identifier. Such a label is not a retrieved authoritative definition.
External terms can still be resolved if the relevant triples are already in the
loaded artifacts; external origin itself does not cause those triples to be ignored.
The reader attempts to load at most 32 additional dependency publications per semantic load, including failed attempts. If more dependencies remain, it stops and records a warning.

Implementation: [load-semantic-specification.ts](../src/data/loading/load-semantic-specification.ts)
and [resolve-reused-values.ts](../src/data/semantic/resolve-reused-values.ts).


## Supported publication and relation structures

The metadata loader expects a Dataspecer HTML publication with embedded JSON-LD.
Normalization handles the structures expected by this application; it is not a
general-purpose JSON-LD expansion engine or an arbitrary HTML documentation scraper.
RDF parsing uses N3 and the supported vocabulary/DSV models, not every RDF syntax
or every possible ontology constraint.

Related specifications currently come from the supported `isProfileOf` structure.
The graph is therefore not a complete dependency or ontology graph. Classification
as a published specification requires a target identity and publication resource URL
in the expected metadata structure; missing metadata can leave a Dataspecer resource
classified as external. This classification is not proof of where a resource was authored.

Implementation: [normalize-specification.ts](../src/data/normalization/normalize-specification.ts)
and [parse-rdf.ts](../src/data/semantic/rdf/parse-rdf.ts).

## Key concepts are a heuristic selection

The Primer's eight-concept selection prioritizes `main` roles, then diagram discovery
order and source order. It is a starting point, not an assessment of domain importance
or a guarantee that all important concepts are included. Missing role metadata and
diagram matches affect the selection. Explorer remains the place to inspect the
complete supported local class/property model.

Implementation: [key-concepts.ts](../src/pages/primer/model/key-concepts.ts).

## Generated code is a starting point, not validated output

TypeScript, JSON Schema and Turtle generation use simplified mappings of the selected
properties. TypeScript optionality and JSON Schema `required` currently depend on
explicit mandatory requirement values, not a complete reconciliation with cardinality.
Collection detection checks for cardinalities ending in `*`; finite upper bounds and
minimum collection sizes are not fully represented. Missing requirement metadata can
therefore affect generated declarations even when cardinality provides constraints.

The Turtle output uses illustrative values and is not guaranteed to be a valid instance
of the application profile. The application does not run SHACL or full conformance
validation on generated output. Developers must review identifiers, types, references
and constraints before using any generated output in an implementation.

Implementation: `createTypeScriptInterface`, `createJsonSchema` and
`createTurtleExample` in [SpecExplorerView.vue](../src/pages/spec-explorer/SpecExplorerView.vue).

## Language selection

The reader prefers the publication's detected language and falls back to other
available strings. It does not translate missing text, and fallback labels can result
in mixed-language content. There is currently no user-facing content-language selector.

Implementation: [publication-language.ts](../src/data/loading/publication-language.ts)
and [localized-string.ts](../src/data/model/localized-string.ts).
