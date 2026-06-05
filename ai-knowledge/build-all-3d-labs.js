const fs = require("fs");
const path = require("path");

const root = __dirname;
const requestedArgs = process.argv
  .slice(2)
  .flatMap((arg) => arg.split(","))
  .map((arg) => arg.trim().toLowerCase())
  .filter(Boolean);
const requestedBlocks = new Set(requestedArgs.filter((arg) => /^[a-z]$/.test(arg)));
const requestedIds = new Set(requestedArgs.filter((arg) => /^[a-z]\d{2}$/.test(arg)));

const FAMILY = {
  a: {
    kind: "algebra",
    block: "Block A",
    subtitle: "Manipulate maps, invariants, decompositions, and structure-preserving transformations.",
    modes: [["map", "Map / morphism"], ["dual", "Dual invariant"], ["decompose", "Decomposition"]],
    params: [["depth", "Construction depth", 1, 10, 1, 3], ["temperature", "Invariant sharpness", 0.25, 3.5, 0.05, 1], ["noise", "Perturbation", 0, 1, 0.02, 0.18], ["budget", "Visible generators", 1, 12, 1, 5], ["residual", "Identity anchor", 0, 1, 0.02, 0.45]],
    metrics: ["Structure score", "Invariant contrast", "Generator coverage", "Stability gap"]
  },
  b: {
    kind: "probability",
    block: "Block B",
    subtitle: "Turn evidence, uncertainty, likelihood, posterior mass, and risk into visible geometry.",
    modes: [["prior", "Prior / baseline"], ["evidence", "Evidence update"], ["posterior", "Posterior focus"]],
    params: [["depth", "Evidence steps", 1, 10, 1, 3], ["temperature", "Posterior sharpness", 0.25, 3.5, 0.05, 1.1], ["noise", "Observation noise", 0, 1, 0.02, 0.24], ["budget", "Sample support", 1, 14, 1, 6], ["residual", "Prior strength", 0, 1, 0.02, 0.42]],
    metrics: ["Uncertainty mass", "Likelihood contrast", "Sample coverage", "Risk gap"]
  },
  c: {
    kind: "optimization",
    block: "Block C",
    subtitle: "Explore objective geometry, descent paths, constraints, dual signals, and transport flow.",
    modes: [["descent", "Descent geometry"], ["constraint", "Constraint / dual"], ["transport", "Flow / transport"]],
    params: [["depth", "Iterations", 1, 12, 1, 4], ["temperature", "Curvature sharpness", 0.25, 3.5, 0.05, 1], ["noise", "Stochastic noise", 0, 1.2, 0.02, 0.16], ["budget", "Search budget", 1, 14, 1, 5], ["residual", "Momentum anchor", 0, 1, 0.02, 0.36]],
    metrics: ["Objective energy", "Descent margin", "Constraint gap", "Path coverage"]
  },
  d: {
    kind: "learning",
    block: "Block D",
    subtitle: "Inspect features, margins, model capacity, validation pressure, and generalization tradeoffs.",
    modes: [["fit", "Fit / margin"], ["regularize", "Regularized model"], ["validate", "Validation pressure"]],
    params: [["depth", "Training depth", 1, 12, 1, 4], ["temperature", "Margin sharpness", 0.25, 3.5, 0.05, 1], ["noise", "Label noise", 0, 1, 0.02, 0.2], ["budget", "Feature budget", 1, 14, 1, 6], ["residual", "Regularization", 0, 1, 0.02, 0.46]],
    metrics: ["Decision margin", "Validation gap", "Feature coverage", "Risk stability"]
  },
  e: {
    kind: "neural",
    block: "Block E",
    subtitle: "Make network depth, routing, latent structure, generation, control, and dynamics visible.",
    modes: [["forward", "Forward signal"], ["latent", "Latent / state"], ["update", "Learning update"]],
    params: [["depth", "Network layers", 1, 16, 1, 4], ["temperature", "Routing temperature", 0.25, 3.5, 0.05, 1], ["noise", "Activation noise", 0, 1.2, 0.02, 0.22], ["budget", "Context window", 1, 16, 1, 6], ["residual", "Residual path", 0, 1, 0.02, 0.42]],
    metrics: ["Signal flow", "Latent separation", "Loss energy", "Context coverage"]
  },
  f: {
    kind: "graph",
    block: "Block F",
    subtitle: "Expose topology through walks, Laplacians, spectra, cuts, clustering, filtrations, and graph limits.",
    modes: [["spectral", "Spectral view"], ["walk", "Walk / flow"], ["cut", "Cut / cluster"]],
    params: [["depth", "Walk/filter depth", 1, 12, 1, 4], ["temperature", "Spectral sharpness", 0.25, 3.5, 0.05, 1], ["noise", "Edge noise", 0, 1, 0.02, 0.18], ["budget", "Visible paths", 1, 16, 1, 6], ["residual", "Self-loop weight", 0, 1, 0.02, 0.42]],
    metrics: ["Graph energy", "Cut contrast", "Path coverage", "Spectral gap"]
  },
  h: {
    kind: "sheaf",
    block: "Block H",
    subtitle: "Show how local sections, restrictions, consistency, transport, and gluing interact.",
    modes: [["section", "Local sections"], ["restriction", "Restrictions"], ["gluing", "Global gluing"]],
    params: [["depth", "Gluing depth", 1, 12, 1, 4], ["temperature", "Restriction sharpness", 0.25, 3.5, 0.05, 1], ["noise", "Cocycle noise", 0, 1, 0.02, 0.24], ["budget", "Open-set cover", 1, 14, 1, 5], ["residual", "Local consistency", 0, 1, 0.02, 0.52]],
    metrics: ["Consistency gap", "Section coverage", "Restriction norm", "Gluing score"]
  },
  i: {
    kind: "quantum",
    block: "Block I",
    subtitle: "Represent amplitudes, phase, gates, interference, measurement, and decoherence as manipulable 3D structure.",
    modes: [["state", "State vector"], ["gate", "Gate / circuit"], ["measure", "Measurement"]],
    params: [["depth", "Circuit depth", 1, 12, 1, 3], ["temperature", "Phase sharpness", 0.25, 3.5, 0.05, 1], ["noise", "Decoherence", 0, 1, 0.02, 0.16], ["budget", "Measured amplitudes", 1, 12, 1, 5], ["residual", "Identity branch", 0, 1, 0.02, 0.5]],
    metrics: ["Amplitude contrast", "Phase coherence", "Measurement mass", "Gate stability"]
  }
};

const B_COMMON_PARAMS = [
  ["focus", "Concept focus", 0, 1, 0.01, 0.45],
  ["spread", "Spread / uncertainty", 0.05, 1, 0.01, 0.55],
  ["noise", "Noise / perturbation", 0, 1, 0.01, 0.24],
  ["samples", "Sample count", 2, 14, 1, 7],
  ["strength", "Evidence strength", 0, 1, 0.01, 0.5]
];

const B_BLOCK_BLUEPRINTS = {
  b01: {
    title: "B01 Probability Theory Foundations",
    visual: { kind: "probability-space-lab", graphStyle: "hidden" },
    subtitle: "A finite sample space in 3D: outcomes become probability bars, event A and evidence B become regions, and Monte Carlo samples approximate expectation.",
    keywords: "probability sample space event conditional probability random variable expectation Monte Carlo",
    modes: [["space", "Sample space"], ["conditioning", "Conditioning"], ["random", "Random variable"], ["montecarlo", "Monte Carlo"]],
    params: B_COMMON_PARAMS,
    metrics: ["Event probability", "Entropy", "Conditional mass", "Expectation"],
    profile: {
      preferredMetric: "Event probability",
      formula: "P(A | B) = P(A cap B) / P(B)",
      insight: "B01 makes the primitive objects visible: sample space, event, evidence, conditional mass, random variable height, and empirical sampling."
    }
  },
  b02: {
    title: "B02 Multivariate Probability",
    visual: { kind: "joint-distribution-lab", graphStyle: "hidden" },
    subtitle: "A joint distribution surface with marginal projections, conditional slices, and a covariance ellipse that rotates with correlation.",
    keywords: "multivariate probability joint distribution marginal conditional covariance correlation Gaussian",
    modes: [["joint", "Joint law"], ["marginal", "Marginals"], ["conditional", "Conditional slice"], ["gaussian", "Gaussian covariance"]],
    params: B_COMMON_PARAMS,
    metrics: ["Correlation", "Marginal spread", "Conditional shift", "Tail mass"],
    profile: {
      preferredMetric: "Correlation",
      formula: "p(x,y) -> p(x), p(y), p(y | x)",
      insight: "B02 connects the full joint law to what is lost by marginalizing and what is gained by conditioning on one coordinate."
    }
  },
  b03: {
    title: "B03 Statistical Estimation",
    visual: { kind: "estimation-likelihood-lab", graphStyle: "hidden" },
    subtitle: "Data points generate a likelihood curve; the MLE marker, confidence band, and sampling distribution expose bias and variance.",
    keywords: "statistical estimation estimator likelihood MLE MAP bias variance sampling distribution confidence interval",
    modes: [["likelihood", "Likelihood"], ["mle", "MLE"], ["bias", "Bias / variance"], ["confidence", "Confidence interval"]],
    params: B_COMMON_PARAMS,
    metrics: ["Likelihood peak", "Estimator bias", "Variance", "CI width"],
    profile: {
      preferredMetric: "Likelihood peak",
      formula: "theta_hat = argmax_theta L(theta; data)",
      insight: "B03 shows estimation as a geometric choice: data support a parameter, repeated samples move the estimator, and uncertainty becomes interval width."
    }
  },
  b04: {
    title: "B04 Hypothesis Testing",
    visual: { kind: "hypothesis-testing-lab", graphStyle: "hidden" },
    subtitle: "Null and alternative distributions share one decision surface: p-value tail, rejection region, Type I risk, Type II error, and power.",
    keywords: "hypothesis testing null alternative p-value rejection region type I type II power effect size",
    modes: [["null", "Null model"], ["pvalue", "p-value"], ["power", "Power"], ["multiple", "Multiple tests"]],
    params: B_COMMON_PARAMS,
    metrics: ["p-value", "Power", "Type I risk", "Effect size"],
    profile: {
      preferredMetric: "p-value",
      formula: "p = P(T >= t_obs | H0)",
      insight: "B04 keeps testing as a decision geometry: the observed statistic is compared to the null tail while power comes from the alternative shift."
    }
  },
  b05: {
    title: "B05 Bayesian Inference",
    visual: { kind: "bayesian-updating-lab", graphStyle: "hidden" },
    subtitle: "Prior, likelihood, and posterior curves occupy separate lanes; Bayes update beams multiply evidence into posterior mass and predictive uncertainty.",
    keywords: "Bayesian inference prior likelihood posterior Bayes factor credible interval posterior predictive",
    modes: [["prior", "Prior"], ["likelihood", "Likelihood"], ["posterior", "Posterior"], ["predictive", "Predictive"]],
    params: B_COMMON_PARAMS,
    metrics: ["Posterior mean", "Posterior precision", "Bayes factor", "Credible width"],
    profile: {
      preferredMetric: "Posterior mean",
      formula: "p(theta | x) proportional p(x | theta) p(theta)",
      insight: "B05 makes Bayesian inference a visible update: prior belief is reweighted by likelihood, producing posterior concentration and predictive uncertainty."
    }
  },
  b06: {
    title: "B06 Stochastic Processes",
    visual: { kind: "stochastic-process-lab", graphStyle: "hidden" },
    subtitle: "A Markov state ring with transition beams, sample path, stationary-mass bars, mixing gap, and hitting target.",
    keywords: "stochastic process Markov chain transition kernel stationary distribution mixing hitting time Poisson process",
    modes: [["chain", "Markov chain"], ["mixing", "Mixing"], ["hitting", "Hitting time"], ["poisson", "Poisson clock"]],
    params: B_COMMON_PARAMS,
    metrics: ["Stationary mass", "Mixing gap", "Path entropy", "Hitting chance"],
    profile: {
      preferredMetric: "Mixing gap",
      formula: "pi_{t+1} = pi_t P",
      insight: "B06 turns a stochastic process into moving probability mass: transitions drive sample paths, mixing erases memory, and hitting measures target reachability."
    }
  },
  b07: {
    title: "B07 Advanced Stochastic Calculus",
    visual: { kind: "stochastic-calculus-lab", graphStyle: "hidden" },
    subtitle: "Brownian roughness, quadratic-variation bars, Ito correction, and SDE drift-plus-diffusion path in one orbitable space.",
    keywords: "Brownian motion Ito integral quadratic variation SDE martingale diffusion reverse diffusion",
    modes: [["brownian", "Brownian path"], ["ito", "Ito integral"], ["sde", "SDE flow"], ["reverse", "Reverse diffusion"]],
    params: B_COMMON_PARAMS,
    metrics: ["Quadratic variation", "Ito drift", "Diffusion scale", "SDE stability"],
    profile: {
      preferredMetric: "Quadratic variation",
      formula: "dX_t = b(X_t,t) dt + sigma(X_t,t) dW_t",
      insight: "B07 explains why stochastic calculus is not ordinary calculus: Brownian paths are rough, quadratic variation survives, and SDEs mix drift with diffusion."
    }
  },
  b08: {
    title: "B08 Information Geometry",
    visual: { kind: "information-geometry-lab", graphStyle: "hidden" },
    subtitle: "A statistical manifold with Fisher metric ellipse, local KL neighborhood, geodesic, and natural-gradient step.",
    keywords: "information geometry statistical manifold Fisher metric KL divergence geodesic natural gradient",
    modes: [["manifold", "Manifold"], ["fisher", "Fisher metric"], ["kl", "KL projection"], ["natural", "Natural gradient"]],
    params: B_COMMON_PARAMS,
    metrics: ["Fisher length", "KL projection", "Geodesic gap", "Curvature"],
    profile: {
      preferredMetric: "Fisher length",
      formula: "ds^2 = dtheta^T I(theta) dtheta",
      insight: "B08 treats probability models as geometry: Fisher metric measures distinguishability, KL bends local neighborhoods, and natural gradient follows that geometry."
    }
  },
  b09: {
    title: "B09 Non-parametric Statistics",
    visual: { kind: "nonparametric-statistics-lab", graphStyle: "hidden" },
    subtitle: "Sample rug, histogram bins, kernel bumps, KDE curve, bootstrap band, and adaptive smoother show inference without a fixed parametric family.",
    keywords: "non-parametric statistics KDE kernel density bootstrap kernel regression smoothing Gaussian process",
    modes: [["kde", "KDE"], ["bootstrap", "Bootstrap"], ["regression", "Kernel regression"], ["gp", "Gaussian process"]],
    params: B_COMMON_PARAMS,
    metrics: ["Bandwidth", "Bootstrap spread", "EDF gap", "Smooth risk"],
    profile: {
      preferredMetric: "Bandwidth",
      formula: "f_hat_h(x) = (1/nh) sum_i K((x - x_i)/h)",
      insight: "B09 makes flexible inference concrete: data points spawn local kernels, bandwidth controls smoothness, and bootstrap resampling estimates uncertainty."
    }
  },
  b10: {
    title: "B10 Causal Inference",
    visual: { kind: "causal-inference-lab", graphStyle: "hidden" },
    subtitle: "A causal DAG separates confounder, treatment, mediator, outcome, backdoor adjustment, and do-operator intervention.",
    keywords: "causal inference DAG confounder treatment outcome backdoor adjustment do-operator counterfactual ATE",
    modes: [["dag", "DAG"], ["backdoor", "Backdoor"], ["intervention", "Intervention"], ["counterfactual", "Counterfactual"]],
    params: B_COMMON_PARAMS,
    metrics: ["Causal effect", "Backdoor bias", "Adjustment score", "ATE stability"],
    profile: {
      preferredMetric: "Causal effect",
      formula: "ATE = E[Y | do(T=1)] - E[Y | do(T=0)]",
      insight: "B10 keeps association separate from causation: confounding opens a backdoor path, adjustment blocks it, and intervention clamps treatment structurally."
    }
  }
};

