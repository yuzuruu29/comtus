/**
 * Throwaway QA mock: a tiny OpenAI-compatible streaming endpoint that
 * answers with LaTeX-heavy linear algebra (mirrors the ASCII-math
 * screenshot the math-rendering work targets). Used only by local
 * Playwright checks — never deployed (lives outside api/, excluded from
 * the Vercel bundle by .vercelignore? No — scripts/ isn't a function
 * directory, so Vercel never sees it).
 */
import http from "node:http";

const ANSWER = `## Setting up the system

We solve for $x_1$ and $x_2$ using Cramer's rule. First, the coefficient matrix and the determinant:

$$
A = \\begin{pmatrix} 1 & 2 \\\\ 3 & -1 \\end{pmatrix}, \\qquad |A| = (1)(-1) - (2)(3) = -7 \\neq 0
$$

Because $|A| \\neq 0$, the system has exactly one solution.

## Replacing a column

Replace column 2 with $d = (6, 12)$:

$$
|A_d| = \\begin{vmatrix} 1 & 6 \\\\ 3 & 12 \\end{vmatrix} = (1)(12) - (6)(3) = -6
$$

So $x_2 = \\frac{|A_d|}{|A|} = \\frac{-6}{-7} = \\frac{6}{7} \\approx 0.857$.

## Summary table

| Quantity | Value |
| --- | --- |
| $|A|$ | $-7$ |
| $x_1$ | $\\frac{19}{7}$ |
| $x_2$ | $\\frac{6}{7}$ |

The equilibrium prices are therefore $P_1 = \\frac{19}{7}$ and $P_2 = \\frac{6}{7}$.`;

const body = JSON.stringify({
  id: "chatcmpl-mock",
  object: "chat.completion.chunk",
  created: Date.now(),
  model: "mock-math",
  choices: [{ index: 0, delta: {}, finish_reason: null }],
});

http
  .createServer((req, res) => {
    const cors = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
    };
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      return res.end();
    }
    res.writeHead(200, { "content-type": "text/event-stream", ...cors });
    // Stream the answer in small word-ish chunks like a real model.
    const pieces = ANSWER.match(/[\s\S]{1,24}/g) ?? [];
    let i = 0;
    const timer = setInterval(() => {
      if (i >= pieces.length) {
        res.write(
          `data: ${JSON.stringify({
            ...JSON.parse(body),
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          })}\n\n`,
        );
        res.write("data: [DONE]\n\n");
        clearInterval(timer);
        return res.end();
      }
      res.write(
        `data: ${JSON.stringify({
          ...JSON.parse(body),
          choices: [{ index: 0, delta: { content: pieces[i++] }, finish_reason: null }],
        })}\n\n`,
      );
    }, 15);
    req.on("close", () => clearInterval(timer));
  })
  .listen(5999, "127.0.0.1", () => console.log("mock llm on http://127.0.0.1:5999/v1"));
