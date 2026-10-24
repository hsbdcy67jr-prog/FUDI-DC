import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { randomInt } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 8080);
const rendererOrigin = normalizeOrigin(process.env.FUDI_RENDERER_ORIGIN || "");
const appOrigins = new Set([
  "https://hsbdcy67jr-prog.github.io",
  "http://localhost:4173",
  "http://localhost:8080",
  ...(process.env.FUDI_EXTRA_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean),
]);
const maxBodyBytes = 3 * 1024 * 1024;
const maxRendererBodyBytes = 256 * 1024;
const monthlyCap = Number(process.env.FUDI_CLOUD_AI_MONTHLY_REQUEST_CAP || 0);
const spendCapUsd = Number(process.env.FUDI_CLOUD_AI_SPEND_CAP_USD || 0);
const cloudAIEnabled = process.env.FUDI_CLOUD_AI_ENABLED === "true"
  && process.env.GEMINI_BILLING_TIER === "paid"
  && Boolean(process.env.GEMINI_API_KEY)
  && Number.isInteger(monthlyCap) && monthlyCap > 0
  && Number.isFinite(spendCapUsd) && spendCapUsd > 0;

const liveCatalog = JSON.parse(await readFile(resolve(here, "live-catalog.json"), "utf8"));
const rateBuckets = new Map();
let usageMonth = new Date().toISOString().slice(0, 7);
let monthlyAIRequests = 0;

function normalizeOrigin(value) {
  if (!value) return "";
  try {
    const url = new URL(value);
    if (!(["https:", "http:"].includes(url.protocol))) return "";
    if (url.protocol === "http:" && !["localhost", "127.0.0.1"].includes(url.hostname)) return "";
    return url.origin;
  } catch { return ""; }
}