const C_COMMON_PARAMS = [
  ["curvature", "Curvature / convexity", -1.5, 2.5, 0.01, 0.9],
  ["step", "Step size / time", 0.02, 1, 0.01, 0.28],
  ["noise", "Noise / perturbation", 0, 1, 0.01, 0.16],
  ["budget", "Iterations / particles", 1, 14, 1, 6],
  ["regularization", "Regularization / dual weight", 0, 1, 0.01, 0.45]
];

const C03_KKT_PARAMS = [
  ["curvature", "Constraint offset s/r", -1.5, 2.5, 0.01, 0.9],
  ["step", "Projected step alpha", 0.02, 1, 0.01, 0.28],
  ["noise", "Unconstrained optimum a", 0, 1, 0.01, 0.16],
  ["budget", "Barrier path samples", 1, 14, 1, 6],
  ["regularization", "Barrier mu / lambda", 0, 1, 0.01, 0.45]
];

const C04_STOCHASTIC_PARAMS = [
  ["curvature", "Condition number kappa", -1.5, 2.5, 0.01, 0.9],
  ["step", "Learning rate alpha", 0.02, 1, 0.01, 0.28],
  ["noise", "Gradient noise sigma", 0, 1, 0.01, 0.16],
  ["budget", "Batch size b", 1, 14, 1, 6],
  ["regularization", "Momentum beta / Adam scale", 0, 1, 0.01, 0.45]
];

const C05_VARIATION_PARAMS = [
  ["curvature", "Curve stiffness / shape", -1.5, 2.5, 0.01, 0.9],
  ["step", "Variation epsilon", 0.02, 1, 0.01, 0.28],
  ["noise", "Perturbation amplitude", 0, 1, 0.01, 0.16],
  ["budget", "Quadrature samples", 1, 14, 1, 6],
  ["regularization", "Boundary penalty", 0, 1, 0.01, 0.45]
];

const C06_CONTROL_PARAMS = [
  ["curvature", "Terminal weight Q_f", -1.5, 2.5, 0.01, 0.9],
  ["step", "Actuator limit u_max", 0.02, 1, 0.01, 0.28],
  ["noise", "Disturbance impulse", 0, 1, 0.01, 0.16],
  ["budget", "Horizon T nodes", 1, 14, 1, 6],
  ["regularization", "Control penalty R / gain", 0, 1, 0.01, 0.45]
];

const C07_DUAL_PARAMS = [
  ["curvature", "Constraint bound b", -1.5, 2.5, 0.01, 0.9],
  ["step", "Candidate x", 0.02, 1, 0.01, 0.28],
  ["noise", "Objective tilt", 0, 1, 0.01, 0.16],
  ["budget", "Dual price samples", 1, 14, 1, 6],
  ["regularization", "Certificate lambda", 0, 1, 0.01, 0.45]
];

const C08_PROX_PARAMS = [
  ["curvature", "Smooth curvature L", -1.5, 2.5, 0.01, 0.9],
  ["step", "Step alpha / v", 0.02, 1, 0.01, 0.28],
  ["noise", "Forward gradient bias", 0, 1, 0.01, 0.16],
  ["budget", "Iteration k", 1, 14, 1, 6],
  ["regularization", "Lambda threshold", 0, 1, 0.01, 0.45]
];

const C09_NONCONVEX_PARAMS = [
  ["curvature", "Negative curvature lambda_min", -1.5, 2.5, 0.01, 0.9],
  ["step", "Learning rate eta", 0.02, 1, 0.01, 0.28],
  ["noise", "Perturbation noise sigma", 0, 1, 0.01, 0.16],
  ["budget", "Initialization seeds", 1, 14, 1, 6],
  ["regularization", "Basin width / sharpness", 0, 1, 0.01, 0.45]
];

const C10_TRANSPORT_PARAMS = [
  ["curvature", "Cost power p", -1.5, 2.5, 0.01, 0.9],
  ["step", "Geodesic time t", 0.02, 1, 0.01, 0.28],
  ["noise", "Source-target layout", 0, 1, 0.01, 0.16],
  ["budget", "Sinkhorn iterations", 1, 14, 1, 6],
  ["regularization", "Entropy epsilon", 0, 1, 0.01, 0.45]
];

const C_BLOCK_BLUEPRINTS = {
  c01: {
    title: "C01 Convex Analysis",
    visual: { kind: "convex-analysis-lab", graphStyle: "hidden", quality: "c01-c02-premium-v1" },
    subtitle: "Convexity as certificate geometry: convex sets, epigraphs, Jensen chords, subgradient supporting planes, and Fenchel dual slopes.",
    keywords: "convex analysis convex set epigraph Jensen subgradient supporting hyperplane Fenchel conjugate",
    modes: [["set", "Convex set"], ["epigraph", "Epigraph"], ["jensen", "Jensen"], ["fenchel", "Fenchel conjugate"]],
    params: C_COMMON_PARAMS,
    metrics: ["Jensen gap", "Support violation", "Subgradient norm", "Fenchel gap"],
    profile: {
      preferredMetric: "Jensen gap",
      formula: "f(theta x + (1-theta)y) <= theta f(x) + (1-theta)f(y)",
      insight: "C01 makes convex analysis concrete: epigraphs, supporting planes, Jensen gaps, and conjugate slopes are visible certificates, not abstract definitions."
    }
  },
  c02: {
    title: "C02 Unconstrained Optimization",
    visual: { kind: "unconstrained-optimization-lab", graphStyle: "hidden", quality: "c01-c02-premium-v1" },
    subtitle: "An objective surface with gradient descent, line search, Newton curvature correction, and momentum trace.",
    keywords: "unconstrained optimization objective gradient descent line search Newton momentum Hessian",
    modes: [["gradient", "Gradient descent"], ["line", "Line search"], ["newton", "Newton"], ["momentum", "Momentum"]],
    params: C_COMMON_PARAMS,
    metrics: ["Objective value", "Gradient norm", "Step decrease", "Newton gain"],
    profile: {
      preferredMetric: "Gradient norm",
      formula: "x_{k+1} = x_k - alpha grad f(x_k)",
      insight: "C02 shows descent as geometry: the objective surface supplies a gradient, line search chooses a reliable step, Newton rescales by curvature, and momentum carries velocity."
    }
  },
  c03: {
    title: "C03 Constrained Optimization",
    visual: { kind: "constrained-optimization-lab", graphStyle: "hidden", quality: "c03-c04-premium-v1" },
    subtitle: "A KKT force-balance landscape: objective bowl, feasible half-space, active boundary, normal cone, multiplier force, and barrier path.",
    keywords: "constrained optimization feasible set Lagrange multiplier KKT active set barrier normal cone",
    modes: [["feasible", "Feasible set"], ["lagrange", "Lagrange"], ["kkt", "KKT"], ["barrier", "Barrier"]],
    params: C03_KKT_PARAMS,
    metrics: ["Max violation", "KKT residual", "Lagrange lambda", "Complementarity"],
    profile: {
      preferredMetric: "KKT residual",
      formula: "grad f(x*) + sum_i lambda_i grad g_i(x*) = 0",
      insight: "C03 makes constraints visible: descent cannot ignore the feasible set, and optimality happens when objective force is balanced by active boundary normals."
    }
  },
  c04: {
    title: "C04 Stochastic Optimization",
    visual: { kind: "stochastic-optimization-lab", graphStyle: "hidden", quality: "c03-c04-premium-v1" },
    subtitle: "A noisy quadratic optimizer arena: full gradient, stochastic gradient fan, minibatch mean, update vector, momentum, Adam scaling, and noise covariance.",
    keywords: "stochastic optimization SGD minibatch momentum Adam variance reduction learning rate",
    modes: [["sgd", "SGD"], ["minibatch", "Minibatch"], ["momentum", "Momentum"], ["adam", "Adam"]],
    params: C04_STOCHASTIC_PARAMS,
    metrics: ["Gradient variance", "Update norm", "Angle error", "Batch coverage"],
    profile: {
      preferredMetric: "Gradient variance",
      formula: "g_k is an unbiased noisy estimate of grad F(x_k)",
      insight: "C04 separates stochastic optimization signals: individual gradients are noisy, minibatches average noise, momentum accumulates direction, and adaptive methods rescale coordinates."
    }
  },
  c05: {
    title: "C05 Calculus of Variations",
    visual: { kind: "calculus-variations-lab", graphStyle: "hidden", quality: "c05-c06-premium-v1" },
    subtitle: "A curve-as-variable lab: candidate function, admissible variation, perturbed curve, action density, Euler-Lagrange residual, and boundary term.",
    keywords: "calculus of variations functional action variation Euler-Lagrange boundary term admissible curve",
    modes: [["functional", "Functional"], ["variation", "Variation"], ["euler", "Euler-Lagrange"], ["boundary", "Boundary terms"]],
    params: C05_VARIATION_PARAMS,
    metrics: ["Action J[y]", "Euler residual", "Boundary defect", "First variation"],
    profile: {
      preferredMetric: "Euler residual",
      formula: "d/dt partial_{xdot} L - partial_x L = 0",
      insight: "C05 treats a curve as the optimization variable: perturbations test stationarity, the action integrates local cost, and Euler-Lagrange residual shows failure to be extremal."
    }
  },
  c06: {
    title: "C06 Optimal Control Theory",
    visual: { kind: "optimal-control-lab", graphStyle: "hidden", quality: "c05-c06-premium-v1" },
    subtitle: "A state-time control arena: controls generate trajectories, costates price future error, HJB shapes feedback, and Riccati vectors stabilize the target.",
    keywords: "optimal control state control costate Pontryagin Hamiltonian HJB Riccati LQR",
    modes: [["state", "State-control"], ["pontryagin", "Pontryagin"], ["hjb", "HJB"], ["lqr", "LQR"]],
    params: C06_CONTROL_PARAMS,
    metrics: ["Control cost", "HJB residual", "Riccati gain", "Terminal error"],
    profile: {
      preferredMetric: "Control cost",
      formula: "min_u integral L(x,u,t)dt + Phi(x_T)",
      insight: "C06 shows optimization through dynamics: controls bend state trajectories, costates price future error, and Riccati feedback stabilizes the terminal target."
    }
  },
  c07: {
    title: "C07 Duality Theory",
    visual: { kind: "duality-theory-lab", graphStyle: "hidden", quality: "c07-c08-premium-v1" },
    subtitle: "A primal-dual certificate lab: primal value, dual lower bound, vertical gap, Lagrangian saddle, Fenchel support, and complementarity.",
    keywords: "duality Lagrangian dual gap strong duality Fenchel conjugate primal dual certificate",
    modes: [["lagrangian", "Lagrangian"], ["dual", "Dual gap"], ["fenchel", "Fenchel"], ["minimax", "Minimax"]],
    params: C07_DUAL_PARAMS,
    metrics: ["Duality gap", "Primal residual", "Complementarity", "Certificate slack"],
    profile: {
      preferredMetric: "Duality gap",
      formula: "dual value <= primal value",
      insight: "C07 turns duality into an inspection tool: a dual bound certifies primal quality, complementarity explains active constraints, and Fenchel pairs expose support geometry."
    }
  },
  c08: {
    title: "C08 Proximal Methods",
    visual: { kind: "proximal-methods-lab", graphStyle: "hidden", quality: "c07-c08-premium-v1" },
    subtitle: "A proximal workbench: forward proposal v, exact prox output, quadratic tether, L1 deadzone, Moreau envelope, and ADMM split residual.",
    keywords: "proximal methods prox operator Moreau envelope soft thresholding sparse ADMM splitting",
    modes: [["prox", "Prox map"], ["moreau", "Moreau envelope"], ["soft", "Soft threshold"], ["admm", "ADMM split"]],
    params: C08_PROX_PARAMS,
    metrics: ["Prox distance", "Moreau smoothness", "Sparsity", "ADMM residual"],
    profile: {
      preferredMetric: "Prox distance",
      formula: "prox_{lambda g}(v) = argmin_x g(x) + ||x-v||^2/(2lambda)",
      insight: "C08 shows why prox methods work: a quadratic center pulls toward v while the nonsmooth term shrinks, projects, or splits the update into easier pieces."
    }
  },
  c09: {
    title: "C09 Non-convex Optimization",
    visual: { kind: "nonconvex-optimization-lab", graphStyle: "hidden", quality: "c09-c10-premium-v1" },
    subtitle: "A diagnostic non-convex terrain: saddle plateau, negative curvature, trapped descent, perturbation escape, seed basins, and flat versus sharp minima.",
    keywords: "non-convex optimization saddle negative curvature basin sharp flat minima perturbed gradient descent",
    modes: [["landscape", "Landscape"], ["basins", "Basins"], ["saddle", "Saddle"], ["optimizer", "Optimizer"]],
    params: C09_NONCONVEX_PARAMS,
    metrics: ["Saddle escape", "Sharpness", "Basin energy", "Perturbation gain"],
    profile: {
      preferredMetric: "Saddle escape",
      formula: "grad f(x) small does not imply local minimum when Hessian has negative eigenvalues",
      insight: "C09 makes non-convexity inspectable: small gradient can mean saddle, perturbations reveal escape directions, and minima differ by sharpness and basin geometry."
    }
  },
  c10: {
    title: "C10 Optimal Transport",
    visual: { kind: "optimal-transport-lab", graphStyle: "hidden", quality: "c09-c10-premium-v1" },
    subtitle: "A mass-shipping board: source and target towers, Pij transport tubes, marginal meters, cost floor, Sinkhorn scaling, dual prices, and Wasserstein flow.",
    keywords: "optimal transport transport plan coupling Sinkhorn Wasserstein dual potentials displacement interpolation",
    modes: [["plan", "Plan"], ["sinkhorn", "Sinkhorn"], ["dual", "Dual potentials"], ["displacement", "Displacement"]],
    params: C10_TRANSPORT_PARAMS,
    metrics: ["Transport cost", "Marginal error", "Entropy", "Wasserstein path"],
    profile: {
      preferredMetric: "Transport cost",
      formula: "min_pi sum_ij c_ij pi_ij subject to pi 1 = a, pi^T 1 = b",
      insight: "C10 shows distribution comparison as moving mass: a coupling links source and target, Sinkhorn regularizes the plan, and Wasserstein geometry interpolates displacement."
    }
  }
};

