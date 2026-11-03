import { Medal } from "@phosphor-icons/react";
import type { CSSProperties } from "react";
import { MILESTONES, type MilestoneRecord } from "../../lib/milestones";
import { InkMark } from "../../ui/InkMark";
import { Modal } from "../ui";
import { ICON } from "../../ui/iconScale";

export default function MilestonesPanel({
  open,
  onClose,
  record,
}: {
  open: boolean;
  onClose: () => void;
  record: MilestoneRecord;
}) {
  const held = Object.keys(record.unlockedAt).length;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Medal size={ICON.lg} weight="fill" className="text-brass" />
          Milestones
        </span>
      }
      wide
    >
      <p className="text-small leading-relaxed text-muted">
        {`Marks of study kept on this device. ${held} of ${MILESTONES.length} held.`}
      </p>
      <div
        className="milestone-meter"
        role="meter"
        aria-label="Milestones held"
        aria-valuemin={0}
        aria-valuemax={MILESTONES.length}
        aria-valuenow={held}
        style={{ ["--held" as string]: held / MILESTONES.length } as CSSProperties}
      />
      <div className="milestone-grid mt-4">
        {MILESTONES.map((m, i) => {
          const unlockedAt = record.unlockedAt[m.id];
          const isHeld = Boolean(unlockedAt);
          return (
            <article
              key={m.id}
              className="milestone-card"
              data-held={isHeld ? "true" : "false"}
              data-accent={m.accent}
              style={{ ["--i" as string]: i } as CSSProperties}
            >
              <span className="milestone-seal" data-accent={m.accent} aria-hidden>
                {isHeld ? <InkMark kind="check" /> : <span className="milestone-seal-blank" />}
              </span>
              <div className="min-w-0">
                <h3 className="font-display text-body font-[450] text-ink">{m.title}</h3>
                <p className="mt-0.5 text-small leading-relaxed text-muted">{m.line}</p>
                {isHeld && (
                  <p className="milestone-date">
                    {`Held ${new Date(unlockedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`}
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </Modal>
  );
}
