// Google Calendar's REST API: the calendars the person sees, their events
// over a stretch of time, one event in full, and making a new one.

import { accessToken } from './auth.js'

const API = 'https://www.googleapis.com/calendar/v3'

async function call(method, path, params = {}, payload = null) {
  const url = new URL(`${API}${path}`)
  for (const [key, value] of Object.entries(params)) if (value != null) url.searchParams.set(key, String(value))
  const response = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${await accessToken()}`, ...(payload ? { 'content-type': 'application/json' } : {}) },
    body: payload ? JSON.stringify(payload) : undefined,
  })
  const body = await response.json()
  if (!response.ok) throw new Error(`Google Calendar: ${body.error?.message || response.status}`)
  return body
}
const get = (path, params) => call('GET', path, params)

const compact = (value) => Object.fromEntries(Object.entries(value).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length)))

export async function calendars() {
  const list = await get('/users/me/calendarList')
  return (list.items ?? []).map((c) => compact({
    id: c.id,
    name: c.summaryOverride || c.summary,
    primary: c.primary || null,
    access: c.accessRole,
    time_zone: c.timeZone,
  }))
}

// a date alone is the start of that day, in the calendar's own time zone
const moment = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value

function when(point) {
  return point?.dateTime ?? point?.date ?? null
}

function event(e, { full }) {
  const meet = e.hangoutLink || e.conferenceData?.entryPoints?.find((p) => p.entryPointType === 'video')?.uri
  return compact({
    id: e.id,
    title: e.summary ?? '(no title)',
    start: when(e.start),
    end: when(e.end),
    all_day: e.start?.date ? true : null,
    location: e.location,
    status: e.status !== 'confirmed' ? e.status : null,
    organizer: e.organizer?.self ? null : e.organizer?.email,
    your_response: e.attendees?.find((a) => a.self)?.responseStatus,
    attendees: full
      ? e.attendees?.map((a) => compact({ email: a.email, name: a.displayName, response: a.responseStatus, organizer: a.organizer || null }))
      : e.attendees?.length,
    meet,
    recurring: e.recurringEventId ? true : null,
    description: full ? e.description : null,
    link: e.htmlLink,
  })
}

export async function events({ calendar = 'primary', from, to, query, max = 50, pageToken }) {
  const start = moment(from ?? new Date().toISOString())
  const list = await get(`/calendars/${encodeURIComponent(calendar)}/events`, {
    timeMin: start,
    timeMax: to ? moment(to) : null,
    q: query,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: Math.min(Math.max(1, max), 250),
    pageToken,
  })
  return { time_zone: list.timeZone, events: (list.items ?? []).map((e) => event(e, { full: false })), next_page_token: list.nextPageToken ?? null }
}

export async function getEvent({ calendar = 'primary', id }) {
  return event(await get(`/calendars/${encodeURIComponent(calendar)}/events/${encodeURIComponent(id)}`), { full: true })
}

// a time as Google takes it: a date alone is an all-day event's day
const point = (value, timeZone) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? { date: value } : { dateTime: value, ...(timeZone ? { timeZone } : {}) }

export async function createEvent({ calendar = 'primary', title, start, end, timeZone, location, description, attendees = [], invite = false }) {
  const made = await call('POST', `/calendars/${encodeURIComponent(calendar)}/events`, { sendUpdates: invite ? 'all' : 'none' }, {
    summary: title,
    start: point(start, timeZone),
    end: point(end, timeZone),
    location,
    description,
    attendees: attendees.map((email) => ({ email })),
  })
  return event(made, { full: true })
}
