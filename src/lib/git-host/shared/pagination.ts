/** Max pull requests to load per repository for list/omnibar views. */
export const REPO_PULL_REQUEST_LIST_LIMIT = 100;

export async function collectPaginated<T>(fetchPage: (page: number) => Promise<T[]>, pageSize = 100, maxItems?: number) {
    const values: T[] = [];
    let page = 1;

    while (true) {
        const current = await fetchPage(page);
        values.push(...current);
        if (maxItems !== undefined && values.length >= maxItems) {
            return values.slice(0, maxItems);
        }
        if (current.length < pageSize) break;
        page += 1;
    }

    return values;
}
