import { useState } from "react";
import { Settings, Keyboard, SlidersHorizontal, RotateCcw, MonitorCog, LogOut } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DiffToolbar } from "@/components/diff-toolbar";
import { useShortcuts, type ShortcutConfig } from "@/lib/shortcuts-context";
import { cn } from "@/lib/utils";

type WorkspaceMode = "single" | "all";
type Tab = "diff" | "shortcuts" | "workspace";

function ShortcutRow({
  label,
  shortcut,
  onChange,
}: {
  label: string;
  shortcut: ShortcutConfig;
  onChange: (config: Partial<ShortcutConfig>) => void;
}) {
  const [isRecording, setIsRecording] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isRecording) return;
    e.preventDefault();

    if (e.key === "Escape") {
      setIsRecording(false);
      return;
    }

    // Don't allow modifier-only keys
    if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;

    onChange({
      key: e.key.toLowerCase(),
      modifiers: {
        ctrl: e.ctrlKey && e.key !== "Control",
        alt: e.altKey && e.key !== "Alt",
        shift: e.shiftKey && e.key !== "Shift",
        meta: e.metaKey && e.key !== "Meta",
      },
    });
    setIsRecording(false);
  };

  const displayShortcut = () => {
    const parts: string[] = [];
    if (shortcut.modifiers.ctrl) parts.push("Ctrl");
    if (shortcut.modifiers.alt) parts.push("Alt");
    if (shortcut.modifiers.shift) parts.push("Shift");
    if (shortcut.modifiers.meta) parts.push("Cmd");
    parts.push(shortcut.key.toUpperCase());
    return parts.join("+");
  };

  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <div className="flex flex-col">
        <span className="text-[13px]">{label}</span>
        <span className="text-[11px] text-muted-foreground">
          {shortcut.description}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsRecording(true)}
          onKeyDown={handleKeyDown}
          onBlur={() => setIsRecording(false)}
          className={cn(
            "h-8 px-3 text-[13px] border transition-colors min-w-[100px] text-center",
            isRecording
              ? "border-ring bg-accent text-accent-foreground"
              : "border-input bg-background hover:border-ring"
          )}
        >
          {isRecording ? "Press key..." : displayShortcut()}
        </button>
      </div>
    </div>
  );
}

function ShortcutsTab() {
  const { shortcuts, updateShortcut, resetToDefaults } = useShortcuts();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-muted-foreground">
          Click on a shortcut to change it. Press Escape to cancel.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={resetToDefaults}
          className="gap-1.5"
        >
          <RotateCcw className="size-3.5" />
          Reset Defaults
        </Button>
      </div>

      <div className="border border-border rounded-sm">
        <ShortcutRow
          label="Next Unviewed File"
          shortcut={shortcuts.nextUnviewedFile}
          onChange={(config) => updateShortcut("nextUnviewedFile", config)}
        />
        <ShortcutRow
          label="Previous Unviewed File"
          shortcut={shortcuts.previousUnviewedFile}
          onChange={(config) => updateShortcut("previousUnviewedFile", config)}
        />
        <ShortcutRow
          label="Scroll Down"
          shortcut={shortcuts.scrollDown}
          onChange={(config) => updateShortcut("scrollDown", config)}
        />
        <ShortcutRow
          label="Scroll Up"
          shortcut={shortcuts.scrollUp}
          onChange={(config) => updateShortcut("scrollUp", config)}
        />
        <ShortcutRow
          label="Next File"
          shortcut={shortcuts.nextFile}
          onChange={(config) => updateShortcut("nextFile", config)}
        />
        <ShortcutRow
          label="Previous File"
          shortcut={shortcuts.previousFile}
          onChange={(config) => updateShortcut("previousFile", config)}
        />
      </div>
    </div>
  );
}

function DiffSettingsTab() {
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-muted-foreground">
        Configure how diffs are displayed.
      </p>
      <DiffToolbar />
    </div>
  );
}

function WorkspaceTab({
  workspaceMode,
  onWorkspaceModeChange,
  onDisconnect,
}: {
  workspaceMode?: WorkspaceMode;
  onWorkspaceModeChange?: (mode: WorkspaceMode) => void;
  onDisconnect?: () => void;
}) {
  const selectedMode = workspaceMode ?? "single";

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[13px] text-muted-foreground mb-2">Review mode</p>
        <div className="flex items-center gap-2">
          <Button
            variant={selectedMode === "single" ? "default" : "outline"}
            size="sm"
            className="h-8"
            onClick={() => onWorkspaceModeChange?.("single")}
          >
            Single file
          </Button>
          <Button
            variant={selectedMode === "all" ? "default" : "outline"}
            size="sm"
            className="h-8"
            onClick={() => onWorkspaceModeChange?.("all")}
          >
            All files
          </Button>
        </div>
      </div>

      <div className="pt-2 border-t border-border">
        <Button
          variant="outline"
          className="gap-2"
          onClick={() => onDisconnect?.()}
          disabled={!onDisconnect}
        >
          <LogOut className="size-3.5" />
          Disconnect
        </Button>
      </div>
    </div>
  );
}

export function SettingsMenu({
  workspaceMode,
  onWorkspaceModeChange,
  onDisconnect,
}: {
  workspaceMode?: WorkspaceMode;
  onWorkspaceModeChange?: (mode: WorkspaceMode) => void;
  onDisconnect?: () => void;
} = {}) {
  const [activeTab, setActiveTab] = useState<Tab>("diff");
  const [open, setOpen] = useState(false);
  const showWorkspaceTab = Boolean(onWorkspaceModeChange || onDisconnect);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Settings">
          <Settings className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-4 py-3 border-b border-border bg-secondary">
          <DialogTitle className="text-[13px] font-medium flex items-center gap-2">
            <Settings className="size-4" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          {/* Sidebar */}
          <div className="w-48 border-r border-border bg-sidebar">
            <nav className="p-2 space-y-1">
              <button
                onClick={() => setActiveTab("diff")}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-[13px] transition-colors",
                  activeTab === "diff"
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50"
                )}
              >
                <SlidersHorizontal className="size-4" />
                Diff Settings
              </button>
              <button
                onClick={() => setActiveTab("shortcuts")}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 text-[13px] transition-colors",
                  activeTab === "shortcuts"
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50"
                )}
              >
                <Keyboard className="size-4" />
                Keyboard Shortcuts
              </button>
              {showWorkspaceTab && (
                <button
                  onClick={() => setActiveTab("workspace")}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-[13px] transition-colors",
                    activeTab === "workspace"
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50"
                  )}
                >
                  <MonitorCog className="size-4" />
                  Workspace
                </button>
              )}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1 p-4 overflow-auto">
            {activeTab === "diff" && <DiffSettingsTab />}
            {activeTab === "shortcuts" && <ShortcutsTab />}
            {activeTab === "workspace" && (
              <WorkspaceTab
                workspaceMode={workspaceMode}
                onWorkspaceModeChange={onWorkspaceModeChange}
                onDisconnect={onDisconnect}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
