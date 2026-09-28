import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ReviewRightSidebar } from "../src/components/pull-request-review/review-right-sidebar";
import { getPaneWidthForResizeKey } from "../src/components/pull-request-review/use-review-layout-preferences";

describe("review pane resizers", () => {
    test("resizes a left pane with arrow, Home, and End keys", () => {
        expect(getPaneWidthForResizeKey("ArrowLeft", 280, 180, 720, -1)).toBe(264);
        expect(getPaneWidthForResizeKey("ArrowRight", 280, 180, 720, -1)).toBe(296);
        expect(getPaneWidthForResizeKey("Home", 280, 180, 720, -1)).toBe(180);
        expect(getPaneWidthForResizeKey("End", 280, 180, 720, -1)).toBe(720);
        expect(getPaneWidthForResizeKey("Enter", 280, 180, 720, -1)).toBeNull();
    });

    test("uses the separator's visual direction for a right pane and clamps its width", () => {
        expect(getPaneWidthForResizeKey("ArrowLeft", 320, 240, 520, 1)).toBe(336);
        expect(getPaneWidthForResizeKey("ArrowRight", 320, 240, 520, 1)).toBe(304);
        expect(getPaneWidthForResizeKey("ArrowRight", 240, 240, 520, 1)).toBe(240);
        expect(getPaneWidthForResizeKey("ArrowLeft", 520, 240, 520, 1)).toBe(520);
    });

    test("renders the right pane handle as a valued vertical separator with a 24px hit target", () => {
        const html = renderToStaticMarkup(
            <ReviewRightSidebar width={320} collapsed={false} title="Comments" onToggleCollapsed={() => {}} onStartResize={() => {}}>
                Comments
            </ReviewRightSidebar>,
        );

        expect(html).toContain("<hr");
        expect(html).toContain('tabindex="0"');
        expect(html).toContain('aria-orientation="vertical"');
        expect(html).toContain('aria-valuemin="240"');
        expect(html).toContain('aria-valuemax="520"');
        expect(html).toContain('aria-valuenow="320"');
        expect(html).toContain('aria-valuetext="320 pixels"');
        expect(html).toContain("w-6 cursor-col-resize");
    });
});
