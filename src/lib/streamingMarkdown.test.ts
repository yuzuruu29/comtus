import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { describe, expect, it } from "vitest";
import { mathRehypePlugins, mathRemarkPlugins } from "./markdownMath";
import { closeStreamingMarkdown, rehypeStreamCursor } from "./streamingMarkdown";

describe("closeStreamingMarkdown", () => {
  it("leaves finished markdown alone", () => {
    const done = "**Active transport** needs *energy*.\n\n- one\n- two\n\n`code` and $x^2$ cost $5.";
    expect(closeStreamingMarkdown(done)).toBe(done);
  });

  it("closes bold, italic and strikethrough that are still open", () => {
    expect(closeStreamingMarkdown("and pull **2")).toBe("and pull **2**");
    expect(closeStreamingMarkdown("moves ions *against")).toBe("moves ions *against*");
    expect(closeStreamingMarkdown("**bold and *both")).toBe("**bold and *both***");
    expect(closeStreamingMarkdown("not ~~this")).toBe("not ~~this~~");
    expect(closeStreamingMarkdown("- **Active trans")).toBe("- **Active trans**");
  });

  it("drops a marker that has no text after it yet", () => {
    expect(closeStreamingMarkdown("and pull **")).toBe("and pull");
    expect(closeStreamingMarkdown("and pull ** ")).toBe("and pull");
  });

  it("does not treat list bullets or multiplication as emphasis", () => {
    expect(closeStreamingMarkdown("* first item")).toBe("* first item");
    expect(closeStreamingMarkdown("3 * 4 is 12")).toBe("3 * 4 is 12");
  });

  it("only repairs the block still being written", () => {
    expect(closeStreamingMarkdown("Stray ** in an old line.\n\nNew **bo")).toBe(
      "Stray ** in an old line.\n\nNew **bo**",
    );
  });

  it("ignores markers inside inline code", () => {
    expect(closeStreamingMarkdown("use `a ** b` then **x")).toBe("use `a ** b` then **x**");
    expect(closeStreamingMarkdown("run `npm te")).toBe("run `npm te`");
  });

  it("closes an open code fence and leaves its contents untouched", () => {
    expect(closeStreamingMarkdown("```py\nx = 2 ** 3")).toBe("```py\nx = 2 ** 3\n```");
    expect(closeStreamingMarkdown("```py\na = 1\n\nb = 2\n```\nAfter")).toBe(
      "```py\na = 1\n\nb = 2\n```\nAfter",
    );
  });

  it("hides math until its closing delimiter arrives", () => {
    expect(closeStreamingMarkdown("so $\\frac{1}{")).toBe("so");
    expect(closeStreamingMarkdown("Area:\n\n$$\n\\int_0^1")).toBe("Area:");
    expect(closeStreamingMarkdown("costs $5 and $x")).toBe("costs $5 and");
  });

  it("keeps a currency amount visible", () => {
    expect(closeStreamingMarkdown("it costs $5 a month")).toBe("it costs $5 a month");
  });

  it("holds back a table until its divider row is complete", () => {
    expect(closeStreamingMarkdown("Compare:\n| | Energy | Dir")).toBe("Compare:");
    expect(closeStreamingMarkdown("| | Energy | Direction |\n|---|--")).toBe("");
    const ready = "| | Energy | Direction |\n|---|---|---|\n| pump | AT";
    expect(closeStreamingMarkdown(ready)).toBe(ready);
  });

  it("shows only the text of a link whose address is still arriving", () => {
    expect(closeStreamingMarkdown("see [the pump](https://en.wiki")).toBe("see the pump");
    expect(closeStreamingMarkdown("![diagram](https://img")).toBe("");
  });
});

function render(markdown: string): string {
  return renderToStaticMarkup(
    createElement(
      ReactMarkdown,
      {
        remarkPlugins: [remarkGfm, ...mathRemarkPlugins],
        rehypePlugins: [...mathRehypePlugins, rehypeStreamCursor],
      },
      markdown,
    ),
  );
}

const CURSOR = '<span class="stream-typing-beacon" aria-hidden="true">';

describe("rehypeStreamCursor", () => {
  it("sits at the end of the last paragraph, not on a line of its own", () => {
    const html = render("First.\n\nSecond **line**");
    expect(html).toContain(`line${CURSOR}`);
    expect(html.indexOf(CURSOR)).toBeLessThan(html.lastIndexOf("</p>"));
  });

  it("follows the last list item and the last table cell", () => {
    expect(render("- one\n- two")).toMatch(new RegExp(`two${CURSOR}.*</li>`));
    expect(render("| a | b |\n|---|---|\n| 1 | 2 |")).toMatch(new RegExp(`2${CURSOR}.*</td>`));
  });

  it("goes after a formula rather than inside it", () => {
    const html = render("so $x^2$");
    const cursorAt = html.indexOf(CURSOR);
    expect(cursorAt).toBeGreaterThan(html.lastIndexOf('class="katex"'));
    expect(html.slice(cursorAt)).not.toContain("katex");
  });
});