function corsHeaders(req) {
  const origin = req.headers.origin || "";
  if (!appOrigins.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Accept",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

function send(res, status, payload, headers = {}) {
  const body = typeof payload === "string" ? payload : JSON.stringify(payload);
  res.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": typeof payload === "string" ? "text/plain; charset=utf-8" : "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  res.end(body);
}

function readBody(req, limit = maxBodyBytes) {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    const chunks = [];
    let oversized = false;
    let settled = false;
    req.on("data", chunk => {
      if (oversized) return;
      size += chunk.length;
      if (size > limit) {
        oversized = true;
        settled = true;
        reject(Object.assign(new Error("Request body is too large."), { status: 413 }));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => { if (!settled) resolveBody(Buffer.concat(chunks)); });
    req.on("error", error => { if (!settled) reject(error); });
  });
}

function takeRateLimit(key, limit, windowMs) {
  const now = Date.now();
  if (rateBuckets.size > 2_000) {
    for (const [candidate, bucket] of rateBuckets) if (bucket.until <= now) rateBuckets.delete(candidate);
  }
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.until <= now) {
    rateBuckets.set(key, { count: 1, until: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

function publicURL(req) {
  if (process.env.FUDI_PUBLIC_API_URL) return normalizeOrigin(process.env.FUDI_PUBLIC_API_URL);
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (!host || !/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) return "";
  const protocol = req.headers["x-forwarded-proto"] === "http" ? "http" : "https";
  return protocol + "://" + host;
}

async function handleLiveQuestion(req, res, url, headers) {
  if (!rendererOrigin) return send(res, 503, { error: "Live questions are not configured." }, headers);
  const topic = url.searchParams.get("topic") || "";
  const difficulty = url.searchParams.get("difficulty") || "";
  const topicSources = liveCatalog[topic];
  if (!Array.isArray(topicSources) || !["easy", "medium", "challenge"].includes(difficulty)) {
    return send(res, 400, { error: "Choose a supported topic and difficulty." }, headers);
  }
  const pool = topicSources.filter(item => item.difficulty === difficulty);
  if (!pool.length) return send(res, 404, { error: "No live problem is available for this topic and level." }, headers);
  if (!takeRateLimit("live:" + (req.socket.remoteAddress || "unknown"), 30, 60_000)) {
    return send(res, 429, { error: "Please pause briefly before loading another live question." }, headers);
  }
  const requestedPath = url.searchParams.get("sourcePath");
  const requestedSource = requestedPath && pool.find(item => item.path === requestedPath);
  if (requestedPath && !requestedSource) return send(res, 400, { error: "That saved question is not part of this topic." }, headers);
  const source = requestedSource || pool[randomInt(pool.length)];
  const requestedSeed = Number(url.searchParams.get("seed"));
  const seed = Number.isInteger(requestedSeed) && requestedSeed > 0 && requestedSeed <= 2_147_483_647
    ? requestedSeed : randomInt(1, 2_147_483_647);
  const apiOrigin = publicURL(req);
  if (!apiOrigin) return send(res, 503, { error: "The interaction service URL is unavailable." }, headers);
  const params = new URLSearchParams({
    sourceFilePath: source.path,
    problemSeed: String(seed),
    _format: "html",
    outputFormat: "default",
    displayMode: "MathJax",
    baseURL: rendererOrigin + "/",
    formURL: apiOrigin + "/render-api",
    hidePreviewButton: "0",
    hideCheckAnswersButton: "0",
    showHints: "1",
    showSolutions: "0",
  });
  let upstream;
  try {
    upstream = await fetch(rendererOrigin + "/render-api", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "text/html" },
      body: params,
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return send(res, 503, { error: "The live question service is temporarily unavailable." }, headers);
  }
  if (!upstream.ok) return send(res, 502, { error: "The live question could not be rendered." }, headers);
  const html = await upstream.text();
  if (!html || html.length > 2_000_000) return send(res, 502, { error: "The live renderer returned an unusable question." }, headers);
  const sourceUrl = "https://github.com/openwebwork/webwork-open-problem-library/blob/master/" + source.path.replace(/^OpenProblemLibrary\//, "");
  return send(res, 200, {
    html,
    title: source.title,
    problemId: topic + "-" + seed,
    seed,
    rendererBase: rendererOrigin + "/",
    sourceUrl,
    sourcePath: source.path,
    attribution: "WeBWorK Open Problem Library · CC BY-NC-SA 3.0 · noncommercial use",
  }, headers);
}

function normalizeMarks(result) {
  const marks = Array.isArray(result?.marks) ? result.marks.slice(0, 6) : [];
  return marks.map(item => ({
    type: item?.type === "highlight" ? "highlight" : "note",
    x: Number.isFinite(Number(item?.x)) ? Math.max(0, Math.min(1, Number(item.x))) : 0.5,
    y: Number.isFinite(Number(item?.y)) ? Math.max(0, Math.min(1, Number(item.y))) : 0.5,
    text: String(item?.text || "Review this step").replace(/[<>]/g, "").slice(0, 140),
  }));
}

async function handleCloudFeedback(req, res, headers) {
  if (!cloudAIEnabled) return send(res, 503, { error: "Cloud feedback is disabled until paid credentials and spending limits are configured." }, headers);
  if (!takeRateLimit("ai:" + (req.socket.remoteAddress || "unknown"), 3, 60_000)) {
    return send(res, 429, { error: "Please wait a moment before requesting more feedback." }, headers);
  }
  const month = new Date().toISOString().slice(0, 7);
  if (month !== usageMonth) { usageMonth = month; monthlyAIRequests = 0; }
  if (monthlyAIRequests >= monthlyCap) return send(res, 429, { error: "The configured monthly cloud feedback request cap has been reached." }, headers);
  let data;
  try { data = JSON.parse((await readBody(req)).toString("utf8")); }
  catch (error) { return send(res, error.status || 400, { error: error.status ? error.message : "Send a valid JSON request." }, headers); }
  if (data.consent !== true) return send(res, 400, { error: "Cloud analysis requires per-request consent." }, headers);
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(data.imageDataURL || ""));
  if (!match) return send(res, 400, { error: "Send one PNG, JPEG, or WebP notebook image." }, headers);
  const image = Buffer.from(match[2], "base64");
  if (!image.length || image.length > 2_500_000) return send(res, 413, { error: "Notebook image must be smaller than 2.5 MB." }, headers);
  const question = String(data.question || "").replace(/[\u0000-\u001f<>]/g, " ").slice(0, 500);
  const prompt = `Review this student's handwritten math work for the problem: ${question || "No question text provided."}\nReturn only JSON with a short supportive summary and up to 4 marks. A mark is a note or highlight at normalized page coordinates (x,y from 0 to 1). Point to the first likely incorrect step when visible. Be cautious: do not invent work that is not on the page. If uncertain, say so and use no marks. Schema: {"summary":string,"marks":[{"type":"note"|"highlight","x":number,"y":number,"text":string}]}`;
  monthlyAIRequests += 1;
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  let upstream;
  try {
    upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inlineData: { mimeType: match[1], data: image.toString("base64") } }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              summary: { type: "STRING" },
              marks: { type: "ARRAY", items: { type: "OBJECT", properties: {
                type: { type: "STRING", enum: ["note", "highlight"] },
                x: { type: "NUMBER" }, y: { type: "NUMBER" }, text: { type: "STRING" },
              }, required: ["type", "x", "y", "text"] } },
            }, required: ["summary", "marks"],
          },
          maxOutputTokens: 512,
        },
      }),
      signal: AbortSignal.timeout(35_000),
    });
  } catch {
    return send(res, 502, { error: "Cloud feedback could not reach the configured provider. Your page was not saved by FUDI-DC." }, headers);
  }
  if (!upstream.ok) return send(res, 502, { error: "The configured cloud provider did not return feedback." }, headers);
  let payload;
  try { payload = await upstream.json(); }
  catch { return send(res, 502, { error: "The cloud response could not be read." }, headers); }
  const raw = payload?.candidates?.[0]?.content?.parts?.find(part => typeof part.text === "string")?.text;
  let result;
  try { result = JSON.parse(raw || ""); }
  catch { return send(res, 502, { error: "The cloud provider returned invalid structured feedback." }, headers); }
  return send(res, 200, {
    summary: String(result.summary || "Review the suggested notes carefully.").replace(/[<>]/g, "").slice(0, 320),
    marks: normalizeMarks(result),
    experimental: true,
    privacy: "Processed for this request only; FUDI-DC does not persist the notebook image or response.",
  }, headers);
}

