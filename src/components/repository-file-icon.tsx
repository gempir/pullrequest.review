import { File, FileArchive, FileCode2, FileImage, FileJson2, FileSpreadsheet, FileText } from "lucide-react";
import type { ComponentType } from "react";
import { cn } from "@/lib/utils";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"]);

const CODE_EXTENSIONS = new Set([
    "ts",
    "tsx",
    "js",
    "jsx",
    "mjs",
    "cjs",
    "py",
    "go",
    "rs",
    "java",
    "kt",
    "swift",
    "rb",
    "php",
    "c",
    "h",
    "cc",
    "cpp",
    "cs",
    "sh",
    "bash",
    "zsh",
]);

const TEXT_EXTENSIONS = new Set(["txt", "md", "mdx", "rst", "log", "env", "ini", "toml", "yaml", "yml"]);

const SPREADSHEET_EXTENSIONS = new Set(["csv", "tsv", "xlsx", "xls"]);
const ARCHIVE_EXTENSIONS = new Set(["zip", "tar", "gz", "tgz", "bz2", "7z", "rar"]);

function extensionOf(fileName: string) {
    const dotIndex = fileName.lastIndexOf(".");
    if (dotIndex < 0 || dotIndex === fileName.length - 1) return "";
    return fileName.slice(dotIndex + 1).toLowerCase();
}

function iconForExtension(extension: string): ComponentType<{ className?: string }> {
    if (!extension) return File;
    if (extension === "json" || extension === "jsonc" || extension === "json5") {
        return FileJson2;
    }
    if (IMAGE_EXTENSIONS.has(extension)) return FileImage;
    if (SPREADSHEET_EXTENSIONS.has(extension)) return FileSpreadsheet;
    if (ARCHIVE_EXTENSIONS.has(extension)) return FileArchive;
    if (TEXT_EXTENSIONS.has(extension)) return FileText;
    if (CODE_EXTENSIONS.has(extension)) return FileCode2;
    return File;
}

export function RepositoryFileIcon({ fileName, className }: { fileName: string; className?: string }) {
    const extension = extensionOf(fileName);
    const Icon = iconForExtension(extension);

    return <Icon className={cn("shrink-0", className)} aria-hidden />;
}
