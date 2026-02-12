import {
  FolderOpen,
  Keyboard,
  LogOut,
  MonitorCog,
  Palette,
  RotateCcw,
  Settings,
  SlidersHorizontal,
} from "lucide-react";
import { useState } from "react";
import { DiffToolbar } from "@/components/diff-toolbar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { type AppThemeMode, useAppearance } from "@/lib/appearance-context";
import { useFileTree } from "@/lib/file-tree-context";
import {
  FONT_FAMILY_OPTIONS,
  type FontFamilyValue,
  SANS_FONT_FAMILY_OPTIONS,
} from "@/lib/font-options";
import { type ShortcutConfig, useShortcuts } from "@/lib/shortcuts-context";
import { cn } from "@/lib/utils";

type WorkspaceMode = "single" | "all";
type Tab = "diff" | "appearance" | "tree" | "shortcuts" | "workspace";

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
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0 gap-3">
      <div className="flex flex-col">
        <span className="text-[13px]">{label}</span>
        <span className="text-[11px] text-muted-foreground">
          {shortcut.description}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setIsRecording(true)}
          onKeyDown={handleKeyDown}
          onBlur={() => setIsRecording(false)}
          className={cn(
            "h-8 px-3 text-[13px] border transition-colors min-w-[100px] text-center",
            isRecording
              ? "border-ring bg-accent text-accent-foreground"
              : "border-input bg-background hover:border-ring",
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
    <div className="space-y-5">
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

      <div className="border border-border rounded-sm bg-card">
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
        <ShortcutRow
          label="Approve Pull Request"
          shortcut={shortcuts.approvePullRequest}
          onChange={(config) => updateShortcut("approvePullRequest", config)}
        />
        <ShortcutRow
          label="Request Changes"
          shortcut={shortcuts.requestChangesPullRequest}
          onChange={(config) =>
            updateShortcut("requestChangesPullRequest", config)
          }
        />
      </div>
    </div>
  );
}

function DiffSettingsTab({
  workspaceMode,
  onWorkspaceModeChange,
}: {
  workspaceMode?: WorkspaceMode;
  onWorkspaceModeChange?: (mode: WorkspaceMode) => void;
}) {
  return (
    <div className="space-y-5">
      {workspaceMode && onWorkspaceModeChange && (
        <div className="border border-border bg-card p-4 space-y-3">
          <p className="text-[13px] text-muted-foreground">Review mode</p>
          <div className="flex items-center gap-2">
            <Button
              variant={workspaceMode === "single" ? "default" : "outline"}
              size="sm"
              className="h-8"
              onClick={() => onWorkspaceModeChange("single")}
            >
              Single file
            </Button>
            <Button
              variant={workspaceMode === "all" ? "default" : "outline"}
              size="sm"
              className="h-8"
              onClick={() => onWorkspaceModeChange("all")}
            >
              All files
            </Button>
          </div>
        </div>
      )}
      <p className="text-[13px] text-muted-foreground">
        Configure how diffs are displayed.
      </p>
      <div className="border border-border bg-card p-4">
        <DiffToolbar />
      </div>
    </div>
  );
}