const LAB_BLUEPRINTS = {
  ...B_BLOCK_BLUEPRINTS,
  ...C_BLOCK_BLUEPRINTS,
  a01: {
    title: "A01 Linear Algebra Fundamentals",
    visual: { kind: "vector-space-3d", graphStyle: "hidden" },
    subtitle: "A clean 3D vector space: rotate the axes, move vector v with x/y/z components, read its component legs, plane projection, and relation to a second vector u.",
    keywords: "linear algebra vectors 3d space axes components coordinates projection dot product basis",
    modes: [["vector", "Vector coordinates"], ["components", "Components"], ["projection", "Projection"]],
    params: [["x", "x component", -2, 2, 0.05, 1.1], ["y", "y component", -2, 2, 0.05, 0.85], ["z", "z component", -2, 2, 0.05, 0.55], ["basis", "Basis scale", 0.5, 2.5, 0.05, 1], ["mix", "Second vector mix", -1, 1, 0.05, 0.35]],
    metrics: ["Vector length", "Plane projection", "Dot with u", "Basis volume"],
    profile: {
      preferredMetric: "Vector length",
      formula: "v = x e1 + y e2 + z e3",
      insight: "This lab keeps linear algebra at the object level: one vector in 3D space, its coordinate components, its projection onto the base plane, and its comparison with a second vector."
    },
    graph: {
      nodes: [
        { label: "origin", position: [-0.35, -1.75, 0], group: 0 },
        { label: "x axis", position: [2.2, -1.75, 0], group: 1 },
        { label: "y axis", position: [-0.35, 0.55, 0], group: 2 },
        { label: "z axis", position: [-0.35, -1.75, 2.2], group: 3 },
        { label: "vector v", position: [1.0, -0.65, 0.7], group: 4 },
        { label: "component legs", position: [0.65, -1.05, 0.35], group: 5 },
        { label: "plane projection", position: [1.0, -1.75, 0.7], group: 6 },
        { label: "second vector u", position: [-1.0, -1.2, 1.15], group: 7 }
      ],
      edges: [
        [0, 1, "basis x direction", 1.0],
        [0, 2, "basis y direction", 1.0],
        [0, 3, "basis z direction", 1.0],
        [0, 4, "v coordinates", 1.4],
        [0, 5, "component decomposition", 1.0],
        [4, 6, "projection shadow", 1.1],
        [0, 7, "second vector comparison", 0.9],
        [4, 7, "dot product angle", 0.8]
      ]
    }
  },
  a02: {
    title: "A02 Vectors, Spaces and Linear Maps",
    visual: { kind: "linear-map-3d", graphStyle: "hidden" },
    subtitle: "A linear map sends a vector from a domain space to a codomain space while preserving addition and scaling; kernel, image, rank-nullity, and dual action stay visible.",
    keywords: "vector spaces linear maps domain codomain kernel image rank nullity dual functional",
    modes: [["map", "Map T"], ["kernel", "Kernel / image"], ["dual", "Dual action"]],
    params: [["stretch", "Stretch", 0.35, 2.4, 0.05, 1.2], ["shear", "Shear", -1.2, 1.2, 0.05, 0.25], ["collapse", "Collapse", 0, 1, 0.02, 0.18], ["angle", "Input angle", -180, 180, 1, 35], ["dual", "Dual probe", -1, 1, 0.05, 0.3]],
    metrics: ["Rank of T", "Kernel dim", "Image norm", "Dual value"],
    profile: {
      preferredMetric: "Rank of T",
      formula: "T(v) = A v; dim(domain) = rank(T) + dim ker(T)",
      insight: "A02 reads a linear map as movement between spaces: the domain vector v is transformed into T(v), the transformed axes show the image, a red direction marks the kernel when collapse removes information, and the dual probe reads a scalar from the output."
    },
    graph: {
      nodes: [
        { label: "domain V", position: [-2.4, -1.3, -0.2], group: 0 },
        { label: "vector v", position: [-1.45, -0.65, 0.7], group: 1 },
        { label: "linear map T", position: [0, -0.55, 0.3], group: 2 },
        { label: "codomain W", position: [2.15, -1.3, -0.2], group: 3 },
        { label: "image T(v)", position: [2.85, -0.45, 0.55], group: 4 },
        { label: "image subspace", position: [2.15, -1.15, 0.75], group: 5 },
        { label: "kernel direction", position: [-2.65, -1.1, 1.0], group: 6 },
        { label: "dual probe", position: [2.7, 0.25, 0.95], group: 7 }
      ],
      edges: [
        [0, 1, "choose input vector", 1.0],
        [1, 2, "apply T", 1.4],
        [2, 4, "output image vector", 1.3],
        [3, 4, "codomain coordinates", 1.0],
        [3, 5, "reachable image", 1.1],
        [0, 6, "kernel invisible input", 0.8],
        [4, 7, "dual functional reads scalar", 0.9],
        [6, 5, "rank-nullity ledger", 0.7]
      ]
    }
  },
  a03: {
    title: "A03 Multivariable Calculus",
    visual: { kind: "quadratic-taylor-surface", graphStyle: "hidden" },
    subtitle: "A local Taylor model for a scalar function: move the point, change Hessian eigenvalues, and read the surface, tangent plane, gradient, level curves, and curvature class.",
    keywords: "multivariable calculus gradient tangent plane Hessian eigenvalues Taylor approximation saddle level sets",
    modes: [["surface", "Taylor surface"], ["gradient", "Gradient flow"], ["hessian", "Hessian saddle"]],
    params: [["lambda1", "lambda1", -2.2, 2.2, 0.05, 1.15], ["lambda2", "lambda2", -2.2, 2.2, 0.05, 0.55], ["px", "point x", -1.2, 1.2, 0.05, 0.45], ["py", "point y", -1.2, 1.2, 0.05, 0.35], ["rotation", "eigen rotation", -90, 90, 1, 25]],
    metrics: ["Gradient norm", "Hessian det", "Curvature class", "Directional derivative"],
    profile: {
      preferredMetric: "Gradient norm",
      formula: "f(p+h) ~= f(p) + grad f(p)^T h + 1/2 h^T H h",
      insight: "A03 shows the local object behind multivariable calculus: the function surface, the tangent plane from the gradient, and the Hessian eigen-directions that classify minimum, maximum, saddle, or flat behavior."
    },
    graph: {
      nodes: [
        { label: "surface f", position: [0, -0.8, 0], group: 0 },
        { label: "point p", position: [0.45, -0.35, 0.35], group: 1 },
        { label: "gradient", position: [0.95, -0.05, 0.35], group: 2 },
        { label: "tangent plane", position: [0.45, -0.25, 0.35], group: 3 },
        { label: "lambda1 direction", position: [1.0, -0.65, 0.0], group: 4 },
        { label: "lambda2 direction", position: [0.0, -0.65, 1.0], group: 5 },
        { label: "level set", position: [-0.55, -0.85, 0.65], group: 6 },
        { label: "descent step", position: [0.15, -0.55, 0.1], group: 7 }
      ],
      edges: [
        [0, 1, "evaluate at p", 1.2],
        [1, 2, "first derivative", 1.2],
        [1, 3, "linear approximation", 1.1],
        [1, 4, "Hessian eigenvector", 1.0],
        [1, 5, "Hessian eigenvector", 1.0],
        [0, 6, "same value contour", 0.8],
        [2, 7, "negative gradient", 0.9],
        [4, 5, "curvature classification", 0.8]
      ]
    }
  },
  a04: {
    title: "A04 Measure Convergence",
    visual: { kind: "measure-convergence-3d", graphStyle: "hidden" },
    subtitle: "Compare pointwise limits, shrinking spike support, Lebesgue range slices, and integral mass.",
    keywords: "measure convergence Lebesgue integral limits",
    modes: [["pointwise", "Pointwise limit"], ["spike", "A.E. spike"], ["simple", "Lebesgue slices"]],
    params: [["n", "sequence n", 1, 40, 1, 8], ["epsilon", "epsilon", 0.02, 0.5, 0.01, 0.12], ["support", "support", 0.1, 0.8, 0.02, 0.35], ["partitions", "levels", 3, 14, 1, 6], ["envelope", "bound", 0.4, 3, 0.05, 1.35]],
    metrics: ["Sup error", "L1 integral", "Support measure", "Dominated ratio"],
    profile: {
      preferredMetric: "L1 integral",
      formula: "f_n -> f pointwise/a.e. does not imply int f_n dmu -> int f dmu",
      insight: "A04 shows convergence as measurable geometry: bars are f_n, the green footprint is support, and horizontal slices build the integral."
    },
    graph: {
      nodes: [
        { label: "domain [0,1]", position: [-2.6, -1.8, 0], group: 0 },
        { label: "function sequence", position: [-0.8, -0.55, 0.15], group: 1 },
        { label: "support measure", position: [0.7, -1.72, 0.25], group: 2 },
        { label: "Lebesgue slices", position: [2.1, -0.5, 0.45], group: 3 },
        { label: "limit test", position: [2.8, -1.5, -0.5], group: 4 }
      ],
      edges: [[0, 1, "measurable function", 1], [1, 2, "support footprint", 1], [1, 3, "range slicing", 1], [2, 4, "a.e. exception", 1], [3, 4, "integral limit test", 1]]
    }
  },
  a05: {
    title: "A05 Functional Analysis",
    visual: { kind: "functional-operator-space", graphStyle: "hidden" },
    subtitle: "Waveform plus coefficients show projection, compact smoothing, derivative stress, and dual scalar readout.",
    keywords: "functional analysis Hilbert Banach operators projection basis coefficients compact derivative dual Riesz",
    modes: [["projection", "Hilbert projection"], ["compact", "Compact smoothing"], ["derivative", "Derivative stress"], ["dual", "Dual functional"]],
    params: [["truncation", "basis cutoff", 1, 12, 1, 5], ["frequency", "frequency", 1, 12, 1, 6], ["strength", "op strength", 0.2, 2, 0.05, 0.9], ["smoothness", "smoothness", 0, 1, 0.02, 0.45], ["probe", "dual probe", 0.08, 0.92, 0.01, 0.62]],
    metrics: ["Input norm", "Output norm", "Operator gain", "Residual norm"],
    profile: {
      preferredMetric: "Operator gain",
      formula: "T: f = sum a_k e_k -> sum b_k e_k,  ||T|| = sup ||Tf||/||f||",
      insight: "A05 treats functions as vectors: coefficient towers are coordinates, waveforms are the same vector in physical space, and each operator shows whether geometry is preserved, compressed, amplified, or read by a dual functional."
    },
    graph: {
      nodes: [
        { label: "function f", position: [-2.7, -0.65, -0.55], group: 0 },
        { label: "basis coefficients", position: [-1.0, -1.45, 0.85], group: 1 },
        { label: "operator T", position: [0.55, -1.0, 0], group: 2 },
        { label: "projection", position: [1.8, -1.3, 0.65], group: 3 },
        { label: "dual functional", position: [2.75, -0.55, -0.65], group: 4 }
      ],
      edges: [[0, 1, "basis expansion", 1], [1, 2, "operator on modes", 1], [2, 3, "closed subspace", 1], [2, 4, "scalar readout", 1], [3, 0, "residual geometry", 1]]
    }
  },
  a06: {
    title: "A06 Topology Basics",
    visual: { kind: "topology-space-lab", graphStyle: "hidden" },
    subtitle: "A topological space lab for open neighborhoods, boundary, continuity via preimages, compact finite subcovers, connected splits, and quotient gluing.",
    keywords: "topology open sets neighborhoods boundary continuity preimage compactness connectedness quotient",
    modes: [["open", "Open neighborhoods"], ["continuity", "Continuity preimage"], ["compact", "Compact subcover"], ["connected", "Connected split"], ["quotient", "Quotient glue"]],
    params: [["radius", "neighborhood", 0.12, 0.9, 0.02, 0.34], ["cover", "cover sets", 2, 9, 1, 5], ["map", "map stretch", 0.4, 1.8, 0.05, 1], ["glue", "glue strength", 0, 1, 0.05, 0.25], ["separation", "separation", 0, 1, 0.05, 0.2]],
    metrics: ["Open coverage", "Boundary count", "Subcover size", "Continuity score"],
    profile: {
      preferredMetric: "Open coverage",
      formula: "f continuous iff f^-1(V) is open in X for every open V in Y",
      insight: "A06 makes topology operational: open neighborhoods define local context, preimages test continuity, compactness extracts finite subcovers, connectedness fails by separated opens, and quotient gluing changes the global space."
    },
    graph: {
      nodes: [
        { label: "space X", position: [-2.7, -1.9, -0.2], group: 0 },
        { label: "open neighborhoods", position: [-0.8, -1.65, -0.1], group: 1 },
        { label: "boundary", position: [0.2, -1.55, -0.2], group: 2 },
        { label: "target open set V", position: [0, -0.8, 1.2], group: 3 },
        { label: "preimage test", position: [0, -1.8, -0.2], group: 4 },
        { label: "finite subcover", position: [0.6, -1.65, 0.7], group: 5 },
        { label: "connected split", position: [-0.1, -1.8, -0.65], group: 6 },
        { label: "quotient glue", position: [2.2, -1.0, 1.2], group: 7 }
      ],
      edges: [
        [0, 1, "opens define neighborhoods", 1.1],
        [1, 2, "boundary of local data", 0.9],
        [3, 4, "continuity by preimage", 1.3],
        [1, 5, "open cover reduces", 1.0],
        [0, 6, "connectedness test", 1.0],
        [0, 7, "quotient projection", 0.9],
        [5, 7, "global shape changes", 0.8]
      ]
    }
  },
  a07: {
    title: "A07 Differential Geometry",
    visual: { kind: "differential-manifold-3d", graphStyle: "hidden" },
    subtitle: "A curved manifold with local chart, tangent plane, metric volume patch, geodesic path, ambient chord, and curvature sign.",
    keywords: "differential geometry manifold tangent metric geodesic curvature chart retraction",
    modes: [["tangent", "Tangent chart"], ["metric", "Metric volume"], ["geodesic", "Geodesic path"], ["curvature", "Curvature field"]],
    params: [["theta", "chart u", -1.15, 1.15, 0.05, 0.35], ["phi", "chart v", -1.15, 1.15, 0.05, 0.25], ["metric", "metric scale", 0.4, 2, 0.05, 1], ["curvature", "curvature", -1.6, 1.6, 0.05, 0.75], ["step", "step size", 0.1, 1.2, 0.05, 0.55]],
    metrics: ["Metric area", "Geodesic gap", "Curvature sign", "Tangent error"],
    profile: {
      preferredMetric: "Curvature sign",
      formula: "local chart -> T_pM, metric g_p, geodesic exp_p(v), curvature K",
      insight: "A07 keeps the manifold separate from the ambient drawing: p lies on the surface, the tangent plane is local linear geometry, the metric patch measures local area, and the geodesic stays on the manifold."
    },
    graph: {
      nodes: [
        { label: "manifold surface", position: [0, -1.3, 0], group: 0 },
        { label: "point p", position: [0.35, -0.55, 0.25], group: 1 },
        { label: "tangent plane", position: [0.35, -0.52, 0.25], group: 2 },
        { label: "metric volume", position: [-0.75, -0.9, 0.62], group: 3 },
        { label: "geodesic", position: [1.1, -0.72, 0.2], group: 4 }
      ],
      edges: [[0, 1, "local chart", 1], [1, 2, "linear model", 1], [2, 3, "metric area", 1], [1, 4, "exp/retract", 1], [4, 0, "curvature bends path", 1]]
    }
  },
  a08: {
    title: "A08 Abstract Algebra",
    visual: { kind: "abstract-algebra-lab", graphStyle: "hidden" },
    subtitle: "Finite structures as operation tables, laws, units, zero divisors, generator orbits, homomorphism kernels, and quotients.",
    keywords: "abstract algebra groups rings fields homomorphism kernel quotient orbit units zero divisors",
    modes: [["table", "Group table"], ["ring", "Ring units"], ["homomorphism", "Homomorphism"], ["action", "Group action"]],
    params: [["modulus", "modulus n", 4, 9, 1, 4], ["generator", "generator", 1, 8, 1, 1], ["map", "map factor", 1, 5, 1, 2], ["operation", "operation", 0, 1, 1, 0], ["quotient", "quotient", 2, 5, 1, 2]],
    metrics: ["Closure score", "Unit fraction", "Kernel size", "Orbit length"],
    profile: {
      preferredMetric: "Orbit length",
      formula: "operation table + generator orbit + ker(phi) -> quotient structure",
      insight: "A08 makes algebra procedural: the table proves closure, highlighted rows show identity/inverses/units, generator arrows show reachability, and the kernel/quotient view shows exactly what a homomorphism forgets."
    },
    graph: {
      nodes: [
        { label: "operation table", position: [-1.8, -1.7, 0], group: 0 },
        { label: "identity", position: [-0.2, -0.8, -0.7], group: 1 },
        { label: "inverse/unit", position: [0.8, -1.0, -0.2], group: 2 },
        { label: "generator orbit", position: [2.0, -1.3, 0.4], group: 3 },
        { label: "kernel quotient", position: [2.8, -0.8, -0.55], group: 4 }
      ],
      edges: [[0, 1, "law check", 1], [0, 2, "invertibility", 1], [2, 3, "action orbit", 1], [0, 4, "homomorphism collapse", 1], [4, 3, "quotient action", 1]]
    }
  },
  a09: {
    title: "A09 Category Theory Basics",
    visual: { kind: "category-diagram-lab", graphStyle: "hidden" },
    subtitle: "Objects and arrows form a compositional diagram; functors project it to another layer; naturality checks two routes around a square.",
    keywords: "category theory objects arrows identity composition functor naturality poset monoid diagram",
    modes: [["category", "Category laws"], ["functor", "Functor layer"], ["naturality", "Naturality square"], ["poset", "Poset category"], ["monoid", "One-object monoid"]],
    params: [["objects", "objects", 3, 5, 1, 3], ["functor", "functor", 0, 1, 0.05, 0.65], ["naturality", "naturality gap", 0, 1, 0.05, 0.18], ["reversal", "arrow reversal", 0, 1, 0.05, 0.25], ["composition", "composition", 0, 1, 0.05, 0.7]],
    metrics: ["Composition error", "Functor law", "Naturality gap", "Arrow count"],
    profile: {
      preferredMetric: "Naturality gap",
      formula: "F(g o f) = F(g) o F(f),  G(f) o eta_A = eta_B o F(f)",
      insight: "A09 makes categorical thinking visual: arrows compose, identities stay attached to objects, functors copy the whole diagram into a target layer, and naturality is a square whose two paths must agree."
    },
    graph: {
      nodes: [
        { label: "objects", position: [-2.6, -1.3, -0.2], group: 0 },
        { label: "arrows", position: [-1.1, -0.8, 0.4], group: 1 },
        { label: "composition", position: [0.1, -0.55, 0.2], group: 2 },
        { label: "functor image", position: [1.4, -1.0, 0.7], group: 3 },
        { label: "naturality square", position: [2.65, -0.7, -0.35], group: 4 }
      ],
      edges: [[0, 1, "hom set", 1], [1, 2, "compose", 1], [2, 3, "F preserves", 1], [3, 4, "eta comparison", 1], [4, 2, "commuting routes", 1]]
    }
  },
  a10: {
    title: "A10 Advanced Category Theory",
    visual: { kind: "advanced-category-lab", graphStyle: "hidden" },
    subtitle: "Universal cones, adjunction transposes, monad unit/multiplication, Kan extension envelopes, and local-to-global gluing in one orbitable 3D categorical workspace.",
    keywords: "advanced category theory limits colimits cones adjunction monad Kan extension sheaf gluing universal property",
    modes: [["limits", "Limits"], ["adjunction", "Adjunction"], ["monad", "Monad"], ["kan", "Kan extension"], ["sheaf", "Sheaf glue"]],
    params: [["defect", "cone defect", 0, 1, 0.02, 0.18], ["adjunction", "adjunction fit", 0, 1, 0.02, 0.72], ["depth", "monad depth", 1, 8, 1, 3], ["extension", "extension span", 0, 1, 0.02, 0.45], ["glue", "glue strength", 0, 1, 0.02, 0.28]],
    metrics: ["Universal defect", "Adjunction fit", "Monad coherence", "Extension cost"],
    profile: {
      preferredMetric: "Universal defect",
      formula: "limit cone + hom_C(Fa,b) ~= hom_D(a,Ub) + T=UF + Lan_K",
      insight: "A10 keeps advanced category theory as universal tasks: a cone factors uniquely through a limit, adjunctions transpose arrows, monads flatten nested structure, Kan extensions fill missing data, and sheaf gluing checks coherence."
    }
  },
  a11: {
    title: "A11 Information Theory",
    visual: { kind: "information-theory-lab", graphStyle: "hidden" },
    subtitle: "Probability bars become code lengths; model mismatch becomes KL penalty; noisy channel matrices show mutual information loss.",
    keywords: "information theory entropy cross entropy KL divergence mutual information noisy channel coding theorem",
    modes: [["entropy", "Entropy"], ["cross", "Cross entropy"], ["kl", "KL mismatch"], ["mi", "Mutual information"], ["channel", "Noisy channel"]],
    params: [["spread", "entropy spread", 0.05, 1, 0.02, 0.62], ["mismatch", "model mismatch", 0, 1, 0.02, 0.25], ["noise", "channel noise", 0, 0.5, 0.01, 0.18], ["samples", "samples", 2, 12, 1, 6], ["temperature", "softmax temp", 0.35, 2.5, 0.05, 1]],
    metrics: ["Entropy H(p)", "Cross entropy", "KL divergence", "Mutual information"],
    profile: {
      preferredMetric: "KL divergence",
      formula: "H(p), H(p,q)=H(p)+D_KL(p||q), I(X;Y)=H(X)-H(X|Y)",
      insight: "A11 makes information visible as coding geometry: p sets ideal code lengths, q pays an extra KL cost when mismatched, and channel noise destroys shared uncertainty between input and output."
    }
  },
  a12: {
    title: "A12 Algebraic Topology",
    visual: { kind: "algebraic-topology-lab", graphStyle: "hidden" },
    subtitle: "A finite simplicial complex with chain groups, boundary maps, surviving cycles, filled faces, Betti numbers, and persistence bars.",
    keywords: "algebraic topology simplicial complex chains boundary maps homology Betti fundamental group persistence",
    modes: [["complex", "Simplicial complex"], ["boundary", "Boundary maps"], ["homology", "Homology"], ["fundamental", "Fundamental loop"], ["persistence", "Persistence"]],
    params: [["radius", "filtration radius", 0.45, 1.8, 0.05, 1.05], ["fill", "face fill", 0, 1, 0.02, 0.22], ["boundary", "boundary weight", 0, 1, 0.02, 0.65], ["twist", "loop twist", 0, 1, 0.02, 0.2], ["persistence", "persistence", 0, 1, 0.02, 0.55]],
    metrics: ["Betti-0", "Betti-1", "Boundary rank", "Persistence span"],
    profile: {
      preferredMetric: "Betti-1",
      formula: "H_k = ker(partial_k) / im(partial_{k+1})",
      insight: "A12 turns topology into computable algebra: simplices become chain groups, boundary matrices detect cycles, a filled face kills a loop, and persistence records how long features survive."
    }
  },
  a13: {
    title: "A13 Differential Equations",
    visual: { kind: "differential-equations-flow-lab", graphStyle: "hidden" },
    subtitle: "A vector-field phase space where local derivative samples build trajectories, Euler/RK steps diverge, equilibria stabilize, and stiffness stresses step size.",
    keywords: "differential equations ODE vector field trajectory Euler Runge Kutta equilibrium stiffness boundary value problem",
    modes: [["flow", "ODE flow"], ["solver", "Euler vs RK"], ["equilibrium", "Equilibrium"], ["stiff", "Stiff system"], ["boundary", "Boundary value"]],
    params: [["step", "step size", 0.05, 0.9, 0.01, 0.28], ["stiffness", "stiffness", 0.2, 8, 0.05, 1.2], ["damping", "damping", 0, 1.4, 0.02, 0.45], ["initial", "initial state", -1.5, 1.5, 0.05, 0.8], ["solver", "solver correction", 0, 1, 0.02, 0.65]],
    metrics: ["Step error", "Stability margin", "Equilibrium gap", "Stiffness ratio"],
    profile: {
      preferredMetric: "Step error",
      formula: "x'(t)=f(t,x), local derivative -> numerical step -> trajectory",
      insight: "A13 shows equations as flow: an initial condition selects one solution curve, solver steps approximate local derivatives, equilibrium stability shapes the path, and stiffness forces smaller steps."
    }
  },
  a14: {
    title: "A14 Complex Analysis",
    visual: { kind: "complex-analysis-contour-lab", graphStyle: "hidden" },
    subtitle: "A complex-plane contour lab for Cauchy-Riemann local structure, pole location, winding number, Laurent residue, branch cut, and contour integral accumulation.",
    keywords: "complex analysis Cauchy Riemann analytic contour integral residue theorem Laurent pole branch cut winding number",
    modes: [["cr", "Cauchy-Riemann"], ["contour", "Contour integral"], ["residue", "Residue theorem"], ["laurent", "Laurent pole"], ["branch", "Branch cut"]],
    params: [["radius", "contour radius", 0.45, 2.2, 0.05, 1.25], ["pole", "pole distance", 0, 2.4, 0.05, 0.72], ["residue", "residue scale", -2, 2, 0.05, 1], ["winding", "winding", -2, 3, 1, 1], ["branch", "branch cut", 0, 1, 0.02, 0.25]],
    metrics: ["Winding number", "Residue integral", "CR defect", "Pole distance"],
    profile: {
      preferredMetric: "Winding number",
      formula: "oint_C f(z) dz = 2 pi i * sum Res(f,a) * wind(C,a)",
      insight: "A14 makes the residue theorem operational: a contour samples analytic structure globally, a pole contributes only when enclosed with nonzero winding, and branch cuts mark where analytic continuation changes sheet."
    }
  },
  a15: {
    title: "A15 Numerical Methods",
    visual: { kind: "numerical-methods-stability-lab", graphStyle: "hidden" },
    subtitle: "A numerical reliability lab for conditioning, residual iteration, root brackets, finite-difference step size, roundoff stress, regularization, and trusted digits.",
    keywords: "numerical methods conditioning stability roundoff residual root finding finite differences linear solve time stepping trusted digits",
    modes: [["conditioning", "Conditioning"], ["root", "Root finding"], ["finite", "Finite differences"], ["linear", "Linear solve"], ["time", "Time stepping"]],
    params: [["condition", "condition", 1, 9, 0.05, 2.2], ["step", "step size", 0.02, 0.8, 0.01, 0.18], ["roundoff", "roundoff", 0, 1, 0.02, 0.18], ["regularization", "regularization", 0, 1, 0.02, 0.35], ["iterations", "iterations", 1, 12, 1, 5]],
    metrics: ["Condition number", "Residual norm", "Trusted digits", "Stability margin"],
    profile: {
      preferredMetric: "Trusted digits",
      formula: "forward error <= conditioning * backward error; stable iterations reduce residual",
      insight: "A15 separates the numerical story: conditioning is problem sensitivity, stability is algorithm behavior, roundoff is finite precision noise, and trusted digits are what survives the computation."
    }
  },
  h01: {
    title: "H01 Introduction To Sheaf Theory",
    visual: { kind: "open-cover", graphStyle: "anchors" },
    subtitle: "Open sets carry local data; restriction maps decide whether those local sections can become one global section.",
    keywords: "sheaf introduction open sets stalks restrictions global sections cellular sheaf",
    modes: [["cover", "Open cover"], ["stalk", "Stalks and restrictions"], ["global", "Global section test"]],
    params: [["depth", "Cover refinement", 1, 10, 1, 3], ["temperature", "Restriction strictness", 0.25, 3.5, 0.05, 0.9], ["noise", "Local mismatch", 0, 1, 0.02, 0.18], ["budget", "Visible opens", 1, 10, 1, 5], ["residual", "Identity section", 0, 1, 0.02, 0.5]],
    metrics: ["Gluing score", "Restriction defect", "Cover support", "Global section gap"],
    profile: {
      preferredMetric: "Gluing score",
      formula: "local sections + compatible restrictions -> global section",
      insight: "This scene is the sheaf definition as a mechanism: open sets hold local data, overlap edges restrict it, and red channels show exactly where gluing fails."
    },
    graph: {
      nodes: [
        { label: "X", position: [0, 1.15, 0], group: 0 },
        { label: "U", position: [-2.8, 0.35, -0.7], group: 1 },
        { label: "V", position: [0, 0.15, 1.7], group: 1 },
        { label: "W", position: [2.8, 0.35, -0.7], group: 1 },
        { label: "U∩V", position: [-1.55, -0.85, 0.55], group: 2 },
        { label: "V∩W", position: [1.55, -0.85, 0.55], group: 2 },
        { label: "U∩W", position: [0, -0.95, -1.75], group: 2 },
        { label: "s_U", position: [-3.45, -1.65, -0.1], group: 3 },
        { label: "s_V", position: [0, -1.95, 2.3], group: 3 },
        { label: "s_W", position: [3.45, -1.65, -0.1], group: 3 }
      ],
      edges: [
        [0, 1, "open subset", 1.2], [0, 2, "open subset", 1.2], [0, 3, "open subset", 1.2],
        [1, 4, "restrict to overlap", 1.35], [2, 4, "restrict to overlap", 1.2],
        [2, 5, "restrict to overlap", 1.35], [3, 5, "restrict to overlap", 1.2],
        [1, 6, "restrict to overlap", 0.95], [3, 6, "restrict to overlap", 0.95],
        [7, 1, "section over U", 1.0], [8, 2, "section over V", 1.0], [9, 3, "section over W", 1.0],
        [4, 5, "locality check", 0.7], [5, 6, "gluing check", 0.7], [6, 4, "gluing check", 0.7]
      ]
    }
  },
  h02: {
    title: "H02 Sheaves On Topological Spaces",
    visual: { kind: "locality-cover", graphStyle: "anchors" },
    subtitle: "A sheaf on a topological space is a system of sections over opens whose overlap agreements control existence and uniqueness.",
    keywords: "topological sheaf presheaf locality gluing open cover overlap",
    modes: [["locality", "Locality axiom"], ["gluing", "Gluing axiom"], ["unique", "Unique global section"]],
    params: [["depth", "Refinement depth", 1, 10, 1, 4], ["temperature", "Overlap tolerance", 0.25, 3.5, 0.05, 1.1], ["noise", "Patch disagreement", 0, 1, 0.02, 0.22], ["budget", "Active patches", 1, 12, 1, 6], ["residual", "Base-space anchor", 0, 1, 0.02, 0.44]],
    metrics: ["Overlap agreement", "Locality margin", "Patch coverage", "Uniqueness gap"],
    profile: {
      preferredMetric: "Overlap agreement",
      formula: "F(U), F(V), F(U∩V) with res_UV(s_U) = res_VU(s_V)",
      insight: "This lab focuses on the two sheaf axioms: local equality is tested on overlaps, and compatible patch data is glued into a unique global object."
    },
    graph: {
      nodes: [
        { label: "Space X", position: [0, 1.25, 0], group: 0 },
        { label: "Open U", position: [-2.5, 0.35, 0.2], group: 1 },
        { label: "Open V", position: [0, 0.45, 1.9], group: 1 },
        { label: "Open W", position: [2.5, 0.35, 0.2], group: 1 },
        { label: "U∩V", position: [-1.2, -0.65, 1.1], group: 2 },
        { label: "V∩W", position: [1.2, -0.65, 1.1], group: 2 },
        { label: "U∩W", position: [0, -0.75, -1.15], group: 2 },
        { label: "F(U)", position: [-3.2, -1.55, 0.3], group: 3 },
        { label: "F(V)", position: [0, -1.65, 2.65], group: 3 },
        { label: "F(W)", position: [3.2, -1.55, 0.3], group: 3 },
        { label: "F(X)", position: [0, -2.25, -0.4], group: 0 }
      ],
      edges: [
        [1, 4, "res_U to overlap", 1.25], [2, 4, "res_V to overlap", 1.25],
        [2, 5, "res_V to overlap", 1.25], [3, 5, "res_W to overlap", 1.25],
        [1, 6, "res_U to overlap", 1.0], [3, 6, "res_W to overlap", 1.0],
        [7, 4, "section restriction", 1.2], [8, 4, "section restriction", 1.2],
        [8, 5, "section restriction", 1.2], [9, 5, "section restriction", 1.2],
        [10, 7, "global restricts", 0.9], [10, 8, "global restricts", 0.9], [10, 9, "global restricts", 0.9]
      ]
    }
  },
  h03: {
    title: "H03 Cellular Sheaves And Cohomology",
    visual: { kind: "cellular-triangle", graphStyle: "anchors" },
    subtitle: "Vertex stalks, edge stalks, and face circulation make coboundary defects visible on a triangular cell complex.",
    keywords: "cellular sheaf cochains coboundary cohomology triangle circulation",
    modes: [["constant", "Constant restrictions"], ["signed", "Signed restrictions"], ["rotate", "Rotational cochains"]],
    params: [["depth", "Cochain degree", 1, 8, 1, 2], ["temperature", "Coboundary sharpness", 0.25, 3.5, 0.05, 1], ["noise", "Circulation defect", 0, 1, 0.02, 0.16], ["budget", "Visible cells", 1, 10, 1, 6], ["residual", "Harmonic anchor", 0, 1, 0.02, 0.55]],
    metrics: ["Coboundary norm", "Cycle circulation", "Cell coverage", "Harmonic gap"],
    profile: {
      preferredMetric: "Coboundary norm",
      formula: "C^0 ->δ0 C^1 ->δ1 C^2, with cohomology ker δ / im δ",
      insight: "The triangle shows cellular cohomology directly: node values become edge residuals through δ0, then edge residuals circulate around the face through δ1."
    },
    graph: {
      nodes: [
        { label: "v0", position: [-2.2, 0.6, 0], group: 0 },
        { label: "v1", position: [2.2, 0.6, 0], group: 0 },
        { label: "v2", position: [0, 2.35, 0], group: 0 },
        { label: "e01", position: [0, 0.0, 0.75], group: 1 },
        { label: "e12", position: [1.35, 1.55, 0.75], group: 1 },
        { label: "e20", position: [-1.35, 1.55, 0.75], group: 1 },
        { label: "face", position: [0, 1.25, 1.75], group: 2 },
        { label: "C0", position: [-3.25, -1.2, -0.7], group: 3 },
        { label: "C1", position: [0, -1.55, 0.9], group: 3 },
        { label: "C2", position: [3.25, -1.2, -0.7], group: 3 }
      ],
      edges: [
        [0, 3, "δ0 endpoint", 1.3], [1, 3, "δ0 endpoint", 1.3],
        [1, 4, "δ0 endpoint", 1.3], [2, 4, "δ0 endpoint", 1.3],
        [2, 5, "δ0 endpoint", 1.3], [0, 5, "δ0 endpoint", 1.3],
        [3, 6, "δ1 boundary", 1.15], [4, 6, "δ1 boundary", 1.15], [5, 6, "δ1 boundary", 1.15],
        [7, 8, "coboundary map δ0", 1.4], [8, 9, "coboundary map δ1", 1.1]
      ]
    }
  },
  h04: {
    title: "H04 Cellular Sheaves On Graphs",
    visual: { kind: "graph-stalks", graphStyle: "graph" },
    subtitle: "A graph sheaf gives every node and edge a stalk, then compares endpoint data through edge-specific restriction maps.",
    keywords: "cellular sheaf graph stalk edge stalk restriction incidence energy",
    modes: [["signed", "Signed edge maps"], ["scaled", "Scaled maps"], ["connection", "Connection maps"]],
    params: [["depth", "Incidence depth", 1, 10, 1, 3], ["temperature", "Map contrast", 0.25, 3.5, 0.05, 1.05], ["noise", "Edge inconsistency", 0, 1, 0.02, 0.2], ["budget", "Visible edge stalks", 1, 12, 1, 5], ["residual", "Node stalk memory", 0, 1, 0.02, 0.48]],
    metrics: ["Sheaf energy", "Map agreement", "Edge-stalk coverage", "Incidence rank"],
    profile: {
      preferredMetric: "Sheaf energy",
      formula: "δx(e) = F_{v->e}x_v - F_{u->e}x_u",
      insight: "This is a graph as a one-dimensional cell complex: endpoint stalks do not need to be equal; they need to agree after restriction into each edge stalk."
    },
    graph: {
      nodes: [
        { label: "node A", position: [-2.6, 1.1, -0.4], group: 0 },
        { label: "node B", position: [0.2, 1.4, 0.8], group: 1 },
        { label: "node C", position: [2.6, 0.65, -0.2], group: 2 },
        { label: "node D", position: [-0.5, -0.6, -1.2], group: 3 },
        { label: "edge AB", position: [-1.2, 0.15, 0.9], group: 1 },
        { label: "edge BC", position: [1.45, 0.35, 0.8], group: 1 },
        { label: "edge CD", position: [1.05, -1.1, -0.85], group: 1 },
        { label: "edge DA", position: [-1.65, -1.0, -0.95], group: 1 },
        { label: "edge BD", position: [-0.15, 0.0, -0.2], group: 2 },
        { label: "δ_F x", position: [0, -2.1, 0.7], group: 3 }
      ],
      edges: [
        [0, 4, "F_A->AB", 1.35], [1, 4, "F_B->AB", 1.1],
        [1, 5, "F_B->BC", 1.35], [2, 5, "F_C->BC", 1.1],
        [2, 6, "F_C->CD", 1.35], [3, 6, "F_D->CD", 1.1],
        [3, 7, "F_D->DA", 1.35], [0, 7, "F_A->DA", 1.1],
        [1, 8, "typed map", 1.2], [3, 8, "typed map", 1.2],
        [4, 9, "residual rod", 0.8], [5, 9, "residual rod", 0.8], [6, 9, "residual rod", 0.8], [7, 9, "residual rod", 0.8]
      ]
    }
  },
  h05: {
    title: "H05 The Sheaf Laplacian",
    initialSelected: 2,
    visual: { kind: "laplacian-matrix", graphStyle: "hidden" },
    subtitle: "The sheaf Laplacian is a residual machine: restrict local values into edge stalks, measure mismatch delta x, square it as energy, and move toward the kernel.",
    keywords: "sheaf laplacian coboundary delta transpose energy kernel diffusion",
    modes: [["assemble", "Assemble δ"], ["energy", "Dirichlet energy"], ["diffuse", "Diffuse by -Lx"]],
    params: [["depth", "Diffusion steps", 1, 14, 1, 4], ["temperature", "Map strength", 0.25, 3.5, 0.05, 1], ["noise", "Residual injection", 0, 1, 0.02, 0.12], ["budget", "Visible blocks", 1, 14, 1, 6], ["residual", "Kernel anchor", 0, 1, 0.02, 0.62]],
    metrics: ["Dirichlet energy", "Kernel proximity", "Block coverage", "Stability margin"],
    profile: {
      preferredMetric: "Dirichlet energy",
      formula: "L_F = δ^T δ, E(x)=||δx||^2",
      insight: "Comprehension-first reading: start at local values x_v, apply restriction maps F into an edge stalk, read the red mismatch as delta x, then L_F = delta^T delta turns those mismatches into energy. Kernel directions are exactly the compatible global sections."
    },
    graph: {
      nodes: [
        { label: "x node stalks", position: [-3.2, 1.2, 0], group: 0 },
        { label: "restriction maps", position: [-1.55, 0.5, 0.9], group: 1 },
        { label: "δx residuals", position: [0, 0.1, 1.35], group: 2 },
        { label: "δ^T residual", position: [1.55, 0.5, 0.9], group: 2 },
        { label: "L_F x", position: [3.2, 1.2, 0], group: 3 },
        { label: "energy bowl", position: [0, -1.15, -1.1], group: 1 },
        { label: "ker L_F", position: [-2.15, -1.9, -0.4], group: 0 },
        { label: "-L_F x flow", position: [2.15, -1.9, -0.4], group: 3 },
        { label: "edge blocks", position: [0, 1.95, -0.75], group: 2 }
      ],
      edges: [
        [0, 1, "apply endpoint maps", 1.35], [1, 2, "coboundary δ", 1.5],
        [2, 3, "transpose δ^T", 1.3], [3, 4, "Laplacian force", 1.45],
        [2, 5, "energy ||δx||^2", 1.25], [5, 6, "zero energy kernel", 0.9],
        [4, 7, "diffusion direction", 1.2], [8, 1, "block matrix", 1.0], [8, 3, "block matrix", 1.0]
      ]
    }
  },
  h06: {
    title: "H06 Sheaf Diffusion",
    visual: { kind: "diffusion-spectrum", graphStyle: "reference" },
    subtitle: "Sheaf heat flow damps incompatible components while preserving harmonic sections, with step size controlling stability.",
    keywords: "sheaf diffusion heat equation harmonic sections spectral stability",
    modes: [["heat", "Heat equation"], ["spectral", "Spectral damping"], ["stable", "Step-size stability"]],
    params: [["depth", "Time steps", 1, 16, 1, 5], ["temperature", "Spectral damping", 0.25, 3.5, 0.05, 1], ["noise", "Unstable injection", 0, 1, 0.02, 0.18], ["budget", "Visible modes", 1, 12, 1, 5], ["residual", "Harmonic preservation", 0, 1, 0.02, 0.58]],
    metrics: ["Energy decay", "Harmonic mass", "Mode coverage", "Step stability"],
    profile: {
      preferredMetric: "Energy decay",
      formula: "dx/dt = -L_F x, x_{t+1}=x_t - η L_F x_t",
      insight: "Diffusion is not just smoothing: with a sheaf Laplacian it moves signals toward compatibility under the learned restrictions while protecting harmonic components."
    },
    graph: {
      nodes: [
        { label: "initial signal", position: [-3.1, 1.1, 0.1], group: 0 },
        { label: "L_F", position: [-1.55, 0.75, 0.8], group: 1 },
        { label: "fast mode", position: [0, 1.45, 1.2], group: 2 },
        { label: "slow mode", position: [0, 0.15, 1.2], group: 2 },
        { label: "harmonic mode", position: [0, -1.1, 1.2], group: 3 },
        { label: "x(t)", position: [1.65, 0.35, 0.1], group: 0 },
        { label: "energy(t)", position: [3.15, 0.9, -0.4], group: 1 },
        { label: "stable step", position: [2.55, -1.2, -0.9], group: 3 },
        { label: "overshoot", position: [-2.35, -1.45, -0.9], group: 2 }
      ],
      edges: [
        [0, 1, "apply Laplacian", 1.4], [1, 2, "high eigenvalue", 1.2],
        [1, 3, "mid eigenvalue", 1.0], [1, 4, "zero eigenvalue", 0.85],
        [2, 5, "damps quickly", 1.25], [3, 5, "damps slowly", 1.0], [4, 5, "preserved", 1.25],
        [5, 6, "energy decreases", 1.3], [7, 5, "stable update", 1.0], [8, 5, "too-large step", 0.8]
      ]
    }
  },
  h07: {
    title: "H07 Sheaf Neural Networks",
    visual: { kind: "snn-compatibility", graphStyle: "hybrid" },
    subtitle: "A sheaf neural network learns edge restriction maps so heterophilic neighbors can become compatible before aggregation.",
    keywords: "sheaf neural network learned restriction maps heterophily compatibility message passing",
    modes: [["learn", "Learn restrictions"], ["message", "Sheaf message pass"], ["regularize", "Regularize maps"]],
    params: [["depth", "SNN layers", 1, 12, 1, 4], ["temperature", "Compatibility sharpness", 0.25, 3.5, 0.05, 1], ["noise", "Relation noise", 0, 1, 0.02, 0.24], ["budget", "Active neighbors", 1, 14, 1, 5], ["residual", "Self representation", 0, 1, 0.02, 0.52]],
    metrics: ["Compatibility gain", "Message quality", "Neighbor coverage", "Map regularity"],
    profile: {
      preferredMetric: "Compatibility gain",
      formula: "m_v = Σ_u F_{u->e}^T F_{v->e} h_u, with learned F",
      insight: "This is the SNN mechanism: edges learn how two endpoint representations should be compared before messages are trusted, so heterophily becomes structured signal."
    },
    graph: {
      nodes: [
        { label: "target v", position: [0, 1.25, 0], group: 0 },
        { label: "same-label u", position: [-2.8, 0.3, 0.4], group: 1 },
        { label: "role u", position: [2.8, 0.3, 0.4], group: 2 },
        { label: "conflict u", position: [0, -0.15, -2.6], group: 3 },
        { label: "F_v->e", position: [-1.2, -0.8, 0.9], group: 1 },
        { label: "F_u->e", position: [1.2, -0.8, 0.9], group: 1 },
        { label: "edge stalk", position: [0, -1.55, 1.75], group: 2 },
        { label: "message", position: [0, -2.25, 0.2], group: 0 },
        { label: "loss", position: [-2.3, -2.0, -1.4], group: 3 },
        { label: "map penalty", position: [2.3, -2.0, -1.4], group: 3 }
      ],
      edges: [
        [1, 4, "learn neighbor map", 1.35], [0, 4, "learn target map", 1.1],
        [2, 5, "role-compatible map", 1.4], [0, 5, "target comparison", 1.1],
        [3, 6, "noisy relation", 0.8], [4, 6, "common edge stalk", 1.25], [5, 6, "common edge stalk", 1.25],
        [6, 7, "trusted message", 1.5], [7, 0, "update h_v", 1.3], [8, 4, "supervision", 0.9], [9, 5, "regularization", 0.9]
      ]
    }
  },
  h08: {
    title: "H08 Neural Sheaf Diffusion",
    visual: { kind: "neural-diffusion", graphStyle: "hybrid" },
    subtitle: "Learned restrictions turn raw graph diffusion into relation-aware diffusion that can survive heterophily.",
    keywords: "neural sheaf diffusion learned kernels heterophily stability energy",
    modes: [["plain", "Plain diffusion"], ["learned", "Learned sheaf diffusion"], ["energy", "Energy response"]],
    params: [["depth", "Diffusion layers", 1, 16, 1, 5], ["temperature", "Kernel sharpness", 0.25, 3.5, 0.05, 1], ["noise", "Feature corruption", 0, 1, 0.02, 0.22], ["budget", "Relation channels", 1, 14, 1, 6], ["residual", "Skip connection", 0, 1, 0.02, 0.45]],
    metrics: ["Sheaf energy drop", "Label agreement", "Relation coverage", "Stability reserve"],
    profile: {
      preferredMetric: "Sheaf energy drop",
      formula: "x_{t+1}=x_t - η L_F(x,edge_attr) x_t",
      insight: "The lab compares what ordinary averaging destroys with what learned sheaf diffusion preserves: edges can translate features before smoothing them."
    },
    graph: {
      nodes: [
        { label: "raw features", position: [-3.2, 1.0, 0], group: 0 },
        { label: "plain Laplacian", position: [-1.4, 1.2, 0.9], group: 1 },
        { label: "oversmoothed state", position: [0.35, 1.0, 0], group: 2 },
        { label: "edge attributes", position: [-2.3, -0.8, -1.1], group: 3 },
        { label: "learn F_e", position: [-0.6, -0.65, 0.9], group: 1 },
        { label: "sheaf Laplacian", position: [1.25, -0.35, 0.9], group: 1 },
        { label: "role-aware state", position: [3.05, 0.2, 0], group: 0 },
        { label: "energy", position: [1.0, -2.0, -0.9], group: 2 },
        { label: "stability gate", position: [3.0, -1.6, -0.7], group: 3 }
      ],
      edges: [
        [0, 1, "ordinary smoothing", 0.9], [1, 2, "homophily bias", 0.8],
        [0, 3, "edge context", 1.1], [3, 4, "learn restrictions", 1.4],
        [4, 5, "build L_F", 1.35], [5, 6, "relation-aware diffusion", 1.5],
        [5, 7, "energy monitor", 1.2], [8, 5, "stable step", 1.0], [7, 6, "preserve label signal", 1.1]
      ]
    }
  },
  h09: {
    title: "H09 Connection Laplacian Transport",
    initialSelected: 8,
    visual: { kind: "connection-loop", graphStyle: "anchors" },
    subtitle: "Connection sheaves transport vector states between local frames; loop holonomy reveals curvature and frame inconsistency.",
    keywords: "connection laplacian parallel transport holonomy local frame curvature",
    modes: [["transport", "Parallel transport"], ["holonomy", "Loop holonomy"], ["diffuse", "Connection diffusion"]],
    params: [["depth", "Loop traversals", 1, 12, 1, 3], ["temperature", "Rotation sharpness", 0.25, 3.5, 0.05, 1], ["noise", "Frame error", 0, 1, 0.02, 0.14], ["budget", "Visible transports", 1, 12, 1, 5], ["residual", "Norm preservation", 0, 1, 0.02, 0.65]],
    metrics: ["Holonomy angle", "Transport norm", "Loop coverage", "Curvature defect"],
    profile: {
      preferredMetric: "Holonomy angle",
      formula: "R_41 R_34 R_23 R_12 v, and L_conn from orthogonal edge maps",
      insight: "Connection Laplacians are about local frames. A vector can be consistent on each edge yet return rotated after a loop; that leftover rotation is holonomy."
    },
    graph: {
      nodes: [
        { label: "frame 1", position: [-2.2, 1.25, 0], group: 0 },
        { label: "frame 2", position: [2.2, 1.25, 0], group: 0 },
        { label: "frame 3", position: [2.2, -1.25, 0], group: 0 },
        { label: "frame 4", position: [-2.2, -1.25, 0], group: 0 },
        { label: "R12", position: [0, 1.95, 0.9], group: 1 },
        { label: "R23", position: [3.05, 0, 0.9], group: 1 },
        { label: "R34", position: [0, -1.95, 0.9], group: 1 },
        { label: "R41", position: [-3.05, 0, 0.9], group: 1 },
        { label: "holonomy", position: [0, 0, 2.1], group: 2 },
        { label: "L_conn", position: [0, 0, -1.65], group: 3 }
      ],
      edges: [
        [0, 4, "transport start", 1.2], [4, 1, "rotate frame", 1.35],
        [1, 5, "transport", 1.2], [5, 2, "rotate frame", 1.35],
        [2, 6, "transport", 1.2], [6, 3, "rotate frame", 1.35],
        [3, 7, "transport", 1.2], [7, 0, "rotate frame", 1.35],
        [4, 8, "loop product", 1.0], [5, 8, "loop product", 1.0], [6, 8, "loop product", 1.0], [7, 8, "loop product", 1.0],
        [8, 9, "curvature enters L", 1.15]
      ]
    }
  },
  h10: {
    title: "H10 Sheaves And Heterophily",
    visual: { kind: "heterophily-roles", graphStyle: "hybrid" },
    subtitle: "Low homophily is not automatically noise: sheaf maps can encode role complementarity and signed relations.",
    keywords: "sheaves heterophily role complementarity signed relation compatibility",
    modes: [["homophily", "Homophily baseline"], ["roles", "Role compatibility"], ["signed", "Signed relations"]],
    params: [["depth", "Propagation rounds", 1, 12, 1, 4], ["temperature", "Compatibility threshold", 0.25, 3.5, 0.05, 1], ["noise", "Mis-specified relation", 0, 1, 0.02, 0.2], ["budget", "Relation types", 1, 14, 1, 6], ["residual", "Role identity", 0, 1, 0.02, 0.54]],
    metrics: ["Neighbor help", "Role agreement", "Relation coverage", "Raw smoothing loss"],
    profile: {
      preferredMetric: "Neighbor help",
      formula: "help(edge) = compatibility(edge type) * transformed neighbor signal",
      insight: "This lab separates heterophily from randomness. A neighbor with a different label can still be useful if the edge tells the model how to translate it."
    },
    graph: {
      nodes: [
        { label: "buyer", position: [-2.8, 1.1, 0.2], group: 0 },
        { label: "seller", position: [0, 1.45, 1.0], group: 1 },
        { label: "product", position: [2.8, 1.1, 0.2], group: 2 },
        { label: "reviewer", position: [-2.0, -0.75, -1.1], group: 3 },
        { label: "brand", position: [2.0, -0.75, -1.1], group: 2 },
        { label: "raw average", position: [-0.9, -2.0, 0.7], group: 3 },
        { label: "sheaf map", position: [0.9, -2.0, 0.7], group: 1 },
        { label: "role signal", position: [0, -2.75, -0.8], group: 0 }
      ],
      edges: [
        [0, 1, "transaction role", 1.35], [1, 2, "inventory role", 1.25],
        [2, 4, "brand relation", 1.0], [3, 2, "review relation", 0.9],
        [0, 5, "bad raw smoothing", 0.7], [1, 5, "bad raw smoothing", 0.7], [2, 5, "bad raw smoothing", 0.7],
        [0, 6, "buyer map", 1.25], [1, 6, "seller map", 1.25], [2, 6, "product map", 1.25],
        [6, 7, "compatible message", 1.45], [5, 7, "homophily failure", 0.6]
      ]
    }
  },
  h11: {
    title: "H11 Sheaf Theory And Gauge Theory",
    visual: { kind: "gauge-frames", graphStyle: "anchors" },
    subtitle: "Changing local frames should not change the physical energy; gauge transformations move coordinates while preserving structure.",
    keywords: "sheaf gauge theory local frames gauge transform invariant holonomy curvature",
    modes: [["gauge", "Gauge transform"], ["invariant", "Invariant energy"], ["curvature", "Holonomy curvature"]],
    params: [["depth", "Gauge steps", 1, 12, 1, 4], ["temperature", "Frame rotation", 0.25, 3.5, 0.05, 1], ["noise", "Gauge mismatch", 0, 1, 0.02, 0.16], ["budget", "Visible frames", 1, 12, 1, 5], ["residual", "Invariant anchor", 0, 1, 0.02, 0.62]],
    metrics: ["Gauge error", "Invariant energy", "Frame coverage", "Curvature signal"],
    profile: {
      preferredMetric: "Gauge error",
      formula: "F_{v->e} -> G_e F_{v->e} G_v^-1 while energy stays invariant",
      insight: "Gauge theory enters sheaves through coordinate choices. The same section can look different in each local frame while all restriction residuals remain physically equivalent."
    },
    graph: {
      nodes: [
        { label: "frame A", position: [-2.6, 1.2, 0], group: 0 },
        { label: "frame B", position: [0, 1.5, 1.1], group: 0 },
        { label: "frame C", position: [2.6, 1.2, 0], group: 0 },
        { label: "G_A", position: [-2.95, -0.25, 1.0], group: 1 },
        { label: "G_B", position: [0, -0.1, 1.45], group: 1 },
        { label: "G_C", position: [2.95, -0.25, 1.0], group: 1 },
        { label: "edge map", position: [-1.35, -1.35, -0.45], group: 2 },
        { label: "edge map'", position: [1.35, -1.35, -0.45], group: 2 },
        { label: "energy", position: [0, -2.35, 0.7], group: 3 },
        { label: "holonomy", position: [0, 0.15, -1.85], group: 3 }
      ],
      edges: [
        [0, 3, "choose local basis", 1.2], [1, 4, "choose local basis", 1.2], [2, 5, "choose local basis", 1.2],
        [0, 6, "old restriction", 1.25], [1, 6, "old restriction", 1.0],
        [1, 7, "transformed restriction", 1.0], [2, 7, "transformed restriction", 1.25],
        [6, 8, "same energy", 1.3], [7, 8, "same energy", 1.3],
        [6, 9, "loop product", 0.9], [7, 9, "loop product", 0.9], [9, 8, "curvature obstruction", 1.0]
      ]
    }
  },
  h12: {
    title: "H12 Applications Of Sheaf GNNs",
    visual: { kind: "application-map", graphStyle: "reference" },
    subtitle: "Different application graphs fail for different reasons; the sheaf map is the domain-specific compatibility layer.",
    keywords: "applications fraud weather molecular recommendation traffic sheaf gnn",
    modes: [["fraud", "Fraud / abuse"], ["physics", "Weather / traffic"], ["recsys", "Recommendation / molecule"]],
    params: [["depth", "Design passes", 1, 12, 1, 4], ["temperature", "Domain-map sharpness", 0.25, 3.5, 0.05, 1], ["noise", "Domain mismatch", 0, 1, 0.02, 0.2], ["budget", "Active domains", 1, 12, 1, 5], ["residual", "Plain-GNN baseline", 0, 1, 0.02, 0.42]],
    metrics: ["Domain fit", "Disagreement explained", "Application coverage", "Baseline failure gap"],
    profile: {
      preferredMetric: "Domain fit",
      formula: "domain graph + edge semantics -> sheaf maps -> task loss",
      insight: "This lab is a model-design map: each application needs a different comparison rule, and the sheaf layer is where that rule becomes computation."
    },
    graph: {
      nodes: [
        { label: "fraud", position: [-3.1, 1.25, 0.3], group: 0 },
        { label: "recommender", position: [-1.15, 1.45, 1.2], group: 1 },
        { label: "weather mesh", position: [1.15, 1.45, 1.2], group: 2 },
        { label: "traffic", position: [3.1, 1.25, 0.3], group: 3 },
        { label: "molecule", position: [0, 0.15, -1.7], group: 2 },
        { label: "plain smoothing", position: [-1.7, -1.45, -0.4], group: 3 },
        { label: "sheaf map", position: [1.7, -1.45, -0.4], group: 1 },
        { label: "task signal", position: [0, -2.45, 0.8], group: 0 }
      ],
      edges: [
        [0, 5, "anomaly washed out", 0.7], [1, 5, "bipartite averaging fails", 0.75],
        [2, 5, "vector field mismatch", 0.75], [3, 5, "direction ignored", 0.75], [4, 5, "geometry ignored", 0.75],
        [0, 6, "fraud relation map", 1.3], [1, 6, "user-item role map", 1.25], [2, 6, "local frame map", 1.35], [3, 6, "flow direction map", 1.25], [4, 6, "bond geometry map", 1.25],
        [6, 7, "domain-aware task signal", 1.45], [5, 7, "baseline gap", 0.65]
      ]
    }
  },
  h13: {
    title: "H13 Directed Sheaves And Hypergraphs",
    visual: { kind: "directed-hypergraph", graphStyle: "anchors" },
    subtitle: "Directed edges and hyperedges need asymmetric or group-level stalks; pairwise undirected expansion loses information.",
    keywords: "directed sheaf hypergraph asymmetric restriction hyperedge group stalk",
    modes: [["directed", "Directed edge sheaf"], ["hyperedge", "Hyperedge stalk"], ["project", "Projection coherence"]],
    params: [["depth", "Propagation order", 1, 12, 1, 4], ["temperature", "Projection sharpness", 0.25, 3.5, 0.05, 1], ["noise", "Direction error", 0, 1, 0.02, 0.2], ["budget", "Active incidences", 1, 14, 1, 6], ["residual", "Node contribution", 0, 1, 0.02, 0.5]],
    metrics: ["Asymmetry signal", "Hyperedge coherence", "Incidence coverage", "Projection defect"],
    profile: {
      preferredMetric: "Asymmetry signal",
      formula: "node stalks -> directed edge stalk or group hyperedge stalk",
      insight: "The scene separates two extensions: directed sheaves use asymmetric maps, while hypergraph sheaves compare many nodes through one shared group stalk."
    },
    graph: {
      nodes: [
        { label: "source", position: [-3.0, 1.15, 0], group: 0 },
        { label: "target", position: [-0.85, 1.15, 0.9], group: 1 },
        { label: "reverse map", position: [-1.95, -0.25, 1.55], group: 3 },
        { label: "directed edge", position: [-1.95, -1.25, 0], group: 2 },
        { label: "member A", position: [1.0, 1.45, 0.5], group: 0 },
        { label: "member B", position: [2.65, 0.95, -0.1], group: 1 },
        { label: "member C", position: [1.65, -0.2, -1.2], group: 2 },
        { label: "hyperedge stalk", position: [2.35, -1.55, 0.85], group: 3 },
        { label: "coherence", position: [0, -2.45, -0.2], group: 2 }
      ],
      edges: [
        [0, 3, "forward restriction", 1.45], [1, 3, "target projection", 1.0],
        [1, 2, "reverse is different", 0.85], [2, 0, "asymmetric return", 0.75],
        [4, 7, "member projection", 1.25], [5, 7, "member projection", 1.25], [6, 7, "member projection", 1.25],
        [7, 8, "group coherence", 1.4], [3, 8, "directed coherence", 1.1]
      ]
    }
  },
  h14: {
    title: "H14 Sheaves And Persistent Topology",
    visual: { kind: "persistence-filtration", graphStyle: "anchors" },
    subtitle: "A filtration grows cells over scale; sheaf coefficients reveal disagreement ordinary persistence cannot see.",
    keywords: "persistent topology filtration sheaf cohomology point cloud defect heat",
    modes: [["filtration", "Grow filtration"], ["ordinary", "Ordinary persistence"], ["sheaf", "Sheaf persistence"]],
    params: [["depth", "Filtration radius", 1, 16, 1, 5], ["temperature", "Birth/death sharpness", 0.25, 3.5, 0.05, 1], ["noise", "Coefficient defect", 0, 1, 0.02, 0.18], ["budget", "Active cells", 1, 16, 1, 7], ["residual", "Cohomology memory", 0, 1, 0.02, 0.55]],
    metrics: ["Persistent defect", "Cycle strength", "Cell coverage", "Sheaf barcode gap"],
    profile: {
      preferredMetric: "Persistent defect",
      formula: "filtration K_r with sheaf cohomology H^*(K_r; F_r)",
      insight: "Ordinary persistence tracks holes. Persistent sheaf topology also tracks whether data attached to the growing cells stays compatible across the filtration."
    },
    graph: {
      nodes: [
        { label: "p1", position: [-2.8, 1.25, 0.2], group: 0 },
        { label: "p2", position: [-0.8, 1.65, 0.9], group: 0 },
        { label: "p3", position: [1.35, 1.25, 0.2], group: 0 },
        { label: "p4", position: [2.75, -0.2, -0.7], group: 0 },
        { label: "edge birth", position: [-1.75, 0.0, 1.25], group: 1 },
        { label: "cycle", position: [0.2, 0.0, 1.65], group: 2 },
        { label: "triangle fill", position: [1.55, -1.1, 0.9], group: 2 },
        { label: "sheaf defect", position: [-0.85, -1.35, -1.05], group: 3 },
        { label: "barcode", position: [1.45, -2.25, -0.35], group: 1 }
      ],
      edges: [
        [0, 4, "filtration edge", 1.2], [1, 4, "filtration edge", 1.2],
        [1, 5, "cycle edge", 1.25], [2, 5, "cycle edge", 1.25], [0, 5, "cycle edge", 0.95],
        [2, 6, "face appears", 1.25], [3, 6, "face appears", 0.9], [5, 6, "fills cycle", 1.1],
        [4, 7, "coefficient mismatch", 1.15], [5, 7, "coefficient mismatch", 1.15],
        [7, 8, "sheaf barcode", 1.4], [6, 8, "ordinary barcode", 0.9]
      ]
    }
  },
  h15: {
    title: "H15 Research Frontier In Sheaf GNNs",
    initialSelected: 8,
    visual: { kind: "research-roadmap", graphStyle: "reference" },
    subtitle: "The frontier is not one trick: dynamic sheaves, topology learning, gauge constraints, hypergraphs, multimodal maps, and scaling are coupled design problems.",
    keywords: "research frontier dynamic sheaves topology learning gauge hypergraph multimodal scalability",
    modes: [["dynamic", "Dynamic sheaves"], ["structure", "Learn topology"], ["systems", "Scale systems"]],
    params: [["depth", "Research horizon", 1, 12, 1, 4], ["temperature", "Constraint sharpness", 0.25, 3.5, 0.05, 1], ["noise", "Open-problem uncertainty", 0, 1, 0.02, 0.24], ["budget", "Active directions", 1, 14, 1, 6], ["residual", "Known theory anchor", 0, 1, 0.02, 0.5]],
    metrics: ["Open-problem pressure", "Theory anchor", "Direction coverage", "Systems risk"],
    profile: {
      preferredMetric: "Open-problem pressure",
      formula: "learn F, learn topology, preserve gauge/constraints, scale computation",
      insight: "This frontier map shows why research directions interact: changing topology changes the sheaf, gauge constraints restrict learnable maps, and scale changes which models are feasible."
    },
    graph: {
      nodes: [
        { label: "dynamic F(t)", position: [-3.1, 1.35, 0.2], group: 0 },
        { label: "learn topology", position: [-1.25, 1.7, 1.15], group: 1 },
        { label: "gauge constraints", position: [1.25, 1.7, 1.15], group: 2 },
        { label: "hypergraph sheaves", position: [3.1, 1.35, 0.2], group: 3 },
        { label: "multimodal stalks", position: [-2.2, -0.35, -1.2], group: 1 },
        { label: "scalable solvers", position: [2.2, -0.35, -1.2], group: 2 },
        { label: "benchmarks", position: [-1.3, -2.0, 0.45], group: 0 },
        { label: "theory gap", position: [1.3, -2.0, 0.45], group: 3 },
        { label: "usable SNN", position: [0, -2.75, -0.75], group: 0 }
      ],
      edges: [
        [0, 1, "time changes topology", 1.1], [1, 2, "constraints on learned maps", 1.25],
        [2, 3, "higher-order symmetry", 1.1], [3, 4, "group-level data", 0.95],
        [4, 5, "large stalk cost", 1.25], [5, 8, "systems feasibility", 1.35],
        [0, 8, "dynamic deployment", 1.05], [1, 8, "topology update", 1.05],
        [2, 8, "constraint layer", 1.05], [3, 8, "higher-order relation", 1.05], [4, 8, "multimodal interface", 1.05],
        [0, 6, "temporal benchmark", 0.9], [1, 6, "structure benchmark", 0.9],
        [2, 7, "proof obligations", 1.25], [3, 7, "expressivity gap", 1.0],
        [6, 8, "empirical validation", 1.2], [7, 8, "theoretical validation", 1.2]
      ]
    }
  }
};

