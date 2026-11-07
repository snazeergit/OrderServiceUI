import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertCircle, ArrowDownToLine, Check, ChevronDown, CirclePlus, Clock3, LoaderCircle, Package, Pencil, Plus, RefreshCw, Search, Server, ShoppingBag, Trash2, X } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api/v1/orders').replace(/\/$/, '');
const AUTH_KEY = 'order-desk-basic-auth';
const fieldDefs = [
  { key: 'customerName', label: 'Customer name', placeholder: 'e.g. Jordan Lee', type: 'text' },
  { key: 'product', label: 'Product', placeholder: 'e.g. Wireless headphones', type: 'text' },
  { key: 'quantity', label: 'Quantity', placeholder: '1', type: 'number' },
];
const pickOrder = (data) => Array.isArray(data) ? data : (data?.content || data?.orders || []);
const displayId = (order) => order?.id ?? order?.orderId ?? '—';

async function request(path = '', options = {}) {
  const basicAuth = sessionStorage.getItem(AUTH_KEY);
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...(basicAuth ? { Authorization: `Basic ${basicAuth}` } : {}), ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
  });
  const text = await response.text();
  let data = text;
  try { data = text ? JSON.parse(text) : null; } catch { /* Plain text response */ }
  if (!response.ok) throw new Error(typeof data === 'string' ? data : data?.message || `Request failed (${response.status})`);
  return data;
}

