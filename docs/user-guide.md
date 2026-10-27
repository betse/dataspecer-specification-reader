# User guide

[Project home](../README.md) · [Known limitations](limitations.md)

This guide explains how to explore a **supported Dataspecer-published specification** with the Dataspecer Specification Reader. The reader displays information from published resources; it does not change the underlying specification.

## Choose a view

| If you want to… | Open… |
| --- | --- |
| Understand the specification's purpose and available resources | **Spec-to-Spec → Specification Overview** |
| Find related specifications and explore their relationships | **Spec-to-Spec → Specification Browser** |
| Learn the main concepts without inspecting every property | **Primer** |
| Find a class, property, value type, requirement, or cardinality | **Specification Explorer → List view** |
| Obtain a starting point for an implementation | **Specification Explorer → Code view** |

All views are available to all users. **Simple** mode initially shows less detail; **detailed** mode exposes more information. You can expand individual sections without switching modes.

## 1. Open a specification

1. Visit the [application](https://betse.github.io/dataspecer-specification-reader/).
2. Select a card under **Preloaded specifications** to load that publication directly; **or** paste a Dataspecer-generated HTML documentation URL into **Specification URL** and choose **Open S2S**.
3. After the publication loads, use the navigation to open Spec-to-Spec, Primer, or Explorer.

**Example:** Choose the preloaded **DCAT-AP** publication. It is an illustrative Dataspecer-generated publication, not necessarily the official DCAT-AP documentation.

Use a published **HTML documentation URL**, not a standalone Turtle file or an arbitrary vocabulary IRI. Preloaded entries also fetch live resources; they are not offline copies.

### Sharing a view

Copy the browser address to share the current view. Its `specificationUrl` parameter allows the reader to reload the publication when the link is opened or refreshed. Filters and individual selections may not be preserved. A shared link is not a snapshot of the publication.

If a page reports **No specification loaded**, choose **Load specification** and open a publication first.

## 2. Spec-to-Spec: understand the publication

### Specification Overview

Start here to inspect the publication's title, description, available type information, related-resource counts, and artifact list. Artifacts can include RDF resources, diagrams, schemas, and other files. Follow an artifact link to open or download it, depending on the server and browser.

The overview's counts concern **publication metadata and related resources**, not the total number of semantic classes or properties. Expand shortened lists when necessary.

### Specification Browser

1. Open the **Specification Browser** tab.
2. Find an item using the left-hand list, search, and scope controls.
3. Select a list item or graph node to inspect the details panel.
4. Use the available link to open a related Dataspecer publication in the reader or visit an external resource at its original location.

The graph visualizes relationships represented in the loaded publication metadata; it is **not** a complete ontology dependency graph. The labels **Dataspecer specifications** and **External resources** reflect the available publication metadata, not a judgment of source quality or authorship. Vocabulary/application-profile types appear only when supported by the metadata.

**Try it:** With DCAT-AP loaded, identify one related specification, inspect its details, and follow its link. Return to your original tab to continue.

## 3. Primer: start with the main concepts

Open **Primer** to get a concise introduction before exploring the full property model.

### Conceptual diagram

If the publication provides a supported SVG diagram, select a class node to inspect available details and properties. Use diagram controls to adjust the view or open the original SVG.

Diagram nodes are matched to separately parsed semantic terms where possible. An unmatched node may display only text available in the SVG. That does **not** establish that the underlying concept has no other properties. If no SVG is published, the reader currently does not generate a replacement diagram automatically.

### Key concepts and requirement matrix

The **Key concepts** section presents up to eight starting concepts, favoring classes marked as main in the source data. It is an introduction, not a complete list or authoritative ranking. Use Explorer for the full supported local class list.

The **requirement matrix** presents available property requirements and cardinalities. These mean different things:

| Information | Meaning |
| --- | --- |
| **Mandatory / Recommended / Optional** | A requirement level explicitly supplied by the specification, when available |
| **`0..1`** | Zero or one value |
| **`1..1`** | Exactly one value |
| **`0..*`** | Zero or more values |
| **`1..*`** | One or more values |
| **`—`** | No value available in the loaded data; do not interpret as optional |

A minimum cardinality of one indicates a required occurrence, but it does not by itself establish that the author explicitly assigned a particular requirement-level label.

The **Resources** section links to available published artifacts.

**Try it:** Find a catalogue-related concept in DCAT-AP and inspect one property or related concept.

## 4. Specification Explorer: find precise details

### Select classes

The left panel lists main classes before supportive classes. It initially selects up to two main classes when available. Search and class-role controls help narrow the list.

- Click a class name to select it alone; **Shift+click** adds a class.
- Use class checkboxes to toggle individual selections.
- **Select all** and **Clear** change the selection in bulk.

Selected classes form the **active context** for both list and code views.

### List view

1. Select a class, such as **Distribution** in the DCAT-AP example.
2. Find a property using search or filters.
3. Open its details to inspect the information available: description, IRI, domain, range, value type, cardinality, usage note, and requirement level.
4. Use column controls, sorting, and column resizing when useful.

Each class has filters for requirement, property kind, and range. If an expected property is not visible, reset filters to **All** before assuming it is absent. Requirement columns may be hidden by default when the selected class has no requirement information; they can be enabled manually.

Class **Details** may include descriptions, usage notes, and backward associations. A backward association means that a property on another loaded class refers to this class as its range. Local class references can navigate within the reader; external links lead to their published locations and do not imply that external definitions were downloaded.

## 5. Code view: prepare implementation-oriented output

1. Select one or more classes in Explorer.
2. Switch to **Code view**.
3. In the sidebar's **Properties** tab, choose which properties to include. Searching or filtering the checklist does not itself change inclusion.
4. Optionally use **Include all** or **Include mandatory only**. These apply to the selected classes even when the checklist is filtered.
5. Choose **TS** (TypeScript interfaces), **JSON** (JSON Schema), or **TTL** (illustrative Turtle).
6. For TypeScript, use **Include referenced classes** when available. Review any warnings about unresolved references or excluded mandatory properties.
7. Select **Copy** to copy the result.

**Important:** JSON output is **JSON Schema**, not an example data record. Generated output is a starting point, not a validated implementation or complete conformance check. Review types, identifiers, constraints, and dependencies before use. See [generated-code limitations](limitations.md#generated-code-is-a-starting-point-not-validated-output).

## 6. Presentation preferences

Switch between simple/detailed modes and light/dark themes using the shared navigation controls. These preferences are remembered in your browser and do not modify the publication. Labels use available source-language variants with fallbacks; missing translations may produce mixed-language text.

## Troubleshooting

| Problem | What to try |
| --- | --- |
| Publication does not load | Check that the URL points to a Dataspecer-generated HTML publication. Open it directly; browser CORS restrictions may still block the reader. |
| Overview loads, but Primer/Explorer does not | RDF artifacts or dependency publications may be slow or unavailable even when the HTML loads. Try again later or use another publication. |
| No classes or properties appear | Check available artifacts and warnings; the publication may lack accessible supported semantic data. |
| Diagram selection shows limited details | The node may not match a semantic term uniquely, the loaded semantic data may be incomplete, or the Primer may show only a selection of properties. Open the class in Explorer to inspect all properties available in the loaded data. |
| A property is missing | Clear list filters and check class selection. In Code view, also check property inclusion. |
| A reused or external term lacks a description | Its definition may not be present in the downloaded resources. Follow the source link where available. |

For a fuller account of supported inputs and behavior, see [known limitations](limitations.md). Use GitHub Issues for reporting an issue, include the publication URL, view, steps to reproduce, expected and actual results, and relevant browser/error details.
