export function motionSafeScrollBehavior(preferred: ScrollBehavior = "smooth"): ScrollBehavior {
    if (preferred !== "smooth" || typeof window === "undefined") return preferred;
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
