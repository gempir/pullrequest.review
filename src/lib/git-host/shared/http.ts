export async function parseFailureBody(response: Response) {
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
