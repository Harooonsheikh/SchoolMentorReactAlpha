import { useEffect, useMemo, useState } from 'react'
import TutorialButton from '../../components/TutorialButton'
import { createPortal } from 'react-dom'
import {
  loadInv, saveInv, MONTHS, ITEM_STATUSES, CONDITIONS,
  rs, num, todayISO, fmtDate, nextItemCode, barcodeBars,
} from './data'
import { loadChainProfile, chainInitials } from '../../config/chainProfile'
import './Inventory.css'

const stClass = (s) => `st-${(s || '').replace(/ /g, '-')}`

export default function Inventory() {
  const [inv, setInv] = useState(null)
  const [tab, setTab] = useState('manage')
  const [toast, setToast] = useState(null)

  useEffect(() => { setInv(loadInv()) }, [])
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t) }, [toast])
  const fire = (text, type = 'success') => setToast({ text, type })
  const commit = (next) => { setInv(next); saveInv(next) }
  if (!inv) return null

  return (
    <>
      <div className="page-header">
        <div className="page-title-row">
          <div className="page-icon" style={{ background: 'linear-gradient(135deg,#1E3A8A,#1E40AF)' }}><i className="fa-solid fa-boxes-stacked" /></div>
          <div><div className="page-title">Inventory</div><div className="page-sub">School assets, a simple shop counter &amp; printable reports.</div></div>
        </div>
        <TutorialButton />
      </div>

      <div className="inv-tabs">
        {[['manage', 'fa-warehouse', 'Inventory Management'], ['pos', 'fa-cash-register', 'Point of Sale'], ['reports', 'fa-chart-column', 'Reports']].map(([k, ic, lbl]) => (
          <button key={k} className={`inv-tab${tab === k ? ' active' : ''}`} onClick={() => setTab(k)}><i className={`fa-solid ${ic}`} /> {lbl}</button>
        ))}
      </div>

      {tab === 'manage' && <Manage inv={inv} commit={commit} fire={fire} />}
      {tab === 'pos' && <POS inv={inv} commit={commit} fire={fire} />}
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
function Manage({ inv, commit, fire }) {
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

  const saveItem = (data, id) => {
    if (id) commit({ ...inv, items: inv.items.map((i) => (i.id === id ? { ...i, ...data } : i)) })
    else { const nid = inv.nextItemId + 1; commit({ ...inv, nextItemId: nid, items: [...inv.items, { id: nid, active: true, history: [{ t: 'Item added to inventory', at: todayISO() }], ...data }] }) }
    setItemModal(null); fire(id ? 'Item updated' : 'Item added')
  }
  const toggleActive = (it) => {
    const active = !it.active
    commit({ ...inv, items: inv.items.map((i) => (i.id === it.id ? { ...i, active, history: [...i.history, { t: active ? 'Marked Active' : 'Marked Inactive', at: todayISO() }] } : i)) })
    fire(active ? 'Item reactivated' : 'Item marked inactive', 'info')
  }
  const doDelete = () => { commit({ ...inv, items: inv.items.filter((i) => i.id !== del.id) }); setDel(null); setOpenId(null); fire('Item deleted', 'info') }

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
          <button className="btn-sm" style={{ height: 38, borderColor: item.active ? 'var(--warn)' : 'var(--success)', color: item.active ? 'var(--warn)' : 'var(--success)' }} onClick={() => toggleActive(item)}><i className={`fa-solid ${item.active ? 'fa-circle-pause' : 'fa-circle-check'}`} /> {item.active ? 'Mark Inactive' : 'Reactivate'}</button>
          {!item.active && <button className="btn-sm" style={{ height: 38, borderColor: 'var(--err)', color: 'var(--err)', background: 'rgba(220,38,38,.05)' }} onClick={() => setDel(item)}><i className="fa-solid fa-trash-can" /> Delete</button>}
        </div>
        <div className="inv-detail-grid">
          <div className="inv-info-card">
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--t1)', marginBottom: 8 }}><i className="fa-solid fa-circle-info" style={{ color: 'var(--brand)', marginRight: 6 }} /> Item Details</div>
            {[['Inventory #', item.code], ['Category', item.cat], ['Quantity', `${num(item.qty)}${item.low > 0 && item.qty <= item.low ? ' (low stock)' : ''}`], ['Low-stock Alert', item.low], ['Condition', item.cond], ['Status', item.status], ['Location', item.loc || '—'], ['Added', fmtDate(item.date)]].map(([l, v]) => (
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
        {del && <ConfirmModal title="Delete Item?" body={`“${del.name}” will be permanently removed from inventory records.`} onClose={() => setDel(null)} onConfirm={doDelete} />}
      </>
    )
  }

  return (
    <>
      <div className="inv-overview">
        <div className="inv-ov-ic"><i className="fa-solid fa-warehouse" /></div>
        <div><div className="inv-ov-title">Inventory Management</div><div className="inv-ov-sub">Keep a record of every physical item — furniture, equipment, lab &amp; sports gear. Print barcode labels to paste on each item.</div></div>
      </div>

      <div className="inv-kpis">
        <div className="inv-kpi info"><div className="inv-kpi-top"><i className="fa-solid fa-boxes-stacked" /> Total Units</div><div className="inv-kpi-val">{num(stats.qty)}</div><div className="inv-kpi-sub">across active items</div></div>
        <div className="inv-kpi green"><div className="inv-kpi-top"><i className="fa-solid fa-circle-check" /> Active Items</div><div className="inv-kpi-val">{stats.active}</div></div>
        <div className="inv-kpi"><div className="inv-kpi-top"><i className="fa-solid fa-layer-group" /> Categories</div><div className="inv-kpi-val">{stats.cats}</div></div>
        <div className="inv-kpi amber"><div className="inv-kpi-top"><i className="fa-solid fa-triangle-exclamation" /> Low Stock</div><div className="inv-kpi-val">{stats.low}</div></div>
      </div>

      <div className="inv-bar">
        <div style={{ flex: 1, fontSize: 14, fontWeight: 800, color: 'var(--t1)', alignSelf: 'center' }}><i className="fa-solid fa-boxes-stacked" style={{ color: 'var(--brand)', marginRight: 7 }} /> All Inventory Items</div>
        <button className="btn-primary" onClick={() => setItemModal({ mode: 'add' })}><i className="fa-solid fa-plus" /> Add Inventory Item</button>
      </div>

      <div className="inv-seg">
        <button className={`inv-seg-btn${seg === 'active' ? ' active' : ''}`} onClick={() => setSeg('active')}><i className="fa-solid fa-circle-check" /> Active Items</button>
        <button className={`inv-seg-btn${seg === 'inactive' ? ' active' : ''}`} onClick={() => setSeg('inactive')}><i className="fa-solid fa-circle-pause" /> Inactive Items</button>
      </div>

      <div className="inv-bar">
        <div className="inv-field" style={{ flex: 1, minWidth: 220 }}><label>Search</label><div className="search-box"><i className="fa-solid fa-magnifying-glass" /><input className="search-input" placeholder="Search by name, inventory number or location" value={search} onChange={(e) => setSearch(e.target.value)} /></div></div>
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
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }))
  const save = () => {
    if (!v.name.trim()) return onToast('Please enter an item name', 'warn')
    const code = v.code.trim() || nextItemCode(inv, v.name)
    onSave({ ...v, name: v.name.trim(), code, loc: v.loc.trim(), desc: v.desc.trim(), qty: Number(v.qty) || 0, low: Number(v.low) || 0 }, modal.mode === 'edit' ? it.id : null)
  }
  return (
    <Shell title={it ? 'Edit Inventory Item' : 'Add Inventory Item'} icon="fa-box" onClose={onClose}
      foot={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Save Item</button></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="inv-field"><label>Item Name</label><input className="inv-input" value={v.name} onChange={set('name')} placeholder="e.g. Student Chair" /></div>
        <div className="inv-field"><label>Category</label><select className="inv-input" value={v.cat} onChange={set('cat')}>{inv.categories.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="inv-field"><label>Inventory # {!it && <span style={{ color: 'var(--tm)', fontWeight: 400 }}>(auto)</span>}</label><input className="inv-input" value={v.code} onChange={set('code')} placeholder="auto-generated" /></div>
        <div className="inv-field"><label>Location</label><input className="inv-input" value={v.loc} onChange={set('loc')} placeholder="e.g. Computer Lab" /></div>
        <div className="inv-field"><label>Quantity</label><input className="inv-input" type="number" value={v.qty} onChange={set('qty')} placeholder="0" /></div>
        <div className="inv-field"><label>Low-stock Alert</label><input className="inv-input" type="number" value={v.low} onChange={set('low')} placeholder="0" /></div>
        <div className="inv-field"><label>Condition</label><select className="inv-input" value={v.cond} onChange={set('cond')}>{CONDITIONS.map((c) => <option key={c}>{c}</option>)}</select></div>
        <div className="inv-field"><label>Status</label><select className="inv-input" value={v.status} onChange={set('status')}>{ITEM_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div className="inv-field"><label>Date Added</label><input className="inv-input" type="date" value={v.date} onChange={set('date')} /></div>
      </div>
      <div className="inv-field"><label>Description</label><textarea className="inv-input" rows={2} value={v.desc} onChange={set('desc')} placeholder="Notes about this item" /></div>
    </Shell>
  )
}

/* ════════ POINT OF SALE ════════ */
function POS({ inv, commit, fire }) {
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
      return [...c, { id: p.id, name: p.name, price: p.price, qty: 1, stock: p.stock }]
    })
  }
  const setQty = (id, q) => setCart((c) => c.map((l) => (l.id === id ? { ...l, qty: Math.max(1, Math.min(q, l.stock)) } : l)))
  const removeLine = (id) => setCart((c) => c.filter((l) => l.id !== id))

  const checkout = () => {
    if (!cart.length) return fire('Cart is empty', 'warn')
    const no = `RCP-${inv.nextReceiptNo}`
    const sale = { no, date: today, buyer: buyer.trim() || 'Walk-in', lines: cart.map((l) => ({ name: l.name, qty: l.qty, price: l.price })), total, by: 'Front Desk' }
    const products = inv.products.map((p) => { const l = cart.find((x) => x.id === p.id); return l ? { ...p, stock: p.stock - l.qty } : p })
    commit({ ...inv, nextReceiptNo: inv.nextReceiptNo + 1, products, sales: [sale, ...inv.sales] })
    printReceipt(sale, fire)
    setCart([]); setBuyer(''); fire('Sale completed · receipt generated')
  }

  const saveProd = (data, id) => {
    if (id) commit({ ...inv, products: inv.products.map((p) => (p.id === id ? { ...p, ...data } : p)) })
    else { const nid = inv.nextProdId + 1; commit({ ...inv, nextProdId: nid, products: [...inv.products, { id: nid, ...data }] }) }
    setProdModal(null); fire(id ? 'Product updated' : 'Product added')
  }
  const doDelProd = () => { commit({ ...inv, products: inv.products.filter((p) => p.id !== del.id) }); setDel(null); fire('Product deleted', 'info') }

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
              <div className="inv-field" style={{ marginBottom: 12 }}><label>Buyer Name (Student / Parent)</label><input className="inv-input" value={buyer} onChange={(e) => setBuyer(e.target.value)} placeholder="e.g. Ahmed Raza — Class 5B" /></div>
              <div className="inv-cart-total"><span style={{ fontWeight: 700, color: 'var(--tm)' }}>Total</span><span className="inv-cart-total-val">{rs(total)}</span></div>
              <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg,#16A34A,#15803D)' }} onClick={checkout}><i className="fa-solid fa-receipt" /> Generate Receipt</button>
            </div>
          </div>
        </div>
      )}

      {pt === 'products' && (
        <div className="section-card">
          <div className="card-header"><div className="card-title"><i className="fa-solid fa-box-open" /> Shop Products</div><button className="btn-primary" onClick={() => setProdModal({ mode: 'add' })}><i className="fa-solid fa-plus" /> Add Product</button></div>
          <div className="tbl-wrap">
            <table className="inv-table">
              <thead><tr><th>Product</th><th>Category</th><th>Barcode</th><th className="c">Stock</th><th className="r">Cost</th><th className="r">Price</th><th className="c">Action</th></tr></thead>
              <tbody>
                {inv.products.map((p) => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 700, color: 'var(--t1)' }}>{p.name}</td>
                    <td>{p.cat}</td>
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
              <thead><tr><th>Receipt #</th><th>Date</th><th>Buyer</th><th>Items</th><th className="c">Qty</th><th className="r">Amount</th><th className="c">Receipt</th></tr></thead>
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
  const [v, setV] = useState({ name: p?.name || '', cat: p?.cat || 'Stationery', barcode: p?.barcode || '', stock: p?.stock ?? '', low: p?.low ?? 0, cost: p?.cost ?? '', price: p?.price ?? '' })
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }))
  const save = () => { if (!v.name.trim()) return onToast('Please enter a product name', 'warn'); onSave({ name: v.name.trim(), cat: v.cat.trim() || 'Other', barcode: v.barcode.trim(), stock: Number(v.stock) || 0, low: Number(v.low) || 0, cost: Number(v.cost) || 0, price: Number(v.price) || 0 }, modal.mode === 'edit' ? p.id : null) }
  return (
    <Shell title={p ? 'Edit Product' : 'Add Product'} icon="fa-box-open" onClose={onClose} maxWidth={520}
      foot={<><button className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save}><i className="fa-solid fa-floppy-disk" /> Save Product</button></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="inv-field"><label>Product Name</label><input className="inv-input" value={v.name} onChange={set('name')} placeholder="e.g. Notebook (100 pages)" /></div>
        <div className="inv-field"><label>Category</label><input className="inv-input" value={v.cat} onChange={set('cat')} placeholder="e.g. Stationery" /></div>
        <div className="inv-field"><label>Barcode</label><input className="inv-input" value={v.barcode} onChange={set('barcode')} placeholder="e.g. NB-100-003" /></div>
        <div className="inv-field"><label>Stock</label><input className="inv-input" type="number" value={v.stock} onChange={set('stock')} placeholder="0" /></div>
        <div className="inv-field"><label>Low-stock Alert</label><input className="inv-input" type="number" value={v.low} onChange={set('low')} placeholder="0" /></div>
        <div className="inv-field"><label>Cost Price (Rs)</label><input className="inv-input" type="number" value={v.cost} onChange={set('cost')} placeholder="0" /></div>
        <div className="inv-field"><label>Sell Price (Rs)</label><input className="inv-input" type="number" value={v.price} onChange={set('price')} placeholder="0" /></div>
      </div>
    </Shell>
  )
}