const server = createServer(async (req, res) => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") {
    res.writeHead(204, { ...headers, "Content-Length": "0" });
    return res.end();
  }
  let url;
  try { url = new URL(req.url || "/", "http://localhost"); }
  catch { return send(res, 400, { error: "Invalid request URL." }, headers); }
  try {
    if (req.method === "GET" && url.pathname === "/healthz") return send(res, 200, { ok: true, liveQuestions: Boolean(rendererOrigin), cloudFeedback: cloudAIEnabled }, headers);
    if (req.method === "GET" && url.pathname === "/api/live/catalog") {
      return send(res, 200, { enabled: Boolean(rendererOrigin), topics: Object.keys(liveCatalog), source: "WeBWorK Open Problem Library", license: "CC BY-NC-SA 3.0" }, headers);
    }
    if (req.method === "GET" && url.pathname === "/api/live/question") return await handleLiveQuestion(req, res, url, headers);
    if (req.method === "POST" && url.pathname === "/render-api") {
      if (!rendererOrigin) return send(res, 503, { error: "The live renderer is not configured." }, headers);
      if (!req.headers["content-type"]?.startsWith("application/x-www-form-urlencoded")) return send(res, 415, { error: "Unsupported renderer request." }, headers);
      let body;
      try { body = await readBody(req, maxRendererBodyBytes); }
      catch (error) { return send(res, error.status || 400, { error: "Renderer request was too large." }, headers); }
      try {
        const upstream = await fetch(rendererOrigin + "/render-api", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: req.headers.accept || "text/html" }, body, signal: AbortSignal.timeout(30_000) });
        const data = await upstream.arrayBuffer();
        res.writeHead(upstream.status, { ...headers, "Cache-Control": "no-store", "Content-Type": upstream.headers.get("content-type") || "text/html; charset=utf-8", "X-Content-Type-Options": "nosniff" });
        return res.end(Buffer.from(data));
      } catch { return send(res, 502, { error: "The renderer is unavailable." }, headers); }
    }
    if (req.method === "POST" && url.pathname === "/api/ai/feedback") {
      if (!req.headers["content-type"]?.startsWith("application/json")) return send(res, 415, { error: "Use JSON for a cloud feedback request." }, headers);
      return await handleCloudFeedback(req, res, headers);
    }
    return send(res, 404, { error: "Not found." }, headers);
  } catch {
    return send(res, 500, { error: "The request could not be completed." }, headers);
  }
});

server.listen(port, "0.0.0.0");
