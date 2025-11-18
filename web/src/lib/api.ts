import axios from 'axios'

export const API_BASE = (import.meta as any).env.VITE_API_BASE || `${window.location.protocol}//${window.location.hostname}:8000`

export type Task = 'heart' | 'diabetes' | 'parkinsons' | 'general'

export function authHeaders(token?: string) {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function getFeatureSchema(task: Task, token?: string) {
  const res = await axios.get(`${API_BASE}/features/schema`, {
    params: { task },
    headers: { ...authHeaders(token) },
  })
  return res.data
}

export async function ingestReport(task: Task, file: File, token?: string) {
  const form = new FormData()
  form.append('file', file)
  // task goes in query
  const res = await axios.post(`${API_BASE}/ingest/report`, form, {
    params: { task },
    headers: { ...authHeaders(token) },
  })
  return res.data as {
    report_id: string
    extracted: Record<string, any>
    missing_fields: string[]
    warnings?: string[]
    extracted_meta?: Record<string, { value: any; unit?: string|null; confidence?: number; source?: string }>
    task: string
    raw_text?: string
    out_of_range_fields?: string[]
  }
}

export async function predictWithFeatures(
  task: Task,
  features: Record<string, any>,
  reportId?: string,
  token?: string,
) {
  const res = await axios.post(
    `${API_BASE}/predict/with_features`,
    { task, features, report_id: reportId },
    { headers: { 'Content-Type': 'application/json', ...authHeaders(token) } },
  )
  return res.data as {
    task: Task
    label: number
    probability: number
    health_score: number
    top_contributors?: string[]
    warnings?: string[]
    prediction_id: string
  }
}

export async function triage(
  task: Task,
  features: Record<string, any>,
  modelOutput: { label: number; probability: number; health_score: number } | null | undefined,
  complaint: string,
  token?: string,
) {
  const res = await axios.post(
    `${API_BASE}/triage`,
    { task, features, model_output: modelOutput, complaint },
    { headers: { 'Content-Type': 'application/json', ...authHeaders(token) } },
  )
  return res.data as {
    triage_summary: string
    followups: string[]
    model_name: string
  }
}

export async function sessionSubmit(payload: {
  report_id?: string
  task: Task | string
  features: Record<string, any>
  prediction: { label: number; probability: number; health_score: number }
  triage?: { triage_summary: string; followups: string[]; model_name?: string }
  complaint?: string
  prediction_id?: string
}, token?: string) {
  const res = await axios.post(
    `${API_BASE}/session/submit`,
    payload,
    { headers: { 'Content-Type': 'application/json', ...authHeaders(token) } },
  )
  return res.data as { ok: boolean; prediction_id: string }
}

export async function getHistoryReports(token?: string) {
  const res = await axios.get(`${API_BASE}/history/reports`, { headers: { ...authHeaders(token) } })
  return res.data as any[]
}

export async function getHistoryPredictions(token?: string) {
  const res = await axios.get(`${API_BASE}/history/predictions`, { headers: { ...authHeaders(token) } })
  return res.data as any[]
}
