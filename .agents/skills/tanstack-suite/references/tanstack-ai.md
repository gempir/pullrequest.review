# TanStack AI

Official docs: https://tanstack.com/ai/latest

TanStack AI is a **type-safe AI SDK** for building AI-powered apps:

- Provider-agnostic adapters (OpenAI, Anthropic, Gemini, Ollama, etc.)
- Streaming responses
- Tool calling with type-safe definitions
- Observability + devtools

TanStack AI is new/alpha; confirm exact APIs against the official docs when implementing.

## Packages (React)

Core:

```bash
npm i @tanstack/ai
```

React adapter:

```bash
npm i @tanstack/ai-react
```

Provider adapter (choose one):

```bash
npm i @tanstack/ai-openai
# or: @tanstack/ai-anthropic, @tanstack/ai-gemini, @tanstack/ai-ollama, ...
```

## Security model

- Keep provider keys **on the server**.
- Expose a server endpoint or Start server function that the client can call.
- Do not ship provider SDKs or keys to the browser.

## Tools

TanStack AI supports defining tools with schemas so inputs/outputs are typed.

Conceptual example:

```ts
import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

export const getWeatherTool = toolDefinition({
  name: 'getWeather',
  description: 'Get the weather for a city',
  input: z.object({ city: z.string() }),
  output: z.object({ summary: z.string() }),
})
```

Then register tools in your server-side AI adapter/agent configuration.

## Streaming

Typical pattern:

- Server streams tokens/chunks to client (SSE or similar)
- Client consumes stream and updates UI incrementally

## Devtools

TanStack AI integrates with **TanStack Devtools**.

Install:

```bash
npm install -D @tanstack/react-ai-devtools @tanstack/react-devtools
```

Usage:

```tsx
import { TanStackDevtools } from '@tanstack/react-devtools'
import { aiDevtoolsPlugin } from '@tanstack/react-ai-devtools'

export function Devtools() {
  if (import.meta.env.PROD) return null
  return (
    <TanStackDevtools
      plugins={[aiDevtoolsPlugin()]}
      eventBusConfig={{
        // important: connects the client panel to the server event bus
        connectToServerBus: true,
      }}
    />
  )
}
```

## Common pitfalls

- Accidentally exposing provider keys on the client.
- Not validating tool inputs/outputs.
- Not handling streaming termination/cancellation.

## Next references

- Start (server-only code): `references/tanstack-start.md`
- Devtools: `references/tanstack-devtools.md`
