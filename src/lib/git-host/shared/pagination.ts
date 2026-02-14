export async function collectPaginated<T>(
  fetchPage: (page: number) => Promise<T[]>,
  pageSize = 100,
) {
  const values: T[] = [];
  let page = 1;

  while (true) {
    const current = await fetchPage(page);
    values.push(...current);
    if (current.length < pageSize) break;
    page += 1;
  }

  return values;
}
