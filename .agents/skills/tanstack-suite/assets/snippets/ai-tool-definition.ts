import { toolDefinition } from '@tanstack/ai'
import { z } from 'zod'

/**
 * Example tool definition.
 * Keep tool schemas small and explicit.
 */
export const getWeatherTool = toolDefinition({
  name: 'getWeather',
  description: 'Get the weather for a city',
  input: z.object({
    city: z.string(),
  }),
  output: z.object({
    summary: z.string(),
  }),
})
