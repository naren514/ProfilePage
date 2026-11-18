// A stand-in for the OpenAI Chat Completions API, for end-to-end tests.
// Streams deterministic replies and records every request it receives.
//
//   node tests/e2e/mock-openai.cjs [port]      (default 3999)
//   GET  /__requests  -> JSON list of received request bodies
//
// Replies: inline passages -> "a much tighter phrase"; block passages ->
// "<p>Rewritten by the mock AI.</p>". A passage containing SLOW streams slowly.
// Model "broken-model" returns 404 model_not_found.

const http = require("http");

const port = Number(process.argv[2] || 3999);
const requests = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

http
  .createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/__requests") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(requests));
    }
    if (req.method !== "POST" || !req.url.endsWith("/chat/completions")) {
      res.writeHead(404);
      return res.end();
    }
    let raw = "";
    for await (const chunk of req) raw += chunk;
    const body = JSON.parse(raw);
    requests.push(body);

    if (body.model === "broken-model") {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: { message: "The model `broken-model` does not exist", code: "model_not_found" } }));
    }

    const user = body.messages.find((m) => m.role === "user")?.content ?? "";
    const inline = user.includes('<passage kind="inline">');
    const slow = /<passage[^>]*>[\s\S]*SLOW[\s\S]*<\/passage>/.test(user);
    const reply = inline ? "a much tighter phrase" : "<p>Rewritten by the mock AI.</p>";
    const pieces = reply.match(/.{1,6}/g);

    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
    const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
    let closed = false;
    req.on("close", () => (closed = true));
    for (const piece of pieces) {
      if (closed) return;
      send({ model: body.model, choices: [{ delta: { content: piece } }] });
      await sleep(slow ? 1500 : 25);
    }
    send({ model: body.model, choices: [{ delta: {}, finish_reason: "stop" }] });
    send({ model: body.model, choices: [], usage: { prompt_tokens: 1200, completion_tokens: 40 } });
    res.write("data: [DONE]\n\n");
    res.end();
  })
  .listen(port, () => console.log(`mock OpenAI listening on ${port}`));
