import { registerRoot } from "remotion";
import { HowRoot } from "./HowRoot";

// A separate entry point keeps the explainer independent of the brand film's Root.
registerRoot(HowRoot);
