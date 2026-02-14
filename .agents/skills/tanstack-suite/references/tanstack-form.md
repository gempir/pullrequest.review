# TanStack Form

Official docs: https://tanstack.com/form/latest

TanStack Form provides **type-safe form state**, validation, and field-level reactivity.

Use it when you want:

- Predictable form state (values, touched/dirty, errors, submission state)
- Fine-grained reactivity (fields update without rerendering the whole form)
- A validation model that supports sync + async and composes well

This reference focuses on the **React adapter**.

## Install (React)

```bash
npm i @tanstack/react-form
```

Optional: if using TanStack Start integration helpers:

```bash
npm i @tanstack/react-form-start
```

## Minimal example

```tsx
import * as React from 'react'
import { useForm, Field } from '@tanstack/react-form'

export function SignupForm() {
  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      // call a server function / mutation here
      console.log(value)
    },
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
    >
      <Field
        form={form}
        name="email"
        validators={{
          onChange: ({ value }) => (!value.includes('@') ? 'Invalid email' : undefined),
        }}
      >
        {(field) => (
          <div>
            <label>Email</label>
            <input
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              onBlur={field.handleBlur}
            />
            {field.state.meta.touchedErrors ? (
              <div>{field.state.meta.touchedErrors}</div>
            ) : null}
          </div>
        )}
      </Field>

      <button type="submit" disabled={form.state.isSubmitting}>
        Submit
      </button>
    </form>
  )
}
```

## Validation patterns

- Use **field validators** for local, fast checks.
- Use **form-level validators** for cross-field constraints.
- Keep **server validation canonical** (the source of truth). Client validation is UX.

If you use a schema library (e.g. Zod), prefer a single shared schema used by:

- Client validation (optional)
- Server validation (required)
- Tool schemas (if using AI)

## Submission patterns

### With Query

Use `useMutation` for submission and map errors back to the form:

- `mutationFn` performs the server request
- `onSuccess` invalidates or updates relevant queries
- `onError` maps to form/field errors

### With Start / Router actions

For full-stack apps:

- Use Start server functions or Router actions for server-side submission.
- Return structured errors, e.g. `{ fieldErrors: { email: '...' }, formError: '...' }`.

## Devtools

TanStack Form integrates with **TanStack Devtools**.

Install:

```bash
npm i @tanstack/react-devtools
npm i @tanstack/react-form-devtools
```

Then (dev-only):

```tsx
import { TanStackDevtools } from '@tanstack/react-devtools'
import { formDevtoolsPlugin } from '@tanstack/react-form-devtools'

export function Devtools() {
  if (import.meta.env.PROD) return null
  return <TanStackDevtools plugins={[formDevtoolsPlugin()]} />
}
```

## Common pitfalls

- Creating the form object conditionally (should be stable per component instance)
- Trying to mirror Query data into form state without explicit mapping
- Returning unstructured errors from the server (hard to map to fields)

## Next references

- Query: `references/tanstack-query.md`
- Start: `references/tanstack-start.md`
- Devtools: `references/tanstack-devtools.md`
