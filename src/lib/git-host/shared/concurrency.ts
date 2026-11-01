export async function mapWithConcurrency<TInput, TOutput>(values: TInput[], concurrency: number, mapper: (value: TInput, index: number) => Promise<TOutput>) {
    if (values.length === 0) return [] as TOutput[];
    const safeConcurrency = Math.max(1, Math.min(concurrency, values.length));
    const results = new Array<TOutput>(values.length);
    let index = 0;

    const runNext = async (): Promise<void> => {
        const current = index;
        index += 1;
        if (current >= values.length) return;
        results[current] = await mapper(values[current], current);
        return runNext();
    };

    const workers = Array.from({ length: safeConcurrency }, () => runNext());

    await Promise.all(workers);
    return results;
}
