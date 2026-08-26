import { Medal } from "@phosphor-icons/react";
import { MILESTONES } from "../../lib/milestones";
import { useMilestoneUi } from "./milestoneUi";

export default function MilestonesButton({ className = "" }: { className?: string }) {
  const { count, open } = useMilestoneUi();
  const total = MILESTONES.length;
  return (
    <button
      type="button"
      onClick={open}
      className={`milestone-chip no-drag ${className}`}
      aria-label={`Milestones, ${count} of ${total}`}
      title="Milestones"
    >
      <Medal size={13} weight="fill" />
      <span>
        {count}/{total}
      </span>
    </button>
  );
}
