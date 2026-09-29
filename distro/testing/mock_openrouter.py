"""Minimal OpenRouter stand-in for testing Kidzink AI key setup and error handling.

Keys: sk-or-v1-good (works), sk-or-v1-empty (valid, no usage left), sk-or-v1-broke (chat -> 402),
sk-or-v1-blocked (chat -> 403 guardrail). Anything else is rejected with 401.
"""
import json
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

VALID = {"sk-or-v1-good": 5.0, "sk-or-v1-empty": 0, "sk-or-v1-broke": 1.0, "sk-or-v1-blocked": 1.0}
MODELS = ["anthropic/claude-sonnet-5", "anthropic/claude-haiku-4.5"]
LOG = open(sys.argv[2], "a") if len(sys.argv) > 2 else sys.stderr


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        LOG.write("%s %s\n" % (self.command, self.path))
        LOG.flush()

    def key(self):
        auth = self.headers.get("Authorization", "")
        return auth[len("Bearer "):] if auth.startswith("Bearer ") else ""

    def json(self, status, body):
        data = json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path.startswith("/api/v1/key"):
            if self.key() in VALID:
                return self.json(200, {"data": {"label": "test", "limit": 5, "limit_remaining": VALID[self.key()], "usage": 0}})
            return self.json(401, {"error": {"code": 401, "message": "User not found."}})
        if self.path.startswith("/api/v1/models"):
            return self.json(200, {"data": [
                {"id": m, "name": m, "context_length": 200000, "supported_parameters": ["tools", "tool_choice"],
                 "pricing": {"prompt": "0.000002", "completion": "0.00001"},
                 "architecture": {"input_modalities": ["text", "image"], "output_modalities": ["text"]}}
                for m in MODELS]})
        return self.json(404, {"error": {"code": 404, "message": "not mocked"}})

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(length) or b"{}")
        LOG.write("  headers X-Title=%s Referer=%s model=%s\n" % (
            self.headers.get("X-Title"), self.headers.get("HTTP-Referer"), body.get("model")))
        LOG.flush()
        if not self.path.startswith("/api/v1/chat/completions"):
            return self.json(404, {"error": {"code": 404, "message": "not mocked"}})
        key = self.key()
        if key not in VALID:
            return self.json(401, {"error": {"code": 401, "message": "User not found."}})
        if key == "sk-or-v1-broke":
            return self.json(402, {"error": {"code": 402, "message": "Insufficient credits. Add more using https://openrouter.ai/credits"}})
        if key == "sk-or-v1-blocked":
            return self.json(403, {"error": {"code": 403, "message": "Model anthropic/claude-sonnet-5 is not allowed by your guardrail"}})
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()
        model = body.get("model", MODELS[0])
        for i, chunk in enumerate(["Hello ", "from the mock ", "OpenRouter."]):
            delta = {"content": chunk}
            if i == 0:
                delta["role"] = "assistant"
            event = {"id": "mock", "object": "chat.completion.chunk", "created": int(time.time()), "model": model,
                     "choices": [{"index": 0, "delta": delta, "finish_reason": None}]}
            self.wfile.write(("data: %s\n\n" % json.dumps(event)).encode())
            self.wfile.flush()
        final = {"id": "mock", "object": "chat.completion.chunk", "created": int(time.time()), "model": model,
                 "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
                 "usage": {"prompt_tokens": 10, "completion_tokens": 5, "total_tokens": 15}}
        self.wfile.write(("data: %s\n\ndata: [DONE]\n\n" % json.dumps(final)).encode())
        self.wfile.flush()


ThreadingHTTPServer(("127.0.0.1", int(sys.argv[1])), Handler).serve_forever()
