declare module "bun:test" {
    interface Matchers {
        readonly not: Matchers;
        toBeNull(): void;
        toHaveLength(expected: number): void;
        toBe(expected: unknown): void;
        toBeUndefined(): void;
        toContain(expected: string): void;
        toEqual(expected: unknown): void;
    }

    export const describe: (name: string, fn: () => void) => void;
    export const test: (name: string, fn: () => void | Promise<void>) => void;
    export const expect: (actual: unknown) => Matchers;
}
