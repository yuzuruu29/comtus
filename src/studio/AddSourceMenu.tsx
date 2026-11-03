import { ClipboardText, Globe, Plus, UploadSimple } from "@phosphor-icons/react";
import { Button, Menu } from "../ui";
import { ICON } from "../ui/iconScale";

/** The single "Add source" control: a Button that opens a Menu with the
 *  three intake paths. SourcesPane mounts exactly one instance at a time —
 *  from the empty state when there are no sources, from the pane header
 *  once there are — never both (Task 2.3 brief rule 10). It is the desk's
 *  primary action only until the first source is in; after that the
 *  composer's Send is, and this steps back to secondary. */
export default function AddSourceMenu({
  disabled,
  variant = "primary",
  onPickFiles,
  onPasteText,
  onWebAddress,
  openRequest,
}: {
  disabled?: boolean;
  variant?: "primary" | "secondary";
  onPickFiles: () => void;
  onPasteText: () => void;
  onWebAddress: () => void;
  openRequest?: number;
}) {
  return (
    <Menu
      aria-label="Add source"
      openRequest={openRequest}
      trigger={
        <Button variant={variant} icon={<Plus size={ICON.md} weight="bold" />} disabled={disabled}>
          Add source
        </Button>
      }
      items={[
        { key: "file", label: "Upload file", icon: <UploadSimple size={ICON.sm} />, onSelect: onPickFiles },
        { key: "paste", label: "Paste text", icon: <ClipboardText size={ICON.sm} />, onSelect: onPasteText },
        { key: "url", label: "Web address", icon: <Globe size={ICON.sm} />, onSelect: onWebAddress },
      ]}
    />
  );
}
