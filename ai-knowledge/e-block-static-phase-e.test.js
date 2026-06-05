const fs = require("fs");
const path = require("path");

const root = __dirname;

const labs = [
  ["E01- Neural Network Foundations.md", "e01-mlp-decision-regions.html", "__e01LabReady", "__e01LabSnapshot"],
  ["E02- Backpropagation and Automatic Differentiation.md", "e02-backprop-computational-graph.html", "__e02LabReady", "__e02LabSnapshot"],
  ["E03- Convolutional Neural Networks (CNNs).md", "e03-convolution-kernel-lab.html", "__e03LabReady", "__e03LabSnapshot"],
  ["E04- Recurrent Neural Networks (RNNs).md", "e04-rnn-hidden-state-lab.html", "__e04LabReady", "__e04LabSnapshot"],
  ["E05- Attention Mechanisms and Transformers.md", "e05-attention-flow.html", "__e05LabReady", "__e05LabSnapshot"],
  ["E06- Large Language Models (LLMs).md", "e06-llm-token-prediction.html", "__e06LabReady", "__e06LabSnapshot"],
  ["E07- Variational Autoencoders (VAEs).md", "e07-vae-latent-space-lab.html", "__e07LabReady", "__e07LabSnapshot"],
  ["E08- Generative Adversarial Networks (GANs).md", "e08-gan-minimax-game.html", "__e08LabReady", "__e08LabSnapshot"],
  ["E09- Diffusion Models.md", "e09-diffusion-denoising.html", "__e09LabReady", "__e09LabSnapshot"],
  ["E10- Normalizing Flows.md", "e10-normalizing-flow-density.html", "__e10LabReady", "__e10LabSnapshot"],
  ["E11- Reinforcement Learning Foundations.md", "e11-gridworld-bellman-lab.html", "__e11LabReady", "__e11LabSnapshot"],
  ["E12- Deep Reinforcement Learning.md", "e12-dqn-target-update-lab.html", "__e12LabReady", "__e12LabSnapshot"],
  ["E13- Meta-Learning.md", "e13-meta-learning-inner-loop.html", "__e13LabReady", "__e13LabSnapshot"],
  ["E14- Self-Supervised Learning.md", "e14-contrastive-representation-lab.html", "__e14LabReady", "__e14LabSnapshot"],
  ["E15- Neural ODEs.md", "e15-neural-ode-flow.html", "__e15LabReady", "__e15LabSnapshot"],
  ["E16- Energy-Based Models.md", "e16-energy-langevin-lab.html", "__e16LabReady", "__e16LabSnapshot"],
  ["E17- State Space Models (SSMs).md", "e17-ssm-scan.html", "__e17LabReady", "__e17LabSnapshot"],
  ["E18- Physics-Informed Neural Networks (PINNs).md", "e18-pinn-residual-lab.html", "__e18LabReady", "__e18LabSnapshot"]
];

function mustMatch(text, pattern, message) {
  if (!pattern.test(text)) {
    throw new Error(message);
  }
}

for (const [noteName, labName, readyHook, snapshotHook] of labs) {
  const labPath = path.join(root, labName);
  const notePath = path.join(root, "..", noteName);
  const lab = fs.readFileSync(labPath, "utf8");
  const note = fs.readFileSync(notePath, "utf8");
  const prefix = labName.replace(/\.html$/, "");

  mustMatch(lab, /lab-shell\s+lab-3d-shell/, `${prefix}: missing dark Phase E 3D shell.`);
  mustMatch(lab, /class="[^"]*lab-viewport[^"]*"/, `${prefix}: missing lab viewport.`);
  mustMatch(lab, /<canvas[^>]+id="canvas"/, `${prefix}: missing canonical canvas#canvas.`);
  mustMatch(lab, new RegExp(`${readyHook}\\s*=\\s*true`), `${prefix}: missing ready hook ${readyHook}.`);
  mustMatch(lab, new RegExp(snapshotHook), `${prefix}: missing snapshot hook ${snapshotHook}.`);
  mustMatch(lab, /cameraTheta|orbit/i, `${prefix}: missing orbitable 3D camera state.`);
  mustMatch(lab, /state-box|id="state"/, `${prefix}: missing explanatory state text.`);
  mustMatch(lab, /<button|<select|<input/i, `${prefix}: missing useful controls.`);

  const iframeMatch = note.match(new RegExp(`<iframe[^>]+src="([^"]+${labName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})"[^>]*>`, "i"));
  if (!iframeMatch) {
    throw new Error(`${noteName}: missing iframe for ${labName}.`);
  }
  if (iframeMatch[1] !== `http://127.0.0.1:8765/${labName}`) {
    throw new Error(`${noteName}: iframe must use local-server URL for ${labName}, found ${iframeMatch[1]}.`);
  }
  mustMatch(iframeMatch[0], /height="720"/i, `${noteName}: iframe must use 720px height.`);
  mustMatch(iframeMatch[0], /background:#071015/i, `${noteName}: iframe must declare dark document-pane background.`);
}

console.log(`E-block static Phase E checks passed for ${labs.length} labs.`);
