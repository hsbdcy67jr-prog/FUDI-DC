# FUDI-DC — Math, made clearer

FUDI-DC brings a math question and a drawable working page into one learning workspace. The public web front end includes short lessons, deterministic practice, answer checks, hints, worked solutions, browser speech, a multi-page notebook, and progress saved on the device.

The curated bank covers foundations, algebra, geometry, trigonometry, precalculus, limits, derivatives, integrals, multivariable calculus, linear algebra, probability and statistics, discrete mathematics, and differential equations. Each area has easy, medium, and challenge question generators.

## Use the web app

Open `index.html` in a modern browser. No account or build step is required. Practice pages are linked to their questions and autosaved in that browser. A separate general notebook is available for notes that are not tied to a problem. Use pen, highlighter, eraser, undo/redo, page tabs, and PNG/PDF export. Notebook data uses browser storage; progress uses local storage.

## Live questions and feedback

Randomized WeBWorK Open Problem Library questions are enabled when the Cloud Run API and renderer are deployed and `FUDI_API_BASE` is set in `api-config.js`. If the service is absent, the curated bank continues to work. Live answers are submitted to the WeBWorK renderer through a no-store proxy, and the UI credits the selected source under the OPL's CC BY-NC-SA 3.0 terms. Keep the public project noncommercial while including OPL content.

Web AI feedback is disabled by default. The optional Gemini route requires paid-tier credentials, a configured request cap and spend limit, and a fresh learner confirmation for every upload. The FUDI-DC API does not persist notebook images, answer submissions, or feedback responses. Cloud Run platform logs may retain ordinary request metadata; application code does not log request bodies. Follow [Google's API-key guidance](https://ai.google.dev/gemini-api/docs/api-key) and use only author-created sample pages during evaluation.

## Apple Silicon Mac app

The Mac app bundles the same workspace in a native WebKit shell and stores notebook/progress data separately in the app's local WebKit store. The first local AI review downloads a quantized Qwen3-VL model; later reviews run on-device through MLX. Feedback notes remain separate from learner ink and can be edited, moved, deleted, undone, or redone. Local feedback is experimental and must be checked by the learner. Intel Macs are out of scope.

Build the Apple Silicon app and disk image with `./macos/package-dmg.sh`. GitHub Actions builds and uploads the `.dmg` as a workflow artifact. The current package is ad-hoc signed and not notarized; see [macOS/README](macos/README.md) for build and installation details.

## Deploy the live service

The renderer and small API run as separate, public Cloud Run services with request-based billing, scale-to-zero, and maximum instance counts. The API is capped at one instance; cloud AI remains disabled by the deployment script. Configure billing budget alerts before enabling any paid feedback provider, then run [api/deploy.sh](api/deploy.sh). Deployment requires an authenticated Google Cloud project, Docker, and Artifact Registry access. After deploying, set `window.FUDI_API_BASE` in `api-config.js` to the printed API origin.

The live public front end is [FUDI-DC on GitHub Pages](https://hsbdcy67jr-prog.github.io/FUDI-DC/). GitHub Pages is publishing the updated web app from the existing `codex/fudi-web-v1` source branch. The same changes are under review in [pull request #1](https://github.com/hsbdcy67jr-prog/FUDI-DC/pull/1). Curated practice works without the Cloud Run services; live OPL questions remain unavailable until those services are deployed.

## Privacy and licenses

There are no accounts, cloud sync, or transfer features. Web and Mac notebook/progress stores are separate. External live-answer checks go to the renderer. Notebook snapshots go to a cloud provider only after a per-request upload choice and only when the paid service is configured. The WeBWorK OPL notice and selected problem references are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Copy-ready launch and Projects-section drafts are in [LINKEDIN.md](LINKEDIN.md). They are drafts only.
