#!/usr/bin/env node
// gcal-lite-mcp: Google Calendar for agents, to read and to make events.
// `npx gcal-lite-mcp auth` signs in once; run without arguments it is an
// MCP server on stdio.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { signIn } from './auth.js'
import { calendars, createEvent, events, getEvent } from './calendar.js'

const VERSION = '0.1.0'

if (process.argv[2] === 'auth') {
  signIn().then(() => process.exit(0), (error) => { console.error(error.message); process.exit(1) })
} else {
  const server = new McpServer({ name: 'gcal-lite-mcp', version: VERSION })
  const answer = (fn) => async (args) => {
    try {
      return { content: [{ type: 'text', text: JSON.stringify(await fn(args), null, 2) }] }
    } catch (error) {
      return { content: [{ type: 'text', text: error.message }], isError: true }
    }
  }
  const readOnly = { readOnlyHint: true, openWorldHint: true }
  const calendar = z.string().optional().describe('a calendar id from calendars; your own calendar when left out')

  server.registerTool('calendars', {
    description: 'The calendars you can see: your own, shared ones and subscriptions, with their ids.',
    inputSchema: {},
    annotations: readOnly,
  }, answer(() => calendars()))

  server.registerTool('events', {
    description: 'Events in a stretch of time, soonest first, repeating events shown one by one. Each has its id, title, start, end, location, your response, the number of attendees, a Meet link and a link to open it.',
    inputSchema: {
      calendar,
      from: z.string().optional().describe('start, as 2026-10-20 or 2026-10-20T09:00:00-04:00; now when left out'),
      to: z.string().optional().describe('end, in the same form; no end when left out'),
      query: z.string().optional().describe('words to find in titles, descriptions, locations and attendees'),
      max: z.number().int().min(1).max(250).optional().describe('how many events, default 50'),
      page_token: z.string().optional().describe('next_page_token from the previous call, for more'),
    },
    annotations: readOnly,
  }, answer(({ calendar, from, to, query, max, page_token }) => events({ calendar, from, to, query, max, pageToken: page_token })))

  server.registerTool('get_event', {
    description: 'One event in full: its description and every attendee with their response.',
    inputSchema: { calendar, id: z.string().describe('the event id from events') },
    annotations: readOnly,
  }, answer(getEvent))

  server.registerTool('create_event', {
    description: 'Makes an event. A date alone (2026-10-21) for start and end makes an all-day event, the end day not included. Attendees get Google\'s invitation email only when invite is true. The event is the person\'s own: write its title and description as they would, with no mention of an AI, an assistant or who drafted it.',
    inputSchema: {
      calendar,
      title: z.string(),
      start: z.string().describe('2026-10-21T14:00:00-04:00, or 2026-10-21 for all day'),
      end: z.string().describe('in the same form as start'),
      time_zone: z.string().optional().describe('an IANA zone like America/New_York, for times given without an offset'),
      location: z.string().optional(),
      description: z.string().optional(),
      attendees: z.array(z.string()).optional().describe('email addresses'),
      invite: z.boolean().optional().describe('email the attendees an invitation; false when left out'),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  }, answer(({ time_zone, ...args }) => createEvent({ ...args, timeZone: time_zone })))

  await server.connect(new StdioServerTransport())
}
