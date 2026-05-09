/**
 * 권한 그룹 설정 — Supabase 기반 스토리지
 */

import { supabase } from './supabase'
import { getOperatorsList } from './operatorAdminStorage'

export const MENU_ITEMS = [
  { menuKey: 'dashboard', menuLabel: '대시보드',   subLabel: '전체 현황' },
  { menuKey: 'matchups',  menuLabel: '매치업 관리', subLabel: '목록/상세' },
  { menuKey: 'users',     menuLabel: '유저 관리',   subLabel: '유저 제재' },
  { menuKey: 'settings',  menuLabel: '시스템 설정', subLabel: '계정 관리' },
]

// 그룹 id → 운영자 permission 필드 매핑 (할당 인원 카운트용)
const GROUP_TO_PERM = { master: 'Master', editor: 'Editor', cs_viewer: 'CS_Viewer' }

function normalize(row) {
  return {
    id:           row.id,
    name:         row.name,
    icon:         row.icon,
    desc:         row.description,
    lastModified: row.last_modified,
    isSystem:     row.is_system,
    permissions:  typeof row.permissions === 'string' ? JSON.parse(row.permissions) : row.permissions,
  }
}

/** 전체 권한 그룹 목록 (할당 인원 포함) */
export async function getPermissionGroups() {
  const [{ data, error }, operators] = await Promise.all([
    supabase.from('admin_permission_groups').select('*').order('created_at', { ascending: true }),
    getOperatorsList(),
  ])
  if (error) { console.error(error); return [] }
  return (data || []).map((row) => {
    const permName = GROUP_TO_PERM[row.id]
    const assignedCount = permName
      ? operators.filter((op) => op.permission === permName).length
      : 0
    return { ...normalize(row), assignedCount }
  })
}

/** 단건 조회 */
export async function getPermissionGroup(id) {
  const { data, error } = await supabase
    .from('admin_permission_groups')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return normalize(data)
}

/** 복사 */
export async function copyPermissionGroup(sourceId) {
  const source = await getPermissionGroup(sourceId)
  if (!source) return null
  const newId = `custom_${Date.now()}`
  const newName = `${source.name} (복사본)`
  const { error } = await supabase
    .from('admin_permission_groups')
    .insert({
      id:          newId,
      name:        newName,
      icon:        source.icon,
      description: source.desc,
      is_system:   false,
      permissions: source.permissions,
    })
  if (error) { console.error(error); return null }
  return newId
}

/** 수정 */
export async function updatePermissionGroup(id, updates) {
  const { error } = await supabase
    .from('admin_permission_groups')
    .update({
      name:        updates.name,
      description: updates.desc,
      permissions: updates.permissions,
    })
    .eq('id', id)
  if (error) { console.error(error); return false }
  return true
}

/** 삭제 (isSystem 그룹 보호) */
export async function deletePermissionGroup(id) {
  const group = await getPermissionGroup(id)
  if (!group || group.isSystem) return false
  const { error } = await supabase
    .from('admin_permission_groups')
    .delete()
    .eq('id', id)
  if (error) { console.error(error); return false }
  return true
}

/** 신규 추가 */
export async function addPermissionGroup(group) {
  const { error } = await supabase
    .from('admin_permission_groups')
    .insert({
      id:          group.id,
      name:        group.name,
      icon:        group.icon || '📋',
      description: group.desc || '',
      is_system:   false,
      permissions: group.permissions,
    })
  if (error) { console.error(error); return null }
  return group.id
}
