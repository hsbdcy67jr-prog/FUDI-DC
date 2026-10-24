# Third-party notices

## WeBWorK Open Problem Library

Selected live questions are served from the [WeBWorK Open Problem Library](https://github.com/openwebwork/webwork-open-problem-library). The OPL states that most contributed problems are licensed under [Creative Commons Attribution-NonCommercial-ShareAlike 3.0](https://github.com/openwebwork/webwork-open-problem-library/blob/main/OPL_LICENSE). Each live question links to its individual source file and identifies the license. FUDI-DC must remain noncommercial while it includes OPL questions unless the relevant rights holders grant additional permission.

The API manifest currently draws from these OPL topic collections:

- Algebra and foundations: Mizzou and SVSU College Algebra.
- Geometry: Mount Allison and PCC.
- Trigonometry and precalculus: CUNY City Tech.
- Limits and derivatives: UBC.
- Integrals: METU-NCC and University of Calgary.
- Multivariable calculus: Hope and Fort Lewis.
- Linear algebra: Mount Allison.
- Probability/statistics: METU-NCC and PCC.
- Discrete mathematics: Mizzou and University of Galway.
- Differential equations: California State University, Northridge.

The manifest and each source's author/license metadata should be checked when adding or updating live questions. Curated FUDI-DC questions are independently authored in `catalog.js` and `app.js`.

## WeBWorK PG Renderer

Live problem rendering uses the [WeBWorK PG Renderer](https://github.com/openwebwork/renderer), distributed under GPL-3.0. It runs as a separate Cloud Run service; this repository's API calls its documented `/render-api` endpoint.

## MLX Swift

The Mac application uses [MLX Swift LM](https://github.com/ml-explore/mlx-swift-lm) and its companion Hugging Face Swift packages. MLX Swift LM is MIT-licensed. Review package notices before redistributing a compiled application.

## Qwen3-VL model weights

On first local AI use, the Mac app downloads the quantized `lmstudio-community/Qwen3-VL-4B-Instruct-MLX-4bit` model from Hugging Face. Model files are not embedded in the disk image. Check the selected model repository's current license and attribution before redistributing weights or changing the model source.

## Gemini API

The optional web feedback route uses Gemini only when an operator configures paid credentials and limits and the learner approves that request. FUDI-DC never puts the API key in browser code. Review current provider terms and pricing before enabling the service.
