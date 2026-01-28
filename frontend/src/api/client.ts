const API_BASE = '/api';

interface ApiError {
  error: string;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error((data as ApiError).error || 'Request failed');
  }
  return response.json();
}

// Auth API
export interface User {
  id: number;
  email: string;
  created_at?: string;
}

export async function login(email: string, password: string): Promise<{ user: User }> {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  return handleResponse(response);
}

export async function register(email: string, password: string): Promise<{ user: User }> {
  const response = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  return handleResponse(response);
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  });
}

export async function getCurrentUser(): Promise<User> {
  const response = await fetch(`${API_BASE}/auth/me`, {
    credentials: 'include',
  });
  return handleResponse(response);
}

// API Keys
export interface ApiKey {
  id: number;
  name: string;
  key_preview?: string;
  key?: string;
  created_at: string;
}

export async function getApiKeys(): Promise<ApiKey[]> {
  const response = await fetch(`${API_BASE}/keys`, {
    credentials: 'include',
  });
  return handleResponse(response);
}

export async function createApiKey(name: string): Promise<ApiKey> {
  const response = await fetch(`${API_BASE}/keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name }),
  });
  return handleResponse(response);
}

export async function deleteApiKey(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/keys/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  await handleResponse(response);
}

// Calendar Sources
export interface CalendarSource {
  id: number;
  name: string;
  color: string;
  last_sync: string | null;
}

export async function getSources(): Promise<CalendarSource[]> {
  const response = await fetch(`${API_BASE}/sources`, {
    credentials: 'include',
  });
  return handleResponse(response);
}

export async function updateSource(id: number, data: { name?: string; color?: string }): Promise<CalendarSource> {
  const response = await fetch(`${API_BASE}/sources/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

// Events
export interface CalendarEvent {
  id: number;
  source_id: number;
  external_id: string | null;
  title: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  notes: string | null;
  all_day: boolean;
  calendar_name: string | null;
  source_name: string;
  source_color: string;
}

export async function getEvents(start: string, end: string): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({ start, end });
  const response = await fetch(`${API_BASE}/events?${params}`, {
    credentials: 'include',
  });
  return handleResponse(response);
}

// Agenda Items
export interface AgendaItem {
  id: number;
  text: string;
  date: string;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export async function getAgendaItems(start: string, end: string): Promise<AgendaItem[]> {
  const params = new URLSearchParams({ start, end, include_completed: 'true' });
  const response = await fetch(`${API_BASE}/agenda/range?${params}`, {
    credentials: 'include',
  });
  return handleResponse(response);
}

export async function createAgendaItem(text: string, date?: string): Promise<AgendaItem> {
  const response = await fetch(`${API_BASE}/agenda`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ text, date }),
  });
  return handleResponse(response);
}

export async function updateAgendaItem(id: number, data: { text?: string; completed?: boolean }): Promise<AgendaItem> {
  const response = await fetch(`${API_BASE}/agenda/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function deleteAgendaItem(id: number): Promise<void> {
  const response = await fetch(`${API_BASE}/agenda/${id}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  await handleResponse(response);
}

export async function rolloverAgenda(): Promise<{ items_moved: number }> {
  const response = await fetch(`${API_BASE}/agenda/rollover`, {
    method: 'POST',
    credentials: 'include',
  });
  return handleResponse(response);
}

// Availability Settings
export interface AvailabilitySettings {
  id: number;
  user_id: number;
  enabled: boolean;
  start_hour: number;
  end_hour: number;
  share_token: string | null;
  days_ahead: number;
  created_at: string;
  updated_at: string;
}

export async function getAvailabilitySettings(): Promise<AvailabilitySettings> {
  const response = await fetch(`${API_BASE}/availability`, {
    credentials: 'include',
  });
  return handleResponse(response);
}

export async function updateAvailabilitySettings(data: {
  enabled?: boolean;
  start_hour?: number;
  end_hour?: number;
  days_ahead?: number;
}): Promise<AvailabilitySettings> {
  const response = await fetch(`${API_BASE}/availability`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  return handleResponse(response);
}

export async function regenerateShareToken(): Promise<AvailabilitySettings> {
  const response = await fetch(`${API_BASE}/availability/regenerate-token`, {
    method: 'POST',
    credentials: 'include',
  });
  return handleResponse(response);
}

// Calendar Colors
export interface CalendarColor {
  id: number;
  user_id: number;
  calendar_name: string;
  color: string;
}

export async function getCalendarColors(): Promise<CalendarColor[]> {
  const response = await fetch(`${API_BASE}/calendar-colors`, {
    credentials: 'include',
  });
  return handleResponse(response);
}

export async function updateCalendarColor(name: string, color: string): Promise<CalendarColor> {
  const response = await fetch(`${API_BASE}/calendar-colors/${encodeURIComponent(name)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ color }),
  });
  return handleResponse(response);
}

// Public availability
export interface TimeSlot {
  start: string;
  end: string;
  status: 'free' | 'busy';
}

export interface DayAvailability {
  date: string;
  slots: TimeSlot[];
}

export interface PublicAvailability {
  start_hour: number;
  end_hour: number;
  days: DayAvailability[];
}

export async function getPublicAvailability(token: string): Promise<PublicAvailability> {
  const response = await fetch(`${API_BASE}/availability/public/${token}`);
  return handleResponse(response);
}
