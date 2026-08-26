import { createContext, useContext } from "react";
import type { LayoutMode } from "./layout";

export type DeskActions = {
  goHome: () => void;
  openSettings: () => void;
  newNotebook: () => void;
  openNotebook: (id: string) => void;
  setLayout: (mode: LayoutMode) => void;
  cycleLayout: (dir: 1 | -1) => void;
  toggleSources: () => void;
  toggleStudio: () => void;
  focusChat: () => void;
  importFiles: () => void;
  openPalette: () => void;
  openMilestones: () => void;
};

const noop = () => {};

export const defaultDeskActions: DeskActions = {
  goHome: noop,
  openSettings: noop,
  newNotebook: noop,
  openNotebook: noop,
  setLayout: noop,
  cycleLayout: noop,
  toggleSources: noop,
  toggleStudio: noop,
  focusChat: noop,
  importFiles: noop,
  openPalette: noop,
  openMilestones: noop,
};

export const DeskContext = createContext<DeskActions>(defaultDeskActions);

export function useDesk(): DeskActions {
  return useContext(DeskContext);
}
