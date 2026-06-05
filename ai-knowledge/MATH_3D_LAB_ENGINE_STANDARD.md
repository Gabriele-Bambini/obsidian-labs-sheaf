# Mathematical 3D Lab Engine Standard

This is the reusable standard for every new or rebuilt lab across the vault. It is not a GNN standard. The current reference is the fitted H07/G03-style 3D lab only for layout quality: a single Obsidian-safe learning instrument with a large 3D viewport, manual orbit/zoom, a horizontal command bar directly under the visualization, live parameters with visible consequences, and a compact readout panel.

Do not create simple static diagrams, scrollable mini-pages, decorative dashboards, or text-first demos when a lab is requested. A lab is a manipulable 3D concept model.

Shared engine does not mean shared content. The shell, renderer, controls, and telemetry are reusable; the actual scene must be lesson-specific. A block generator must not clone the same graph, modes, labels, parameters, and copy across lessons, and must not treat graph visualization as the default for the vault.

The reference format is aesthetic, spatial, and functional. It is not a requirement that every lesson be a GNN or even a graph. Use the best 3D representation for the concept: graphs when the concept is relational, landscapes for optimization, manifolds and fields for geometry/analysis, distributions for probability, matrices/operators for linear algebra, circuits/spheres/amplitudes for quantum, filtrations/cell complexes for topology, and flow diagrams only when the content is actually a computational flow.

Within a block, each lesson should get a distinct visual grammar unless two lessons genuinely teach the same mathematical object. The common contract is the interaction shell; the internal graphics must be custom: surfaces, matrices, cells, spectra, vector frames, hyperedges, circuits, bars, fields, trajectories, or topology should be selected from the lesson content.

Graph layers are optional and must be subordinated to the lesson. Use a full graph only when the graph is the object being studied. Use graph-as-reference or anchor points when the primary object is an operator, cover, filtration, spectrum, frame system, matrix, circuit, or roadmap. If the lesson is about a non-graph object, the visualization must depict that object directly rather than forcing it into a graph metaphor.

## Concrete Textbook Visual Rule

The first design decision for every lab is the canonical object a learner would expect from a textbook, lecture board, or standard paper figure. The lab must render that object directly before adding style, particles, or secondary abstractions.

Use concrete physical or mathematical objects. The following examples are mandatory design precedents for the corresponding topics:

- Neural networks: draw the actual architecture. For an MLP, show layered neurons, weights, activations, loss, and backpropagated gradients. For a CNN, show image grids, convolution kernels, feature maps, pooling, classifier head, and gradient flow through those objects. For attention, show token/key-query-value tables and attention weights. Do not replace these with an unrelated abstract graph unless the lesson is explicitly graph neural networks.
- VAE and latent-variable models: show encoder, latent distribution, reparameterization sample, prior, decoder, reconstruction, and KL/reconstruction tradeoff. The latent space should be an explorable plane or manifold with samples moving through it.
- GANs and minimax models: show generator distribution, real data distribution, discriminator/critic surface, decision boundary, gradients, and mode collapse/coverage. The adversarial game must be visible as two concrete actors changing the same space.
- Diffusion and denoising models: show noisy sample states, denoising trajectory, score/vector field, timestep schedule, and reconstructed sample. Noise sliders must visibly corrupt and recover an object or distribution.
- Normalizing flows: show a base density warped through invertible transforms, Jacobian/log-det effects, forward and inverse sample paths, and density conservation/change.
- Reinforcement learning: show the environment, state, action arrows, value/policy surface, reward, trajectory, and Bellman backup on the actual grid/world/object.
- Optimization and learning dynamics: render an explorable 2D or 3D loss landscape, contour plane, feasible region, trajectory, gradient arrows, Hessian curvature, saddle, valley, or basin. The learner should see where the algorithm is moving.
- Operators and Laplacians: show the domain object plus the operator acting on it. For a graph Laplacian, show the graph, the signal over nodes, edge differences, energy surface, smoothing/diffusion step, and optionally the matrix/spectrum. For a sheaf Laplacian, show stalks, restrictions, coboundary residuals, the Laplacian matrix/action, and compatibility energy.
- Linear algebra and analysis: render vectors, bases, planes, transformations, fields, functions, surfaces, measures, integrals, or trajectories in their natural coordinate space. Functions belong on axes, planes, surfaces, contours, vector fields, or phase portraits, not as arbitrary nodes.
- Probability and statistics: render distributions, samples, likelihood surfaces, posterior updates, confidence regions, decision boundaries, or sampling paths.
- Topology/algebra/category theory: render the actual complexes, spaces, maps, diagrams, covers, quotient actions, or commutative structures being taught.
- Quantum topics: render Bloch spheres, amplitudes, circuits, gates, interference paths, measurement axes, probability bars, and variational landscapes according to the topic.

3Blue1Brown inspiration means canonical math diagrams made dynamic and explorable: clean geometry, moving quantities, visible arrows, morphing functions, highlighted invariant structure, and color used as meaning. It does not mean decorative glowing objects whose relationship to the lesson is indirect.