function AppearanceTab() {
  const {
    appThemeMode,
    pageFontFamily,
    pageFontSize,
    pageLineHeight,
    commentFontFamily,
    setAppThemeMode,
    setPageFontFamily,
    setPageFontSize,
    setPageLineHeight,
    setCommentFontFamily,
  } = useAppearance();

  return (
    <div className="space-y-5">
      <div className="border border-border bg-card p-4 space-y-4">
        <div>
          <h3 className="text-[13px] font-medium">General Appearance</h3>
          <p className="text-[12px] text-muted-foreground">
            Configure app-wide theme and typography.
          </p>
        </div>
      </div>

      <div className="border border-border bg-card p-4 space-y-4">
        <div>
          <h3 className="text-[13px] font-medium">App Theme</h3>
          <p className="text-[12px] text-muted-foreground">
            Auto follows browser preference.
          </p>
        </div>
        <div className="space-y-1">
          <Label className="text-[12px] text-muted-foreground">
            Theme Mode
          </Label>
          <Select
            value={appThemeMode}
            onValueChange={(value) => setAppThemeMode(value as AppThemeMode)}
          >
            <SelectTrigger className="h-8 text-[12px] w-full" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto" className="text-[12px]">
                Auto
              </SelectItem>
              <SelectItem value="light" className="text-[12px]">
                Light
              </SelectItem>
              <SelectItem value="dark" className="text-[12px]">
                Dark
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border border-border bg-card p-4 space-y-4">
        <div>
          <h3 className="text-[13px] font-medium">Page Typography</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className="text-[12px] text-muted-foreground">
              Font Family
            </Label>
            <Select
              value={pageFontFamily}
              onValueChange={(value) =>
                setPageFontFamily(value as FontFamilyValue)
              }
            >
              <SelectTrigger className="h-8 text-[12px] w-full" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {FONT_FAMILY_OPTIONS.map((font) => (
                  <SelectItem
                    key={font.value}
                    value={font.value}
                    className="text-[12px]"
                  >
                    {font.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[12px] text-muted-foreground">
              Font Size
            </Label>
            <Input
              type="number"
              value={pageFontSize}
              min={11}
              max={20}
              onChange={(event) => setPageFontSize(Number(event.target.value))}
              className="h-8 text-[12px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[12px] text-muted-foreground">
              Line Height
            </Label>
            <Input
              type="number"
              value={pageLineHeight}
              min={1}
              max={2.2}
              step={0.05}
              onChange={(event) =>
                setPageLineHeight(Number(event.target.value))
              }
              className="h-8 text-[12px]"
            />
          </div>
        </div>
      </div>

      <div className="border border-border bg-card p-4 space-y-4">
        <div>
          <h3 className="text-[13px] font-medium">Comment Typography</h3>
        </div>
        <div className="space-y-1 max-w-sm">
          <Label className="text-[12px] text-muted-foreground">Sans Font</Label>
          <Select
            value={commentFontFamily}
            onValueChange={(value) =>
              setCommentFontFamily(value as FontFamilyValue)
            }
          >
            <SelectTrigger className="h-8 text-[12px] w-full" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              {SANS_FONT_FAMILY_OPTIONS.map((font) => (
                <SelectItem
                  key={font.value}
                  value={font.value}
                  className="text-[12px]"
                >
                  {font.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function TreeTab() {
  const {
    setTreeFontFamily,
    setTreeFontSize,
    setTreeLineHeight,
    treeFontFamily,
    treeFontSize,
    treeLineHeight,
  } = useAppearance();
  const { compactSingleChildDirectories, setCompactSingleChildDirectories } =
    useFileTree();

  return (
    <div className="space-y-5">
      <div className="border border-border bg-card p-4 space-y-4">
        <div>
          <h3 className="text-[13px] font-medium">Directory Tree</h3>
          <p className="text-[12px] text-muted-foreground">
            Control how folders are displayed in the sidebar tree.
          </p>
        </div>
        <div className="flex items-start justify-between gap-4 border border-border bg-background px-3 py-2.5">
          <div className="space-y-1">
            <Label
              htmlFor="tree-compact-single-child"
              className="text-[12px] text-foreground"
            >
              Compact single-child folder chains
            </Label>
            <p className="text-[11px] text-muted-foreground">
              Example: services/foo/bar/file.php displays as services/foo/bar
              when this is a linear directory chain.
            </p>
          </div>
          <Switch
            id="tree-compact-single-child"
            checked={compactSingleChildDirectories}
            onCheckedChange={setCompactSingleChildDirectories}
            size="sm"
          />
        </div>
      </div>
      <div className="border border-border bg-card p-4 space-y-4">
        <div>
          <h3 className="text-[13px] font-medium">File Tree Typography</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className="text-[12px] text-muted-foreground">
              Font Family
            </Label>
            <Select
              value={treeFontFamily}
              onValueChange={(value) =>
                setTreeFontFamily(value as FontFamilyValue)
              }
            >
              <SelectTrigger className="h-8 text-[12px] w-full" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {FONT_FAMILY_OPTIONS.map((font) => (
                  <SelectItem
                    key={font.value}
                    value={font.value}
                    className="text-[12px]"
                  >
                    {font.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[12px] text-muted-foreground">
              Font Size
            </Label>
            <Input
              type="number"
              value={treeFontSize}
              min={10}
              max={18}
              onChange={(event) => setTreeFontSize(Number(event.target.value))}
              className="h-8 text-[12px]"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[12px] text-muted-foreground">
              Line Height
            </Label>
            <Input
              type="number"
              value={treeLineHeight}
              min={1}
              max={2.2}
              step={0.05}
              onChange={(event) =>
                setTreeLineHeight(Number(event.target.value))
              }
              className="h-8 text-[12px]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkspaceTab({ onDisconnect }: { onDisconnect?: () => void }) {
  return (
    <div className="space-y-4">
      <div>
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
  const showWorkspaceTab = Boolean(onDisconnect);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0"
          aria-label="Settings"
        >
          <Settings className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-5 py-4 border-b border-border bg-secondary">
          <DialogTitle className="text-[14px] font-medium flex items-center gap-2">
            <Settings className="size-4" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 min-h-0">
          <div className="w-56 border-r border-border bg-sidebar">
            <nav className="p-3 space-y-1.5">
              <button
                type="button"
                onClick={() => setActiveTab("diff")}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2.5 text-[13px] transition-colors",
                  activeTab === "diff"
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50",
                )}
              >
                <SlidersHorizontal className="size-4" />
                Diff Settings
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("tree")}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2.5 text-[13px] transition-colors",
                  activeTab === "tree"
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50",
                )}
              >
                <FolderOpen className="size-4" />
                Directory Tree
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("appearance")}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2.5 text-[13px] transition-colors",
                  activeTab === "appearance"
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50",
                )}
              >
                <Palette className="size-4" />
                General Appearance
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("shortcuts")}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2.5 text-[13px] transition-colors",
                  activeTab === "shortcuts"
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50",
                )}
              >
                <Keyboard className="size-4" />
                Keyboard Shortcuts
              </button>
              {showWorkspaceTab && (
                <button
                  type="button"
                  onClick={() => setActiveTab("workspace")}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2.5 text-[13px] transition-colors",
                    activeTab === "workspace"
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent/50",
                  )}
                >
                  <MonitorCog className="size-4" />
                  Workspace
                </button>
              )}
            </nav>
          </div>

          <div className="flex-1 p-5 overflow-auto">
            {activeTab === "diff" && (
              <DiffSettingsTab
                workspaceMode={workspaceMode}
                onWorkspaceModeChange={onWorkspaceModeChange}
              />
            )}
            {activeTab === "appearance" && <AppearanceTab />}
            {activeTab === "tree" && <TreeTab />}
            {activeTab === "shortcuts" && <ShortcutsTab />}
            {activeTab === "workspace" && (
              <WorkspaceTab onDisconnect={onDisconnect} />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
