import { useEffect, useState } from "react";
import { Button, Dialog, Field, Input } from "../ui";
import { createNotebook } from "../lib/db";

/** Owns its own name/pending/error state so Shelf only has to open/close
 *  it and react to the finished notebook id. */
export default function NewNotebookDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setName("");
      setError("");
    }
  }, [open]);

  const close = () => {
    if (!pending) onClose();
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || pending) return;
    setPending(true);
    setError("");
    try {
      const nb = await createNotebook(trimmed);
      onCreated(nb.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The notebook could not be created.");
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onClose={close} title="New notebook">
      <div className="space-y-5">
        <Field label="Name" hint="e.g. Comparison of Android 15 and iOS 18">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder="Name this notebook"
            disabled={pending}
          />
        </Field>
        {error && (
          <p role="alert" className="text-body text-rust">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={close} disabled={pending}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void submit()} loading={pending} disabled={!name.trim()}>
            Create
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