If the implementer cannot state the canonical object in one sentence before coding, the lab design is not ready. Examples of valid scene contracts are: "a two-layer MLP with forward activations and backward gradients", "a CNN sliding a kernel over an image into feature maps", "a VAE encoder mapping data into a latent Gaussian plane and decoder reconstructing it", "a convex bowl with gradient descent and momentum trajectories", "a graph signal diffusing under the Laplacian", "a function surface with level sets and gradients", or "an open cover with sections, restriction residuals, and a glued global section".

## Independent Lesson Scene Rule

Every lesson in a regenerated block needs its own primary scene contract. A generator must define what mathematical object is being rendered before it defines graph nodes or labels. The object can be an open cover, a surface of sections, a cochain complex, an operator matrix, a spectrum, a compatibility chamber, a transport loop, a role-compatibility table, a gauge-frame system, a directed hyperedge, a filtration/barcode, or any other object demanded by the lesson.

The graph layer is never allowed to be the fallback answer for a non-graph lesson. For a sheaf block, for example, `H04` can use a full graph because cellular sheaves on graphs are the topic; `H05` must primarily render the coboundary/Laplacian operator and energy geometry; `H14` must primarily render a filtration and barcode; `H15` must primarily render coupled research directions and constraints.

## Engine Principles

- One shared visual shell should support many mathematical objects: algebraic maps, probability/inference systems, optimization landscapes, neural computations, graph/spectral systems, sheaf maps, filtrations, manifolds, vector fields, matrices/operators, and quantum circuits.
- Individual lab HTML files should mostly declare configuration: title, modes, parameters, metrics, scene type, and concept copy.
- The engine must make parameters semantically real. Sliders must visibly alter geometry, active channels, propagation radius, attention/sharpness, perturbation/noise channels, colors, metrics, or selected-object state.
- A lab is acceptable only if the visual model teaches the concept without requiring the learner to read paragraphs first.
- Controls must be Obsidian-safe: pointer, keyboard, and narrow-iframe usage must work without relying on fragile native range behavior.

## Canonical Layout

Every generated lab must use this physical structure:

1. Root shell: `<main class="gnn-lab lab-shell lab-3d-shell" data-lab-kind="..." data-lab-id="...">`.
2. Left/primary stack: `.visual-stack`.
3. Main viewport: `.stage > .lab-viewport > canvas#canvas`.
4. Overlay: `.scene-overlay` with a concept badge and compact formula/model chip.
5. Selection readout: `.selected-chip[data-role="selected"]`.
6. Horizontal command bar: `.command-bar.controls` below the viewport, not beside it and not in a scrollbar.
7. Side/readout panel: `.side-panel.lab-3d-panel` with title, metrics, insight, state box, and a short hint.

The page must fit in an Obsidian iframe height of `720` with no page scrollbar, no inner scrollbar, and no clipped controls. If a viewport is narrow, the 3D scene remains dominant and the readout compresses before the command bar becomes unusable.

## Common Interaction Grammar

- Drag to orbit / rotate.
- Wheel or trackpad to zoom.
- Click/select a mathematical object.
- Horizontal command bar under the visualization.
- Live numeric parameters.
- Mode selector.
- Pulse/step/reset commands.
- Metrics that update from the current simulated state.
- Parameter edits should automatically switch to the most explanatory visual mode: depth/layers opens a propagation frontier; sharpness/temperature redistributes active channel weight; noise/distractor exposes red perturbation channels; budget/visible-neighbors gates active channels; residual/self-weight strengthens the selected object.
- Pulse/step commands must advance a named phenomenon on the concrete object: one optimization step on a landscape, one forward/backward pass through an architecture, one convolution sweep, one diffusion/Laplacian step, one restriction/gluing check, one sampling/update step, or one circuit layer. Rename buttons to the phenomenon when `Pulse` or `Step` is too generic.

## Required Live Parameters

Each lab family should rename parameters for the domain, but preserve these five semantic roles:

- `depth`: layers, iterations, gluing depth, circuit depth, evidence steps, or construction depth. It must expand a frontier or receptive field.
- `temperature`: sharpness, curvature, phase, routing, posterior, spectral, or restriction sharpness. It must redistribute active channel weights.
- `noise`: perturbation, distractor, decoherence, label noise, stochastic noise, observation noise, or cocycle noise. It must make unstable/red channels visible.
- `budget`: visible neighbors, support, context window, open-set cover, measured amplitudes, feature/search/path budget. It must gate how many channels/objects are active.
- `residual`: self-loop, identity branch, local consistency, prior strength, regularization, momentum, or residual path. It must strengthen selected-object persistence.

Controls are not decorative. Changing any of these roles must alter at least one of: visible geometry, highlighted active edge count, active node count, color/emission, metric values, `data-*` telemetry, or readout text.

## Reusable Scene Families

