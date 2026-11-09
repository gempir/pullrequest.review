import { HostApiError } from "@/lib/git-host/types";

async function parseFailureBody(response: Response) {
    const contentType = response.headers.get("content-type") ?? "";
    try {
        if (contentType.includes("application/json")) {
            const json = (await response.json()) as { message?: string };
            return json.message ?? JSON.stringify(json);
        }
        return await response.text();
    } catch {
        return "";
    }
}

export async function throwIfNotOk(response: Response, label: string) {
    if (response.ok) return response;
    const body = await parseFailureBody(response);
    const status = `${response.status} ${response.statusText}`;
    throw new HostApiError(body ? `${label} failed (${status}): ${body}` : `${label} failed (${status})`, {
        status: response.status,
        statusText: response.statusText,
        body,
    });
}

export function encodeFilePath(path: string) {
    return path.replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/");
}

export async function mapWithConcurrency<TInput, TOutput>(values: TInput[], concurrency: number, mapper: (value: TInput) => Promise<TOutput>) {
    const results = new Array<TOutput>(values.length);
    let index = 0;
    const runNext = async (): Promise<void> => {
        const current = index;
        index += 1;
        if (current >= values.length) return;
        results[current] = await mapper(values[current]);
        return runNext();
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, runNext));
    return results;
}

export const REPO_PULL_REQUEST_LIST_LIMIT = 100;
