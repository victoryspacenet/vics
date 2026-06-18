/**
 * 서버 점검·다운 안내 — admin_settings.server_maintenance + 헬스 프로브
 */
import { supabase } from './supabase'
import { getSiteOrigin } from './siteApiBase'

export const SERVER_MAINTENANCE_SETTINGS_KEY = 'server_maintenance'

export const DEFAULT_SERVER_MAINTENANCE_MESSAGE =
  '경쟁이 너무 뜨거워 서버가 잠시 열을 식히는 중입니다!'

/** 치명적 버그 등 — 즉시 전환 시 기본 문구 */
export const DEFAULT_EMERGENCY_MAINTENANCE_MESSAGE =
  '중요한 문제를 확인 중입니다. 안전한 서비스를 위해 잠시 이용이 제한됩니다.'

export const EMERGENCY_DEFAULT_RECOVERY_HOURS = 2

export const SERVER_MAINTENANCE_UPDATED = 'vics:server-maintenance:updated'

/** 평상시 admin_settings 반복 조회 완화 (탭·폴링마다 DB 왕복 방지) */
const MAINTENANCE_CONFIG_CACHE_MS = 90_000
let maintenanceConfigCache = null
let maintenanceConfigCacheAt = 0

function invalidateMaintenanceConfigCache() {
  maintenanceConfigCache = null
  maintenanceConfigCacheAt = 0
}

export const MAINTENANCE_MODES = {
  off: 'off',
  planned: 'planned',
  emergency: 'emergency',
}

function normalizeRecoveryIso(value) {
  if (value == null || value === '') return null
  const t = new Date(value)
  return Number.isFinite(t.getTime()) ? t.toISOString() : null
}

function normalizeConfig(raw) {
  const v = raw && typeof raw === 'object' ? raw : {}
  const enabled = Boolean(v.enabled)
  let mode = String(v.mode || '').trim()
  if (mode !== MAINTENANCE_MODES.emergency && mode !== MAINTENANCE_MODES.planned) {
    mode = enabled ? MAINTENANCE_MODES.planned : MAINTENANCE_MODES.off
  }
  if (!enabled) mode = MAINTENANCE_MODES.off

  const defaultMessage =
    mode === MAINTENANCE_MODES.emergency
      ? DEFAULT_EMERGENCY_MAINTENANCE_MESSAGE
      : DEFAULT_SERVER_MAINTENANCE_MESSAGE
  const message = String(v.message || '').trim() || defaultMessage
  const expectedRecoveryAt = normalizeRecoveryIso(v.expectedRecoveryAt)
  const emergencyActivatedAt = normalizeRecoveryIso(v.emergencyActivatedAt)
  const emergencyActivatedBy =
    v.emergencyActivatedBy != null && String(v.emergencyActivatedBy).trim()
      ? String(v.emergencyActivatedBy).trim()
      : null

  return {
    enabled,
    mode,
    message,
    expectedRecoveryAt,
    emergencyActivatedAt,
    emergencyActivatedBy,
  }
}

export function isEmergencyMaintenance(config) {
  return Boolean(config?.enabled && config?.mode === MAINTENANCE_MODES.emergency)
}

/** 긴급 점검 기본 복구 예정 (지금 + hours) */
export function defaultEmergencyRecoveryIso(hours = EMERGENCY_DEFAULT_RECOVERY_HOURS) {
  const d = new Date()
  d.setTime(d.getTime() + hours * 60 * 60 * 1000)
  return d.toISOString()
}

/** 치명적 버그 발견 시 — 즉시 긴급 점검 모드 ON */
export async function activateEmergencyMaintenance({
  message,
  expectedRecoveryAt,
  activatedBy,
} = {}) {
  const now = new Date().toISOString()
  return saveServerMaintenanceConfig({
    enabled: true,
    mode: MAINTENANCE_MODES.emergency,
    message: String(message || '').trim() || DEFAULT_EMERGENCY_MAINTENANCE_MESSAGE,
    expectedRecoveryAt: normalizeRecoveryIso(expectedRecoveryAt) ?? defaultEmergencyRecoveryIso(),
    emergencyActivatedAt: now,
    emergencyActivatedBy: activatedBy ? String(activatedBy).trim() : null,
  })
}

/** 긴급·일반 점검 모드 OFF */
export async function deactivateServerMaintenance() {
  return saveServerMaintenanceConfig({
    enabled: false,
    mode: MAINTENANCE_MODES.off,
    emergencyActivatedAt: null,
    emergencyActivatedBy: null,
  })
}

