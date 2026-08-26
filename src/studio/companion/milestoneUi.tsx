import { createContext, useContext, type ReactNode } from "react";

type MilestoneUiValue = {
  count: number;
  open: () => void;
};

const MilestoneUiContext = createContext<MilestoneUiValue>({
  count: 0,
  open: () => {},
});

export function MilestoneUiProvider({
  value,
  children,
}: {
  value: MilestoneUiValue;
  children: ReactNode;
}) {
  return <MilestoneUiContext.Provider value={value}>{children}</MilestoneUiContext.Provider>;
}

export function useMilestoneUi(): MilestoneUiValue {
  return useContext(MilestoneUiContext);
}
