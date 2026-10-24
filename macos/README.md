# FUDI-DC for Mac

The native Mac wrapper keeps the same learning workspace bundled locally and stores notebook pages and progress in the app's own WebKit data store. Those pages are separate from a browser's FUDI-DC data. There is no account, sync, or transfer feature.

The first local feedback request downloads the 4-bit `lmstudio-community/Qwen3-VL-4B-Instruct-MLX-4bit` model. After the download completes, inference runs through MLX on Apple Silicon and the notebook image is deleted from the app's temporary folder after each request. The model is never bundled in the `.dmg`. Feedback notes are experimental, remain separate from learner ink, and can be edited, moved, removed, undone, or redone in the notebook.

## Build a disk image

On an Apple Silicon Mac with Xcode 16 or newer and the Swift command-line tools installed:

```sh
./macos/package-dmg.sh
```

This creates `dist/FUDI-DC.dmg`. The included GitHub Actions workflow builds the disk image on an Apple Silicon macOS runner and uploads it as a workflow artifact. It is currently ad-hoc signed and not notarized; a Developer ID certificate and notarization credentials are needed for a frictionless public installer.

## Local model

Qwen3-VL weights are downloaded from Hugging Face on first use and cached by the Hugging Face downloader. The Mac app does not call the cloud feedback endpoint; web requests use Gemini only after the learner approves the one-time upload and the service is deliberately configured for paid billing.