/* ════════ REPORTS ════════ */
const INV_REPORTS = [
  { key: 'inv_total', label: 'Total Inventory', icon: 'fa-boxes-stacked', group: 'Inventory', ctrl: 'none' },
  { key: 'inv_status', label: 'Active vs Inactive', icon: 'fa-toggle-on', group: 'Inventory', ctrl: 'none' },
  { key: 'inv_category', label: 'Category-wise', icon: 'fa-layer-group', group: 'Inventory', ctrl: 'none' },
  { key: 'inv_location', label: 'Location-wise', icon: 'fa-location-dot', group: 'Inventory', ctrl: 'none' },
  { key: 'pos_daily', label: 'Daily Sales', icon: 'fa-calendar-day', group: 'Sales', ctrl: 'date' },
  { key: 'pos_monthly', label: 'Monthly Sales', icon: 'fa-calendar-days', group: 'Sales', ctrl: 'month' },
  { key: 'pos_overall', label: 'Overall Sales', icon: 'fa-receipt', group: 'Sales', ctrl: 'range' },
  { key: 'pos_product', label: 'Product-wise Sales', icon: 'fa-box', group: 'Sales', ctrl: 'none' },
  { key: 'pos_lowstock', label: 'Low Stock', icon: 'fa-triangle-exclamation', group: 'Sales', ctrl: 'none' },
  { key: 'pos_pnl', label: 'Profit & Loss', icon: 'fa-scale-balanced', group: 'Finance', ctrl: 'range' },
  { key: 'pos_invvalue', label: 'Inventory Value', icon: 'fa-wallet', group: 'Finance', ctrl: 'none' },
  { key: 'pos_pvs', label: 'Purchase vs Sale', icon: 'fa-right-left', group: 'Finance', ctrl: 'none' },
]

