"use client";

import { Command as Cmdk } from "cmdk";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

export interface PaletteCommand {
  id: string;
  label: string;
  group: string;
  icon?: React.ReactNode;
  shortcut?: string;
  keywords?: string[];
  run: () => void;
  disabled?: boolean;
}

/** ⌘K: every editor action, searchable. */
export function CommandPalette({
  open,
  onOpenChange,
  commands,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: PaletteCommand[];
}) {
  const groups = Array.from(new Set(commands.map((c) => c.group)));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[20%] max-w-xl translate-y-0 gap-0 overflow-hidden rounded-2xl p-0 shadow-2xl [&>button]:hidden">
        <DialogTitle className="sr-only">Commands</DialogTitle>
        <DialogDescription className="sr-only">Search for an action and press Enter to run it.</DialogDescription>
        <Cmdk label="Commands" loop className="flex flex-col">
          <div className="flex items-center gap-3 border-b px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <Cmdk.Input
              autoFocus
              placeholder="What do you want to do?"
              className="h-14 flex-1 bg-transparent text-[0.9375rem] placeholder:text-muted-foreground focus:outline-none"
            />
            <kbd className="kbd">esc</kbd>
          </div>
          <Cmdk.List className="max-h-[22rem] overflow-y-auto p-2">
            <Cmdk.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">No matching action.</Cmdk.Empty>
            {groups.map((group) => (
              <Cmdk.Group
                key={group}
                heading={group}
                className="mb-1 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[0.6875rem] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {commands
                  .filter((c) => c.group === group && !c.disabled)
                  .map((c) => (
                    <Cmdk.Item
                      key={c.id}
                      value={`${c.label} ${c.keywords?.join(" ") ?? ""}`}
                      onSelect={() => {
                        onOpenChange(false);
                        // Let the dialog close (and return focus) before the action runs
                        setTimeout(c.run, 0);
                      }}
                      className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm aria-selected:bg-muted data-[selected=true]:bg-muted"
                    >
                      <span className="flex h-4 w-4 items-center justify-center text-muted-foreground">{c.icon}</span>
                      <span className="flex-1">{c.label}</span>
                      {c.shortcut && <span className="text-xs tracking-wide text-muted-foreground">{c.shortcut}</span>}
                    </Cmdk.Item>
                  ))}
              </Cmdk.Group>
            ))}
          </Cmdk.List>
        </Cmdk>
      </DialogContent>
    </Dialog>
  );
}
