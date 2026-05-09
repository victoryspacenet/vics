import { supabase } from './supabase'

/** V-Report V-Card 제작 (리워드 카드·SQL `purchase_vcard_report`와 동일) */
export const VCARD_REPORT_COST = 1500

/**
 * V-Card 제작 포인트 차감 (`purchase_vcard_report` RPC)
 * @returns {Promise<{ ok: true, pointsSpent: number } | { ok: false, error: string }>}
 */
export async function purchaseVcardReportRpc() {
  const { data: raw, error } = await supabase.rpc('purchase_vcard_report')

  if (error) {
    return { ok: false, error: error.message || '결제 요청에 실패했어요' }
  }

  let data = raw
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch {
      return { ok: false, error: '응답이 올바르지 않아요' }
    }
  }

  if (data == null || typeof data !== 'object') {
    return { ok: false, error: '응답이 올바르지 않아요' }
  }

  if (data.ok === false) {
    return { ok: false, error: typeof data.error === 'string' ? data.error : '포인트 차감에 실패했어요' }
  }

  return {
    ok: true,
    pointsSpent: Number(data.points_spent ?? VCARD_REPORT_COST),
  }
}