- Graph systems: GNNs, graph theory, sheaves, knowledge graphs, molecular graphs.
- Landscape systems: optimization, loss geometry, convexity, energy models.
- Field systems: vector fields, ODEs, stochastic processes, diffusion, flow matching.
- Distribution systems: probability, inference, information geometry, optimal transport.
- Architecture systems: MLPs, CNNs, RNNs, transformers, autoencoders, VAEs, GANs, diffusion models, normalizing flows, and state-space models.
- Algebraic/topological systems: bases, maps, groups, simplices, homology, sheaf cochains.
- Circuit systems: quantum states, gates, measurement, variational circuits.

Pick one family because it fits the lesson. Do not force a graph rendering onto lessons whose main object is a surface, operator, distribution, circuit, or dynamical field.

## Universal Visual Contract

Every migrated lab page must:

- Keep its existing HTML filename and iframe target stable.
- Load `shared/three.min.js`, `shared/gnn-lab-core.css`, and `shared/gnn-lab-core.js`.
- Use the fitted shell: `.gnn-lab.lab-3d-shell`, `.lab-viewport canvas`, `.command-bar`, `.metric-grid`, `data-role="insight"`, and `data-role="selected"`.
- Include mode selector, at least five live numeric parameters, Pulse/Step/Reset, and at least four live metrics.
- Expose `window.__gLabSnapshot()` and a legacy `window.__<labId>LabSnapshot()` alias.
- Render inside a 720px Obsidian iframe without internal scrollbars or clipped controls.
- Show concept consequences in the scene, not just in metric text.
- Keep labels subdued: selected and local-neighbor labels can appear; global labels must not dominate the visualization.
- Avoid autonomous graph drifting. The learner controls rotation/zoom; animations may be used only for local pulses, particles, highlights, or state feedback.
- Keep command controls clickable and keyboard-operable in the Obsidian in-app browser.
- Expose measurable telemetry on the root: `activeNodes`, `activeEdges`, `attentionMax`, `attentionEntropy`, `distractorCount`, `visibleNeighborCount`, `selfAttention`, `visualMode`, `stepRadius`, `cameraTheta`, `cameraPhi`, and `cameraRadius`.

## Block Generation Protocol

For a full block migration:

1. Do not rename lab files and do not edit note iframe targets unless the target is wrong.
2. Add or update the block family config in `build-all-3d-labs.js`.
3. Add per-lesson blueprints for the block. Each blueprint should define topic-specific title/subtitle, modes, parameters, metrics, profile copy, and, where possible, an explicit scene graph with meaningful node and relation labels.
4. Add a per-lesson concrete scene contract and visual kind. The contract must name the canonical object being rendered, e.g. MLP, CNN, loss landscape, Laplacian energy surface, open cover, matrix spectrum, filtration, or circuit. Do not rely on node labels alone to make a lab specific.
5. Choose the graph layer role explicitly: `graph`, `hybrid`, `operator`, `reference`, `anchors`, or `hidden`.
6. Generate the block with `node build-all-3d-labs.js <block-letter>`; for example, `node build-all-3d-labs.js h`.
7. Run the shared static contract: `node all-modern-3d-labs.test.js`.
8. Run or add a block-specific contract when touching a whole block.
9. Browser-check representative labs from distinct visual kinds for no overflow and real parameter effects.

The generator may support whole-vault generation, but block work should be reproducible by block letter so a single block can be regenerated without accidental unrelated churn.

## Adoption Rule

When rebuilding a weak lab, keep its filename and iframe target stable. Replace internal implementation with the shared engine where practical, and add a small compatibility alias if existing tests or notes expect `window.__<id>LabSnapshot()`. Old lab-specific smoke tests should be retired into a shared modern contract when their old selectors no longer describe the standard UI.

## Minimum Acceptance Checklist

A lab is not done until these are true:

- It visually resembles the H07/G03 fitted 3D format.
- Its visual content is specific to the lesson. Labels, relations, geometric objects, modes, parameters, metrics, and readout must name the actual concept taught by that note.
- It uses a lesson-specific visual grammar, not only a renamed generic graph.
- It renders a concrete canonical object from the topic, not an abstract metaphor. GNN lessons look like GNNs; Laplacian lessons look like Laplacians acting on signals/operators; VAE lessons look like encoder-latent-decoder systems; functions live in spaces, planes, surfaces, contours, or fields; topology/sheaf lessons show covers, cells, complexes, restrictions, or filtrations.
- It has `canvas#canvas`, `.command-bar.controls`, five live range inputs, mode selector, and Pulse/Step/Reset.
- It has no horizontal or vertical overflow in a `720px` iframe viewport.
- Drag rotates the camera, wheel zooms, idle does not drift the graph.
- Every live parameter has an observable consequence.
- Every command button has a visible, domain-specific consequence and can be named after that consequence.
- The state box explains the current parameter consequence in domain language.
- The root telemetry changes when controls change.
- `window.__<labId>LabSnapshot()` returns a useful state object for tests.
