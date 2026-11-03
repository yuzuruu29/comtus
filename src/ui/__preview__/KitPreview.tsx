import { useState, type ReactNode } from "react";
import { GearSix, Sparkle, Star, Trash } from "@phosphor-icons/react";
import { Button } from "../Button";
import { IconButton } from "../IconButton";
import { Chip } from "../Chip";
import { Field } from "../Field";
import { Input } from "../Input";
import { Textarea } from "../Textarea";
import { Segmented } from "../Segmented";
import { Menu } from "../Menu";
import { Sheet } from "../Sheet";
import { Dialog } from "../Dialog";
import { Skeleton } from "../Skeleton";
import { Empty } from "../Empty";
import { applyResolvedTheme } from "../../lib/theme";
import { ICON } from "../iconScale";
// The components are imported directly rather than through the barrel, so the
// kit stylesheet has to be asked for by name. Without this the preview
// renders unstyled.
import "../ui.css";

/** Dev-only screenshot surface for the src/ui primitive kit — every
 *  component, every state, in both themes. Mounted at /studio/kit only
 *  when import.meta.env.DEV; never reachable in a production build. */
export default function KitPreview() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [view, setView] = useState<"cards" | "list" | "table">("cards");
  const [chipSelected, setChipSelected] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyResolvedTheme(next);
  };

  return (
    <div className="min-h-screen bg-ground p-8 text-ink">
      <div className="mx-auto flex max-w-3xl flex-col gap-10">
        <div className="flex items-center justify-between">
          <h1 className="text-title font-display">src/ui kit preview</h1>
          <Button variant="secondary" size="sm" onClick={toggleTheme}>
            Toggle theme ({theme})
          </Button>
        </div>

        <Section title="Button">
          <Row>
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
          </Row>
          <Row>
            <Button variant="primary" size="sm">Primary sm</Button>
            <Button variant="primary" loading>Loading</Button>
            <Button variant="primary" disabled>Disabled</Button>
            <Button variant="primary" icon={<Sparkle size={ICON.md} weight="fill" />}>With icon</Button>
          </Row>
        </Section>

        <Section title="IconButton">
          <Row>
            <IconButton aria-label="Settings"><GearSix size={ICON.lg} /></IconButton>
            <IconButton aria-label="Favorite" variant="secondary"><Star size={ICON.lg} /></IconButton>
            <IconButton aria-label="Delete" variant="danger"><Trash size={ICON.lg} /></IconButton>
            <IconButton aria-label="Loading" loading><GearSix size={ICON.lg} /></IconButton>
            <IconButton aria-label="Disabled" disabled><GearSix size={ICON.lg} /></IconButton>
          </Row>
        </Section>

        <Section title="Chip">
          <Row>
            <Chip tone="brass" selected={chipSelected} onClick={() => setChipSelected((v) => !v)} onRemove={() => {}}>
              Photosynthesis
            </Chip>
            <Chip tone="sage">Sage tone</Chip>
            <Chip tone="rust">Rust tone</Chip>
            <Chip tone="moon">Moon tone</Chip>
            <Chip tone="candle">Candle tone</Chip>
          </Row>
        </Section>

        <Section title="Field / Input / Textarea">
          <div className="flex max-w-sm flex-col gap-4">
            <Field label="Notebook title" hint="Shown on the shelf">
              <Input placeholder="Untitled notebook" />
            </Field>
            <Field label="Notes">
              <Textarea placeholder="Add a note…" rows={3} />
            </Field>
          </div>
        </Section>

        <Section title="Segmented">
          <Segmented
            value={view}
            onChange={setView}
            aria-label="View"
            options={[
              { value: "cards", label: "Cards" },
              { value: "list", label: "List" },
              { value: "table", label: "Table" },
            ]}
          />
        </Section>

        <Section title="Menu">
          <Menu
            aria-label="Notebook actions"
            trigger={<Button variant="secondary">Actions</Button>}
            items={[
              { key: "rename", label: "Rename", onSelect: () => {} },
              { key: "delete", label: "Delete", onSelect: () => {} },
            ]}
          />
        </Section>

        <Section title="Sheet / Dialog">
          <Row>
            <Button onClick={() => setSheetOpen(true)}>Open sheet</Button>
            <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
          </Row>
          <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Sources">
            <p className="text-body text-muted">Sheet body content.</p>
          </Sheet>
          <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Confirm">
            <p className="text-body text-muted">Dialog body content.</p>
          </Dialog>
        </Section>

        <Section title="Skeleton">
          <div className="flex max-w-sm flex-col gap-4">
            <Skeleton lines={3} />
            <Skeleton.Card />
          </div>
        </Section>

        <Section title="Empty">
          <Empty
            title="No sources yet"
            body="Add a PDF, a link, or paste text to start building this notebook."
            action={<Button size="sm">Add a source</Button>}
          />
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-hairline pt-6">
      <h2 className="text-label font-medium text-muted">{title}</h2>
      {children}
    </section>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>;
}