function esc(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function js(value) {
  return JSON.stringify(value);
}

function titleCase(text) {
  return text
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.length <= 3 && /^[a-z]+$/.test(word) ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

function labId(file) {
  const match = file.match(/^([a-z]\d{2})/i);
  if (!match) throw new Error(`Cannot infer lab id for ${file}`);
  return match[1].toLowerCase();
}

function renderLab(file) {
  const id = labId(file);
  const block = id[0];
  const family = FAMILY[block];
  const blueprint = LAB_BLUEPRINTS[id] || {};
  if (!family) throw new Error(`No family for ${file}`);
  const slug = file.replace(/\.html$/i, "").replace(new RegExp(`^${id}-?`, "i"), "");
  const title = blueprint.title || `${id.toUpperCase()} ${titleCase(slug.replace(/-lab$/i, ""))}`;
  const subtitle = blueprint.subtitle || family.subtitle;
  const keywords = blueprint.keywords || `${family.kind} ${slug.replace(/-/g, " ")}`;
  const modes = blueprint.modes || family.modes;
  const params = blueprint.params || family.params;
  const metricList = blueprint.metrics || family.metrics;
  const modeOptions = modes.map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join("\n            ");
  const rangeControls = params.map(([key, label, min, max, step, value]) => `
        <div class="command-control">
          <label for="${id}-${key}">${esc(label)} <output data-output="${esc(key)}">${esc(value)}</output></label>
          <input id="${id}-${key}" data-param="${esc(key)}" type="range" min="${min}" max="${max}" step="${step}" value="${value}">
        </div>`).join("");
  const metrics = metricList.map((label) => `
        <div class="metric" data-role="metric" data-metric="${esc(label)}">
          <span>${esc(label)}</span>
          <strong>0.00</strong>
        </div>`).join("");
  const config = {
    id,
    kind: family.kind,
    title,
    modes: modes.map(([value, label]) => ({ value, label })),
    parameters: params.map(([key, label, min, max, step, value]) => ({ key, label, min, max, step, value })),
    metrics: metricList,
    initialSelected: blueprint.initialSelected,
    visual: blueprint.visual,
    profile: blueprint.profile,
    graph: blueprint.graph
  };
  const alias = `__${id}LabSnapshot`;
  const ready = `__${id}LabReady`;
  const cacheKeys = {
    a01: "a01-linear-intuitive-v12",
    a02: "a02-linear-map-v1",
    a03: "a03-taylor-surface-v1",
    a04: "a04-measure-convergence-v1",
    a05: "a05-functional-operator-v1",
    a06: "a06-topology-space-v1",
    a07: "a07-differential-manifold-v1",
    a08: "a08-abstract-algebra-v1",
    a09: "a09-category-diagram-v1",
    a10: "a10-advanced-category-v1",
    a11: "a11-information-theory-v1",
    a12: "a12-algebraic-topology-v1",
    a13: "a13-differential-equations-v1",
    a14: "a14-complex-analysis-v1",
    a15: "a15-numerical-methods-v1",
    b01: "b01-probability-space-v1",
    b02: "b02-joint-distribution-v1",
    b03: "b03-estimation-likelihood-v1",
    b04: "b04-hypothesis-testing-v1",
    b05: "b05-bayesian-updating-v1",
    b06: "b06-stochastic-process-v1",
    b07: "b07-stochastic-calculus-v1",
    b08: "b08-information-geometry-v1",
    b09: "b09-nonparametric-statistics-v1",
    b10: "b10-causal-inference-v1",
    c01: "c01-convex-analysis-premium-v3",
    c02: "c02-unconstrained-optimization-premium-v3",
    c03: "c03-constrained-optimization-premium-v2",
    c04: "c04-stochastic-optimization-premium-v2",
    c05: "c05-calculus-variations-premium-v2",
    c06: "c06-optimal-control-premium-v2",
    c07: "c07-duality-theory-premium-v4",
    c08: "c08-proximal-methods-premium-v4",
    c09: "c09-nonconvex-optimization-premium-v2",
    c10: "c10-optimal-transport-premium-v2"
  };
  const cacheKey = cacheKeys[id] || "h05-intuitive-v11";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <link rel="stylesheet" href="shared/gnn-lab-core.css?math3d=${cacheKey}">
</head>
<body>
  <main class="gnn-lab math-3d-lab lab-shell lab-3d-shell" data-lab-kind="${esc(family.kind)}" data-lab-id="${esc(id)}" data-keywords="${esc(keywords)}">
    <section class="visual-stack" aria-label="Interactive 3D mathematical visualization">
      <div class="stage">
        <div class="lab-viewport" title="Drag to orbit / rotate. Use the wheel to zoom. Click objects to inspect.">
          <canvas id="canvas" aria-label="${esc(title)} 3D interactive visualization"></canvas>
        </div>
        <div class="scene-overlay">
          <div class="scene-badge"><span>Live concept</span><strong>${esc(id.toUpperCase())}</strong></div>
          <div class="formula-chip"><span>Model sketch</span>${esc(subtitle)}</div>
        </div>
        <div class="selected-chip" data-role="selected"><span>Selected object</span><strong>Click a node to inspect local structure.</strong></div>
      </div>
      <div class="command-bar controls" aria-label="Horizontal command bar under the 3D visualization">
        <select data-control="mode" aria-label="Concept mode">
            ${modeOptions}
        </select>${rangeControls}
        <button class="primary" data-action="pulse" type="button">Pulse</button>
        <button data-action="step" type="button">Step</button>
        <button data-action="reset" type="button">Reset</button>
      </div>
    </section>
    <aside class="side-panel lab-3d-panel">
      <header>
        <p class="eyebrow">${esc(family.block)} 3D lab</p>
        <h1>${esc(title)}</h1>
        <p class="subtitle">Orbit / rotate / zoom the system, select objects, then change parameters to experiment with ${esc(keywords)}.</p>
      </header>
      <div class="metric-grid">${metrics}
      </div>
      <div class="insight-card">
        <h2>What to watch</h2>
        <p data-role="insight">Loading the 3D mathematical system.</p>
        <p id="stateBox" class="state-box">Waiting for the first render.</p>
      </div>
      <p class="hint">Command bar controls are live: every slider changes geometry, active channels, metrics, or selected-object state. Blue/cyan shows signal, amber shows frontier, red shows perturbation.</p>
    </aside>
  </main>
  <script src="shared/three.min.js"></script>
  <script src="shared/gnn-lab-core.js?math3d=${cacheKey}"></script>
  <script>
    const labState = createGnnLab(${js(config)});
    window.${alias} = () => window.__gLabSnapshot();
    Object.defineProperty(window, "${ready}", { get: () => window.__gLabReady === true });
  </script>
</body>
</html>
`;
}

const targets = fs
  .readdirSync(root)
  .filter((file) => /^[abcdefhi]\d{2}.*\.html$/i.test(file))
  .filter((file) => {
    const id = file.match(/^([a-z]\d{2})/i)[1].toLowerCase();
    return requestedArgs.length === 0 || requestedIds.has(id) || requestedBlocks.has(id[0]);
  })
  .sort();

for (const arg of requestedArgs) {
  if (/^[a-z]$/.test(arg) && !FAMILY[arg]) throw new Error(`Unknown or unsupported block "${arg}". Supported blocks: ${Object.keys(FAMILY).join(", ")}`);
  if (!/^[a-z]$/.test(arg) && !/^[a-z]\d{2}$/.test(arg)) throw new Error(`Unsupported target "${arg}". Use a block letter or exact lab id such as a01.`);
}

for (const id of requestedIds) {
  if (!targets.some((file) => file.toLowerCase().startsWith(id))) throw new Error(`No generated lab file found for "${id}".`);
}

for (const file of targets) {
  fs.writeFileSync(path.join(root, file), renderLab(file), "utf8");
  console.log(`wrote ${file}`);
}

const targetLabel = requestedArgs.length ? ` for target(s) ${requestedArgs.join(",").toUpperCase()}` : "";
console.log(`Built ${targets.length} non-G 3D labs${targetLabel}.`);
