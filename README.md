# FUDI — Math, made clearer

FUDI is a browser based math learning space for calculus foundations, multivariable calculus, and linear algebra. This first web release includes short lessons, generated practice, a drawable notebook, and local progress tracking.

## Use the app

Open `index.html` in a modern browser. No build step or account is required. Practice questions are generated reproducibly from authored math rules using a sequence saved in this browser; answer checks, hints, and worked solutions run in the browser. Spoken explanations use the browser's speech playback when available.

Notebook pages and practice progress are stored locally in the current browser. There is no account, cloud sync, notebook transfer, handwriting recognition, or AI feedback in the web release. The later Mac notebook will keep its data separate.

## Notebook

Create and rename pages, draw with a mouse, stylus, or finger, choose pen/highlighter/eraser and ink color, undo or redo strokes, then export the current page as PNG or all pages as a PDF.

## Publish with GitHub Pages

1. In the repository, open **Settings → Pages**.
2. Under **Build and deployment**, choose **Deploy from a branch**.
3. Select the `codex/fudi-web-v1` branch and the `/(root)` folder, then save.
4. GitHub Pages will publish the app at `https://hsbdcy67jr-prog.github.io/FUDI-DC/` after its first deployment completes.

The repository and published site are public. Notebook pages and practice history remain in each learner's browser.

## Later phases

The next planned phase is packaging the shared experience as a Mac app and `.dmg`. On-device AI feedback for notebook work is a separate later investigation; web v1 does not send notebook pages anywhere.
