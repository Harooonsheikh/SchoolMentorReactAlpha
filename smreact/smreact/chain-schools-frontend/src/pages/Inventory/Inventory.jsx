import { useCallback, useEffect, useMemo, useState } from 'react'
import TutorialButton from '../../components/TutorialButton'
import SpinnerButton from '../../components/SpinnerButton'
import { createPortal } from 'react-dom'
import {
  MONTHS, ITEM_STATUSES, CONDITIONS,
  rs, num, todayISO, fmtDate, nextItemCode, barcodeBars,
} from './data'
import {
  fetchInventory, saveNetworkItem, deleteNetworkItem,
  saveNetworkProduct, deleteNetworkProduct, saveNetworkSale,
} from '../../api/inventoryApi'
import { loadChainProfile, chainInitials } from '../../config/chainProfile'
import './Inventory.css'

const stClass = (s) => `st-${(s || '').replace(/ /g, '-')}`

export default function Inventory() {
  const [inv, setInv] = useState(null)
  const [tab, setTab] = useState('manage')
  const [toast, setToast] = useState(null)

  const fire = (text, type = 'success') => setToast({ text, type })
  const reload = useCallback(async () => {
    try { setInv(await fetchInventory()) }
    catch (e) { setInv({ items: [], products: [], sales: [], categories: [] }); setToast({ text: e.message || 'Could not load head office assets', type: 'warn' }) }
  }, [])
  useEffect(() => { reload() }, [reload])
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t) }, [toast])
  if (!inv) return null

  return (
    <>
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}><i className="fa-solid fa-boxes-stacked" /></div>
          <div><div className="page-title">Head Office Assets</div><div className="page-sub">Head office assets, a simple shop counter &amp; printable reports.</div></div>
        </div>
        <TutorialButton />
      </div>

      <div className="inv-tabs">
        {[['manage', 'fa-warehouse', 'Head Office Assets Management'], ['pos', 'fa-cash-register', 'Point of Sale'], ['reports', 'fa-chart-column', 'Reports']].map(([k, ic, lbl]) => (
          <button key={k} className={`inv-tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}><i className={`fa-solid ${ic}`} /> {lbl}</button>
        ))}
      </div>

      {tab === 'manage' && <Manage inv={inv} reload={reload} fire={fire} />}
      {tab === 'pos' && <POS inv={inv} reload={reload} fire={fire} />}
      {tab === 'reports' && <Reports inv={inv} fire={fire} />}

      {toast && createPortal(
        <div className="ss-toast-wrap"><div className={`ss-toast ${toast.type}`}><i className={`fa-solid ${toast.type === 'success' ? 'fa-circle-check' : toast.type === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-info'}`} /> {toast.text}</div></div>,
        document.body,
      )}
    </>
  )
}

function Barcode({ code }) {
  return <div className="inv-barcode">{barcodeBars(code).map((w, i) => <i key={i} style={{ width: w, background: i % 2 ? '#fff' : '#111' }} />)}</div>
}

/* ════════ INVENTORY MANAGEMENT ════════ */
function Manage({ inv, reload, fire }) {
  const [seg, setSeg] = useState('active')
  const [search, setSearch] = useState('')
  const [cat, setCat] = useState('all')
  const [status, setStatus] = useState('all')
  const [openId, setOpenId] = useState(null)
  const [itemModal, setItemModal] = useState(null)
  const [del, setDel] = useState(null)

  const stats = useMemo(() => {
    const active = inv.items.filter((i) => i.active)
    return { qty: active.reduce((a, i) => a + i.qty, 0), active: active.length, cats: new Set(active.map((i) => i.cat)).size, low: active.filter((i) => i.low > 0 && i.qty <= i.low).length }
  }, [inv.items])

  const list = useMemo(() => {
    const q = search.trim().toLowerCase()
    return inv.items.filter((i) => i.active === (seg === 'active')
      && (cat === 'all' || i.cat === cat) && (status === 'all' || i.status === status)
      && (!q || `${i.name}${i.code}${i.loc}`.toLowerCase().includes(q)))
  }, [inv.items, seg, cat, status, search])

  const item = inv.items.find((i) => i.id === openId)

  const saveItem = async (data, id) => {
    try {
      /* Edit par item ka maujooda active/inactive status barqarar rakho — form
         `active` nahi bhejta, is liye warna inactive item update karte hi active
         ho jata tha (API me isActive true chala jata). Naya item → active. */
      const existing = id ? inv.items.find((i) => i.id === id) : null
      const active = data.active ?? existing?.active ?? true
      await saveNetworkItem({ ...data, id: id || 0, active })
      setItemModal(null); fire(id ? 'Item updated' : 'Item added')
      await reload()
    } catch (e) { fire(e.message || 'Could not save item', 'warn') }
  }
  const toggleActive = async (it) => {
    const active = !it.active
    try {
      await saveNetworkItem({ ...it, active })
      fire(active ? 'Item reactivated' : 'Item marked inactive', 'info')
      await reload()
    } catch (e) { fire(e.message || 'Could not update item', 'warn') }
  }
  const doDelete = async () => {
    try {
      await deleteNetworkItem(del)
      setDel(null); setOpenId(null); fire('Item deleted', 'info')
      await reload()
    } catch (e) { fire(e.message || 'Could not delete item', 'warn') }
  }

  const printLabel = (it) => {
    const chain = loadChainProfile()
    const bars = barcodeBars(it.code).map((w, i) => `<i style="display:inline-block;width:${w}px;height:46px;background:${i % 2 ? '#fff' : '#111'}"></i>`).join('')
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${it.code}</title><style>*{margin:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:18px;text-align:center}.lbl{border:2px solid #111;border-radius:8px;padding:14px 18px;display:inline-block;min-width:260px}.org{font-size:11px;color:#555;margin-bottom:4px}.nm{font-size:15px;font-weight:800}.bc{margin:8px 0;display:flex;gap:1px;align-items:flex-end;justify-content:center;height:46px}.cd{font-family:monospace;font-size:13px;letter-spacing:2px}@media print{@page{margin:6mm}}</style></head><body><div class="lbl"><div class="org">${esc(chain.chainName)}</div><div class="nm">${esc(it.name)}</div><div class="bc">${bars}</div><div class="cd">${esc(it.code)}</div></div><script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script></body></html>`
    const w = window.open('', '_blank'); if (!w) return fire('Allow pop-ups to print the label', 'warn'); w.document.write(html); w.document.close()
  }

  if (item) {
    return (
      <>
        <div className="inv-bar" style={{ marginBottom: 16 }}>
          <button className="btn-secondary" onClick={() => setOpenId(null)}><i className="fa-solid fa-arrow-left" /> All Items</button>
          <div style={{ flex: 1, fontSize: 16, fontWeight: 800, color: 'var(--t1)', alignSelf: 'center' }}>{item.name}</div>
          <button className="btn-secondary" onClick={() => printLabel(item)}><i className="fa-solid fa-barcode" /> Print Barcode</button>
          <button className="btn-secondary" onClick={() => setItemModal({ mode: 'edit', item })}><i className="fa-solid fa-pen" /> Edit</button>
          <button className="btn-sm" style={{ height: 38, borderColor: item.active ? 'var(--warn)' : 'var(--success)', color: item.active ? 'var(--warn)' : 'var(--success)' }} onClick={() => toggleActive(item)}><i className={`fa-solid ${item.active ? 'fa-circle-pause' : 'fa-circle-check'}`} /> {item.active ? 'Mark Inactive' : 'Mark Active'}</button>
          {!item.active && <button className="btn-sm" style={{ height: 38, borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' }} onClick={() => setDel(item)}><i className="fa-solid fa-trash-can" /> Delete</button>}
        </div>
        <div className="inv-detail-grid">
          <div className="inv-info-card">
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--t1)', marginBottom: 8 }}><i className="fa-solid fa-circle-info" style={{ color: 'var(--brand)', marginRight: 6 }} /> Item Details</div>
            {[['Asset #', item.code], ['Category', item.cat], ['Quantity', `${num(item.qty)}${item.low > 0 && item.qty <= item.low ? ' (low stock)' : ''}`], ['Low-stock Alert', item.low], ['Condition', item.cond], ['Status', item.status], ['Location', item.loc || '—'], ['Added', fmtDate(item.date)]].map(([l, v]) => (
              <div className="inv-info-row" key={l}><span className="l">{l}</span><span className="v">{v}</span></div>
            ))}
            {item.desc && <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--t2)', lineHeight: 1.55 }}>{item.desc}</div>}
          </div>
          <div>
            <div className="inv-info-card" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--t1)', marginBottom: 10 }}><i className="fa-solid fa-barcode" style={{ color: 'var(--brand)', marginRight: 6 }} /> Barcode Label</div>
              <Barcode code={item.code} />
              <div style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 13, letterSpacing: 2, marginTop: 8, color: 'var(--t1)' }}>{item.code}</div>
            </div>
            <div className="inv-info-card">
              <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--t1)', marginBottom: 8 }}><i className="fa-solid fa-clock-rotate-left" style={{ color: 'var(--brand)', marginRight: 6 }} /> History</div>
              {item.history.map((h, i) => <div className="inv-hist-item" key={i}><div className="inv-hist-dot" /><div style={{ flex: 1 }}><div style={{ fontSize: 12.5, color: 'var(--t1)' }}>{h.t}</div><div style={{ fontSize: 11, color: 'var(--tm)' }}>{fmtDate(h.at)}</div></div></div>)}
            </div>
          </div>
        </div>
        {itemModal && <ItemModal modal={itemModal} inv={inv} onClose={() => setItemModal(null)} onSave={saveItem} onToast={fire} />}
        {del && <ConfirmModal title="Delete Item?" body={`“${del.name}” will be permanently removed from head office asset records.`} onClose={() => setDel(null)} onConfirm={doDelete} />}
      </>
    )
  }

  return (
    <>
      <div className="inv-overview">
        <div className="inv-ov-ic"><i className="fa-solid fa-warehouse" /></div>
        <div><div className="inv-ov-title">Head Office Assets Management</div><div className="inv-ov-sub">Keep a record of every physical item — furniture, equipment, lab &amp; sports gear. Print barcode labels to paste on each item.</div></div>
      </div>

      <div className="inv-kpis">
        <div className="inv-kpi info"><div className="inv-kpi-top"><i className="fa-solid fa-boxes-stacked" /> Total Units</div><div className="inv-kpi-val">{num(stats.qty)}</div><div className="inv-kpi-sub">across active items</div></div>
        <div className="inv-kpi green"><div className="inv-kpi-top"><i className="fa-solid fa-circle-check" /> Active Items</div><div className="inv-kpi-val">{stats.active}</div></div>
        <div className="inv-kpi"><div className="inv-kpi-top"><i className="fa-solid fa-layer-group" /> Categories</div><div className="inv-kpi-val">{stats.cats}</div></div>
        <div className="inv-kpi amber"><div className="inv-kpi-top"><i className="fa-solid fa-triangle-exclamation" /> Low Stock</div><div className="inv-kpi-val">{stats.low}</div></div>
      </div>

      <div className="inv-bar">
        <div style={{ flex: 1, fontSize: 14, fontWeight: 800, color: 'var(--t1)', alignSelf: 'center' }}><i className="fa-solid fa-boxes-stacked" style={{ color: 'var(--brand)', marginRight: 7 }} /> All Assets</div>
        <button className="btn-primary" onClick={() => setItemModal({ mode: 'add' })}><i className="fa-solid fa-plus" /> Add Asset</button>
      </div>

      <div className="inv-seg">
        <button className={`inv-seg-btn${seg === 'active' ? ' active' : ''}`} onClick={() => setSeg('active')}><i className="fa-solid fa-circle-check" /> Active Items</button>
        <button className={`inv-seg-btn${seg === 'inactive' ? ' active' : ''}`} onClick={() => setSeg('inactive')}><i className="fa-solid fa-circle-pause" /> Inactive Items</button>
      </div>

      <div className="inv-bar">
        <div className="inv-field" style={{ flex: 1, minWidth: 220 }}><label>Search</label><div className="search-box"><i className="fa-solid fa-magnifying-glass" /><input className="search-input" placeholder="Search by name, asset number or location" value={search} onChange={(e) => setSearch(e.target.value)} /></div></div>
        <div className="inv-field"><label>Category</label><select className="inv-input" value={cat} onChange={(e) => setCat(e.target.value)}><option value="all">All Categories</option>{inv.categories.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="inv-field"><label>Status</label><select className="inv-input" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All Status</option>{ITEM_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
      </div>

      <div className="inv-grid">
        {list.length === 0 ? <div className="inv-empty" style={{ gridColumn: '1/-1' }}><i className="fa-solid fa-boxes-stacked" /><div style={{ fontSize: 14, fontWeight: 700 }}>No items found</div></div>
          : list.map((i) => {
            const low = i.low > 0 && i.qty <= i.low
            return (
              <div className="inv-card" key={i.id} onClick={() => setOpenId(i.id)}>
                <div className="inv-card-top">
                  <div className="inv-card-ic"><i className="fa-solid fa-box" /></div>
                  <div style={{ flex: 1, minWidth: 0 }}><div className="inv-card-name">{i.name}</div><div className="inv-card-code">{i.code}</div></div>
                </div>
                <div className="inv-badges">
                  <span className={`badge ${stClass(i.status)}`}>{i.status}</span>
                  <span className="badge b-gray">{i.cat}</span>
                  {i.loc && <span className="badge b-gray"><i className="fa-solid fa-location-dot" style={{ fontSize: 8 }} /> {i.loc}</span>}
                </div>
                <div className="inv-card-foot">
                  <div className="inv-card-qty">{num(i.qty)} <small>units</small></div>
                  {low && <span className="inv-low" style={{ fontSize: 11 }}><i className="fa-solid fa-triangle-exclamation" /> Low</span>}
                </div>
              </div>
            )
          })}
      </div>

      {itemModal && <ItemModal modal={itemModal} inv={inv} onClose={() => setItemModal(null)} onSave={saveItem} onToast={fire} />}
    </>
  )
}

function ItemModal({ modal, inv, onClose, onSave, onToast }) {
  const it = modal.item
  const [v, setV] = useState(() => ({ name: it?.name || '', cat: it?.cat || inv.categories[0], code: it?.code || '', qty: it?.qty ?? '', low: it?.low ?? 0, date: it?.date || todayISO(), cond: it?.cond || 'Good', status: it?.status || 'In Use', loc: it?.loc || '', desc: it?.desc || '' }))
  const posInt = (val) => (val === '' ? '' : Math.floor(Math.abs(Number(val) || 0)))
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }))
  const setNum = (k) => (e) => setV((s) => ({ ...s, [k]: posInt(e.target.value) }))
  const save = () => {
    if (!v.name.trim()) return onToast('Please enter an item name', 'warn')
    const qty = Number(v.qty) || 0
    const low = Number(v.low) || 0
    if (low > 0 && low >= qty) return onToast('Low-stock alert must be less than quantity', 'warn')
    const code = v.code.trim() || nextItemCode(inv, v.name)
    return onSave({ ...v, name: v.name.trim(), code, loc: v.loc.trim(), desc: v.desc.trim(), qty, low }, modal.mode === 'edit' ? it.id : null)
  }
  return (
    <Shell title={it ? 'Edit Asset' : 'Add Asset'} icon="fa-box" onClose={onClose}
      foot={<><button className="btn-secondary" onClick={onClose}>Cancel</button><SpinnerButton icon="fa-floppy-disk" onClick={save}>Save Item</SpinnerButton></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="inv-field"><label>Item Name</label><input className="inv-input" value={v.name} onChange={set('name')} placeholder="e.g. Student Chair" /></div>
        <div className="inv-field"><label>Category</label><select className="inv-input" value={v.cat} onChange={set('cat')}>{inv.categories.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="inv-field"><label>Asset # {!it && <span style={{ color: 'var(--tm)', fontWeight: 400 }}>(auto)</span>}</label><input className="inv-input" value={v.code} readOnly disabled placeholder="auto-generated" style={{ background: 'var(--muted)', cursor: 'not-allowed' }} /></div>
        <div className="inv-field"><label>Location</label><input className="inv-input" value={v.loc} onChange={set('loc')} placeholder="e.g. Computer Lab" /></div>
        <div className="inv-field"><label>Quantity</label><input className="inv-input" type="number" min="0" step="1" value={v.qty} onChange={setNum('qty')} placeholder="0" /></div>
        <div className="inv-field"><label>Low-stock Alert</label><input className="inv-input" type="number" min="0" step="1" value={v.low} onChange={setNum('low')} placeholder="0" /></div>
        <div className="inv-field"><label>Condition</label><select className="inv-input" value={v.cond} onChange={set('cond')}>{CONDITIONS.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="inv-field"><label>Status</label><select className="inv-input" value={v.status} onChange={set('status')}>{ITEM_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div className="inv-field"><label>Date Added</label><input className="inv-input" type="date" value={v.date} onChange={set('date')} /></div>
      </div>
      <div className="inv-field"><label>Description</label><textarea className="inv-input" rows={2} value={v.desc} onChange={set('desc')} placeholder="Notes about this item" /></div>
    </Shell>
  )
}

/* ════════ POINT OF SALE ════════ */
function POS({ inv, reload, fire }) {
  const [pt, setPt] = useState('sell')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState([])
  const [buyer, setBuyer] = useState('')
  const [prodModal, setProdModal] = useState(null)
  const [del, setDel] = useState(null)

  const today = todayISO()
  const todaySales = inv.sales.filter((s) => s.date === today)
  const lowCount = inv.products.filter((p) => p.stock <= p.low).length
  const total = cart.reduce((a, l) => a + l.qty * l.price, 0)

  const addToCart = (p) => {
    if (p.stock <= 0) return fire('Out of stock', 'warn')
    setCart((c) => {
      const ex = c.find((l) => l.id === p.id)
      if (ex) { if (ex.qty >= p.stock) { fire('Not enough stock', 'warn'); return c } return c.map((l) => (l.id === p.id ? { ...l, qty: l.qty + 1 } : l)) }
      return [...c, { id: p.id, name: p.name, price: p.price, qty: 1, stock: p.stock, cat: p.cat, barcode: p.barcode }]
    })
  }
  const setQty = (id, q) => setCart((c) => c.map((l) => (l.id === id ? { ...l, qty: Math.max(1, Math.min(q, l.stock)) } : l)))
  const removeLine = (id) => setCart((c) => c.filter((l) => l.id !== id))

  const checkout = async () => {
    if (!cart.length) return fire('Cart is empty', 'warn')
    try {
      const res = await saveNetworkSale({ cart, buyer, total })
      const no = res?.data?.saleId ? `RCP-${res.data.saleId}` : 'RCP'
      const sale = { no, date: today, buyer: buyer.trim() || 'Walk-in', lines: cart.map((l) => ({ name: l.name, qty: l.qty, price: l.price })), total, by: 'Front Desk' }
      printReceipt(sale, fire)
      setCart([]); setBuyer(''); fire('Sale completed · receipt generated')
      await reload()
    } catch (e) { fire(e.message || 'Could not complete sale', 'warn') }
  }

  const saveProd = async (data, id) => {
    try {
      await saveNetworkProduct({ ...data, id: id || 0 })
      setProdModal(null); fire(id ? 'Product updated' : 'Product added')
      await reload()
    } catch (e) { fire(e.message || 'Could not save product', 'warn') }
  }
  const doDelProd = async () => {
    try {
      await deleteNetworkProduct(del)
      setDel(null); fire('Product deleted', 'info')
      await reload()
    } catch (e) { fire(e.message || 'Could not delete product', 'warn') }
  }

  const prodList = inv.products.filter((p) => { const q = search.trim().toLowerCase(); return !q || `${p.name}${p.barcode}`.toLowerCase().includes(q) })

  return (
    <>
      <div className="inv-overview">
        <div className="inv-ov-ic" style={{ background: 'linear-gradient(135deg,#16A34A,#15803D)' }}><i className="fa-solid fa-cash-register" /></div>
        <div><div className="inv-ov-title">Point of Sale</div><div className="inv-ov-sub">A simple school shop counter. Sell books, uniforms &amp; stationery, then print a receipt — stock reduces automatically.</div></div>
      </div>

      <div className="inv-kpis">
        <div className="inv-kpi green"><div className="inv-kpi-top"><i className="fa-solid fa-sack-dollar" /> Today's Sales</div><div className="inv-kpi-val">{rs(todaySales.reduce((a, s) => a + s.total, 0))}</div></div>
        <div className="inv-kpi info"><div className="inv-kpi-top"><i className="fa-solid fa-receipt" /> Today's Receipts</div><div className="inv-kpi-val">{todaySales.length}</div></div>
        <div className="inv-kpi amber"><div className="inv-kpi-top"><i className="fa-solid fa-triangle-exclamation" /> Low Stock Products</div><div className="inv-kpi-val">{lowCount}</div></div>
      </div>

      <div className="inv-seg">
        {[['sell', 'fa-cart-shopping', 'New Sale'], ['products', 'fa-box-open', 'Products'], ['sales', 'fa-receipt', 'Sales History']].map(([k, ic, lbl]) => (
          <button key={k} className={`inv-seg-btn${pt === k ? ' active' : ''}`} onClick={() => setPt(k)}><i className={`fa-solid ${ic}`} /> {lbl}</button>
        ))}
      </div>

      {pt === 'sell' && (
        <div className="inv-pos-wrap">
          <div>
            <div className="inv-bar"><div className="inv-field" style={{ flex: 1 }}><label>Search Product</label><div className="search-box"><i className="fa-solid fa-magnifying-glass" /><input className="search-input" placeholder="Search product by name or barcode" value={search} onChange={(e) => setSearch(e.target.value)} /></div></div></div>
            <div className="inv-pos-products">
              {prodList.map((p) => (
                <div className={`inv-prod-card${p.stock <= 0 ? ' out' : ''}`} key={p.id} onClick={() => addToCart(p)}>
                  <div className="inv-prod-name">{p.name}</div>
                  <div className="inv-prod-price">{rs(p.price)}</div>
                  <div className="inv-prod-stock" style={p.stock <= p.low ? { color: 'var(--err)', fontWeight: 700 } : undefined}>{p.stock} in stock</div>
                </div>
              ))}
            </div>
          </div>
          <div className="inv-cart">
            <div className="inv-cart-head"><div className="inv-cart-head-title"><i className="fa-solid fa-cart-shopping" /> Cart</div><button className="btn-sm" style={{ height: 28 }} onClick={() => setCart([])}><i className="fa-solid fa-trash-can" /> Clear</button></div>
            <div className="inv-cart-items">
              {cart.length === 0 ? <div style={{ textAlign: 'center', padding: 24, color: 'var(--tm)', fontSize: 12.5 }}>Cart is empty. Tap a product to add it.</div>
                : cart.map((l) => (
                  <div className="inv-cart-line" key={l.id}>
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--t1)' }}>{l.name}</div><div style={{ fontSize: 11, color: 'var(--tm)' }}>{rs(l.price)} each</div></div>
                    <button className="inv-qty-btn" onClick={() => setQty(l.id, l.qty - 1)}>−</button>
                    <span style={{ minWidth: 22, textAlign: 'center', fontWeight: 700 }}>{l.qty}</span>
                    <button className="inv-qty-btn" onClick={() => setQty(l.id, l.qty + 1)}>+</button>
                    <span style={{ minWidth: 60, textAlign: 'right', fontWeight: 800 }}>{num(l.qty * l.price)}</span>
                    <button className="inv-qty-btn" style={{ borderColor: 'var(--err)', color: 'var(--err)' }} onClick={() => removeLine(l.id)}><i className="fa-solid fa-xmark" /></button>
                  </div>
                ))}
            </div>
            <div className="inv-cart-foot">
              <div className="inv-field" style={{ marginBottom: 12 }}><label>School Owner</label><input className="inv-input" value={buyer} onChange={(e) => setBuyer(e.target.value)} placeholder="e.g. ABC-Campus" /></div>
              <div className="inv-cart-total"><span style={{ fontWeight: 700, color: 'var(--tm)' }}>Total</span><span className="inv-cart-total-val">{rs(total)}</span></div>
              <SpinnerButton style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg,#16A34A,#15803D)' }} icon="fa-receipt" onClick={checkout}>Generate Receipt</SpinnerButton>
            </div>
          </div>
        </div>
      )}

      {pt === 'products' && (
        <div className="section-card">
          <div className="card-header"><div className="card-title"><i className="fa-solid fa-box-open" /> Shop Products</div><button className="btn-primary" onClick={() => setProdModal({ mode: 'add' })}><i className="fa-solid fa-plus" /> Add Product</button></div>
          <div className="tbl-wrap">
            <table className="inv-table">
              <thead><tr><th>Product</th><th>Category</th><th>Vendor</th><th>Barcode</th><th className="c">Stock</th><th className="r">Cost</th><th className="r">Price</th><th className="c">Action</th></tr></thead>
              <tbody>
                {inv.products.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700, color: 'var(--t1)' }}>{p.name}</td>
                    <td>{p.cat}</td>
                    <td>{p.vendor || '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11.5 }}>{p.barcode}</td>
                    <td className="c"><span style={p.stock <= p.low ? { color: 'var(--err)', fontWeight: 800 } : { fontWeight: 700 }}>{p.stock}</span>{p.stock <= p.low && <div style={{ fontSize: 10, color: 'var(--err)' }}>low</div>}</td>
                    <td className="r">{rs(p.cost)}</td>
                    <td className="r" style={{ fontWeight: 700 }}>{rs(p.price)}</td>
                    <td className="c"><div style={{ display: 'flex', gap: 5, justifyContent: 'center' }}><button className="btn-sm" style={{ height: 28 }} onClick={() => setProdModal({ mode: 'edit', prod: p })}><i className="fa-solid fa-pen" /></button><button className="btn-sm" style={{ height: 28, borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' }} onClick={() => setDel(p)}><i className="fa-solid fa-trash-can" /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {pt === 'sales' && (
        <div className="section-card">
          <div className="card-header"><div className="card-title"><i className="fa-solid fa-receipt" /> Sales History</div></div>
          <div className="tbl-wrap">
            <table className="inv-table">
              <thead><tr><th>Receipt #</th><th>Date</th><th>School Owner</th><th>Items</th><th className="c">Qty</th><th className="r">Amount</th><th className="c">Receipt</th></tr></thead>
              <tbody>
                {inv.sales.length === 0 ? <tr><td colSpan={7}><div className="inv-empty"><i className="fa-solid fa-receipt" /><div style={{ fontSize: 13, fontWeight: 700 }}>No sales yet</div></div></td></tr>
                  : inv.sales.map((s) => (
                    <tr key={s.no}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--brand)' }}>{s.no}</td>
                      <td>{fmtDate(s.date)}</td>
                      <td>{s.buyer}</td>
                      <td style={{ maxWidth: 280 }}><small>{s.lines.map((l) => `${l.qty}× ${l.name}`).join(', ')}</small></td>
                      <td className="c">{s.lines.reduce((a, l) => a + l.qty, 0)}</td>
                      <td className="r" style={{ fontWeight: 800 }}>{rs(s.total)}</td>
                      <td className="c"><button className="btn-sm" style={{ height: 28 }} onClick={() => printReceipt(s, fire)}><i className="fa-solid fa-print" /></button></td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {prodModal && <ProductModal modal={prodModal} onClose={() => setProdModal(null)} onSave={saveProd} onToast={fire} />}
      {del && <ConfirmModal title="Delete Product?" body={`“${del.name}” will be removed from the shop.`} onClose={() => setDel(null)} onConfirm={doDelProd} />}
    </>
  )
}

function ProductModal({ modal, onClose, onSave, onToast }) {
  const p = modal.prod
  const [v, setV] = useState({ name: p?.name || '', cat: p?.cat || 'Stationery', barcode: p?.barcode || '', vendor: p?.vendor || '', stock: p?.stock ?? '', low: p?.low ?? 0, cost: p?.cost ?? '', price: p?.price ?? '' })
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }))
  const save = () => {
    if (!v.name.trim()) return onToast('Please enter a product name', 'warn')
    const stockN = Number(v.stock) || 0
    const lowN = Number(v.low) || 0
    /* Low-stock alert stock se KAM hona chahiye — barabar bhi nahi (strictly less). */
    if (lowN >= stockN) return onToast('Low-stock alert must be less than stock', 'warn')
    return onSave({ name: v.name.trim(), cat: v.cat.trim() || 'Other', barcode: v.barcode.trim(), vendor: v.vendor.trim(), stock: stockN, low: lowN, cost: Number(v.cost) || 0, price: Number(v.price) || 0 }, modal.mode === 'edit' ? p.id : null)
  }
  return (
    <Shell title={p ? 'Edit Product' : 'Add Product'} icon="fa-box-open" onClose={onClose} maxWidth={520}
      foot={<><button className="btn-secondary" onClick={onClose}>Cancel</button><SpinnerButton icon="fa-floppy-disk" onClick={save}>Save Product</SpinnerButton></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="inv-field"><label>Product Name</label><input className="inv-input" value={v.name} onChange={set('name')} placeholder="e.g. Notebook (100 pages)" /></div>
        <div className="inv-field"><label>Category</label><input className="inv-input" value={v.cat} onChange={set('cat')} placeholder="e.g. Stationery" /></div>
        <div className="inv-field"><label>Barcode</label><input className="inv-input" value={v.barcode} onChange={set('barcode')} placeholder="e.g. NB-100-003" /></div>
        <div className="inv-field"><label>Vendor</label><input className="inv-input" value={v.vendor} onChange={set('vendor')} placeholder="e.g. ABC Suppliers" /></div>
        <div className="inv-field"><label>Stock</label><input className="inv-input" type="number" value={v.stock} onChange={set('stock')} placeholder="0" /></div>
        <div className="inv-field"><label>Low-stock Alert</label><input className="inv-input" type="number" value={v.low} onChange={set('low')} placeholder="0" /></div>
        <div className="inv-field"><label>Cost Price (Rs)</label><input className="inv-input" type="number" value={v.cost} onChange={set('cost')} placeholder="0" /></div>
        <div className="inv-field"><label>Sell Price (Rs)</label><input className="inv-input" type="number" value={v.price} onChange={set('price')} placeholder="0" /></div>
      </div>
    </Shell>
  )
}

/* ════════ REPORTS ════════
   ERP-style Reports tab: an overview banner, a download-dialog hint, then
   two card grids (Head Office Assets + Point of Sale). Each tile opens the
   download dialog (Colorful / Colorless · PDF / Word) that builds the A4
   report — the same card-grid flow the School Mentor ERP Inventory uses. */
const INV_REPORTS = [
  { key: 'inv_total',    icon: 'fa-boxes-stacked',        title: 'Total Assets Report',     desc: 'Complete list of all items & quantities',     ctrl: 'none' },
  { key: 'inv_status',   icon: 'fa-toggle-on',            title: 'Active vs Inactive',      desc: 'Items currently in use vs retired',           ctrl: 'none' },
  { key: 'inv_category', icon: 'fa-layer-group',          title: 'Category-wise',           desc: 'Items grouped by category',                   ctrl: 'none' },
  { key: 'inv_location', icon: 'fa-location-dot',         title: 'Location-wise',           desc: 'Items grouped by room / location',            ctrl: 'none' },
  { key: 'pos_daily',    icon: 'fa-calendar-day',         title: 'Daily Sales Report',      desc: 'All sales for a selected day',                ctrl: 'date' },
  { key: 'pos_monthly',  icon: 'fa-calendar-days',        title: 'Monthly Sales Report',    desc: 'Day-by-day sales for a selected month',       ctrl: 'month' },
  { key: 'pos_overall',  icon: 'fa-calendar-week',        title: 'Overall Sales Report',    desc: 'All sales between two selected dates',         ctrl: 'range' },
  { key: 'pos_product',  icon: 'fa-box-open',             title: 'Product-wise Sales',      desc: 'Units & revenue sold per product',            ctrl: 'none' },
  { key: 'pos_lowstock', icon: 'fa-triangle-exclamation', title: 'Low Stock Products',      desc: 'Shop products that need restocking',           ctrl: 'none' },
  { key: 'pos_pvs',      icon: 'fa-scale-balanced',       title: 'Purchase vs Sale Summary', desc: 'Cost, revenue & profit per product',          ctrl: 'none' },
  { key: 'pos_pnl',      icon: 'fa-money-bill-trend-up',  title: 'Profit & Loss Report',    desc: 'Sales, costing & profit between two dates',   ctrl: 'range' },
  { key: 'pos_invvalue', icon: 'fa-warehouse',            title: 'Current Product Value',   desc: 'Stock value at purchase & sale price',        ctrl: 'none' },
  { key: 'pos_vendor',   icon: 'fa-truck',                title: 'Vendor Report',           desc: 'Products & stock value grouped by vendor',    ctrl: 'none' },
]

function Reports({ inv, fire }) {
  const nowYM = todayISO().slice(0, 7)
  const [ry, rm] = nowYM.split('-')
  const monthEnd = `${nowYM}-${String(new Date(Number(ry), Number(rm), 0).getDate()).padStart(2, '0')}`
  const [ctrl, setCtrl] = useState({ date: todayISO(), month: nowYM, from: `${nowYM}-01`, to: monthEnd })
  const [picker, setPicker] = useState(null) // selected tile → open download dialog

  const generate = (style, fmt) => {
    if (picker.ctrl === 'range' && ctrl.from > ctrl.to) { fire('“From” date must be before “To” date', 'warn'); return }
    const report = buildInvReport(inv, picker.key, ctrl)
    renderA4Report(report, { onToast: fire, bw: style === 'bw', format: fmt })
    setPicker(null)
  }

  const invTiles = INV_REPORTS.filter((r) => r.key.startsWith('inv_'))
  const posTiles = INV_REPORTS.filter((r) => r.key.startsWith('pos_'))

  return (
    <>
      <div className="inv-overview">
        <div className="inv-ov-ic" style={{ background: 'linear-gradient(135deg,#7C3AED,#6D28D9)' }}><i className="fa-solid fa-chart-column" /></div>
        <div><div className="inv-ov-title">Reports</div><div className="inv-ov-sub">Clean, printable <strong>A4 reports</strong> for both assets and shop sales — total items, low stock, daily &amp; monthly sales and more. Print or save as PDF.</div></div>
      </div>

      <div className="inv-rep-info"><i className="fa-solid fa-circle-info" /><span>Every report opens through the same download dialog — pick Colorful or Colorless, then PDF or Word.</span></div>

      <div className="inv-rep-grp-ttl"><i className="fa-solid fa-warehouse" /> Head Office Assets Reports</div>
      <div className="inv-rep-grid">
        {invTiles.map((t) => <ReportTile key={t.key} tile={t} variant="blue" onClick={() => setPicker(t)} />)}
      </div>

      <div className="inv-rep-grp-ttl"><i className="fa-solid fa-cash-register" /> Point of Sale Reports</div>
      <div className="inv-rep-grid">
        {posTiles.map((t) => <ReportTile key={t.key} tile={t} variant="green" onClick={() => setPicker(t)} />)}
      </div>

      {picker && <InvReportPicker tile={picker} ctrl={ctrl} setCtrl={setCtrl} onClose={() => setPicker(null)} onGenerate={generate} />}
    </>
  )
}

function ReportTile({ tile, variant, onClick }) {
  return (
    <button type="button" className={`inv-rep-tile inv-rep-tile--${variant}`} onClick={onClick} title={tile.desc}>
      <div className="inv-rep-tile-ic"><i className={`fa-solid ${tile.icon}`} /></div>
      <div className="inv-rep-tile-tx"><div className="inv-rep-tile-name">{tile.title}</div><div className="inv-rep-tile-desc">{tile.desc}</div></div>
      <div className="inv-rep-tile-arrow"><i className="fa-solid fa-arrow-right" /></div>
    </button>
  )
}

/* Download dialog — Report Style (Colorful / Colorless) + optional date
   filters + File Format (PDF / Word), matching the ERP's report picker. */
function InvReportPicker({ tile, ctrl, setCtrl, onClose, onGenerate }) {
  const [style, setStyle] = useState('color')
  const [fmt, setFmt] = useState('pdf')
  const set = (k) => (e) => setCtrl((s) => ({ ...s, [k]: e.target.value }))
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="irp-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }} role="dialog" aria-modal="true">
      <div className="irp-modal">
        <div className="irp-hd">
          <div className="irp-hd-l"><div className="irp-hd-ic"><i className="fa-solid fa-print" /></div>
            <div><div className="irp-hd-ttl">Download Report</div><div className="irp-hd-sub">{tile.title} — choose style and format</div></div></div>
          <button className="irp-x" onClick={onClose} aria-label="Close"><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="irp-body">
          {tile.ctrl !== 'none' && (
            <>
              <div className="irp-lbl">{tile.ctrl === 'range' ? 'Date Range' : tile.ctrl === 'month' ? 'Report Month' : 'Report Date'}</div>
              <div className="irp-filters">
                {tile.ctrl === 'date' && <div className="inv-field"><label>Date</label><input className="inv-input" type="date" value={ctrl.date} onChange={set('date')} /></div>}
                {tile.ctrl === 'month' && <div className="inv-field"><label>Month</label><input className="inv-input" type="month" value={ctrl.month} onChange={set('month')} /></div>}
                {tile.ctrl === 'range' && <>
                  <div className="inv-field"><label>From</label><input className="inv-input" type="date" value={ctrl.from} onChange={set('from')} /></div>
                  <div className="inv-field"><label>To</label><input className="inv-input" type="date" value={ctrl.to} onChange={set('to')} /></div>
                </>}
              </div>
            </>
          )}
          <div className="irp-lbl">Report Style</div>
          <div className="irp-options">
            <button type="button" className={`irp-option${style === 'color' ? ' on' : ''}`} onClick={() => setStyle('color')}>
              <div className="irp-check"><i className="fa-solid fa-check" /></div>
              <div className="irp-prev irp-prev-color"><span /><span /><span /></div>
              <div className="irp-opt-name"><i className="fa-solid fa-palette" style={{ color: '#1E40AF', marginRight: 6 }} />Colorful</div>
              <div className="irp-opt-desc">Branded headings, summary cards &amp; color tags</div>
            </button>
            <button type="button" className={`irp-option${style === 'bw' ? ' on' : ''}`} onClick={() => setStyle('bw')}>
              <div className="irp-check"><i className="fa-solid fa-check" /></div>
              <div className="irp-prev irp-prev-bw"><span /><span /><span /></div>
              <div className="irp-opt-name"><i className="fa-solid fa-circle-half-stroke" style={{ marginRight: 6 }} />Colorless</div>
              <div className="irp-opt-desc">Low-ink layout — white background, light borders only</div>
            </button>
          </div>
          <div className="irp-lbl">File Format</div>
          <div className="irp-format-row">
            <button type="button" className={`irp-pill${fmt === 'pdf' ? ' on-pdf' : ''}`} onClick={() => setFmt('pdf')}><div className="irp-pill-ic"><i className="fa-solid fa-file-pdf" /></div><div><div className="irp-pill-name">PDF</div><div className="irp-pill-desc">Best for sharing</div></div></button>
            <button type="button" className={`irp-pill${fmt === 'word' ? ' on-word' : ''}`} onClick={() => setFmt('word')}><div className="irp-pill-ic"><i className="fa-brands fa-microsoft" /></div><div><div className="irp-pill-name">Word (.doc)</div><div className="irp-pill-desc">Best for editing</div></div></button>
          </div>
        </div>
        <div className="irp-foot">
          <button className="irp-btn ghost" onClick={onClose}>Cancel</button>
          <button className="irp-btn go" onClick={() => onGenerate(style, fmt)}><i className="fa-solid fa-download" /> Download {style === 'color' ? 'Colorful' : 'Colorless'} {fmt === 'pdf' ? 'PDF' : 'Word'}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/* ── Build a unified report (sections) for any type ── */
function buildInvReport(inv, type, ctrl) {
  const C = (label, a) => ({ label, a: a || 'l' })
  if (type === 'inv_total') {
    const list = inv.items.filter((i) => i.active)
    return { title: 'Total Assets Report', period: 'Active items', filters: [['Records', String(list.length)], ['Total Units', num(list.reduce((a, i) => a + i.qty, 0))]],
      kpis: [{ label: 'Items', value: list.length, icon: 'fa-box', cls: 'info' }, { label: 'Total Units', value: num(list.reduce((a, i) => a + i.qty, 0)), icon: 'fa-boxes-stacked', cls: 'green' }],
      sections: [{ columns: [C('Asset #'), C('Item'), C('Category'), C('Qty', 'c'), C('Location'), C('Status')], rows: list.map((i) => [i.code, i.name, i.cat, num(i.qty), i.loc || '—', i.status]), totals: ['', '', 'Total Units', num(list.reduce((a, i) => a + i.qty, 0)), `${list.length} records`, ''] }] }
  }
  if (type === 'inv_status') {
    const a = inv.items.filter((i) => i.active); const n = inv.items.filter((i) => !i.active)
    const sec = (t, arr) => ({ title: t, columns: [C('Asset #'), C('Item'), C('Qty', 'c'), C('Status')], rows: arr.map((i) => [i.code, i.name, num(i.qty), i.status]), totals: null })
    return { title: 'Active vs Inactive Items Report', period: `${a.length} active · ${n.length} inactive`, filters: [['Active', String(a.length)], ['Inactive', String(n.length)], ['Total', String(inv.items.length)]],
      kpis: [{ label: 'Active', value: a.length, icon: 'fa-circle-check', cls: 'green' }, { label: 'Inactive', value: n.length, icon: 'fa-circle-pause', cls: 'amber' }, { label: 'Total Records', value: inv.items.length, icon: 'fa-box', cls: 'info' }],
      sections: [sec('Active Items', a), sec('Inactive Items', n)] }
  }
  if (type === 'inv_category' || type === 'inv_location') {
    const byLoc = type === 'inv_location'
    const groups = {}
    inv.items.filter((i) => i.active).forEach((i) => { const k = byLoc ? (i.loc || 'Unassigned') : i.cat; (groups[k] = groups[k] || []).push(i) })
    const cols = byLoc ? [C('Item'), C('Category'), C('Qty', 'c'), C('Location'), C('Status')] : [C('Asset #'), C('Item'), C('Qty', 'c'), C('Location')]
    const sections = Object.keys(groups).sort().map((k) => {
      const g = groups[k]; const tot = g.reduce((a, i) => a + i.qty, 0)
      return { title: `${k} — ${num(tot)} units`, columns: cols, rows: g.map((i) => byLoc ? [i.name, i.cat, num(i.qty), i.loc || 'Unassigned', i.status] : [i.code, i.name, num(i.qty), i.loc || '—']), totals: null }
    })
    return { title: byLoc ? 'Location-wise Assets Report' : 'Category-wise Assets Report', period: `${sections.length} ${byLoc ? 'locations' : 'categories'}`, filters: [[byLoc ? 'Locations' : 'Categories', String(sections.length)]], kpis: [], sections: sections.length ? sections : [{ columns: cols, rows: [], totals: null }] }
  }
  if (type === 'pos_daily') {
    const list = inv.sales.filter((s) => s.date === ctrl.date); const tot = list.reduce((a, s) => a + s.total, 0)
    return { title: 'Daily Sales Report', period: fmtDate(ctrl.date), filters: [['Date', fmtDate(ctrl.date)], ['Receipts', String(list.length)], ['Total Sales', rs(tot)]],
      kpis: [{ label: 'Receipts', value: list.length, icon: 'fa-receipt', cls: 'info' }, { label: 'Total Sales', value: rs(tot), icon: 'fa-sack-dollar', cls: 'green' }],
      sections: [{ columns: [C('Receipt #'), C('School Owner'), C('Items'), C('Qty', 'c'), C('Amount', 'r')], rows: list.map((s) => [s.no, s.buyer, s.lines.map((l) => `${l.qty}× ${l.name}`).join(', '), s.lines.reduce((a, l) => a + l.qty, 0), num(s.total)]), totals: ['', '', '', 'TOTAL', num(tot)] }] }
  }
  if (type === 'pos_monthly') {
    const list = inv.sales.filter((s) => s.date.slice(0, 7) === ctrl.month)
    const byDay = {}; list.forEach((s) => { byDay[s.date] = (byDay[s.date] || 0) + s.total }); const tot = list.reduce((a, s) => a + s.total, 0)
    const [y, m] = ctrl.month.split('-')
    return { title: 'Monthly Sales Report', period: `${MONTHS[Number(m) - 1]} ${y}`, filters: [['Month', `${MONTHS[Number(m) - 1]} ${y}`], ['Receipts', String(list.length)], ['Total Sales', rs(tot)]],
      kpis: [{ label: 'Receipts', value: list.length, icon: 'fa-receipt', cls: 'info' }, { label: 'Total Sales', value: rs(tot), icon: 'fa-sack-dollar', cls: 'green' }],
      sections: [{ columns: [C('Date'), C('Receipts', 'c'), C('Sales (Rs)', 'r')], rows: Object.keys(byDay).sort().map((d) => [fmtDate(d), list.filter((s) => s.date === d).length, num(byDay[d])]), totals: ['', 'Total', num(tot)] }] }
  }
  if (type === 'pos_overall') {
    const list = inv.sales.filter((s) => s.date >= ctrl.from && s.date <= ctrl.to).sort((a, b) => (a.date < b.date ? -1 : 1))
    const tot = list.reduce((a, s) => a + s.total, 0); const qty = list.reduce((a, s) => a + s.lines.reduce((x, l) => x + l.qty, 0), 0)
    return { title: 'Overall Sales Report', period: `${fmtDate(ctrl.from)} → ${fmtDate(ctrl.to)}`, filters: [['From', fmtDate(ctrl.from)], ['To', fmtDate(ctrl.to)], ['Receipts', String(list.length)], ['Total Sales', rs(tot)]],
      kpis: [{ label: 'Receipts', value: list.length, icon: 'fa-receipt', cls: 'info' }, { label: 'Units Sold', value: num(qty), icon: 'fa-box', cls: 'amber' }, { label: 'Total Sales', value: rs(tot), icon: 'fa-sack-dollar', cls: 'green' }],
      sections: [{ columns: [C('Receipt #'), C('Date'), C('School Owner'), C('Items'), C('Qty', 'c'), C('Amount', 'r')], rows: list.map((s) => [s.no, fmtDate(s.date), s.buyer, s.lines.map((l) => `${l.qty}× ${l.name}`).join(', '), s.lines.reduce((a, l) => a + l.qty, 0), num(s.total)]), totals: ['', '', '', 'TOTAL', qty, num(tot)] }] }
  }
  if (type === 'pos_product') {
    const agg = {}; inv.sales.forEach((s) => s.lines.forEach((l) => { const a = agg[l.name] = agg[l.name] || { qty: 0, rev: 0 }; a.qty += l.qty; a.rev += l.qty * l.price }))
    const keys = Object.keys(agg).sort((a, b) => agg[b].rev - agg[a].rev)
    return { title: 'Product-wise Sales Report', period: 'All sales', filters: [['Products', String(keys.length)]],
      kpis: [{ label: 'Units Sold', value: num(keys.reduce((a, k) => a + agg[k].qty, 0)), icon: 'fa-box', cls: 'amber' }, { label: 'Revenue', value: rs(keys.reduce((a, k) => a + agg[k].rev, 0)), icon: 'fa-sack-dollar', cls: 'green' }],
      sections: [{ columns: [C('Product'), C('Units Sold', 'c'), C('Revenue', 'r')], rows: keys.map((k) => [k, num(agg[k].qty), num(agg[k].rev)]), totals: ['Total', num(keys.reduce((a, k) => a + agg[k].qty, 0)), num(keys.reduce((a, k) => a + agg[k].rev, 0))] }] }
  }
  if (type === 'pos_lowstock') {
    const list = inv.products.filter((p) => p.stock <= p.low)
    return { title: 'Low Stock Products Report', period: `${list.length} product(s) at/below alert`, filters: [['Low Stock', String(list.length)]],
      kpis: [{ label: 'Low Stock Products', value: list.length, icon: 'fa-triangle-exclamation', cls: 'red' }],
      sections: [{ columns: [C('Product'), C('Category'), C('Stock', 'c'), C('Alert Below', 'c'), C('Sell Price', 'r')], rows: list.map((p) => [p.name, p.cat, num(p.stock), num(p.low), num(p.price)]), totals: null }] }
  }
  if (type === 'pos_invvalue') {
    const list = inv.products.slice().sort((a, b) => (a.name < b.name ? -1 : 1))
    let tPur = 0; let tSale = 0
    const rows = list.map((p) => { const pv = p.stock * p.cost; const sv = p.stock * p.price; tPur += pv; tSale += sv; return [p.name, num(p.stock), num(p.cost), num(pv), num(p.price), num(sv)] })
    return { title: 'Current Product Value Report', period: `As of ${fmtDate(todayISO())}`, filters: [['Products', String(list.length)], ['Stock Units', num(list.reduce((a, p) => a + p.stock, 0))]],
      kpis: [{ label: 'Purchase Value', value: rs(tPur), icon: 'fa-cart-shopping', cls: 'info' }, { label: 'Sale Value', value: rs(tSale), icon: 'fa-tags', cls: 'green' }, { label: 'Expected Gross Profit', value: rs(tSale - tPur), icon: 'fa-scale-balanced', cls: tSale - tPur >= 0 ? 'green' : 'red' }],
      sections: [{ columns: [C('Product'), C('Stock', 'c'), C('Cost/Unit', 'r'), C('Purchase Value', 'r'), C('Sale/Unit', 'r'), C('Sale Value', 'r')], rows, totals: ['', '', 'Total', num(tPur), '', num(tSale)] }] }
  }
  if (type === 'pos_vendor') {
    const groups = {}
    inv.products.forEach((p) => { const k = (p.vendor || '').trim() || 'Unassigned'; (groups[k] = groups[k] || []).push(p) })
    const names = Object.keys(groups).sort((a, b) => (a === 'Unassigned' ? 1 : b === 'Unassigned' ? -1 : a.localeCompare(b)))
    const grand = inv.products.reduce((a, p) => a + p.stock * p.cost, 0)
    const sections = names.map((k) => {
      const g = groups[k].slice().sort((a, b) => (a.name < b.name ? -1 : 1))
      const tot = g.reduce((a, p) => a + p.stock * p.cost, 0)
      return { title: `${k} — ${g.length} product${g.length === 1 ? '' : 's'}`, columns: [C('Product'), C('Category'), C('Stock', 'c'), C('Cost/Unit', 'r'), C('Stock Value', 'r')], rows: g.map((p) => [p.name, p.cat, num(p.stock), num(p.cost), num(p.stock * p.cost)]), totals: ['', '', '', 'Total', num(tot)] }
    })
    return { title: 'Vendor Report', period: `${names.length} vendor${names.length === 1 ? '' : 's'}`, filters: [['Vendors', String(names.length)], ['Products', String(inv.products.length)]],
      kpis: [{ label: 'Vendors', value: num(names.length), icon: 'fa-truck', cls: 'info' }, { label: 'Products', value: num(inv.products.length), icon: 'fa-box', cls: 'amber' }, { label: 'Total Stock Value', value: rs(grand), icon: 'fa-sack-dollar', cls: 'green' }],
      sections: sections.length ? sections : [{ columns: [C('Product'), C('Category'), C('Stock', 'c'), C('Cost/Unit', 'r'), C('Stock Value', 'r')], rows: [], totals: null }] }
  }
  // pos_pvs & pos_pnl (P&L within range)
  const list = type === 'pos_pnl' ? inv.sales.filter((s) => s.date >= ctrl.from && s.date <= ctrl.to) : inv.sales
  const agg = {}; list.forEach((s) => s.lines.forEach((l) => { const a = agg[l.name] = agg[l.name] || { qty: 0, rev: 0 }; a.qty += l.qty; a.rev += l.qty * l.price }))
  let tRev = 0; let tCost = 0
  const keys = Object.keys(agg).sort((a, b) => agg[b].rev - agg[a].rev)
  const rows = keys.map((k) => { const p = inv.products.find((x) => x.name === k); const cost = (p ? p.cost : 0) * agg[k].qty; const rev = agg[k].rev; tRev += rev; tCost += cost; return [k, num(agg[k].qty), num(rev), num(cost), num(rev - cost)] })
  const profit = tRev - tCost
  return {
    title: type === 'pos_pnl' ? 'Profit & Loss Report' : 'Purchase vs Sale Summary',
    period: type === 'pos_pnl' ? `${fmtDate(ctrl.from)} → ${fmtDate(ctrl.to)}` : 'All sales',
    filters: type === 'pos_pnl' ? [['From', fmtDate(ctrl.from)], ['To', fmtDate(ctrl.to)], ['Receipts', String(list.length)]] : [['Products', String(keys.length)]],
    kpis: [{ label: 'Total Sales', value: rs(tRev), icon: 'fa-sack-dollar', cls: 'green' }, { label: 'Total Cost', value: rs(tCost), icon: 'fa-cart-shopping', cls: 'red' }, { label: 'Profit', value: rs(profit), icon: 'fa-scale-balanced', cls: profit >= 0 ? 'green' : 'red' }],
    sections: [{ columns: [C('Product'), C('Units', 'c'), C('Sale Amount', 'r'), C('Purchase Cost', 'r'), C('Profit', 'r')], rows, totals: ['', '', num(tRev), num(tCost), num(profit)] }],
  }
}

/* ════════ A4 REPORT — matches the School Mentor ERP Inventory Report ════════
   One shared renderer for every Head Office Assets report AND the POS receipt:
   blue brand header (logo + Generated/Format chips), KPI strip, filter bar,
   blue section bands, zebra tables with totals, three-part footer and a
   print toolbar — the same colourful A4 chrome the ERP's reportKit prints. */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

/* KPI left-bar accent per semantic class — keeps the colour meaning the
   on-screen cards encode, inside the ERP KPI-card shape. */
const KPI_ACCENT = { green: '#16A34A', amber: '#D97706', red: '#DC2626', info: '#1E40AF' }

function renderA4Report(report, { onToast, bw = false, format = 'pdf' } = {}) {
  const chain = loadChainProfile()
  const now = new Date()
  const generatedOn = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) + ', ' + now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  const styleLabel = bw ? 'Colorless' : 'Colorful'
  const fmtLabel = format === 'word' ? 'WORD' : 'PDF'

  /* Two coordinated palettes — a brand-blue Colorful report and a genuine
     low-ink Colorless redesign (white header, no decorative fills, bordered
     table heads), mirroring the ERP reportKit's two styles. */
  const P = bw
    ? { hbg: '#FFFFFF', hfg: '#111111', kick: '#6B7280', sub: '#4B5563', div: '#E5E7EB', hpad: '22px 32px', hbdr: 'border-bottom:1px solid #D1D5DB;',
        chipBg: 'transparent', chipBd: '#D1D5DB', chipFg: '#111111', logoBg: '#FFFFFF', logoFg: '#111111', logoBd: '1.5px solid #111111', logoSh: 'none',
        kpiBg: '#FFFFFF', kpiBd: '#D1D5DB', kpiBar: '#374151', fltBg: '#FFFFFF', fltBd: '1px solid #D1D5DB', fltB: '#111111',
        bandBg: '#FFFFFF', bandFg: '#111111', bandBd: '1.5px solid #111111', thBg: '#FFFFFF', thFg: '#111111', thBdr: 'border-bottom:1.5px solid #111111;',
        zebra: 'transparent', ftBg: '#FFFFFF', ftFg: '#111111', ftBdr: '1.5px solid #111111' }
    : { hbg: '#1E3A8A', hfg: '#FFFFFF', kick: 'rgba(255,255,255,.55)', sub: 'rgba(255,255,255,.75)', div: 'rgba(255,255,255,.2)', hpad: '24px 32px 28px', hbdr: '',
        chipBg: 'rgba(255,255,255,.14)', chipBd: 'transparent', chipFg: '#FFFFFF', logoBg: '#FFFFFF', logoFg: '#1E3A8A', logoBd: 'none', logoSh: '0 4px 18px rgba(0,0,0,.35),0 0 0 2px rgba(255,255,255,.15)',
        kpiBg: '#F8FAFF', kpiBd: '#E5E7EB', kpiBar: '#1E40AF', fltBg: '#F1F5FB', fltBd: 'none', fltB: '#1E40AF',
        bandBg: '#1E3A8A', bandFg: '#FFFFFF', bandBd: 'none', thBg: '#1E3A8A', thFg: '#FFFFFF', thBdr: '',
        zebra: '#FAFBFE', ftBg: '#EAF0FA', ftFg: '#1E40AF', ftBdr: '1.5px solid #CBD5E1' }

  const logo = chain.logo
    ? `<img src="${chain.logo}" alt="" style="width:100%;height:100%;object-fit:contain;background:#fff;border-radius:12px">`
    : `<div class="rep-logo-ini">${esc(chainInitials(chain.chainName))}</div>`
  const contact = [chain.contact && `&#9742; ${esc(chain.contact)}`, chain.email && `&#9993; ${esc(chain.email)}`].filter(Boolean).join(' &nbsp;·&nbsp; ')
  const kpiAccent = (cls) => (bw ? P.kpiBar : (KPI_ACCENT[cls] || '#1E40AF'))
  const kpis = (report.kpis || []).map((k) => `<div class="kpi" style="--kacc:${kpiAccent(k.cls)}"><div class="l">${esc(k.label)}</div><div class="v">${esc(k.value)}</div></div>`).join('')
  const filters = (report.filters || []).map(([l, v]) => `<span><b>${esc(l)}:</b> ${esc(v)}</span>`).join('')
  const sectionsHtml = report.sections.map((sec) => {
    const thead = sec.columns.map((c) => `<th class="${c.a === 'r' ? 'r' : c.a === 'c' ? 'c' : ''}">${esc(c.label)}</th>`).join('')
    const tbody = sec.rows.length
      ? sec.rows.map((row) => `<tr>${row.map((cell, i) => `<td class="${sec.columns[i].a === 'r' ? 'r' : sec.columns[i].a === 'c' ? 'c' : ''}">${esc(cell)}</td>`).join('')}</tr>`).join('')
      : `<tr><td class="empty" colspan="${sec.columns.length}">No records.</td></tr>`
    const tfoot = sec.totals && sec.rows.length ? `<tfoot><tr>${sec.totals.map((cell, i) => `<td class="${sec.columns[i].a === 'r' ? 'r' : sec.columns[i].a === 'c' ? 'c' : ''}">${esc(cell)}</td>`).join('')}</tr></tfoot>` : ''
    return `${sec.title ? `<div class="sec-band">${esc(sec.title)}</div>` : ''}<table class="tbl"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody>${tfoot}</table>`
  }).join('')

  const circles = bw ? '' : '<div class="c1"></div><div class="c2"></div>'
  const toolbar = format === 'pdf' ? '<div class="rep-tb no-print"><button class="pr" onclick="window.print()">Print / Save as PDF</button><button class="cl" onclick="window.close()">Close</button></div>' : ''
  const script = format === 'pdf' ? '<script>window.onload=function(){var i=Array.prototype.slice.call(document.images||[]);Promise.all(i.map(function(m){return m.complete?null:new Promise(function(r){m.onload=r;m.onerror=r})})).then(function(){setTimeout(function(){try{window.focus();window.print()}catch(e){}},200)})}<\/script>' : ''

  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>${esc(report.title)}${chain.chainName ? ` — ${esc(chain.chainName)}` : ''}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#0F172A;font-size:13px}
.page{width:210mm;margin:0 auto}
.rep-hd{background:${P.hbg};padding:${P.hpad};color:${P.hfg};position:relative;overflow:hidden;${P.hbdr}}
.rep-hd .c1{position:absolute;top:-30px;right:-30px;width:140px;height:140px;border-radius:50%;background:rgba(255,255,255,.06)}
.rep-hd .c2{position:absolute;bottom:-20px;left:120px;width:80px;height:80px;border-radius:50%;background:rgba(14,165,233,.15)}
.rep-brand{display:flex;align-items:center;gap:18px;position:relative;z-index:2}
.rep-logo{width:64px;height:64px;border-radius:16px;overflow:hidden;flex-shrink:0;box-shadow:${P.logoSh}}
.rep-logo-ini{width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${P.logoBg};color:${P.logoFg};font-weight:800;font-size:22px;border:${P.logoBd};border-radius:16px}
.rep-kick{font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:${P.kick};font-weight:700;margin-bottom:3px}
.rep-org{font-size:20px;font-weight:800;letter-spacing:-.02em;line-height:1.2}
.rep-org-line{font-size:11px;color:${P.sub};margin-top:3px}
.rep-div{height:1px;background:${P.div};margin:18px 0 16px;position:relative;z-index:2}
.rep-title{font-size:22px;font-weight:800;letter-spacing:-.02em;margin-bottom:4px;position:relative;z-index:2}
.rep-sub{font-size:13px;color:${P.sub};margin-bottom:16px;position:relative;z-index:2}
.rep-chips{display:flex;gap:10px;flex-wrap:wrap;position:relative;z-index:2}
.rep-chip{background:${P.chipBg};border:1px solid ${P.chipBd};color:${P.chipFg};padding:6px 14px;border-radius:20px;font-size:11.5px}
.rep-body{padding:28px 32px}
.kpi-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:16px}
.kpi{border:1px solid ${P.kpiBd};border-radius:8px;padding:10px 12px;background:${P.kpiBg};position:relative;overflow:hidden}
.kpi::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--kacc,#1E40AF)}
.kpi .l{font-size:9px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.3px}
.kpi .v{font-size:15px;font-weight:800;color:#0F172A;margin-top:2px;font-variant-numeric:tabular-nums}
.rfilters{display:flex;flex-wrap:wrap;gap:5px 26px;font-size:11px;color:#333;margin-bottom:14px;background:${P.fltBg};border:${P.fltBd};padding:10px 14px;border-radius:6px}
.rfilters b{color:${P.fltB}}
.sec-band{background:${P.bandBg};color:${P.bandFg};border:${P.bandBd};padding:8px 14px;border-radius:6px;font-weight:800;margin:14px 0 10px;font-size:12px}
.tbl{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;font-size:10.5px;margin-bottom:10px}
.tbl thead th{background:${P.thBg};color:${P.thFg};padding:7px 9px;text-align:left;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:.3px;${P.thBdr}}
.tbl th.r,.tbl td.r{text-align:right}.tbl th.c,.tbl td.c{text-align:center}
.tbl tbody td{padding:6px 9px;border-bottom:1px solid #F1F3F8;vertical-align:top}
.tbl tbody tr:nth-child(even) td{background:${P.zebra}}
.tbl tbody tr:last-child td{border-bottom:0}
.tbl td.empty{text-align:center;padding:24px;color:#94A3B8;font-style:italic}
.tbl tfoot td{padding:8px 9px;background:${P.ftBg};font-weight:800;border-top:${P.ftBdr};font-size:11.5px;color:${P.ftFg}}
.rep-ft{border-top:1px solid #E5E7EB;padding:14px 32px;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:#64748B}
.rep-tb{text-align:center;padding:22px;background:#F8FAFC;border-top:1px solid #E2E8F0}
.rep-tb .pr{background:#1E3A8A;color:#fff;border:none;padding:12px 28px;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;margin-right:10px}
.rep-tb .cl{background:transparent;border:1.5px solid #CBD5E1;color:#64748B;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.no-print{display:none}@page{size:A4 portrait;margin:15mm}}
</style></head><body><div class="page">
<div class="rep-hd">${circles}
  <div class="rep-brand"><div class="rep-logo">${logo}</div><div><div class="rep-kick">School Mentor · Head Office</div><div class="rep-org">${esc(chain.chainName)}</div>${chain.address ? `<div class="rep-org-line">${esc(chain.address)}</div>` : ''}${contact ? `<div class="rep-org-line">${contact}</div>` : ''}</div></div>
  <div class="rep-div"></div>
  <div class="rep-title">${esc(report.title)}</div>
  <div class="rep-sub">${report.period ? esc(report.period) + ' · ' : ''}${styleLabel} Report</div>
  <div class="rep-chips"><div class="rep-chip"><b>Generated:</b> ${esc(generatedOn)}</div><div class="rep-chip"><b>Format:</b> ${fmtLabel}</div></div>
</div>
<div class="rep-body">${kpis ? `<div class="kpi-row">${kpis}</div>` : ''}${filters ? `<div class="rfilters">${filters}</div>` : ''}${sectionsHtml}</div>
<div class="rep-ft"><span>${esc(chain.chainName)}</span><span>School Mentor · Head Office © ${now.getFullYear()}</span><span>Page 1 of 1</span></div>
${toolbar}
</div>
${script}
</body></html>`

  if (format === 'word') {
    const blob = new Blob(['﻿', html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${(report.title || 'Report').replace(/[^\w]+/g, '_')}.doc`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1500)
    onToast?.('Word document downloaded', 'success')
    return
  }
  const w = window.open('', '_blank')
  if (!w) { onToast?.('Allow pop-ups to download / print the report', 'warn'); return }
  w.document.open(); w.document.write(html); w.document.close()
}

/* POS receipt → full A4 report in the same ERP design (not a slip). */
function printReceipt(sale, onToast) {
  const units = sale.lines.reduce((a, l) => a + l.qty, 0)
  const report = {
    title: 'Sales Receipt',
    period: `${sale.no} · ${fmtDate(sale.date)}`,
    filters: [['Receipt #', sale.no], ['Date', fmtDate(sale.date)], ['School Owner', sale.buyer], ['Served By', sale.by]],
    kpis: [
      { label: 'Items', value: num(sale.lines.length), cls: 'info' },
      { label: 'Total Units', value: num(units), cls: 'amber' },
      { label: 'Total Amount', value: rs(sale.total), cls: 'green' },
    ],
    sections: [{
      columns: [{ label: 'Item', a: 'l' }, { label: 'Qty', a: 'c' }, { label: 'Unit Price', a: 'r' }, { label: 'Amount', a: 'r' }],
      rows: sale.lines.map((l) => [l.name, num(l.qty), num(l.price), num(l.qty * l.price)]),
      totals: ['', '', 'TOTAL', rs(sale.total)],
    }],
  }
  renderA4Report(report, { onToast })
}

/* ════════ shared shells ════════ */
function Shell({ title, icon, maxWidth, foot, children, onClose }) {
  return createPortal(
    <div className="pay-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pay-modal" style={{ maxWidth: maxWidth || 600 }}>
        <div className="pay-modal-hdr">
          <div className="pay-modal-av"><i className={`fa-solid ${icon}`} /></div>
          <div><div className="pay-modal-title">{title}</div></div>
          <button className="pay-modal-x" onClick={onClose}><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="pay-modal-body">{children}</div>
        <div className="pay-modal-foot">{foot}</div>
      </div>
    </div>,
    document.body,
  )
}

function ConfirmModal({ title, body, onClose, onConfirm }) {
  return createPortal(
    <div className="ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-body" style={{ textAlign: 'center', padding: '40px 30px' }}>
          <div className="confirm-icon" style={{ background: 'rgba(220,38,38,.1)', border: '2px solid rgba(220,38,38,.25)', color: '#DC2626' }}><i className="fa-solid fa-trash-can" /></div>
          <div className="confirm-title">{title}</div>
          <div className="confirm-sub">{body}</div>
          <div className="confirm-btns">
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <SpinnerButton className="btn-danger" icon="fa-trash-can" onClick={onConfirm}>Delete</SpinnerButton>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
