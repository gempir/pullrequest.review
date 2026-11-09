declare module "bun:test" {
    interface Matchers {
        readonly not: Matchers;
        readonly rejects: Matchers & { toThrow(expected?: string): Promise<void> };
        toBeNull(): void;
        toHaveLength(expected: number): void;
        toBe(expected: unknown): void;
        toBeTrue(): void;
        toBeFalse(): void;
        toBeUndefined(): void;
        toBeGreaterThan(expected: number): void;
        toContain(expected: string): void;
        toEqual(expected: unknown): void;
        toBeInstanceOf(expected: new (...args: never[]) => unknown): void;
    }

    type TestFn = () => void | Promise<void>;

    export const describe: (name: string, fn: () => void) => void;
    export const test: ((name: string, fn: TestFn) => void) & {
        each: <T>(cases: readonly T[]) => (name: string, fn: (value: T) => void | Promise<void>) => void;
    };
    export const beforeEach: (fn: TestFn) => void;
    export const afterEach: (fn: TestFn) => void;
    export const expect: (actual: unknown) => Matchers;
}
