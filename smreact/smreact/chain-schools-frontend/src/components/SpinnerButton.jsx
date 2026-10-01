import { useEffect, useRef, useState } from 'react'

/* Save/action button jo apni loading state khud manage karta hai: click par
   async `onClick` ko await karta hai, us dauran icon ki jagah chhota spinner
   dikhata hai aur button ko disable rakhta hai (double-submit se bachao).

   Istemaal: onClick aisa function ho jo API promise RETURN kare —
     <SpinnerButton icon="fa-floppy-disk" onClick={() => save()}>Save</SpinnerButton>
   Agar onClick promise return na kare to spinner bس ek frame dikhega.

   Modal save par success ke baad parent aksar modal band kar deta hai (button
   unmount) — `mounted` ref setState-after-unmount warning se bachata hai. */
export default function SpinnerButton({
  onClick,
  className = 'btn-primary',
  icon,
  children,
  disabled = false,
  style,
  type = 'button',
}) {
  const [loading, setLoading] = useState(false)
  const mounted = useRef(true)
  /* mount par true set karna ZAROORI hai — StrictMode (dev) mount→cleanup→mount
     chalata hai; agar sirf cleanup me false karein to mounted hamesha false reh
     jata hai aur spinner `finally` me kabhi band nahi hota. */
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  const handle = async (e) => {
    if (loading || disabled) return
    setLoading(true)
    try { await onClick?.(e) }
    finally { if (mounted.current) setLoading(false) }
  }

  const hasLabel = children != null && children !== ''
  return (
    <button type={type} className={className} style={style} disabled={disabled || loading} onClick={handle}>
      {loading ? <i className="fa-solid fa-spinner fa-spin" /> : icon ? <i className={`fa-solid ${icon}`} /> : null}
      {hasLabel && ((loading || icon) ? <> {children}</> : children)}
    </button>
  )
}
