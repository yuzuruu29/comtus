import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";

/**
 * LaTeX math for model answers. Models are instructed to write math in
 * $…$ / $$…$$ delimiters (see HOUSE_RULES in llm.ts); these plugins turn
 * those into real typeset equations via KaTeX.
 *
 * rehype-katex never throws on malformed expressions — it renders the
 * source tinted with errorColor instead, so a bad formula can't take
 * down the transcript mid-stream.
 */
export const mathRemarkPlugins = [remarkMath];
export const mathRehypePlugins = [
  [rehypeKatex, { strict: false, errorColor: "#b3543f" }] as [
    typeof rehypeKatex,
    Parameters<typeof rehypeKatex>[0],
  ],
];
