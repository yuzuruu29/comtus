import { cloneElement, isValidElement, useId, type ReactNode } from "react";
import { Input } from "./Input";
import { Textarea } from "./Textarea";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const control = isValidElement<{ id?: string; "aria-describedby"?: string }>(children) &&
    (children.type === "input" || children.type === "select" || children.type === "textarea" ||
      children.type === Input || children.type === Textarea) ? children : null;
  const controlId = control?.props.id || id;

  return (
    <div
      className="block"
      role={control ? undefined : "group"}
      aria-labelledby={control ? undefined : `${id}-label`}
      aria-describedby={control ? undefined : hintId}
    >
      {control ? (
        <label htmlFor={controlId} className="field-label">{label}</label>
      ) : (
        <div id={`${id}-label`} className="field-label">{label}</div>
      )}
      {control ? cloneElement(control, {
        id: controlId,
        "aria-describedby": [control.props["aria-describedby"], hintId].filter(Boolean).join(" ") || undefined,
      }) : children}
      {hint && <div id={hintId} className="mt-1.5 text-label text-muted">{hint}</div>}
    </div>
  );
}
