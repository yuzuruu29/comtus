import { Check, Medal } from "@phosphor-icons/react";
import { accentClass, MILESTONES, type MilestoneRecord } from "../../lib/milestones";
import { Modal } from "../ui";

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
          <Medal size={18} weight="fill" className="text-brass" />
          Milestones
        </span>
      }
      wide
    >
      <p className="text-[13px] leading-relaxed text-muted">
        {`Marks of study kept on this device. ${held} of ${MILESTONES.length} held${
          record.streakDays > 0 ? ` · ${record.streakDays}-night streak` : ""
        }.`}
      </p>
      <div className="milestone-grid mt-4">
        {MILESTONES.map((m) => {
          const unlockedAt = record.unlockedAt[m.id];
          const isHeld = Boolean(unlockedAt);
          return (
            <article key={m.id} className="milestone-card" data-held={isHeld ? "true" : "false"}>
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${accentClass(m.accent)}`}
                aria-hidden
              >
                {isHeld ? <Check size={16} weight="bold" /> : <span className="h-1.5 w-1.5 rounded-full bg-current opacity-50" />}
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-[14.5px] font-[450] text-ink">{m.title}</h3>
                <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{m.line}</p>
                {isHeld && (
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-brasspale">
                    {new Date(unlockedAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
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
