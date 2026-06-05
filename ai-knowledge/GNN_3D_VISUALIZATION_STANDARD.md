# GNN 3D Visualization Standard

This standard governs every Block G interactive lab. It specializes the reusable engine policy in `MATH_3D_LAB_ENGINE_STANDARD.md`.

## Goal

Each lab must teach the module's core mechanism through a manipulable 3D graph system, not through a static diagram. The viewer should be able to rotate, zoom, inspect nodes, change parameters, and immediately see how graph structure, message flow, neural state, and evaluation metrics change.

## Visual Style

- Use a 3Blue1Brown-inspired mathematical style: dark stage, precise geometry, luminous blue/cyan signal paths, warm amber/brown highlights for contrast, readable labels, and restrained animation.
- The 3D scene is the primary artifact. Text explains what the scene is doing, but the concept should remain understandable from the moving geometry.
- Use node spheres, edge tubes/lines, message particles, translucent planes/rings, and labels only when they encode graph/neural meaning.
- Avoid decorative clutter. Every color, motion, trail, and highlight must correspond to a concept.

## Concrete Mechanism Rule

Block G labs can use graphs, but only because the graph is the studied object or because a neural computation is explicitly running on it. The scene must still be the canonical mechanism from the lesson, not an abstract cluster of nodes.

- Message passing lessons must show neighborhoods, receptive fields, messages, aggregation, node states, and readout values on the graph.
- Attention lessons must show attention coefficients as masked softmax weights on edges, with token/node feature projections and visible coefficient redistribution.
- Sampling/scaling lessons must show sampled subgraphs, memory/batch budgets, cache or frontier growth, and the missing-neighbor tradeoff.
- Molecular/geometric lessons must show atom/bond geometry, distances/angles, equivariant frames, or 3D coordinates when those are the topic.
- Knowledge graph lessons must show typed entities, relation-specific operators, candidate triples, scores, and corruption/negative examples.
- Robustness/heterophily/depth lessons must show the concrete failure mode: smoothed signals, bottlenecked paths, signed/high-pass propagation, adversarial edges, or poisoned labels.
- AI-foundations lessons outside strict GNN mechanics must show the actual AI system object, such as task/data/representation/objective/optimizer/evaluation/deployment pipeline, architecture, or loss landscape. Do not force them into a generic graph.

When a lesson discusses backpropagation, optimization, or an architecture inside the G block, render the architecture or landscape directly. For example, show an MLP or CNN with forward activations and backward gradients instead of a symbolic graph that only labels "backprop".

## Required Layout

- Main viewport: a large 3D scene.
- Horizontal command bar directly below the viewport.
- Side panel: title, metrics, selected object details, and current insight.
- No dedicated scrollbars inside the iframe at normal Obsidian sizes.
- Mobile/narrow layout must preserve the viewport, command bar, and metrics without text overlap.

## Required Interactions

- Drag viewport: orbit around the graph.
- Mouse wheel / trackpad: zoom.
- Click a node: select and inspect it.
- Reset view button: restore camera and parameters.
- Pulse/step button: inject a visible message wave or algorithm step.
- Mode selector: switch the conceptual regime for the lab.
- At least four numeric parameters whose changes alter the 3D visualization and metrics.
- Button names may be domain-specific (`Propagate`, `Aggregate`, `Backprop`, `Convolve`, `Diffuse`, `Sample`, `Attack`, `Decode`) when those names make the concrete mechanism clearer than `Pulse` or `Step`.

## Required Technical Contract

- Each lab file keeps its existing filename and Obsidian link target.
- Each lab uses `_interactive/shared/three.min.js`.
- Each lab uses `_interactive/shared/gnn-lab-core.css` and `_interactive/shared/gnn-lab-core.js`; these files are the first graph-specialized implementation of the general mathematical 3D lab engine.
- Root element: `.gnn-lab` with `data-lab-kind`.
- Canvas is inside `.lab-viewport`.
- Command bar element: `.command-bar`.
- At least four elements with `data-role="metric"`.
- Main explanation element: `data-role="insight"`.
- Shared snapshot: `window.__gLabSnapshot()`.
- Legacy per-lab snapshot alias: `window.__gXXLabSnapshot()`.

## Conceptual Contract

Each lab must expose the actual mathematical or modeling tradeoff:

- G01: message passing as local aggregation.
- G02: GCN as normalized smoothing plus learned mixing.
- G03: GAT as masked softmax over neighbors.
- G04: GraphSAGE as sampled inductive aggregation.
- G05: WL as iterative color refinement.
- G06: higher-order GNNs as motif/subgraph lifting.
- G07: link prediction and graph readout as pair/global decoding.
- G08: scalable GNNs as sampling, clustering, and memory-budget tradeoffs.
- G09: temporal GNNs as event memory over dynamic edges.
- G10: equivariance/invariance as transformation law.
- G11: geometric deep learning as domain, symmetry, and operator matching.
- G12: molecular GNNs as atom/bond/geometric message passing.
- G13: knowledge graph GNNs as typed relational propagation.
- G14: robustness as perturbation, poisoning, and defensive aggregation.
- G15: depth tradeoff between smoothing, squashing, and signal survival.
- G30: heterophily as compatibility-aware high-pass or signed propagation.
- G32: AI foundations as objective, bias, optimization, and evaluation flow.

## Verification

Before considering the G block acceptable:

- Static contract test passes.
- Browser screenshot verifies the scene is visibly 3D, nonblank, and polished.
- Browser interaction verifies orbit, zoom, node selection, parameter mutation, mode switch, and pulse/step.
- Metrics change when parameters change.
- The browser/test review confirms the lab shows a concrete textbook-style mechanism, not only a stylized abstract graph.
