import { cleanup, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { Field } from "./Field";
import { Input } from "./Input";
import { Textarea } from "./Textarea";

afterEach(cleanup);

describe("Field", () => {
  it("associates labels with native and shared form controls", () => {
    render(
      <>
        <Field label="Title"><Input /></Field>
        <Field label="Notes"><Textarea /></Field>
        <Field label="Source URL"><input /></Field>
        <Field label="Pasted text"><textarea /></Field>
        <Field label="Format"><select><option>Document</option></select></Field>
      </>,
    );

    const controls = ["Title", "Notes", "Source URL", "Pasted text", "Format"].map((label) => {
      const control = screen.getByLabelText(label);
      expect(control).toHaveAccessibleName(label);
      return control;
    });
    expect(new Set(controls.map((control) => control.id)).size).toBe(controls.length);
  });

  it("preserves an existing id and description while attaching the hint", () => {
    render(
      <>
        <span id="name-status">Optional.</span>
        <Field label="Notebook name" hint="You can rename it later.">
          <Input id="notebook-name" aria-describedby="name-status" />
        </Field>
      </>,
    );

    const input = screen.getByLabelText("Notebook name");
    expect(input).toHaveAttribute("id", "notebook-name");
    expect(input).toHaveAccessibleDescription("Optional. You can rename it later.");
  });

  it("names choice groups without wrapping their buttons in a label", () => {
    render(
      <Field label="Formats" hint="Choose one or more.">
        <div><button type="button">Quiz</button><button type="button">Flashcards</button></div>
      </Field>,
    );

    const group = screen.getByRole("group", { name: "Formats" });
    expect(group).toHaveAccessibleDescription("Choose one or more.");
    expect(within(group).getAllByRole("button")).toHaveLength(2);
    expect(group.querySelector("label")).toBeNull();
  });
});
