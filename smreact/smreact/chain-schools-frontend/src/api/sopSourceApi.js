/* ═══════════════════════════════════════════════════════════════════
   SOPs SOURCE — network ka chain-level switch.

     POST {chain}/api/Network_Setup/manage_schoolmentorsop
          ?action=get|update&networkId=<id>&schoolMentorSOP=<bool>

   Sab kuch query string me jaata hai; body khali hoti hai (IIS khali POST
   par 411 deta hai, is liye Content-Length: 0 lazmi bhejte hain).

   `action` sirf do hain — get aur update. Kuch aur bhejne par API khud
   keh deti hai: "Invalid @Action value. Use GET or UPDATE."

   schoolMentorSOP:
     true  → chain ke schools School Mentor ki official SOPs dekhte hain
     false → head office ki apni uploaded SOPs
     null  → kabhi set hi nahi hui; ise `false` (custom) maante hain.

   Ye setting pehle localStorage me thi, is liye har browser ka apna jawab
   hota tha aur chain ke schools tak pohanchti hi nahi thi.
   ═══════════════════════════════════════════════════════════════════ */

import { CHAIN_API_BASE } from '@/config/env'
import { currentNetworkId } from './networkSchoolsApi'

const URL_BASE = `${CHAIN_API_BASE}/api/Network_Setup/manage_schoolmentorsop`

async function call(params, label) {
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`${URL_BASE}?${qs}`, {
    method: 'POST',
    /* Body hai hi nahi — magar Content-Length ke baghair IIS request ko
       411 "Length Required" par rok deta hai. */
    headers: { Accept: '*/*', 'Content-Length': '0' },
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json?.success === false) {
    throw new Error(json?.message || `Could not ${label}`)
  }
  return json
}

/** Is network ka mojooda source: 'mentor' | 'custom'. */
export async function fetchSopSource(networkId = currentNetworkId()) {
  const json = await call({ action: 'get', networkId }, 'load the SOPs source')
  return json?.data?.schoolMentorSOP === true ? 'mentor' : 'custom'
}

/** Source badlo — poore chain ke schools par asar karta hai. */
export async function saveSopSource(source, networkId = currentNetworkId()) {
  await call(
    { action: 'update', networkId, schoolMentorSOP: source === 'mentor' },
    'update the SOPs source',
  )
  return source
}
