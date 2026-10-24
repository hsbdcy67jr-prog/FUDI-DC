# FUDI-DC Cloud Run services

This deploys two public, scale-to-zero services: the WeBWorK renderer (with the Open Problem Library image) and the small FUDI-DC API. Set an active Google Cloud project, `GOOGLE_CLOUD_BILLING_ACCOUNT`, and an amount such as `FUDI_MONTHLY_BUDGET_AMOUNT=25USD`, install `gcloud`, Docker, and Git, then run `./deploy.sh` from this directory. The script creates monthly budget alerts at 50%, 90%, and 100% actual spend and 90% forecasted spend when it cannot find an existing FUDI-DC budget. Budget alerts notify account administrators; they do not stop billing. The API is capped at one instance so its optional in-memory cloud feedback request cap is not multiplied across instances. Renderer capacity is capped at two instances.

The API serves `/healthz`, `/api/live/catalog`, `/api/live/question`, and a no-store `/render-api` proxy. The renderer receives live answers; the FUDI-DC API never writes answer bodies, notebook images, or AI responses to disk or logs. Cloud Run may keep request metadata such as method, path, latency, and status in platform logs; request bodies are not logged by this code.

Cloud feedback is disabled by default. The deploy script explicitly disables it. To enable it, configure a paid Gemini API key in Secret Manager, confirm that billing is on the paid tier, choose a request limit and spend ceiling, and set `FUDI_CLOUD_AI_ENABLED=true`, `GEMINI_BILLING_TIER=paid`, `GEMINI_API_KEY` from Secret Manager, `FUDI_CLOUD_AI_MONTHLY_REQUEST_CAP` to a positive integer, and `FUDI_CLOUD_AI_SPEND_CAP_USD` to a positive value. The service enforces the monthly request ceiling in memory with one API instance; this request limit and the Google Cloud budget alerts are operational guards, not a billing provider's hard dollar cap. Any request also requires a fresh consent field from the learner.

Before release, create Google Cloud Billing budget alerts for the project and test against author-created sample pages only. Do not upload real notebook pages during evaluation. Configure the front end's `FUDI_API_BASE` to the deployed API URL after deployment.

## Local API

```sh
cd api
FUDI_RENDERER_ORIGIN=http://localhost:3000 PORT=8080 npm start
```