function Reports({ inv, fire }) {
  const [type, setType] = useState('inv_total')
  const [ctrl, setCtrl] = useState({ date: todayISO(), month: '2026-05', from: '2026-05-01', to: '2026-05-31' })
  const set = (k) => (e) => setCtrl((s) => ({ ...s, [k]: e.target.value }))
  const meta = INV_REPORTS.find((r) => r.key === type)
  const report = useMemo(() => buildInvReport(inv, type, ctrl), [inv, type, ctrl])

  return (
    <>
      {['Inventory', 'Sales', 'Finance'].map((g) => (
        <div className="inv-rep-group" key={g}>
          <div className="inv-rep-group-lbl">{g} Reports</div>
          <div className="inv-rep-types">
            {INV_REPORTS.filter((r) => r.group === g).map((r) => (
              <button key={r.key} className={`inv-rep-type${type === r.key ? ' active' : ''}`} onClick={() => setType(r.key)}><i className={`fa-solid ${r.icon}`} /> {r.label}</button>
            ))}
          </div>
        </div>
      ))}

      <div className="inv-bar" style={{ marginTop: 6 }}>
        {meta.ctrl === 'date' && <div className="inv-field"><label>Date</label><input className="inv-input" type="date" value={ctrl.date} onChange={set('date')} /></div>}
        {meta.ctrl === 'month' && <div className="inv-field"><label>Month</label><input className="inv-input" type="month" value={ctrl.month} onChange={set('month')} /></div>}
        {meta.ctrl === 'range' && <>
          <div className="inv-field"><label>From</label><input className="inv-input" type="date" value={ctrl.from} onChange={set('from')} /></div>
          <div className="inv-field"><label>To</label><input className="inv-input" type="date" value={ctrl.to} onChange={set('to')} /></div>
        </>}
        <button className="inv-pdf-btn" onClick={() => printInvReport(report, fire)}><i className="fa-solid fa-file-pdf" /> Download A4 Report</button>
      </div>

      {report.kpis?.length > 0 && (
        <div className="inv-kpis">
          {report.kpis.map((k, i) => <div key={i} className={`inv-kpi ${k.cls || ''}`}><div className="inv-kpi-top"><i className={`fa-solid ${k.icon || 'fa-circle'}`} /> {k.label}</div><div className="inv-kpi-val" style={{ fontSize: 17 }}>{k.value}</div></div>)}
        </div>
      )}

      <div className="section-card">
        <div className="card-header"><div><div className="card-title"><i className={`fa-solid ${meta.icon}`} /> {report.title}</div>{report.period && <div className="card-sub">{report.period}</div>}</div></div>
        <div style={{ padding: '4px 16px 16px' }}>
          {report.sections.every((s) => s.rows.length === 0) ? <div className="inv-empty"><i className="fa-solid fa-chart-column" /><div style={{ fontSize: 13, fontWeight: 700 }}>No data for this report</div></div>
            : report.sections.map((sec, si) => (
              <div key={si}>
                {sec.title && <div className="inv-sect-title">{sec.title}</div>}
                <div className="tbl-wrap" style={{ marginBottom: 6 }}>
                  <table className="inv-table">
                    <thead><tr>{sec.columns.map((c, i) => <th key={i} className={c.a === 'r' ? 'r' : c.a === 'c' ? 'c' : ''}>{c.label}</th>)}</tr></thead>
                    <tbody>{sec.rows.map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci} className={sec.columns[ci].a === 'r' ? 'r' : sec.columns[ci].a === 'c' ? 'c' : ''}>{cell}</td>)}</tr>)}</tbody>
                    {sec.totals && sec.rows.length > 0 && <tfoot><tr>{sec.totals.map((cell, i) => <td key={i} className={sec.columns[i].a === 'r' ? 'r' : sec.columns[i].a === 'c' ? 'c' : ''}>{cell}</td>)}</tr></tfoot>}
                  </table>
                </div>
              </div>
            ))}
        </div>
      </div>
    </>
  )
}

