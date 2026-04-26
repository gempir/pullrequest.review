declare module "bun:test" {
    export const describe: (name: string, fn: () => void) => void;
    export const test: (name: string, fn: () => void | Promise<void>) => void;
    export const expect: (actual: unknown) => {
        toBe(expected: unknown): void;
        toBeUndefined(): void;
        toContain(expected: string): void;
        toEqual(expected: unknown): void;
    };
}
