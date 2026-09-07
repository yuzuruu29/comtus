import type { ReactNode } from "react";

export interface EmptyProps {
  title: string;
  body: string;
  action?: ReactNode;
  icon?: ReactNode;
}

/** One teaching sentence, one action — not a wall of onboarding copy. */
export function Empty({ title, body, action, icon }: EmptyProps) {
  return (
    <div className="empty">
      {icon && (
        <div className="empty-icon" aria-hidden="true">
          {icon}
        </div>
      )}
      <p className="empty-title">{title}</p>
      <p className="empty-body">{body}</p>
      {action}
    </div>
  );
}