/* ── Build a unified report (sections) for any type ── */
function buildInvReport(inv, type, ctrl) {
  const C = (label, a) => ({ label, a: a || 'l' })
  if (type === 'inv_total') {
    const list = inv.items.filter((i) => i.active)
    return { title: 'Total Inventory Report', period: 'Active items', filters: [['Records', String(list.length)], ['Total Units', num(list.reduce((a, i) => a + i.qty, 0))]],
      kpis: [{ label: 'Items', value: list.length, icon: 'fa-box', cls: 'info' }, { label: 'Total Units', value: num(list.reduce((a, i) => a + i.qty, 0)), icon: 'fa-boxes-stacked', cls: 'green' }],
      sections: [{ columns: [C('Inventory #'), C('Item'), C('Category'), C('Qty', 'c'), C('Location'), C('Status')], rows: list.map((i) => [i.code, i.name, i.cat, num(i.qty), i.loc || '—', i.status]), totals: ['', '', 'Total Units', num(list.reduce((a, i) => a + i.qty, 0)), `${list.length} records`, ''] }] }
  }
  if (type === 'inv_status') {
    const a = inv.items.filter((i) => i.active); const n = inv.items.filter((i) => !i.active)
    const sec = (t, arr) => ({ title: t, columns: [C('Inventory #'), C('Item'), C('Qty', 'c'), C('Status')], rows: arr.map((i) => [i.code, i.name, num(i.qty), i.status]), totals: null })
    return { title: 'Active vs Inactive Items Report', period: `${a.length} active · ${n.length} inactive`, filters: [['Active', String(a.length)], ['Inactive', String(n.length)], ['Total', String(inv.items.length)]],
      kpis: [{ label: 'Active', value: a.length, icon: 'fa-circle-check', cls: 'green' }, { label: 'Inactive', value: n.length, icon: 'fa-circle-pause', cls: 'amber' }, { label: 'Total Records', value: inv.items.length, icon: 'fa-box', cls: 'info' }],
      sections: [sec('Active Items', a), sec('Inactive Items', n)] }
  }
  if (type === 'inv_category' || type === 'inv_location') {
    const byLoc = type === 'inv_location'
    const groups = {}
    inv.items.filter((i) => i.active).forEach((i) => { const k = byLoc ? (i.loc || 'Unassigned') : i.cat; (groups[k] = groups[k] || []).push(i) })
    const cols = byLoc ? [C('Item'), C('Category'), C('Qty', 'c'), C('Location'), C('Status')] : [C('Inventory #'), C('Item'), C('Qty', 'c'), C('Location')]
    const sections = Object.keys(groups).sort().map((k) => {
      const g = groups[k]; const tot = g.reduce((a, i) => a + i.qty, 0)
      return { title: `${k} — ${num(tot)} units`, columns: cols, rows: g.map((i) => byLoc ? [i.name, i.cat, num(i.qty), i.loc || 'Unassigned', i.status] : [i.code, i.name, num(i.qty), i.loc || '—']), totals: null }
    })
    return { title: byLoc ? 'Location-wise Inventory Report' : 'Category-wise Inventory Report', period: `${sections.length} ${byLoc ? 'locations' : 'categories'}`, filters: [[byLoc ? 'Locations' : 'Categories', String(sections.length)]], kpis: [], sections: sections.length ? sections : [{ columns: cols, rows: [], totals: null }] }
  }
  if (type === 'pos_daily') {
    const list = inv.sales.filter((s) => s.date === ctrl.date); const tot = list.reduce((a, s) => a + s.total, 0)
    return { title: 'Daily Sales Report', period: fmtDate(ctrl.date), filters: [['Date', fmtDate(ctrl.date)], ['Receipts', String(list.length)], ['Total Sales', rs(tot)]],
      kpis: [{ label: 'Receipts', value: list.length, icon: 'fa-receipt', cls: 'info' }, { label: 'Total Sales', value: rs(tot), icon: 'fa-sack-dollar', cls: 'green' }],
      sections: [{ columns: [C('Receipt #'), C('Buyer'), C('Items'), C('Qty', 'c'), C('Amount', 'r')], rows: list.map((s) => [s.no, s.buyer, s.lines.map((l) => `${l.qty}× ${l.name}`).join(', '), s.lines.reduce((a, l) => a + l.qty, 0), num(s.total)]), totals: ['', '', '', 'TOTAL', num(tot)] }] }
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
      sections: [{ columns: [C('Receipt #'), C('Date'), C('Buyer'), C('Items'), C('Qty', 'c'), C('Amount', 'r')], rows: list.map((s) => [s.no, fmtDate(s.date), s.buyer, s.lines.map((l) => `${l.qty}× ${l.name}`).join(', '), s.lines.reduce((a, l) => a + l.qty, 0), num(s.total)]), totals: ['', '', '', 'TOTAL', qty, num(tot)] }] }
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
    return { title: 'Current Inventory Value Report', period: `As of ${fmtDate(todayISO())}`, filters: [['Products', String(list.length)], ['Stock Units', num(list.reduce((a, p) => a + p.stock, 0))]],
      kpis: [{ label: 'Purchase Value', value: rs(tPur), icon: 'fa-cart-shopping', cls: 'info' }, { label: 'Sale Value', value: rs(tSale), icon: 'fa-tags', cls: 'green' }, { label: 'Expected Gross Profit', value: rs(tSale - tPur), icon: 'fa-scale-balanced', cls: tSale - tPur >= 0 ? 'green' : 'red' }],
      sections: [{ columns: [C('Product'), C('Stock', 'c'), C('Cost/Unit', 'r'), C('Purchase Value', 'r'), C('Sale/Unit', 'r'), C('Sale Value', 'r')], rows, totals: ['', '', 'Total', num(tPur), '', num(tSale)] }] }
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

/* ════════ A4 BRANDED REPORT (head-office header + footer on each page) ════════ */
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

function printReceipt(sale, onToast) {
  const chain = loadChainProfile()
  const lines = sale.lines.map((l) => `<tr><td>${esc(l.name)}</td><td style="text-align:center">${l.qty}</td><td style="text-align:right">${num(l.price)}</td><td style="text-align:right">${num(l.qty * l.price)}</td></tr>`).join('')
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(sale.no)}</title><style>*{margin:0;box-sizing:border-box}body{font-family:Arial,sans-serif;color:#111;padding:14px}.rcp{max-width:300px;margin:0 auto}.h{text-align:center;border-bottom:2px dashed #999;padding-bottom:8px;margin-bottom:8px}.org{font-size:15px;font-weight:800}.sub{font-size:10px;color:#666}.meta{font-size:11px;margin-bottom:8px}table{width:100%;border-collapse:collapse;font-size:11px}th{text-align:left;border-bottom:1px solid #ccc;padding:4px 0}td{padding:3px 0}.tot{border-top:2px dashed #999;font-weight:800;font-size:13px}.foot{text-align:center;font-size:10px;color:#888;margin-top:10px;border-top:1px dashed #ccc;padding-top:6px}@media print{@page{margin:6mm}}</style></head><body><div class="rcp"><div class="h"><div class="org">${esc(chain.chainName)}</div><div class="sub">${esc(chain.address || '')}</div><div class="sub">School Shop Receipt</div></div><div class="meta"><div><b>Receipt:</b> ${esc(sale.no)}</div><div><b>Date:</b> ${fmtDate(sale.date)}</div><div><b>Buyer:</b> ${esc(sale.buyer)}</div><div><b>By:</b> ${esc(sale.by)}</div></div><table><thead><tr><th>Item</th><th style="text-align:center">Qty</th><th style="text-align:right">Price</th><th style="text-align:right">Amt</th></tr></thead><tbody>${lines}</tbody><tfoot><tr class="tot"><td colspan="3">TOTAL</td><td style="text-align:right">${rs(sale.total)}</td></tr></tfoot></table><div class="foot">Thank you! · ${esc(chain.chainName)}${chain.contact ? ' · ' + esc(chain.contact) : ''}</div></div><script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script></body></html>`
  const w = window.open('', '_blank'); if (!w) return onToast?.('Allow pop-ups to print the receipt', 'warn'); w.document.write(html); w.document.close()
}

function printInvReport(report, onToast) {
  const chain = loadChainProfile()
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }) + ' · ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  const logo = chain.logo ? `<img class="rep-logo-img" src="${chain.logo}" alt="">` : `<div class="rep-logo">${esc(chainInitials(chain.chainName))}</div>`
  const filters = (report.filters || []).map(([l, v]) => `<span><b>${esc(l)}:</b> ${esc(v)}</span>`).join('')
  const sectionsHtml = report.sections.map((sec) => {
    const thead = sec.columns.map((c) => `<th class="${c.a === 'r' ? 'r' : c.a === 'c' ? 'c' : ''}">${esc(c.label)}</th>`).join('')
    const tbody = sec.rows.length ? sec.rows.map((row) => `<tr>${row.map((cell, i) => `<td class="${sec.columns[i].a === 'r' ? 'r' : sec.columns[i].a === 'c' ? 'c' : ''}">${esc(cell)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${sec.columns.length}" style="text-align:center;color:#999;padding:14px">No records.</td></tr>`
    const tfoot = sec.totals && sec.rows.length ? `<tfoot><tr class="rep-tot">${sec.totals.map((cell, i) => `<td class="${sec.columns[i].a === 'r' ? 'r' : sec.columns[i].a === 'c' ? 'c' : ''}">${esc(cell)}</td>`).join('')}</tr></tfoot>` : ''
    return `${sec.title ? `<div class="rep-secttl">${esc(sec.title)}</div>` : ''}<table class="data"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody>${tfoot}</table>`
  }).join('')

  const header = `<div class="rep-head">${logo}<div class="rep-head-txt"><div class="rep-name">${esc(chain.chainName)}</div><div class="rep-org-line">${esc(chain.address || '')}</div><div class="rep-org-line">${esc(chain.contact || '')}${chain.email ? ' · ' + esc(chain.email) : ''}</div></div><div class="rep-meta"><div class="rep-title">${esc(report.title)}</div><div class="rep-period">${esc(report.period || '')}</div></div></div>${filters ? `<div class="rep-filters">${filters}</div>` : ''}`
  const footer = `<div class="rep-foot"><span>${esc(chain.chainName)}${chain.contact ? ' · ' + esc(chain.contact) : ''}</span><span>Computer-generated report · ${esc(report.title)} · ${esc(dateStr)}</span></div>`

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(chain.chainName)} — ${esc(report.title)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#e9eef6}
body{font-family:'Plus Jakarta Sans',Arial,sans-serif;color:#111;font-size:10.5px;line-height:1.4}
.a4{width:210mm;min-height:297mm;margin:14px auto;background:#fff;padding:13mm;box-shadow:0 6px 28px rgba(15,23,42,.18)}
.wrap{width:100%;border-collapse:collapse}.wrap > thead{display:table-header-group}.wrap > tfoot{display:table-footer-group}
.rep-head{display:flex;align-items:flex-start;gap:13px;border-bottom:2.5px solid #1E3A8A;padding-bottom:10px;margin-bottom:10px}
.rep-logo{width:48px;height:48px;border:2px solid #1E3A8A;border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:800;color:#1E3A8A;font-size:15px;flex-shrink:0}
.rep-logo-img{width:48px;height:48px;border-radius:12px;object-fit:cover;flex-shrink:0;border:1px solid #e2e8f0}
.rep-head-txt{flex:1}.rep-name{font-size:18px;font-weight:800;color:#1E3A8A;line-height:1.1}.rep-org-line{font-size:10.5px;color:#555;margin-top:2px}
.rep-meta{text-align:right}.rep-title{font-size:13px;font-weight:800;color:#1E3A8A}.rep-period{font-size:11px;color:#555;margin-top:2px}
.rep-filters{display:flex;flex-wrap:wrap;gap:5px 20px;font-size:10.5px;color:#333;margin-bottom:12px;background:#F1F5FB;padding:9px 13px;border-radius:6px}
.rep-secttl{font-size:12px;font-weight:800;color:#1E3A8A;margin:14px 0 6px;padding-bottom:4px;border-bottom:1px solid #cdd7ea}
.data{width:100%;border-collapse:collapse;font-size:10px;margin-bottom:4px}
.data th{background:#1E3A8A;color:#fff;padding:6px 8px;text-align:left;font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.4px}
.data th.r,.data td.r{text-align:right}.data th.c,.data td.c{text-align:center}
.data td{padding:5px 8px;border-bottom:1px solid #e5e9f2;vertical-align:top}
.data tbody tr:nth-child(even) td{background:#f8fafc}
.data .rep-tot td{background:#EAF0FA;font-weight:800;border-top:2px solid #1E3A8A}
.rep-foot{display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-top:14px;font-size:9px;color:#888;border-top:1px solid #e5e9f2;padding-top:8px}
@media print{html,body{background:#fff}.a4{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}@page{size:A4 portrait;margin:13mm}}
</style></head>
<body><div class="a4"><table class="wrap"><thead><tr><td>${header}</td></tr></thead><tfoot><tr><td>${footer}</td></tr></tfoot><tbody><tr><td>${sectionsHtml}</td></tr></tbody></table></div>
<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},300);};<\/script></body></html>`

  const w = window.open('', '_blank')
  if (!w) { onToast?.('Allow pop-ups to download / print the report', 'warn'); return }
  w.document.open(); w.document.write(html); w.document.close()
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
            <button className="btn-danger" onClick={onConfirm}><i className="fa-solid fa-trash-can" /> Delete</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
