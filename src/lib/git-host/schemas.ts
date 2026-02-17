import * as v from "valibot";

const gitHostSchema = v.picklist(["bitbucket", "github"]);

export const githubAuthSchema = v.object({
    token: v.string(),
});

export const bitbucketAuthSchema = v.object({
    email: v.string(),
    apiToken: v.string(),
});

export const pullRequestBundleSchema = v.object({
    prRef: v.object({
        host: gitHostSchema,
        workspace: v.string(),
        repo: v.string(),
        pullRequestId: v.string(),
    }),
    pr: v.object({
        id: v.number(),
        title: v.string(),
        state: v.string(),
    }),
    diff: v.string(),
    diffstat: v.array(v.unknown()),
    commits: v.array(v.unknown()),
    comments: v.array(v.unknown()),
    history: v.optional(v.array(v.unknown())),
    reviewers: v.optional(v.array(v.unknown())),
    buildStatuses: v.optional(v.array(v.unknown())),
});

export function parseSchema<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
    schema: TSchema,
    value: unknown,
): v.InferOutput<TSchema> | null {
    const result = v.safeParse(schema, value);
    if (!result.success) return null;
    return result.output;
}