function App() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [health, setHealth] = useState('checking');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState(null);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [authenticated, setAuthenticated] = useState(Boolean(sessionStorage.getItem(AUTH_KEY)));
  const [loginOpen, setLoginOpen] = useState(!sessionStorage.getItem(AUTH_KEY));
  const [loginBusy, setLoginBusy] = useState(false);

  const loadOrders = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    try {
      const data = await request('');
      setOrders(pickOrder(data));
      setHealth('online');
    } catch (error) {
      setHealth('offline');
      setNotice({ type: 'error', text: error.message || 'Could not connect to the API.' });
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  const checkHealth = useCallback(async () => {
    try { await request('/health'); setHealth('online'); }
    catch { setHealth('offline'); }
  }, []);

  useEffect(() => { if (authenticated) { loadOrders(); checkHealth(); } }, [authenticated, loadOrders, checkHealth]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return orders;
    return orders.filter((order) => [displayId(order), order.customerName, order.product, order.quantity]
      .some((value) => String(value ?? '').toLowerCase().includes(term)));
  }, [orders, query]);

  const openCreate = () => setModal({ mode: 'create', values: {} });
  const openEdit = (order) => setModal({ mode: 'edit', order, values: { ...order }, updateMethod: 'PATCH' });
  const closeModal = () => !busy && setModal(null);

  async function login(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = String(form.get('username') || '');
    const password = String(form.get('password') || '');
    const encoded = btoa(unescape(encodeURIComponent(`${username}:${password}`)));
    setLoginBusy(true);
    sessionStorage.setItem(AUTH_KEY, encoded);
    try {
      await request('/health');
      setAuthenticated(true);
      setLoginOpen(false);
      setHealth('online');
      setNotice({ type: 'success', text: 'Signed in to the Order service.' });
    } catch (error) {
      sessionStorage.removeItem(AUTH_KEY);
      setAuthenticated(false);
      setHealth('offline');
      setNotice({ type: 'error', text: error.message || 'Sign in failed. Check your credentials and API URL.' });
    } finally { setLoginBusy(false); }
  }

  function logout() {
    sessionStorage.removeItem(AUTH_KEY);
    setAuthenticated(false);
    setOrders([]);
    setLoginOpen(true);
  }

  async function saveOrder(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = {};
    for (const { key, type } of fieldDefs) {
      const value = String(form.get(key) ?? '').trim();
      if (value !== '') payload[key] = type === 'number' ? Number(value) : value;
    }
    if (modal.mode === 'create' && fieldDefs.some(({ key }) => payload[key] === undefined)) {
      setNotice({ type: 'error', text: 'Fill in all order fields before creating an order.' });
      return;
    }
    if (modal.mode === 'edit' && modal.updateMethod === 'PUT' && fieldDefs.some(({ key }) => payload[key] === undefined)) {
      setNotice({ type: 'error', text: 'PUT replaces the order. Fill in all order fields.' });
      return;
    }
    if (payload.quantity !== undefined && (!Number.isInteger(payload.quantity) || payload.quantity < 1)) {
      setNotice({ type: 'error', text: 'Quantity must be a whole number greater than zero.' });
      return;
    }
    setBusy(true);
    try {
      const isCreate = modal.mode === 'create';
      const path = isCreate ? '' : `/${encodeURIComponent(displayId(modal.order))}`;
      await request(path, { method: isCreate ? 'POST' : modal.updateMethod, body: JSON.stringify(payload) });
      setModal(null);
      setNotice({ type: 'success', text: isCreate ? 'Order created.' : `Order #${displayId(modal.order)} updated.` });
      await loadOrders(true);
    } catch (error) { setNotice({ type: 'error', text: error.message || 'Could not save this order.' }); }
    finally { setBusy(false); }
  }

  async function deleteOrder(order) {
    if (!window.confirm(`Delete order #${displayId(order)}? This action cannot be undone.`)) return;
    try {
      await request(`/${encodeURIComponent(displayId(order))}`, { method: 'DELETE' });
      setNotice({ type: 'success', text: `Order #${displayId(order)} deleted.` });
      await loadOrders(true);
    } catch (error) { setNotice({ type: 'error', text: error.message || 'Could not delete this order.' }); }
  }

  const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
  };

  return <main className="app-shell">
    <header className="topbar">
      <a className="brand" href="#" aria-label="Order Desk home"><span className="brand-mark"><ShoppingBag size={19} strokeWidth={2.3} /></span><span>order<span className="brand-light">desk</span></span></a>
      <div className="topbar-right"><span className={`api-status ${health}`}><i />{health === 'checking' ? 'Checking API' : health === 'online' ? 'API connected' : 'API unavailable'}</span><button className="icon-btn top-refresh" onClick={() => authenticated ? (loadOrders(true), checkHealth()) : setLoginOpen(true)} aria-label="Refresh orders" title="Refresh"><RefreshCw size={16} /></button>{authenticated ? <button className="auth-button" onClick={logout}>Sign out</button> : <button className="auth-button" onClick={() => setLoginOpen(true)}>Sign in</button>}<span className="avatar">OD</span></div>
    </header>
    <div className="layout">
      <aside className="sidebar"><div className="side-label">WORKSPACE</div><button className="nav-item active"><Package size={17} /><span>Orders</span><span className="nav-count">{orders.length}</span></button><div className="side-bottom"><div className="side-label">CONNECTION</div><div className="connection-card"><div className="connection-icon"><Server size={16} /></div><div className="connection-copy"><strong>Spring Boot API</strong><span className="truncate" title={API_BASE}>{API_BASE}</span></div><span className={`mini-dot ${health}`} /></div><div className="side-foot"><span className="green-dot" /> Local development</div></div></aside>
      <section className="content">
        <div className="page-heading"><div><div className="eyebrow">WORKSPACE <span>/</span> ORDERS</div><h1>Orders</h1><p className="subtitle">Manage and track your customer orders.</p></div><button className="primary-btn" onClick={openCreate}><Plus size={17} strokeWidth={2.5} /> New order</button></div>
        <div className="metrics"><div className="metric-card"><div className="metric-top"><span>Total orders</span><span className="metric-icon indigo"><Package size={16} /></span></div><div className="metric-value">{loading ? <span className="skeleton short" /> : orders.length}</div><div className="metric-note">All orders in your system</div></div><div className="metric-card"><div className="metric-top"><span>Units ordered</span><span className="metric-icon blue"><ArrowDownToLine size={16} /></span></div><div className="metric-value">{loading ? <span className="skeleton short" /> : orders.reduce((sum, order) => sum + (Number(order.quantity) || 0), 0)}</div><div className="metric-note">Across all orders</div></div><div className="metric-card"><div className="metric-top"><span>Service status</span><span className="metric-icon green"><Activity size={16} /></span></div><div className="metric-value metric-status">{health === 'checking' ? 'Checking' : health === 'online' ? 'Healthy' : 'Offline'}<span className={`status-dot ${health}`} /></div><div className="metric-note">Order service health</div></div></div>
        <section className="orders-panel"><div className="panel-heading"><div><h2>All orders <span className="count-pill">{orders.length}</span></h2><p>View and manage orders from your service.</p></div><div className="panel-actions"><label className="search-box"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search orders..." aria-label="Search orders" /><kbd>⌘ K</kbd></label><button className="icon-btn panel-refresh" onClick={() => loadOrders(true)} aria-label="Refresh list" title="Refresh"><RefreshCw size={16} className={refreshing ? 'spin' : ''} /></button></div></div>
          <div className="table-wrap"><table><thead><tr><th>ORDER</th><th>CUSTOMER</th><th>PRODUCT</th><th>QUANTITY</th><th>DATE</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>
            {loading ? <tr><td colSpan="6" className="loading-cell"><LoaderCircle className="spin" size={20} /> Loading orders</td></tr> : filtered.length === 0 ? <tr><td colSpan="6"><div className="empty-state"><div className="empty-icon">{query ? <Search size={20} /> : <Package size={20} />}</div><strong>{query ? 'No matching orders' : 'No orders yet'}</strong><span>{query ? 'Try a different search term.' : 'Create your first order to see it here.'}</span>{!query && <button className="secondary-btn" onClick={openCreate}><CirclePlus size={15} /> Create an order</button>}</div></td></tr> : filtered.map((order, index) => <tr key={displayId(order)}><td><span className="order-id">#{displayId(order)}</span></td><td><div className="customer-cell"><span className={`customer-avatar tone-${index % 5}`}>{String(order.customerName || '?').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span><span className="customer-name">{order.customerName || '—'}</span></div></td><td><span className="product-name">{order.product || '—'}</span></td><td><span className="quantity-badge">{order.quantity ?? '—'}</span></td><td><span className="date-cell"><Clock3 size={13} />{formatDate(order.createdAt || order.orderDate || order.date)}</span></td><td><div className="row-actions"><button className="icon-btn row-action" onClick={() => openEdit(order)} aria-label={`Edit order ${displayId(order)}`} title="Edit order"><Pencil size={15} /></button><button className="icon-btn row-action delete-action" onClick={() => deleteOrder(order)} aria-label={`Delete order ${displayId(order)}`} title="Delete order"><Trash2 size={15} /></button></div></td></tr>)}
          </tbody></table></div><div className="table-footer"><span>Showing <strong>{loading ? 0 : filtered.length}</strong> of <strong>{orders.length}</strong> orders</span><span className="footer-live"><span className="green-dot" /> Synced with API</span></div></section>
        <footer className="page-footer"><span>Order Desk <span>·</span> Spring Boot client</span><span><span className="green-dot" /> All systems operational</span></footer>
      </section>
    </div>
    {notice && <div className={`toast ${notice.type}`} role="status">{notice.type === 'success' ? <Check size={17} /> : <AlertCircle size={17} />}<span>{notice.text}</span><button onClick={() => setNotice(null)} aria-label="Dismiss notification"><X size={15} /></button></div>}
    {loginOpen && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="login-title"><div className="modal-header"><div><div className="modal-kicker">SPRING BOOT API</div><h2 id="login-title">Sign in to Order Desk</h2><p>Use your Spring Security HTTP Basic credentials.</p></div></div><form onSubmit={login}><div className="form-fields"><label className="form-field"><span>Username</span><input name="username" autoComplete="username" required autoFocus /></label><label className="form-field"><span>Password</span><input name="password" type="password" autoComplete="current-password" required /></label></div><div className="modal-note"><span className="note-dot" />Credentials are kept in this browser tab’s session only.</div><div className="modal-footer"><button type="submit" className="primary-btn" disabled={loginBusy}>{loginBusy && <LoaderCircle size={16} className="spin" />}{loginBusy ? 'Signing in…' : 'Sign in'}</button></div></form></section></div>}
    {modal && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closeModal()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-header"><div><div className="modal-kicker">{modal.mode === 'create' ? 'NEW RECORD' : `ORDER #${displayId(modal.order)}`}</div><h2 id="modal-title">{modal.mode === 'create' ? 'Create an order' : 'Edit order'}</h2><p>{modal.mode === 'create' ? 'Add order details to your service.' : modal.updateMethod === 'PUT' ? 'Replace the full order representation.' : 'Update only the fields you provide.'}</p></div><button className="icon-btn" onClick={closeModal} aria-label="Close dialog"><X size={18} /></button></div><form onSubmit={saveOrder}>{modal.mode === 'edit' && <div className="method-switch" aria-label="Update method"><button type="button" className={modal.updateMethod === 'PATCH' ? 'selected' : ''} onClick={() => setModal({ ...modal, updateMethod: 'PATCH' })}>PATCH <span>Partial update</span></button><button type="button" className={modal.updateMethod === 'PUT' ? 'selected' : ''} onClick={() => setModal({ ...modal, updateMethod: 'PUT' })}>PUT <span>Replace all</span></button></div>}<div className="form-fields">{fieldDefs.map(({ key, label, placeholder, type }) => <label className="form-field" key={key}><span>{label}{(modal.mode === 'create' || modal.updateMethod === 'PUT') && <em>*</em>}</span><input name={key} type={type} min={type === 'number' ? 1 : undefined} step={type === 'number' ? 1 : undefined} defaultValue={modal.values[key] ?? ''} placeholder={placeholder} autoComplete="off" /></label>)}</div><div className="modal-note"><span className="note-dot" />{modal.mode === 'create' ? 'Order will be created in your Spring Boot service.' : modal.updateMethod === 'PUT' ? 'All fields are required and will replace the saved values.' : 'Only fields you fill in will be updated.'}</div><div className="modal-footer"><button type="button" className="secondary-btn" onClick={closeModal} disabled={busy}>Cancel</button><button type="submit" className="primary-btn" disabled={busy}>{busy && <LoaderCircle size={16} className="spin" />}{modal.mode === 'create' ? 'Create order' : 'Save changes'}</button></div></form></section></div>}
  </main>;
}

export default App;
