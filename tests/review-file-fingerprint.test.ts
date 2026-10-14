import { describe, expect, test } from "bun:test";
import { parsePatchFiles } from "@pierre/diffs";
import { buildFileDiffFingerprint } from "../src/lib/review-file-fingerprint";

function parseFile(patch: string) {
    const file = parsePatchFiles(patch)[0]?.files[0];
    if (!file) throw new Error("Expected a file diff");
    return file;
}

describe("review file fingerprints", () => {
    test("keeps a Bitbucket file viewed when only the base blob and hunk position change", () => {
        const before = parseFile(`diff --git a/src/a.ts b/src/a.ts
index 1111111..2222222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,3 +1,3 @@
 context
-old
+new
 context
`);
        const after = parseFile(`diff --git a/src/a.ts b/src/a.ts
index 3333333..2222222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -40,3 +1,3 @@
 context
-old
+new
 context
`);

        expect(buildFileDiffFingerprint(after)).toBe(buildFileDiffFingerprint(before));
    });

    test("detects a new Bitbucket blob even when the parsed diff has no text hunks", () => {
        const before = parseFile(`diff --git a/logo.png b/logo.png
index 1111111..2222222 100644
Binary files a/logo.png and b/logo.png differ
`);
        const after = parseFile(`diff --git a/logo.png b/logo.png
index 1111111..3333333 100644
Binary files a/logo.png and b/logo.png differ
`);

        expect(before.hunks).toHaveLength(0);
        expect(buildFileDiffFingerprint(after)).not.toBe(buildFileDiffFingerprint(before));
    });

    test("detects a Bitbucket text edit with the same hunk shape", () => {
        const before = parseFile(`diff --git a/src/a.ts b/src/a.ts
index 1111111..2222222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1 +1 @@
-old
+first
`);
        const after = parseFile(`diff --git a/src/a.ts b/src/a.ts
index 1111111..3333333 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1 +1 @@
-old
+second
`);

        expect(buildFileDiffFingerprint(after)).not.toBe(buildFileDiffFingerprint(before));
    });

    test("falls back to changed lines when the diff has no object IDs", () => {
        const before = parseFile(`diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,3 +1,3 @@
 context
-old
+new
 context
`);
        const shifted = parseFile(`diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -40,3 +1,3 @@
 context
-old
+new
 context
`);
        const changed = parseFile(`diff --git a/src/a.ts b/src/a.ts
--- a/src/a.ts
+++ b/src/a.ts
@@ -40,3 +1,3 @@
 context
-old
+newer
 context
`);

        expect(buildFileDiffFingerprint(shifted)).toBe(buildFileDiffFingerprint(before));
        expect(buildFileDiffFingerprint(changed)).not.toBe(buildFileDiffFingerprint(shifted));
    });

    test("detects mode changes even when file content stays the same", () => {
        const before = parseFile(`diff --git a/script.sh b/script.sh
index 1111111..2222222 100644
--- a/script.sh
+++ b/script.sh
@@ -1 +1 @@
-old
+new
`);
        const executable = parseFile(`diff --git a/script.sh b/script.sh
old mode 100644
new mode 100755
index 1111111..2222222
--- a/script.sh
+++ b/script.sh
@@ -1 +1 @@
-old
+new
`);

        expect(buildFileDiffFingerprint(executable)).not.toBe(buildFileDiffFingerprint(before));
    });

    test("uses the removed blob for deleted files", () => {
        const before = parseFile(`diff --git a/old.txt b/old.txt
deleted file mode 100644
index 1111111..0000000
--- a/old.txt
+++ /dev/null
@@ -1 +0,0 @@
-old
`);
        const after = parseFile(`diff --git a/old.txt b/old.txt
deleted file mode 100644
index 2222222..0000000
--- a/old.txt
+++ /dev/null
@@ -1 +0,0 @@
-old
`);

        expect(buildFileDiffFingerprint(after)).not.toBe(buildFileDiffFingerprint(before));
    });
});
