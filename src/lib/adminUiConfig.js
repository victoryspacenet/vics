/**
 * 관리자·데모용 JSON blob — Supabase `admin_ui_config`
 */
import { supabase } from './supabase'

/**
 * @template T
 * @param {string} key
 * @param {T} fallback
 * @returns {Promise<T>}
 */
export async function getAdminUiJson(key, fallback = null) {
  try {
    const { data, error } = await supabase.from('admin_ui_config').select('value').eq('key', key).maybeSingle()
    if (error) throw error
    if (data?.value === undefined || data?.value === null) return fallback
    return data.value
  } catch (e) {
    console.warn('[adminUiConfig] get', key, e)
    return fallback
  }
}

/**
 * @param {string} key
 * @param {unknown} value
 * @returns {Promise<boolean>}
 */
export async function setAdminUiJson(key, value) {
  try {
    const { error } = await supabase.from('admin_ui_config').upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    )
    if (error) throw error
    return true
  } catch (e) {
    console.warn('[adminUiConfig] set', key, e)
    return false
  }
}