export async function fetchServerMaintenanceConfig() {
  const now = Date.now()
  if (maintenanceConfigCache && now - maintenanceConfigCacheAt < MAINTENANCE_CONFIG_CACHE_MS) {
    return maintenanceConfigCache
  }
  try {
    const { data, error } = await supabase
      .from('admin_settings')
      .select('value')
      .eq('key', SERVER_MAINTENANCE_SETTINGS_KEY)
      .maybeSingle()
    if (error) throw error
    const normalized = normalizeConfig(data?.value)
    maintenanceConfigCache = normalized
    maintenanceConfigCacheAt = now
    return normalized
  } catch (e) {
    console.warn('[serverMaintenance] fetch:', e?.message || e)
    const fallback = normalizeConfig(null)
    maintenanceConfigCache = fallback
    maintenanceConfigCacheAt = now
    return fallback
  }
}

export async function saveServerMaintenanceConfig(patch) {
  const current = await fetchServerMaintenanceConfig()
  const merged = { ...current, ...patch }
  if (patch.enabled === false) {
    merged.mode = MAINTENANCE_MODES.off
    merged.emergencyActivatedAt = null
    merged.emergencyActivatedBy = null
  } else if (patch.enabled === true && !patch.mode) {
    merged.mode =
      current.mode === MAINTENANCE_MODES.emergency
        ? MAINTENANCE_MODES.emergency
        : MAINTENANCE_MODES.planned
  }
  const next = normalizeConfig(merged)
  const { error } = await supabase.from('admin_settings').upsert(
    { key: SERVER_MAINTENANCE_SETTINGS_KEY, value: next },
    { onConflict: 'key' },
  )
  if (error) throw error
  invalidateMaintenanceConfigCache()
  try {
    window.dispatchEvent(new CustomEvent(SERVER_MAINTENANCE_UPDATED))
  } catch {
    /* ignore */
  }
  return next
}

/** 네트워크 응답 확인용 (OfflineConnectivityBanner와 동일 출처 우선) */
function resolveProbeUrl() {
  try {
    const site = getSiteOrigin()
    if (site) return `${site.replace(/\/+$/, '')}/`
    return new URL('/', window.location.href).href
  } catch {
    return '/'
  }
}

/** 점검 모드·이전 실패 시에만 헬스 프로브 (평상시 admin_settings 반복 조회 방지) */
export function shouldProbeServerHealth(config, lastReachable) {
  if (config?.enabled) return true
  if (lastReachable === false) return true
  return false
}

const HEALTH_PROBE_SESSION_KEY = 'vics:last_health_probe_ok_at'
const HEALTH_PROBE_SESSION_MS = 5 * 60 * 1000

function shouldSkipRecentHealthProbe() {
  if (typeof window === 'undefined') return false
  try {
    const raw = sessionStorage.getItem(HEALTH_PROBE_SESSION_KEY)
    if (!raw) return false
    const at = Number(raw)
    return Number.isFinite(at) && Date.now() - at < HEALTH_PROBE_SESSION_MS
  } catch {
    return false
  }
}

function markRecentHealthProbeOk() {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(HEALTH_PROBE_SESSION_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }
}

/**
 * 서버 가용성 판단
 * @param {{ light?: boolean }} [opts] — light: 정적 출처 HEAD/GET만 (Supabase 미조회)
 */
export async function probeServerHealth({ light = false } = {}) {
  if (light && shouldSkipRecentHealthProbe()) {
    return true
  }
  const ctrl = new AbortController()
  const tid = window.setTimeout(() => ctrl.abort(), light ? 8000 : 10000)
  try {
    if (!light) {
      const { error } = await supabase.from('admin_settings').select('key').limit(1)
      if (!error) {
        markRecentHealthProbeOk()
        return true
      }
    }
    const res = await fetch(resolveProbeUrl(), {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      signal: ctrl.signal,
    })
    const ok = res.ok || res.status < 500
    if (ok && light) markRecentHealthProbeOk()
    return ok
  } catch {
    return false
  } finally {
    window.clearTimeout(tid)
  }
}

/** 예상 복구 시각 — 유저-facing 문구 */
export function formatExpectedRecoveryLabel(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return null
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  const time = d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit', hour12: true })
  if (sameDay) return `오늘 ${time}경 복구 예정`
  const date = d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })
  return `${date} ${time}경 복구 예정`
}

/** datetime-local input value (로컬) */
export function isoToDatetimeLocalValue(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function datetimeLocalValueToIso(local) {
  const s = String(local || '').trim()
  if (!s) return null
  const d = new Date(s)
  if (!Number.isFinite(d.getTime())) return null
  return d.toISOString()
}
