import { ClipboardText, Globe, Plus, UploadSimple } from "@phosphor-icons/react";
import { Button, Menu } from "../ui";
import { ICON } from "../ui/iconScale";

/** The single "Add source" control: a primary Button that opens a Menu with
 *  the three intake paths. SourcesPane mounts exactly one instance at a
 *  time — from the empty state when there are no sources, from the pane
 *  header once there are — never both (Task 2.3 brief rule 10). */
export default function AddSourceMenu({
  disabled,
  onPickFiles,
  onPasteText,
  onWebAddress,
}: {
  disabled?: boolean;
  onPickFiles: () => void;
  onPasteText: () => void;
  onWebAddress: () => void;
}) {
  return (
    <Menu
      aria-label="Add source"
      trigger={
        <Button variant="primary" icon={<Plus size={ICON.md} weight="bold" />} disabled={disabled}>
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
