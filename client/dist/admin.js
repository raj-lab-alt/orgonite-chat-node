window.onerror = function(msg, url, line, col, err) {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#300;color:#f99;padding:8px;font-size:12px;z-index:99999;white-space:pre-wrap';
  d.textContent = 'JS Error: ' + msg + ' (' + line + ':' + col + ')';
  document.body.appendChild(d);
};

const loginContainer = document.getElementById('loginContainer');
const mainBody = document.getElementById('mainBody');
const pageTitle = document.getElementById('pageTitle');
const orderCount = document.getElementById('orderCount');
const loginPassword = document.getElementById('loginPassword');
const loginError = document.getElementById('loginError');

let orders = [];
let currentView = 'orders';
let selectedOrderIds = new Set();
let showTrash = false;
let searchQuery = '';
let filterStatus = 'all';
let currentPage = 1;
const PAGE_SIZE = 20;
let _viewCounter = 0;

function getStatusList() {
  const list = configCache?.statuses || ['attente de confirm tel', 'injoignable', 'annulé', 'non qualifié', 'à expedier', 'livré', 'echouer'];
  return list.filter(s => s !== 'corbeille');
}

function getToken() { return sessionStorage.getItem('admin_token') || localStorage.getItem('admin_token'); }

function setToken(t) {
  sessionStorage.setItem('admin_token', t);
  localStorage.setItem('admin_token', t);
}

function clearToken() {
  sessionStorage.removeItem('admin_token');
  localStorage.removeItem('admin_token');
}

function authHeaders() {
  const t = getToken();
  return t ? { 'Authorization': 'Bearer ' + t, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
}

async function handleLogin() {
  const pwd = loginPassword.value.trim();
  loginError.textContent = '';
  if (!pwd) { loginError.textContent = 'Entrez un mot de passe.'; return; }
  if (loginBtn) { loginBtn.disabled = true; loginBtn.textContent = 'Connexion...'; }
  try {
    const r = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd })
    });
    const data = await r.json();
    if (data.token) {
      setToken(data.token);
      loginContainer.style.display = 'none';
      refreshOrders();
    } else {
      loginError.textContent = data.error || 'Mot de passe incorrect';
    }
  } catch (e) {
    loginError.textContent = 'Erreur: ' + e.message;
  } finally {
    if (loginBtn) { loginBtn.disabled = false; loginBtn.textContent = 'Se connecter'; }
  }
}

function handleLogout() {
  clearToken();
  loginContainer.style.display = 'flex';
  loginPassword.value = '';
  loginError.textContent = '';
  orders = [];
  selectedOrderIds.clear();
  searchQuery = '';
  filterStatus = 'all';
  currentPage = 1;
  showTrash = false;
  currentView = 'orders';
  pageTitle.textContent = 'Commandes';
}

const loginBtn = document.getElementById('loginBtn');
if (loginBtn) loginBtn.addEventListener('click', handleLogin);
loginPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
const refreshBtn = document.getElementById('refreshBtn');
if (refreshBtn) refreshBtn.addEventListener('click', refreshOrders);

// ── Navigation ──

document.querySelectorAll('[data-view]').forEach(a => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelectorAll('[data-view]').forEach(x => x.classList.remove('active'));
    a.classList.add('active');
    currentView = a.dataset.view;
    if (currentView === 'orders') { pageTitle.textContent = 'Commandes'; refreshOrders(); }
    else if (currentView === 'products') { pageTitle.textContent = 'Produits'; renderProductsView(); }
    else if (currentView === 'services') { pageTitle.textContent = 'Services'; renderServicesView(); }
    else if (currentView === 'config') { pageTitle.textContent = 'Configuration'; renderConfig(); }
    else if (currentView === 'stats') { pageTitle.textContent = 'Statistiques'; renderStats(); }
  });
});

// ── Auth check on load ──
(function init() {
  const token = getToken();
  if (token) {
    fetch('/api/admin/check', { headers: { 'Authorization': 'Bearer ' + token } })
      .then(r => r.json())
      .then(data => {
        if (data.valid) {
          loginContainer.style.display = 'none';
          return apiFetch('/api/admin/config').then(c => { configCache = c; }).then(() => refreshOrders()).catch(() => { refreshOrders(); });
        } else { loginContainer.style.display = 'flex'; }
      })
      .catch(() => { loginContainer.style.display = 'flex'; });
  } else {
    loginContainer.style.display = 'flex';
  }
})();

// ── Helpers ──

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatPrix(p) {
  return (p || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' DT';
}

function orderTotal(o) {
  return o.totalCommande ?? o.prixProduit ?? 0;
}

function firstOrderValue(order, keys) {
  for (const key of keys) {
    if (order[key] !== undefined && order[key] !== null && String(order[key]).trim() !== '') return order[key];
  }
  return '';
}

function personalizedManufacturingHtml(order) {
  const rows = [
    ['Format', ['formatPersonnalise', 'format']],
    ['Date naissance', ['dateNaissance', 'date_naissance', 'birthDate']],
    ['Horoscope / signe', ['signeAstrologique', 'horoscope', 'signe', 'signeAstro']],
    ['Chemin de vie', ['cheminVie', 'chemin_de_vie', 'lifePath']],
    ["Nombre d'ame", ['nombreAme', 'nombre_ame', 'soulUrge']],
    ['Nombre personnalite', ['nombrePersonnalite', 'nombre_personnalite', 'personalityNumber']],
    ['Composition', ['compositionPersonnalisee', 'composition_personnalisee', 'composition']],
    ['Brief atelier', ['briefFabrication', 'brief_fabrication']]
  ].map(([label, keys]) => {
    const value = firstOrderValue(order, keys);
    if (!value) return '';
    return `<div class="detail-row"><span class="detail-label">${label}</span><span class="detail-value">${escHtml(value)}</span></div>`;
  }).filter(Boolean).join('');

  if (!rows) return '';
  return `
    <div class="detail-row" style="margin-top:16px"><span class="detail-label">Fabrication</span></div>
    <div class="detail-panel" style="max-width:none;margin:8px 0 16px;border-color:#3b2f55">
      <div class="body">${rows}</div>
    </div>`;
}

function badgeHtml(statut) {
  const s = statut || getStatusList()[0];
  const cls = normalizeStatusClass(s);
  return `<span class="badge badge-${cls}">${escHtml(s)}</span>`;
}

function escHtml(s) {
  if (!s) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeStatusClass(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

function sanitizeAdminHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html || '');
  const allowedTags = new Set(['BR', 'STRONG', 'B', 'EM', 'I', 'U', 'P', 'DIV', 'SPAN', 'IFRAME', 'A']);
  const allowedAttrs = new Set(['href', 'src', 'target', 'rel', 'allow', 'allowfullscreen', 'frameborder', 'scrolling', 'style']);
  template.content.querySelectorAll('*').forEach(node => {
    if (!allowedTags.has(node.tagName)) {
      node.replaceWith(document.createTextNode(node.textContent || ''));
      return;
    }
    [...node.attributes].forEach(attr => {
      if (attr.name.toLowerCase().startsWith('on') || !allowedAttrs.has(attr.name)) {
        node.removeAttribute(attr.name);
      }
    });
    if (node.tagName === 'IFRAME') {
      const src = node.getAttribute('src') || '';
      if (!src.startsWith('https://www.facebook.com/plugins/video.php')) {
        node.setAttribute('src', '');
      }
    }
  });
  return template.innerHTML;
}

async function apiFetch(url, opts) {
  const r = await fetch(url, { ...opts, headers: { ...authHeaders(), ...(opts?.headers || {}) } });
  if (r.status === 401) { handleLogout(); throw new Error('Session expirée'); }
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Erreur');
  return data;
}

// ── Orders ──

async function refreshOrders() {
  const viewId = ++_viewCounter;
  if (currentView === 'orders') {
    try {
      const query = showTrash ? '?includeTrash=1' : '';
      orders = await apiFetch('/api/orders' + query);
      if (viewId !== _viewCounter) return;
      currentPage = 1;
      const visibleOrders = showTrash ? orders : orders.filter(o => o.statut !== 'corbeille');
      selectedOrderIds = new Set([...selectedOrderIds].filter(id => visibleOrders.some(o => o.id === id)));
      orderCount.textContent = visibleOrders.filter(o => o.statut !== 'corbeille').length;
      renderList();
    } catch (e) {
      if (e.message !== 'Session expirée') {
        mainBody.innerHTML = `<div class="empty-state"><i class="fa-solid fa-exclamation-triangle"></i><p>Erreur de chargement</p></div>`;
      }
    }
  } else if (currentView === 'products') {
    renderProductsView();
  } else if (currentView === 'services') {
    renderServicesView();
  } else if (currentView === 'stats') {
    renderStats();
  } else if (currentView === 'config') {
    renderConfig();
  }
}

function getFilteredOrders() {
  let list = showTrash ? orders.filter(o => o.statut === 'corbeille') : orders.filter(o => o.statut !== 'corbeille');
  if (filterStatus !== 'all') {
    list = list.filter(o => o.statut === filterStatus);
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(o =>
      (o.id && String(o.id).toLowerCase().includes(q)) ||
      (o.nom && o.nom.toLowerCase().includes(q)) ||
      (o.telephone && o.telephone.toLowerCase().includes(q)) ||
      (o.telephone2 && o.telephone2.toLowerCase().includes(q)) ||
      (o.produit && o.produit.toLowerCase().includes(q)) ||
      (o.gouvernorat && o.gouvernorat.toLowerCase().includes(q)) ||
      (o.adresse && o.adresse.toLowerCase().includes(q)) ||
      (o.notes && o.notes.toLowerCase().includes(q)) ||
      (o.trackingNumber && o.trackingNumber.toLowerCase().includes(q))
    );
  }
  return list;
}

function statusCounts() {
  const counts = { all: 0 };
  const src = showTrash ? orders.filter(o => o.statut === 'corbeille') : orders.filter(o => o.statut !== 'corbeille');
  const filtered = searchQuery ? getFilteredOrders() : src;
  getStatusList().forEach(s => counts[s] = 0);
  filtered.forEach(o => {
    counts.all++;
    if (counts[o.statut] !== undefined) counts[o.statut]++;
  });
  return counts;
}

function statusTabsHtml() {
  const counts = statusCounts();
  const tabLabels = { 'all': 'Toutes' };
  getStatusList().forEach(s => tabLabels[s] = s.charAt(0).toUpperCase() + s.slice(1));
  return `<div class="status-tabs">` +
    Object.entries(tabLabels).map(([key, label]) => {
      const isActive = (key === 'all' && filterStatus === 'all') || filterStatus === key;
      return `<button class="status-tab${isActive ? ' active' : ''}" data-status="${escHtml(key)}" onclick="setFilterStatusFromTab(this.dataset.status)">${escHtml(label)} <span class="tab-count">${counts[key] || 0}</span></button>`;
    }).join('') +
    `</div>`;
}

function setFilterStatusFromTab(status) {
  filterStatus = status || 'all';
  currentPage = 1;
  renderList();
}

function renderList() {
  pageTitle.textContent = 'Commandes';
  const visibleOrders = getFilteredOrders();
  const totalPages = Math.max(1, Math.ceil(visibleOrders.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageOrders = visibleOrders.slice(start, start + PAGE_SIZE);

  if (visibleOrders.length === 0) {
    mainBody.innerHTML = `
      ${!showTrash ? statusTabsHtml() : ''}
      <div class="orders-toolbar">
        <div class="left">
          <button class="btn-status${showTrash ? ' active' : ''}" onclick="toggleTrashView()"><i class="fa-solid fa-trash"></i> ${showTrash ? 'Masquer corbeille' : 'Afficher corbeille'}</button>
        </div>
        <div class="right">
          <input class="search-input" placeholder="Rechercher ID, nom, téléphone..." value="${escHtml(searchQuery)}" oninput="searchQuery=this.value; currentPage=1; renderList()">
        </div>
      </div>
      <div class="empty-state">
        <i class="fa-solid fa-inbox"></i>
        <p class="text-lg font-medium mb-1">${searchQuery ? 'Aucune commande trouvée' : 'Aucune commande pour le moment'}</p>
        <p class="text-sm text-gray-600">${searchQuery ? 'Essayez un autre terme de recherche.' : 'Les commandes validées par Amine apparaîtront ici automatiquement.'}</p>
      </div>`;
    return;
  }

  const selectableOrders = showTrash ? visibleOrders.filter(o => o.statut === 'corbeille') : visibleOrders.filter(o => o.statut !== 'corbeille');
  const allSelected = selectableOrders.length > 0 && selectableOrders.every(o => selectedOrderIds.has(String(o.id)));
  const rows = pageOrders.map(o => {
    const isTrash = o.statut === 'corbeille';
    const checked = selectedOrderIds.has(String(o.id)) ? 'checked' : '';
    const canSelect = showTrash ? isTrash : !isTrash;
    const checkbox = canSelect
      ? `<input type="checkbox" ${checked} onclick="event.stopPropagation(); toggleOrderSelection('${escHtml(String(o.id))}', this.checked)">`
      : '';
    return `
    <tr onclick="showDetail('${escHtml(String(o.id))}')">
      <td class="select-cell">${checkbox}</td>
      <td><span class="order-id">${escHtml(String(o.id))}</span></td>
      <td><span class="order-date">${formatDate(o.date)}</span></td>
      <td><span class="order-client">${escHtml(o.nom)}</span></td>
      <td><span class="order-produit">${escHtml(o.produit)}</span></td>
      <td><span class="order-montant">${formatPrix(orderTotal(o))}</span></td>
      <td><span class="order-suivi">${o.trackingNumber ? escHtml(o.trackingNumber) : '<span style="color:#555">—</span>'}</span></td>
      <td>${badgeHtml(o.statut)}</td>
    </tr>
  `;
  }).join('');

  function paginationHtml() {
    const tp = totalPages, cp = currentPage, visLen = visibleOrders.length;
    if (tp <= 1) return '';
    let h = '<div class="pagination">';
    h += `<button class="page-btn" onclick="currentPage=1; renderList()" ${cp === 1 ? 'disabled' : ''}><i class="fa-solid fa-angles-left"></i></button>`;
    h += `<button class="page-btn" onclick="currentPage=Math.max(1,currentPage-1); renderList()" ${cp === 1 ? 'disabled' : ''}><i class="fa-solid fa-angle-left"></i></button>`;
    let ps = Math.max(1, cp - 2);
    let pe = Math.min(tp, cp + 2);
    if (ps > 1) h += `<span class="page-dots">...</span>`;
    for (let i = ps; i <= pe; i++) {
      h += `<button class="page-btn${i === cp ? ' active' : ''}" onclick="currentPage=${i}; renderList()">${i}</button>`;
    }
    if (pe < tp) h += `<span class="page-dots">...</span>`;
    h += `<button class="page-btn" onclick="currentPage=Math.min(${tp},currentPage+1); renderList()" ${cp === tp ? 'disabled' : ''}><i class="fa-solid fa-angle-right"></i></button>`;
    h += `<button class="page-btn" onclick="currentPage=${tp}; renderList()" ${cp === tp ? 'disabled' : ''}><i class="fa-solid fa-angles-right"></i></button>`;
    h += `<span class="page-info">${visLen} commande(s)</span>`;
    h += '</div>';
    return h;
  }

  mainBody.innerHTML = `
    ${!showTrash ? statusTabsHtml() : ''}
    <div class="orders-toolbar">
      <div class="left">
        ${showTrash ? `
          <button class="btn-status" onclick="bulkRestoreOrders()" ${selectedOrderIds.size === 0 ? 'disabled' : ''}>
            <i class="fa-solid fa-rotate-left"></i> Restaurer
          </button>
          <button class="btn-danger" onclick="bulkDeleteOrders()" ${selectedOrderIds.size === 0 ? 'disabled' : ''}>
            <i class="fa-solid fa-trash-can"></i> Supprimer définitivement
          </button>
        ` : `
          <button class="btn-danger" onclick="bulkTrashOrders()" ${selectedOrderIds.size === 0 ? 'disabled' : ''}>
            <i class="fa-solid fa-trash"></i> Mettre dans la corbeille
          </button>
        `}
        <span class="selection-count">${selectedOrderIds.size} sélectionnée(s)</span>
      </div>
      <div class="right">
        <input class="search-input" placeholder="Rechercher ID, nom, téléphone..." value="${escHtml(searchQuery)}" oninput="searchQuery=this.value; currentPage=1; renderList()">
        <button class="btn-status${showTrash ? ' active' : ''}" onclick="toggleTrashView()">
          <i class="fa-solid fa-trash"></i> ${showTrash ? 'Masquer corbeille' : 'Afficher corbeille'}
        </button>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="select-cell"><input type="checkbox" ${allSelected ? 'checked' : ''} onclick="event.stopPropagation(); toggleAllOrders(this.checked)"></th>
            <th>ID</th>
            <th>Date</th>
            <th>Client</th>
            <th>Produit</th>
            <th>Total</th>
            <th>Suivi</th>
            <th>Statut</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${paginationHtml()}`;
}

function toggleOrderSelection(id, checked) {
  const sid = String(id);
  if (checked) selectedOrderIds.add(sid);
  else selectedOrderIds.delete(sid);
  renderList();
}

function toggleAllOrders(checked) {
  const visibleOrders = getFilteredOrders();
  visibleOrders.forEach(o => {
    const sid = String(o.id);
    if (checked) selectedOrderIds.add(sid);
    else selectedOrderIds.delete(sid);
  });
  renderList();
}

function toggleTrashView() {
  showTrash = !showTrash;
  filterStatus = 'all';
  selectedOrderIds.clear();
  refreshOrders();
}

async function bulkTrashOrders() {
  const ids = [...selectedOrderIds];
  if (ids.length === 0) return;
  if (!confirm(`Mettre ${ids.length} commande(s) dans la corbeille ?`)) return;
  try {
    await apiFetch('/api/orders/bulk-trash', { method: 'PUT', body: JSON.stringify({ ids }) });
    selectedOrderIds.clear();
    await refreshOrders();
  } catch (e) {
    if (e.message !== 'Session expirée') alert('Erreur: ' + e.message);
  }
}

async function bulkRestoreOrders() {
  const ids = [...selectedOrderIds];
  if (ids.length === 0) return;
  try {
    await apiFetch('/api/orders/bulk-restore', { method: 'PUT', body: JSON.stringify({ ids }) });
    selectedOrderIds.clear();
    await refreshOrders();
  } catch (e) {
    if (e.message !== 'Session expirée') alert('Erreur: ' + e.message);
  }
}

async function bulkDeleteOrders() {
  const ids = [...selectedOrderIds];
  if (ids.length === 0) return;
  if (!confirm(`Supprimer définitivement ${ids.length} commande(s) ? Cette action est irréversible.`)) return;
  try {
    await apiFetch('/api/orders/bulk-delete', { method: 'DELETE', body: JSON.stringify({ ids }) });
    selectedOrderIds.clear();
    await refreshOrders();
  } catch (e) {
    if (e.message !== 'Session expirée') alert('Erreur: ' + e.message);
  }
}

async function showDetail(id) {
  const viewId = ++_viewCounter;
  let order;
  try {
    order = await apiFetch('/api/orders/' + id);
  } catch (e) {
    if (e.message !== 'Session expirée') alert('Erreur: ' + e.message);
    return;
  }
  if (viewId !== _viewCounter) return;
  pageTitle.textContent = 'Commande ' + order.id;
  const statusBtns = getStatusList().map(s =>
    `<button class="btn-status${order.statut === s ? ' active' : ''}" data-order-id="${escHtml(order.id)}" data-status="${escHtml(s)}" onclick="updateStatus(this.dataset.orderId, this.dataset.status)">${escHtml(s)}</button>`
  ).join('');
  const notes = order.notes || '';
  const tracking = order.trackingNumber || '';
  const tel2 = order.telephone2 || '';
  mainBody.innerHTML = `
    <button class="back-btn" onclick="refreshOrders()"><i class="fa-solid fa-arrow-left"></i> Retour</button>
    <div class="detail-panel">
      <div class="head">
        <h3><span class="order-id">${escHtml(order.id)}</span></h3>
        ${badgeHtml(order.statut)}
      </div>
      <div class="body">
        <div class="detail-row"><span class="detail-label">Date</span><span class="detail-value">${formatDate(order.date)}</span></div>
        <div class="detail-row"><span class="detail-label">Nom</span><input class="edit-field edit-field-sm" id="orderNom" value="${escHtml(order.nom)}"></div>
        <div class="detail-row"><span class="detail-label">Téléphone</span><input class="edit-field edit-field-sm" id="orderTel" value="${escHtml(order.telephone)}"></div>
        <div class="detail-row"><span class="detail-label">Tél. 2</span><input class="edit-field edit-field-sm" id="orderTel2" value="${escHtml(tel2)}"></div>
        <div class="detail-row"><span class="detail-label">Gouvernorat</span><input class="edit-field edit-field-sm" id="orderGouv" value="${escHtml(order.gouvernorat)}"></div>
        <div class="detail-row"><span class="detail-label">Adresse</span><input class="edit-field edit-field-sm" id="orderAdresse" value="${escHtml(order.adresse)}"></div>
        <div class="detail-row"><span class="detail-label">Produit</span><input class="edit-field edit-field-sm" id="orderProduit" value="${escHtml(order.produit)}"></div>
        <div class="detail-row"><span class="detail-label">Sous-total</span><input type="number" step="0.01" class="edit-field edit-field-sm" id="orderPrixProduit" value="${Number(order.prixProduit ?? 0).toFixed(2)}"></div>
        <div class="detail-row"><span class="detail-label">Livraison</span><input type="number" step="0.01" class="edit-field edit-field-sm" id="orderFraisLivraison" value="${Number(order.fraisLivraison || 0).toFixed(2)}"></div>
        <div class="detail-row"><span class="detail-label">Total</span><input type="number" step="0.01" class="edit-field edit-field-sm" id="orderTotalCommande" value="${Number(orderTotal(order)).toFixed(2)}"></div>
        ${personalizedManufacturingHtml(order)}
        <div class="status-actions">${statusBtns}</div>
        <div class="detail-row" style="margin-top:16px"><span class="detail-label">Notes</span></div>
        <textarea class="edit-field" id="orderNotes" rows="2" placeholder="Notes internes...">${escHtml(notes)}</textarea>
        <div class="detail-row" style="margin-top:12px"><span class="detail-label">N° Suivi</span></div>
        <input class="edit-field edit-field-sm" id="orderTracking" value="${escHtml(tracking)}" placeholder="Numéro de suivi">
        <button class="save-btn" onclick="saveOrder('${order.id}')"><i class="fa-solid fa-floppy-disk"></i> Enregistrer</button>
        <div id="saveSuccess" class="save-success" style="display:none">✓ Enregistré</div>
      </div>
    </div>`;
}

async function saveOrder(id) {
  const data = {};
  const fields = [
    ['orderNom', 'nom'],
    ['orderTel', 'telephone'],
    ['orderTel2', 'telephone2'],
    ['orderGouv', 'gouvernorat'],
    ['orderAdresse', 'adresse'],
    ['orderProduit', 'produit'],
    ['orderNotes', 'notes'],
    ['orderTracking', 'trackingNumber'],
    ['orderPrixProduit', 'prixProduit'],
    ['orderFraisLivraison', 'fraisLivraison'],
    ['orderTotalCommande', 'totalCommande']
  ];
  for (const [elId, key] of fields) {
    const el = document.getElementById(elId);
    if (el) {
      if (el.type === 'number') {
        data[key] = el.value === '' ? null : (parseFloat(el.value) || 0);
      } else {
        data[key] = el.value;
      }
    }
  }
  if (!data.nom || !data.telephone) {
    alert('Le nom et le téléphone sont obligatoires.');
    return;
  }
  try {
    const updated = await apiFetch('/api/orders/' + id, { method: 'PUT', body: JSON.stringify(data) });
    const el = document.getElementById('saveSuccess');
    if (el) { el.style.display = 'block'; setTimeout(() => { el.style.display = 'none'; }, 2000); }
    const query = showTrash ? '?includeTrash=1' : '';
    orders = await apiFetch('/api/orders' + query);
    const fieldToDom = { nom:'orderNom', telephone:'orderTel', telephone2:'orderTel2', gouvernorat:'orderGouv', adresse:'orderAdresse', produit:'orderProduit', notes:'orderNotes', trackingNumber:'orderTracking', prixProduit:'orderPrixProduit', fraisLivraison:'orderFraisLivraison', totalCommande:'orderTotalCommande' };
    Object.entries(updated || {}).forEach(([k, v]) => {
      const domId = fieldToDom[k];
      if (!domId) return;
      const inp = document.getElementById(domId);
      if (inp && v !== undefined) inp.value = v;
    });
  } catch (e) {
    if (e.message !== 'Session expirée') alert('Erreur: ' + e.message);
  }
}

async function updateStatus(id, statut) {
  try {
    await apiFetch('/api/orders/' + id + '/statut', { method: 'PUT', body: JSON.stringify({ statut }) });
    const query = showTrash ? '?includeTrash=1' : '';
    orders = await apiFetch('/api/orders' + query);
    await showDetail(id);
  } catch (e) {
    if (e.message !== 'Session expirée') alert('Erreur: ' + e.message);
  }
}

// ── Configuration ────────────────────────────────────────────

let configCache = null;

async function renderConfig() {
  pageTitle.textContent = 'Configuration';
  try {
    configCache = await apiFetch('/api/admin/config');

    mainBody.innerHTML = `
      <style>
        .config-section { background:#1a1a20; border:1px solid #2a2a32; border-radius:12px; margin-bottom:20px; }
        .config-section .head { padding:16px 20px; border-bottom:1px solid #2a2a32; font-weight:600; font-size:15px; display:flex; align-items:center; gap:8px; }
        .config-section .body { padding:16px 20px; }
        .config-label { display:block; color:#888; font-size:12px; margin-bottom:4px; margin-top:12px; }
        .config-label:first-child { margin-top:0; }
        .config-input, .config-textarea { width:100%; background:#26262e; border:1px solid #333; border-radius:8px; padding:8px 12px; color:#e0e0e0; font-size:13px; outline:none; font-family:inherit; }
        .config-input:focus, .config-textarea:focus { border-color:#7c3aed; }
        .config-textarea { min-height:200px; resize:vertical; font-family:monospace; font-size:13px; }
        .config-textarea-lg { min-height:400px; }
        .product-card { background:#16161c; border:1px solid #2a2a32; border-radius:10px; padding:14px; margin-bottom:12px; }
        .product-card .row { display:flex; gap:8px; margin-bottom:6px; align-items:center; }
        .product-card .row label { color:#888; font-size:11px; width:70px; flex-shrink:0; }
        .product-card .row input { flex:1; background:#26262e; border:1px solid #333; border-radius:6px; padding:6px 10px; color:#e0e0e0; font-size:13px; outline:none; }
        .product-card .row input:focus { border-color:#7c3aed; }
        .product-card .row textarea { flex:1; background:#26262e; border:1px solid #333; border-radius:6px; padding:6px 10px; color:#e0e0e0; font-size:13px; outline:none; resize:vertical; font-family:inherit; min-height:50px; }
        .product-card .row textarea:focus { border-color:#7c3aed; }
        .product-card .remove-btn { background:#3a1f1f; color:#f87171; border:1px solid #5f2a2a; border-radius:6px; padding:4px 10px; font-size:12px; cursor:pointer; }
        .product-card .remove-btn:hover { background:#5f2a2a; }
        .add-product-btn { padding:8px 16px; border-radius:8px; border:1px dashed #555; background:transparent; color:#aaa; font-size:13px; cursor:pointer; width:100%; margin-top:8px; }
        .add-product-btn:hover { border-color:#7c3aed; color:#a78bfa; }
      </style>

      <!-- System Prompt -->
      <div class="config-section">
        <div class="head"><i class="fa-solid fa-message"></i> Instructions IA (System Prompt)</div>
        <div class="body">
          <div class="config-label">Utilise <code>{{CATALOG}}</code> comme placeholder pour le catalogue des produits (généré automatiquement)</div>
          <textarea class="config-textarea config-textarea-lg" id="configSystemPrompt">${escHtml(configCache.systemPrompt)}</textarea>
          <div class="config-label">Template d'une ligne catalogue <small>(variables: {n} {name} {id} {benefits} {composition} {price} {currency} {taille}...{/taille})</small></div>
          <input class="config-input" id="configCatalogTemplate" value="${escHtml(configCache.catalogItemTemplate)}">
          <div class="config-label">Aperçu du catalogue généré :</div>
          <pre style="background:#0f0f12; border:1px solid #2a2a32; border-radius:6px; padding:8px; font-size:12px; color:#888; max-height:100px; overflow-y:auto; margin-top:4px;" id="catalogPreview">Chargement...</pre>
          <button class="save-btn" onclick="saveSystemPrompt()"><i class="fa-solid fa-floppy-disk"></i> Enregistrer le prompt</button>
          <div id="promptSaveSuccess" class="save-success" style="display:none">✓ Prompt enregistré</div>
        </div>
      </div>

      <!-- Welcome Message -->
      <div class="config-section">
        <div class="head"><i class="fa-solid fa-hand-wave"></i> Message d'accueil du chat</div>
        <div class="body">
          <div class="config-label">Message affiché automatiquement dans le chat (HTML accepté)</div>
          <textarea class="config-textarea" id="configWelcomeMessage" rows="4" style="min-height:80px">${escHtml(configCache.welcomeMessage || '')}</textarea>
          <div class="config-label">Aperçu :</div>
          <div style="background:#0f0f12; border:1px solid #2a2a32; border-radius:6px; padding:12px; font-size:13px; color:#ccc; margin-top:4px; max-height:120px; overflow-y:auto; line-height:1.5" id="welcomePreview"></div>
          <button class="save-btn" onclick="saveWelcomeMessage()" style="margin-top:12px"><i class="fa-solid fa-floppy-disk"></i> Enregistrer le message d'accueil</button>
          <div id="welcomeSaveSuccess" class="save-success" style="display:none">✓ Message d'accueil enregistré</div>
        </div>
      </div>

      <!-- Products (redirect to dedicated tab) -->
      <div class="config-section">
        <div class="head"><i class="fa-solid fa-box"></i> Catalogue Produits</div>
        <div class="body" style="text-align:center;padding:24px 20px">
          <p style="color:#888;font-size:13px;margin-bottom:8px">La gestion des produits a été déplacée dans l'onglet dédié.</p>
          <a href="#" data-view="products" style="color:#a78bfa;font-size:13px;text-decoration:none;cursor:pointer" onclick="document.querySelector('[data-view=products]').click()"><i class="fa-solid fa-arrow-right"></i> Aller à Produits</a>
        </div>
      </div>

      <!-- API Settings -->
      <div class="config-section">
        <div class="head"><i class="fa-solid fa-key"></i> Clés API & Modèles</div>
        <div class="body">
          <div class="config-label">Clés API Gemini (une par ligne) — ${configCache._apiKeyCount} clé(s) actuellement</div>
          <textarea class="config-textarea" id="configApiKeys" rows="3" placeholder="Entrez vos clés API Gemini, une par ligne..." style="min-height:70px">${escHtml((configCache.apiKeys || []).join('\n'))}</textarea>
          <div class="config-label">Modèles Gemini (un par ligne) — ordre prioritaire : le 1er est le modèle principal, les suivants sont des secours</div>
          <textarea class="config-textarea" id="configModels" rows="3" placeholder="Ex: gemini-2.5-flash&#10;gemini-2.5-flash-lite" style="min-height:60px">${escHtml((configCache.models || []).join('\n'))}</textarea>
          <div class="config-label">Le backend utilise toutes les clés avec le modèle 1 avant de passer au modèle 2.</div>
          <button class="save-btn" onclick="saveApiConfig()"><i class="fa-solid fa-floppy-disk"></i> Enregistrer</button>
          <div id="apiSaveSuccess" class="save-success" style="display:none">✓ Configuration API enregistrée</div>
        </div>
      </div>

      <!-- Tracking Settings -->
      <div class="config-section">
        <div class="head"><i class="fa-solid fa-chart-line"></i> Pixels & Analytics</div>
        <div class="body">
          <div class="config-label">Pixel Facebook / Meta (un ID numérique par ligne)</div>
          <textarea class="config-textarea" id="configFacebookPixels" rows="3" placeholder="Ex: 123456789012345" style="min-height:70px">${escHtml((configCache.facebookPixelIds || []).join('\n'))}</textarea>
          <div class="config-label">Google Analytics GA4 (un ID par ligne)</div>
          <textarea class="config-textarea" id="configGoogleAnalytics" rows="3" placeholder="Ex: G-XXXXXXXXXX" style="min-height:70px">${escHtml((configCache.googleAnalyticsIds || []).join('\n'))}</textarea>
          <button class="save-btn" onclick="saveTrackingConfig()"><i class="fa-solid fa-floppy-disk"></i> Enregistrer tracking</button>
          <div id="trackingSaveSuccess" class="save-success" style="display:none">✓ Tracking enregistré</div>
        </div>
      </div>

      <!-- Order Statuses -->
      <div class="config-section">
        <div class="head"><i class="fa-solid fa-tags"></i> Statuts des commandes</div>
        <div class="body">
          <div class="config-label">Modifiez, ajoutez ou supprimez des statuts. Le premier statut est celui attribué par défaut aux nouvelles commandes.</div>
          <div id="statusListContainer"></div>
          <button class="add-product-btn" onclick="addStatus()" style="margin-top:8px"><i class="fa-solid fa-plus"></i> Ajouter un statut</button>
          <button class="save-btn" onclick="saveStatuses()" style="margin-top:12px"><i class="fa-solid fa-floppy-disk"></i> Enregistrer les statuts</button>
          <div id="statusSaveSuccess" class="save-success" style="display:none">✓ Statuts enregistrés</div>
        </div>
      </div>
    `;

    renderStatuses();
    updateWelcomePreview();

  } catch (e) {
    if (e.message !== 'Session expirée') {
      mainBody.innerHTML = `<div class="empty-state"><i class="fa-solid fa-exclamation-triangle"></i><p>Erreur de chargement: ${e.message}</p></div>`;
    }
  }
}

function renderProducts() {
  const container = document.getElementById('productListContainer');
  if (!container) return;
  const products = configCache.products || [];
  if (products.length === 0) {
    container.innerHTML = '<p style="color:#666;font-size:13px;text-align:center;padding:20px;">Aucun produit dans le catalogue.</p>';
    return;
  }
  container.innerHTML = products.map((p, i) => `
    <div class="product-card" data-index="${i}">
      <div class="row"><label>ID</label><input class="prod-id" value="${escHtml(p.id)}" placeholder="id_unique_sans_espaces"></div>
      <div class="row"><label>Nom</label><input class="prod-name" value="${escHtml(p.name)}" placeholder="Nom du produit"></div>
      <div class="row"><label>Prix</label><input class="prod-price" value="${p.price}" placeholder="49" style="flex:0 1 100px"> <span style="color:#888;font-size:13px;">DT</span></div>
      <div class="row"><label>Image</label><input class="prod-image" value="${escHtml(p.imageUrl)}" placeholder="URL de l'image"></div>
      <div class="row"><label>Taille</label><input class="prod-taille" value="${escHtml(p.taille || '')}" placeholder="ex: 3.5 cm"></div>
      <div class="row" style="align-items:flex-start"><label>Description</label><textarea class="prod-benefits" rows="2" placeholder="Description et bienfaits...">${escHtml(p.benefits)}</textarea></div>
      <div class="row" style="align-items:flex-start"><label>Composition</label><textarea class="prod-composition" rows="2" placeholder="Matériaux et cristaux...">${escHtml(p.composition)}</textarea></div>
      <div style="text-align:right;margin-top:6px"><button class="remove-btn" onclick="removeProduct(${i})"><i class="fa-solid fa-trash"></i> Supprimer</button></div>
    </div>
  `).join('');
  document.getElementById('productCount').textContent = products.length;
}

function addProduct() {
  if (!configCache.products) configCache.products = [];
  configCache.products.push({ id: 'nouveau_produit', name: 'Nouveau Produit', price: 0, currency: 'DT', imageUrl: '', benefits: '', composition: '', taille: '' });
  renderProducts();
  updateCatalogPreview();
}

function removeProduct(index) {
  if (!configCache.products) return;
  configCache.products.splice(index, 1);
  renderProducts();
  updateCatalogPreview();
}

function collectProductsFromUI() {
  const cards = document.querySelectorAll('.product-card');
  const products = [];
  cards.forEach(card => {
    const id = card.querySelector('.prod-id')?.value?.trim();
    if (!id) return;
    products.push({
      id,
      name: card.querySelector('.prod-name')?.value?.trim() || '',
      price: parseFloat((card.querySelector('.prod-price')?.value || '').replace(',', '.')) || 0,
      currency: 'DT',
      imageUrl: card.querySelector('.prod-image')?.value?.trim() || '',
      benefits: card.querySelector('.prod-benefits')?.value?.trim() || '',
      composition: card.querySelector('.prod-composition')?.value?.trim() || '',
      taille: card.querySelector('.prod-taille')?.value?.trim() || undefined
    });
  });
  return products;
}

function updateCatalogPreview() {
  const el = document.getElementById('catalogPreview');
  if (!el) return;
  const products = collectProductsFromUI();
  const tmpl = document.getElementById('configCatalogTemplate')?.value || "{n}. {name} [{id}] : {benefits}";
  const lines = products.map((p, i) => {
    let line = tmpl
      .replace(/\{n\}/g, String(i + 1))
      .replace(/\{name\}/g, p.name)
      .replace(/\{id\}/g, p.id)
      .replace(/\{benefits\}/g, p.benefits)
      .replace(/\{composition\}/g, p.composition)
      .replace(/\{price\}/g, String(p.price))
      .replace(/\{currency\}/g, p.currency);
    if (p.taille) { line = line.replace(/\{taille\}/g, p.taille); }
    else { line = line.replace(/\{taille\}[^\{]*\{\/taille\}/g, ''); }
    return line;
  });
  el.textContent = lines.join('\n');
}

async function saveSystemPrompt() {
  const systemPrompt = document.getElementById('configSystemPrompt')?.value || '';
  const catalogItemTemplate = document.getElementById('configCatalogTemplate')?.value || "{n}. {name} [{id}] : {benefits} Composition : {composition} Prix : {price} {currency}.";
  try {
    const result = await apiFetch('/api/admin/config', {
      method: 'PUT',
      body: JSON.stringify({ systemPrompt, catalogItemTemplate })
    });
    if (result && typeof result === 'object') Object.assign(configCache, result); else configCache = result;
    const el = document.getElementById('promptSaveSuccess');
    if (el) { el.style.display = 'block'; setTimeout(() => { el.style.display = 'none'; }, 2000); }
  } catch (e) {
    if (e.message !== 'Session expirée') alert('Erreur: ' + e.message);
  }
}

async function saveApiConfig() {
  const apiKeysText = document.getElementById('configApiKeys')?.value || '';
  const modelsText = document.getElementById('configModels')?.value || '';
  const parseList = (text, dropMasked = false) => text
    .split(/[\r\n,;]+/)
    .map(v => v.trim())
    .filter(v => v.length > 0 && (!dropMasked || v !== '***'));
  const apiKeys = parseList(apiKeysText, true);
  const models = parseList(modelsText);
  const payload = {};
  if (apiKeys.length > 0) payload.apiKeys = apiKeys;
  if (models.length > 0) payload.models = models;
  if (Object.keys(payload).length === 0) return alert('Aucune modification API à enregistrer.');
  try {
    const result = await apiFetch('/api/admin/config', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    if (result && typeof result === 'object') Object.assign(configCache, result); else configCache = result;
    const el = document.getElementById('apiSaveSuccess');
    if (el) { el.style.display = 'block'; setTimeout(() => { el.style.display = 'none'; }, 2000); }
  } catch (e) {
    if (e.message !== 'Session expirée') alert('Erreur: ' + e.message);
  }
}

async function saveTrackingConfig() {
  const facebookText = document.getElementById('configFacebookPixels')?.value || '';
  const googleText = document.getElementById('configGoogleAnalytics')?.value || '';
  const facebookPixelIds = facebookText.split('\n').map(v => v.trim()).filter(v => v.length > 0);
  const googleAnalyticsIds = googleText.split('\n').map(v => v.trim().toUpperCase()).filter(v => v.length > 0);

  const invalidFb = facebookPixelIds.filter(v => !/^[0-9]{5,30}$/.test(v));
  const invalidGa = googleAnalyticsIds.filter(v => !/^G-[A-Z0-9]{4,20}$/.test(v));
  if (invalidFb.length > 0) return alert('Pixel Facebook invalide: ' + invalidFb.join(', '));
  if (invalidGa.length > 0) return alert('ID Google Analytics invalide: ' + invalidGa.join(', '));

  try {
    const result = await apiFetch('/api/admin/config', {
      method: 'PUT',
      body: JSON.stringify({ facebookPixelIds, googleAnalyticsIds })
    });
    if (result && typeof result === 'object') Object.assign(configCache, result); else configCache = result;
    const el = document.getElementById('trackingSaveSuccess');
    if (el) { el.style.display = 'block'; setTimeout(() => { el.style.display = 'none'; }, 2000); }
  } catch (e) {
    if (e.message !== 'Session expirée') alert('Erreur: ' + e.message);
  }
}

// ── Order Status Management ──

function renderStatuses() {
  const container = document.getElementById('statusListContainer');
  if (!container) return;
  let st = configCache.statuses;
  if (!st || st.length === 0) {
    st = getStatusList();
    configCache.statuses = [...st];
  }
  container.innerHTML = st.map((s, i) => `
    <div class="product-card" data-status-index="${i}">
      <div style="display:flex;gap:8px;align-items:center;">
        <span style="color:#555;font-size:11px;min-width:20px;">${i + 1}.</span>
        <input class="status-input" value="${escHtml(s)}" placeholder="Nom du statut" style="flex:1;background:#26262e;border:1px solid #333;border-radius:6px;padding:6px 10px;color:#e0e0e0;font-size:13px;outline:none;">
        ${i === 0 ? '<span style="color:#888;font-size:11px;background:#2a2a32;padding:2px 8px;border-radius:4px;">Défaut</span>' : ''}
        <button class="remove-btn" onclick="removeStatus(${i})"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
  `).join('');
}

function collectStatusesFromUI() {
  const inputs = document.querySelectorAll('.status-input');
  const list = [];
  inputs.forEach(inp => {
    const v = inp.value.trim();
    if (v) list.push(v);
  });
  if (list.length === 0) list.push(getStatusList()[0]);
  return list;
}

function addStatus() {
  if (!configCache.statuses) configCache.statuses = [getStatusList()[0]];
  configCache.statuses.push('');
  renderStatuses();
}

function removeStatus(index) {
  if (!configCache.statuses || configCache.statuses.length <= 1) return alert('Vous devez garder au moins un statut.');
  configCache.statuses.splice(index, 1);
  renderStatuses();
}

async function saveStatuses() {
  const statuses = collectStatusesFromUI();
  if (statuses.length === 0) return alert('Ajoutez au moins un statut.');
  try {
    const result = await apiFetch('/api/admin/config', {
      method: 'PUT',
      body: JSON.stringify({ statuses })
    });
    if (result && typeof result === 'object') Object.assign(configCache, result); else configCache = result;
    const el = document.getElementById('statusSaveSuccess');
    if (el) { el.style.display = 'block'; setTimeout(() => { el.style.display = 'none'; }, 2000); }
  } catch (e) {
    if (e.message !== 'Session expirée') alert('Erreur: ' + e.message);
  }
}

// ── Welcome Message ──

function updateWelcomePreview() {
  const el = document.getElementById('welcomePreview');
  const textarea = document.getElementById('configWelcomeMessage');
  if (el && textarea) el.innerHTML = sanitizeAdminHtml(textarea.value || 'Aucun message');
}

document.addEventListener('input', (e) => {
  if (e.target.id === 'configWelcomeMessage') updateWelcomePreview();
});

async function saveWelcomeMessage() {
  const welcomeMessage = document.getElementById('configWelcomeMessage')?.value || '';
  try {
    const result = await apiFetch('/api/admin/config', {
      method: 'PUT',
      body: JSON.stringify({ welcomeMessage })
    });
    configCache = result;
    const el = document.getElementById('welcomeSaveSuccess');
    if (el) { el.style.display = 'block'; setTimeout(() => { el.style.display = 'none'; }, 2000); }
  } catch (e) {
    if (e.message !== 'Session expirée') alert('Erreur: ' + e.message);
  }
}

// ── Products View (DB) ──

let _productsViewId = 0;

async function renderProductsView() {
  const viewId = ++_productsViewId;
  const el = document.getElementById('mainBody');
  el.innerHTML = '<div style="text-align:center;padding:40px;color:#888;"><i class="fa-solid fa-spinner fa-spin"></i> Chargement...</div>';
  let productsList = [];
  try {
    productsList = await apiFetch('/api/admin/products');
    if (viewId !== _productsViewId) return;
  } catch (e) {
    if (e.message !== 'Session expirée') {
      el.innerHTML = '<div class="empty-state"><i class="fa-solid fa-exclamation-triangle"></i><p>Erreur de chargement: ' + e.message + '</p></div>';
    }
    return;
  }
  if (viewId !== _productsViewId) return;

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="color:#888;font-size:13px">${productsList.length} produit(s)</div>
      <div style="display:flex;gap:8px">
        <button class="save-btn" onclick="syncProductsFromConfig()" style="background:#2a2a32"><i class="fa-solid fa-cloud-arrow-down"></i> Sync config</button>
        <button class="save-btn" onclick="showProductForm(null)"><i class="fa-solid fa-plus"></i> Nouveau produit</button>
      </div>
    </div>
    <div id="productsListContainer">${renderProductsTable(productsList)}</div>
    <div id="productFormContainer"></div>
  `;
}

function renderProductsTable(list) {
  if (!list || list.length === 0) return '<p style="color:#666;font-size:13px;text-align:center;padding:40px">Aucun produit. Cliquez sur "Nouveau produit" pour en créer un.</p>';

  return `<table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead>
      <tr style="color:#888;border-bottom:1px solid #2a2a32">
        <th style="padding:8px 10px;text-align:left;width:30px">#</th>
        <th style="padding:8px 10px;text-align:left">ID</th>
        <th style="padding:8px 10px;text-align:left">Nom</th>
        <th style="padding:8px 10px;text-align:right">Prix</th>
        <th style="padding:8px 10px;text-align:center">Type</th>
        <th style="padding:8px 10px;text-align:center">Visible</th>
        <th style="padding:8px 10px;text-align:right">Actions</th>
      </tr>
    </thead>
    <tbody>
      ${list.map((p, i) => `
        <tr style="border-bottom:1px solid #1a1a24;transition:background 0.15s" onmouseover="this.style.background='#1a1a24'" onmouseout="this.style.background=''">
          <td style="padding:8px 10px;color:#555">${i + 1}</td>
          <td style="padding:8px 10px;font-family:monospace;color:#a78bfa">${escHtml(p.id)}</td>
          <td style="padding:8px 10px;color:#e0e0e0">${escHtml(p.name || '—')}</td>
          <td style="padding:8px 10px;text-align:right;color:#f59e0b">${p.price || 0} DT</td>
          <td style="padding:8px 10px;text-align:center"><span style="background:#2a2a32;padding:2px 8px;border-radius:4px;font-size:11px">${escHtml(p.productType || '—')}</span></td>
          <td style="padding:8px 10px;text-align:center">${p.visible ? '<span style="color:#10b981">✓</span>' : '<span style="color:#666">✗</span>'}</td>
          <td style="padding:8px 10px;text-align:right">
            <button class="save-btn" onclick="showProductForm('${escHtml(p.id)}')" style="padding:4px 10px;font-size:11px;background:#2a2a32"><i class="fa-solid fa-pen"></i></button>
            <button class="remove-btn" onclick="deleteProduct('${escHtml(p.id)}')" style="padding:4px 10px;font-size:11px;display:inline-flex;align-items:center;gap:4px"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>`;
}

function buildProductFormData(product) {
  return {
    id: product?.id || '',
    name: product?.name || '',
    slug: product?.slug || '',
    price: product?.price || '',
    currency: product?.currency || 'DT',
    imageUrl: product?.imageUrl || '',
    benefits: product?.benefits || '',
    taille: product?.taille || '',
    accentColor: product?.accentColor || '#7c3aed',
    productType: product?.productType || '',
    stock: product?.stock ?? 10,
    hook: product?.hook || '',
    hook_transition: product?.hook_transition || '',
    upsellPrice: product?.upsellPrice || '',
    priceOriginal: product?.priceOriginal || '',
    welcomeSequence: Array.isArray(product?.welcomeSequence) ? product.welcomeSequence.join('\n') : '',
    faq: Array.isArray(product?.faq) ? product.faq.map(f => f.question + '|||' + f.answer).join('\n') : '',
    reviews: Array.isArray(product?.reviews) ? product.reviews.map(r => r.name + '|||' + r.city + '|||' + (r.rating || 5) + '|||' + r.text).join('\n') : '',
    visible: product?.visible ?? 1
  };
}

async function showProductForm(productId) {
  const container = document.getElementById('productFormContainer');
  if (!container) return;

  let product = null;
  if (productId) {
    const list = await apiFetch('/api/admin/products');
    product = list.find(p => p.id === productId) || null;
  }

  const d = buildProductFormData(product);
  const isEdit = !!product;

  container.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px" onclick="if(event.target===this)closeProductForm()">
      <div style="background:#1a1a20;border:1px solid #2a2a32;border-radius:16px;width:100%;max-width:700px;max-height:90vh;overflow-y:auto;padding:24px" onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <h2 style="margin:0;font-size:18px;color:#e0e0e0">${isEdit ? 'Modifier' : 'Nouveau'} produit</h2>
          <button onclick="closeProductForm()" style="background:none;border:none;color:#888;font-size:20px;cursor:pointer">&times;</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div style="grid-column:1/-1">
            <div class="config-label">ID unique (sans espaces, ex: coeur_vert_protection)</div>
            <input class="config-input" id="pf-id" value="${escHtml(d.id)}" ${isEdit ? 'readonly style="color:#666;background:#1a1a20"' : ''}>
          </div>
          <div>
            <div class="config-label">Nom</div>
            <input class="config-input" id="pf-name" value="${escHtml(d.name)}">
          </div>
          <div>
            <div class="config-label">Slug (URL)</div>
            <input class="config-input" id="pf-slug" value="${escHtml(d.slug)}" placeholder="auto si vide">
          </div>
          <div>
            <div class="config-label">Prix (DT)</div>
            <input class="config-input" id="pf-price" type="number" step="0.01" value="${d.price}">
          </div>
          <div>
            <div class="config-label">Prix original (barre)</div>
            <input class="config-input" id="pf-priceOriginal" type="number" step="0.01" value="${d.priceOriginal}" placeholder="ex: 89">
          </div>
          <div>
            <div class="config-label">Upsell prix (2 articles)</div>
            <input class="config-input" id="pf-upsellPrice" type="number" step="0.01" value="${d.upsellPrice}" placeholder="ex: 78">
          </div>
          <div>
            <div class="config-label">Stock</div>
            <input class="config-input" id="pf-stock" type="number" value="${d.stock}">
          </div>
          <div>
            <div class="config-label">Type produit</div>
            <input class="config-input" id="pf-productType" value="${escHtml(d.productType)}" placeholder="protection, love...">
          </div>
          <div>
            <div class="config-label">Taille</div>
            <input class="config-input" id="pf-taille" value="${escHtml(d.taille)}" placeholder="ex: 3.5 cm">
          </div>
          <div>
            <div class="config-label">Couleur accent</div>
            <input class="config-input" id="pf-accentColor" value="${escHtml(d.accentColor)}" placeholder="#7c3aed">
          </div>
          <div>
            <div class="config-label">Devise</div>
            <input class="config-input" id="pf-currency" value="${escHtml(d.currency)}">
          </div>
          <div style="display:flex;align-items:center;gap:8px;padding-top:20px">
            <label style="color:#888;font-size:12px">Visible</label>
            <input type="checkbox" id="pf-visible" ${d.visible ? 'checked' : ''} style="accent-color:#7c3aed;width:18px;height:18px">
          </div>
          <div style="grid-column:1/-1">
            <div class="config-label">Image URL</div>
            <input class="config-input" id="pf-imageUrl" value="${escHtml(d.imageUrl)}">
          </div>
          <div style="grid-column:1/-1">
            <div class="config-label">Hook (accroche émotionnelle)</div>
            <input class="config-input" id="pf-hook" value="${escHtml(d.hook)}" placeholder="Ex: Ressentez la différence dès le premier jour">
          </div>
          <div style="grid-column:1/-1">
            <div class="config-label">Transition hook → benefits</div>
            <input class="config-input" id="pf-hookTransition" value="${escHtml(d.hook_transition)}" placeholder="Ex: Voici pourquoi nos clients ressentent une différence...">
          </div>
          <div style="grid-column:1/-1">
            <div class="config-label">Benefits (description / bienfaits)</div>
            <textarea class="config-textarea" id="pf-benefits" rows="3" style="min-height:70px">${escHtml(d.benefits)}</textarea>
          </div>
          <div style="grid-column:1/-1">
            <div class="config-label">Composition</div>
            <textarea class="config-textarea" id="pf-composition" rows="3" style="min-height:60px">${escHtml(d.composition || '')}</textarea>
          </div>
          <div style="grid-column:1/-1">
            <div class="config-label">Welcome Sequence (1 ligne = 1 message, 3 max)</div>
            <textarea class="config-textarea" id="pf-welcomeSequence" rows="3" style="min-height:60px">${escHtml(d.welcomeSequence)}</textarea>
          </div>
          <div style="grid-column:1/-1">
            <div class="config-label">FAQ (1 ligne = question ||| réponse)</div>
            <textarea class="config-textarea" id="pf-faq" rows="3" style="min-height:60px">${escHtml(d.faq)}</textarea>
          </div>
          <div style="grid-column:1/-1">
            <div class="config-label">Reviews (1 ligne = nom ||| ville ||| note ||| texte)</div>
            <textarea class="config-textarea" id="pf-reviews" rows="3" style="min-height:60px">${escHtml(d.reviews)}</textarea>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:20px;justify-content:flex-end">
          <button class="remove-btn" onclick="closeProductForm()" style="padding:8px 16px">Annuler</button>
          <button class="save-btn" onclick="saveProductForm('${escHtml(d.id)}')"><i class="fa-solid fa-floppy-disk"></i> ${isEdit ? 'Mettre à jour' : 'Créer'}</button>
        </div>
        <div id="pf-saveStatus" class="save-success" style="display:none"></div>
      </div>
    </div>
  `;
}

function closeProductForm() {
  const container = document.getElementById('productFormContainer');
  if (container) container.innerHTML = '';
}

async function saveProductForm(existingId) {
  const data = {
    id: document.getElementById('pf-id')?.value?.trim(),
    name: document.getElementById('pf-name')?.value?.trim(),
    slug: document.getElementById('pf-slug')?.value?.trim(),
    price: parseFloat(document.getElementById('pf-price')?.value) || 0,
    currency: document.getElementById('pf-currency')?.value?.trim() || 'DT',
    imageUrl: document.getElementById('pf-imageUrl')?.value?.trim() || '',
    benefits: document.getElementById('pf-benefits')?.value?.trim() || '',
    composition: document.getElementById('pf-composition')?.value?.trim() || '',
    taille: document.getElementById('pf-taille')?.value?.trim() || '',
    accentColor: document.getElementById('pf-accentColor')?.value?.trim() || '#7c3aed',
    productType: document.getElementById('pf-productType')?.value?.trim() || '',
    stock: parseInt(document.getElementById('pf-stock')?.value) || 10,
    hook: document.getElementById('pf-hook')?.value?.trim() || '',
    hook_transition: document.getElementById('pf-hookTransition')?.value?.trim() || '',
    upsellPrice: parseFloat(document.getElementById('pf-upsellPrice')?.value) || null,
    priceOriginal: parseFloat(document.getElementById('pf-priceOriginal')?.value) || null,
    visible: document.getElementById('pf-visible')?.checked ? 1 : 0,
    welcomeSequence: (document.getElementById('pf-welcomeSequence')?.value || '').split('\n').map(s => s.trim()).filter(Boolean),
    faq: (document.getElementById('pf-faq')?.value || '').split('\n').map(s => s.trim()).filter(Boolean).map(s => {
      const parts = s.split('|||');
      return { question: parts[0]?.trim() || '', answer: parts[1]?.trim() || '' };
    }),
    reviews: (document.getElementById('pf-reviews')?.value || '').split('\n').map(s => s.trim()).filter(Boolean).map(s => {
      const parts = s.split('|||');
      return { name: parts[0]?.trim() || '', city: parts[1]?.trim() || '', rating: parseInt(parts[2]) || 5, text: parts[3]?.trim() || '' };
    })
  };

  if (!data.id) return alert('L\'ID est requis');
  if (!data.name) return alert('Le nom est requis');

  const statusEl = document.getElementById('pf-saveStatus');
  try {
    if (existingId) {
      const cleaned = { ...data };
      delete cleaned.id;
      await apiFetch('/api/admin/products/' + encodeURIComponent(existingId), { method: 'PUT', body: JSON.stringify(cleaned) });
    } else {
      await apiFetch('/api/admin/products', { method: 'POST', body: JSON.stringify(data) });
    }
    if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = '✓ Enregistré'; statusEl.style.color = '#10b981'; }
    setTimeout(() => { closeProductForm(); renderProductsView(); }, 800);
  } catch (e) {
    if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = 'Erreur: ' + e.message; statusEl.style.color = '#f87171'; }
  }
}

async function deleteProduct(productId) {
  if (!confirm('Supprimer définitivement le produit "' + productId + '" ?')) return;
  try {
    await apiFetch('/api/admin/products/' + encodeURIComponent(productId), { method: 'DELETE' });
    renderProductsView();
  } catch (e) {
    alert('Erreur: ' + e.message);
  }
}

async function syncProductsFromConfig() {
  try {
    const result = await apiFetch('/api/admin/products/sync', { method: 'POST' });
    alert(result.imported + ' produit(s) importé(s) depuis la config');
    renderProductsView();
  } catch (e) {
    alert('Erreur: ' + e.message);
  }
}

// ── Services ──

let _servicesViewId = 0;

async function renderServicesView() {
  const viewId = ++_servicesViewId;
  const el = document.getElementById('mainBody');
  el.innerHTML = '<div style="text-align:center;padding:40px;color:#888;"><i class="fa-solid fa-spinner fa-spin"></i> Chargement...</div>';
  let servicesList = [];
  try {
    servicesList = await apiFetch('/api/admin/services');
    if (viewId !== _servicesViewId) return;
  } catch (e) {
    if (e.message !== 'Session expirée') {
      el.innerHTML = '<div class="empty-state"><i class="fa-solid fa-exclamation-triangle"></i><p>Erreur de chargement: ' + e.message + '</p></div>';
    }
    return;
  }
  if (viewId !== _servicesViewId) return;

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div style="color:#888;font-size:13px">${servicesList.length} service(s)</div>
      <div>
        <button class="save-btn" onclick="showServiceForm(null)"><i class="fa-solid fa-plus"></i> Nouveau service</button>
      </div>
    </div>
    <div id="servicesListContainer">${renderServicesTable(servicesList)}</div>
    <div id="serviceFormContainer"></div>
  `;
}

function renderServicesTable(list) {
  if (!list || list.length === 0) return '<p style="color:#666;font-size:13px;text-align:center;padding:40px">Aucun service.</p>';

  return `<table style="width:100%;border-collapse:collapse;font-size:13px">
    <thead>
      <tr style="color:#888;border-bottom:1px solid #2a2a32">
        <th style="padding:8px 10px;text-align:left;width:30px">#</th>
        <th style="padding:8px 10px;text-align:left">ID</th>
        <th style="padding:8px 10px;text-align:left">Nom</th>
        <th style="padding:8px 10px;text-align:right">Prix</th>
        <th style="padding:8px 10px;text-align:center">Durée</th>
        <th style="padding:8px 10px;text-align:center">Visible</th>
        <th style="padding:8px 10px;text-align:right">Actions</th>
      </tr>
    </thead>
    <tbody>
      ${list.map((s, i) => `
        <tr style="border-bottom:1px solid #1a1a24;transition:background 0.15s" onmouseover="this.style.background='#1a1a24'" onmouseout="this.style.background=''">
          <td style="padding:8px 10px;color:#555">${i + 1}</td>
          <td style="padding:8px 10px;font-family:monospace;color:#fbbf24">${escHtml(s.id)}</td>
          <td style="padding:8px 10px;color:#e0e0e0">${escHtml(s.name || '—')}</td>
          <td style="padding:8px 10px;text-align:right;color:#22C55E">${s.price || 0} DT</td>
          <td style="padding:8px 10px;text-align:center"><span style="background:#2a2a32;padding:2px 8px;border-radius:4px;font-size:11px">${escHtml(s.duration || '—')}</span></td>
          <td style="padding:8px 10px;text-align:center">${s.visible ? '<span style="color:#10b981">✓</span>' : '<span style="color:#666">✗</span>'}</td>
          <td style="padding:8px 10px;text-align:right">
            <button class="save-btn" onclick="showServiceForm('${escHtml(s.id)}')" style="padding:4px 10px;font-size:11px;background:#2a2a32"><i class="fa-solid fa-pen"></i></button>
            <button class="remove-btn" onclick="deleteService('${escHtml(s.id)}')" style="padding:4px 10px;font-size:11px;display:inline-flex;align-items:center;gap:4px"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>
      `).join('')}
    </tbody>
  </table>`;
}

function buildServiceFormData(service) {
  return {
    id: service?.id || '',
    name: service?.name || '',
    slug: service?.slug || '',
    subtitle: service?.subtitle || '',
    price: service?.price || '',
    originalPrice: service?.originalPrice || '',
    icon: service?.icon || '🔮',
    imageUrl: service?.imageUrl || '',
    color: service?.color || '#8b5cf6',
    description: service?.description || '',
    benefits: Array.isArray(service?.benefits) ? service.benefits.join('\n') : '',
    duration: service?.duration || '',
    format: service?.format || '',
    visible: service?.visible ?? 1,
    linkedProductIds: service?.linkedProductIds || []
  };
}

async function showServiceForm(serviceId) {
  const container = document.getElementById('serviceFormContainer');
  if (!container) return;

  let service = null;
  let allProducts = [];
  if (serviceId) {
    const list = await apiFetch('/api/admin/services');
    service = list.find(s => s.id === serviceId) || null;
  }
  try { allProducts = await apiFetch('/api/admin/products'); } catch (e) {}

  const d = buildServiceFormData(service);
  const isEdit = !!service;

  container.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px" onclick="if(event.target===this)closeServiceForm()">
      <div style="background:#1a1a20;border:1px solid #2a2a32;border-radius:16px;width:100%;max-width:700px;max-height:90vh;overflow-y:auto;padding:24px" onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
          <h2 style="margin:0;font-size:18px;color:#e0e0e0">${isEdit ? 'Modifier' : 'Nouveau'} service</h2>
          <button onclick="closeServiceForm()" style="background:none;border:none;color:#888;font-size:20px;cursor:pointer">&times;</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div style="grid-column:1/-1">
            <div class="config-label">ID unique (sans espaces, ex: consultation-energetique)</div>
            <input class="config-input" id="sf-id" value="${escHtml(d.id)}" ${isEdit ? 'readonly style="color:#666;background:#1a1a20"' : ''}>
          </div>
          <div>
            <div class="config-label">Nom</div>
            <input class="config-input" id="sf-name" value="${escHtml(d.name)}">
          </div>
          <div>
            <div class="config-label">Slug (URL)</div>
            <input class="config-input" id="sf-slug" value="${escHtml(d.slug)}" placeholder="auto si vide">
          </div>
          <div>
            <div class="config-label">Sous-titre</div>
            <input class="config-input" id="sf-subtitle" value="${escHtml(d.subtitle)}">
          </div>
          <div>
            <div class="config-label">Prix (DT)</div>
            <input class="config-input" id="sf-price" type="number" step="0.01" value="${d.price}">
          </div>
          <div>
            <div class="config-label">Prix original (barre)</div>
            <input class="config-input" id="sf-originalPrice" type="number" step="0.01" value="${d.originalPrice}" placeholder="ex: 60">
          </div>
          <div>
            <div class="config-label">Icône (emoji)</div>
            <input class="config-input" id="sf-icon" value="${escHtml(d.icon)}">
          </div>
          <div>
            <div class="config-label">Couleur accent</div>
            <input class="config-input" id="sf-color" value="${escHtml(d.color)}" placeholder="#8b5cf6">
          </div>
          <div>
            <div class="config-label">Durée</div>
            <input class="config-input" id="sf-duration" value="${escHtml(d.duration)}" placeholder="45 min">
          </div>
          <div>
            <div class="config-label">Format</div>
            <input class="config-input" id="sf-format" value="${escHtml(d.format)}" placeholder="Visio / Téléphone">
          </div>
          <div style="display:flex;align-items:center;gap:8px;padding-top:20px">
            <label style="color:#888;font-size:12px">Visible</label>
            <input type="checkbox" id="sf-visible" ${d.visible ? 'checked' : ''} style="accent-color:#8b5cf6;width:18px;height:18px">
          </div>
          <div style="grid-column:1/-1">
            <div class="config-label">Image URL</div>
            <input class="config-input" id="sf-imageUrl" value="${escHtml(d.imageUrl)}">
          </div>
          <div style="grid-column:1/-1">
            <div class="config-label">Description</div>
            <textarea class="config-textarea" id="sf-description" rows="3" style="min-height:70px">${escHtml(d.description)}</textarea>
          </div>
          <div style="grid-column:1/-1">
            <div class="config-label">Bénéfices (1 par ligne)</div>
            <textarea class="config-textarea" id="sf-benefits" rows="3" style="min-height:60px">${escHtml(d.benefits)}</textarea>
          </div>
          <div style="grid-column:1/-1">
            <div class="config-label">Produits liés</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px" id="sf-productCheckboxes">
              ${allProducts.map(p => `
                <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:#bbb;cursor:pointer;background:#2a2a32;padding:4px 10px;border-radius:6px;border:1px solid ${d.linkedProductIds.includes(p.id) ? '#8b5cf6' : '#2a2a32'}">
                  <input type="checkbox" value="${escHtml(p.id)}" ${d.linkedProductIds.includes(p.id) ? 'checked' : ''} style="accent-color:#8b5cf6">
                  ${escHtml(p.name)}
                </label>
              `).join('') || '<span style="color:#555;font-size:12px">Aucun produit. Créez d\'abord des produits.</span>'}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:20px;justify-content:flex-end">
          <button class="remove-btn" onclick="closeServiceForm()" style="padding:8px 16px">Annuler</button>
          <button class="save-btn" onclick="saveServiceForm('${escHtml(d.id)}')"><i class="fa-solid fa-floppy-disk"></i> ${isEdit ? 'Mettre à jour' : 'Créer'}</button>
        </div>
        <div id="sf-saveStatus" class="save-success" style="display:none"></div>
      </div>
    </div>
  `;
}

function closeServiceForm() {
  const container = document.getElementById('serviceFormContainer');
  if (container) container.innerHTML = '';
}

async function saveServiceForm(existingId) {
  const getCheckedProductIds = () => {
    const container = document.getElementById('sf-productCheckboxes');
    if (!container) return [];
    return [...container.querySelectorAll('input[type="checkbox"]:checked')].map(cb => cb.value);
  };

  const data = {
    id: document.getElementById('sf-id')?.value?.trim(),
    name: document.getElementById('sf-name')?.value?.trim(),
    slug: document.getElementById('sf-slug')?.value?.trim(),
    subtitle: document.getElementById('sf-subtitle')?.value?.trim() || '',
    price: parseFloat(document.getElementById('sf-price')?.value) || 0,
    originalPrice: parseFloat(document.getElementById('sf-originalPrice')?.value) || null,
    icon: document.getElementById('sf-icon')?.value?.trim() || '🔮',
    imageUrl: document.getElementById('sf-imageUrl')?.value?.trim() || '',
    color: document.getElementById('sf-color')?.value?.trim() || '#8b5cf6',
    description: document.getElementById('sf-description')?.value?.trim() || '',
    benefits: (document.getElementById('sf-benefits')?.value || '').split('\n').map(s => s.trim()).filter(Boolean),
    duration: document.getElementById('sf-duration')?.value?.trim() || '',
    format: document.getElementById('sf-format')?.value?.trim() || '',
    visible: document.getElementById('sf-visible')?.checked ? 1 : 0,
    linkedProductIds: getCheckedProductIds()
  };

  if (!data.id) return alert('L\'ID est requis');
  if (!data.name) return alert('Le nom est requis');

  const statusEl = document.getElementById('sf-saveStatus');
  try {
    if (existingId) {
      const cleaned = { ...data };
      delete cleaned.id;
      await apiFetch('/api/admin/services/' + encodeURIComponent(existingId), { method: 'PUT', body: JSON.stringify(cleaned) });
    } else {
      await apiFetch('/api/admin/services', { method: 'POST', body: JSON.stringify(data) });
    }
    if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = '✓ Enregistré'; statusEl.style.color = '#10b981'; }
    setTimeout(() => { closeServiceForm(); renderServicesView(); }, 800);
  } catch (e) {
    if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = 'Erreur: ' + e.message; statusEl.style.color = '#f87171'; }
  }
}

async function deleteService(serviceId) {
  if (!confirm('Supprimer définitivement le service "' + serviceId + '" ?')) return;
  try {
    await apiFetch('/api/admin/services/' + encodeURIComponent(serviceId), { method: 'DELETE' });
    renderServicesView();
  } catch (e) {
    alert('Erreur: ' + e.message);
  }
}

// ── Statistiques ──

async function renderStats() {
  const viewId = ++_viewCounter;
  const el = document.getElementById('mainBody');
  el.innerHTML = '<div style="text-align:center;padding:40px;color:#888;"><i class="fa-solid fa-spinner fa-spin"></i> Chargement...</div>';
  try {
    const data = await apiFetch('/api/admin/stats?days=30');
    if (viewId !== _viewCounter) return;
    const s = data.summary || {};
    const conv = data.conversations || [];
    const modes = data.modes || [];
    const stages = data.stages || [];
    const funnel = data.funnel || [];
    const orderStats = data.orderStats || {};
    const topProducts = data.topProducts || [];
    const modeColors = { A: '#7c3aed', B: '#3b82f6', C: '#10b981' };
    const stageLabels = { accueil: 'Accueil', ecoute: 'Ecoute', qualification: 'Qualification', argumentation: 'Argumentation', upsell: 'Upsell', closing: 'Closing' };
    const stageColors = { accueil: '#6b7280', ecoute: '#3b82f6', qualification: '#14b8a6', argumentation: '#f59e0b', upsell: '#f97316', closing: '#10b981' };
    const maxFunnelSessions = Math.max(1, ...funnel.map(f => Number(f.sessions) || 0));
    const tauxConv = s.sessions > 0 ? ((s.total_commandes / s.sessions) * 100).toFixed(1) : 0;
    const visConvRate = (s.visitor_to_conversation_rate || 0) + '%';

    const convChart = conv.map(r => `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:13px"><span style="width:80px;color:#888">${escHtml(r.jour)}</span><div style="flex:1;height:20px;background:#1e1e26;border-radius:4px;overflow:hidden"><div style="width:${Math.min(100, Number(r.total || 0) * 10)}%;background:#7c3aed;height:100%;border-radius:4px"></div></div><span style="width:34px;text-align:right">${r.total || 0}</span>${Number(r.commandes || 0) > 0 ? `<span style="color:#10b981;width:28px;text-align:right">${r.commandes} ok</span>` : ''}</div>`).join('');
    const modeChart = modes.map(m => `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:13px"><span style="width:30px;font-weight:700;color:${modeColors[m.mode] || '#888'}">${escHtml(m.mode || '-')}</span><div style="flex:1;height:16px;background:#1e1e26;border-radius:4px;overflow:hidden"><div style="width:${Math.min(100, Number(m.sessions || 0) * 10)}%;background:${modeColors[m.mode] || '#888'};height:100%;border-radius:4px"></div></div><span style="width:100px;text-align:right">${m.sessions || 0} sess. / ${m.total_messages || 0} msg</span></div>`).join('');
    const stageChart = stages.map(st => `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:13px"><span style="width:110px;color:${stageColors[st.stage] || '#888'}">${stageLabels[st.stage] || escHtml(st.stage || '-')}</span><div style="flex:1;height:16px;background:#1e1e26;border-radius:4px;overflow:hidden"><div style="width:${Math.min(100, Number(st.sessions || st.total || 0) * 5)}%;background:${stageColors[st.stage] || '#888'};height:100%;border-radius:4px"></div></div><span style="width:60px;text-align:right">${st.sessions || 0} sess.</span></div>`).join('');
    const funnelHtml = funnel.map((f, idx) => `<div style="margin-bottom:10px"><div style="display:flex;align-items:center;justify-content:space-between;font-size:13px;margin-bottom:4px"><span style="color:${stageColors[f.stage] || '#888'};font-weight:600">${idx + 1}. ${escHtml(f.label || stageLabels[f.stage] || f.stage)}</span><span style="color:#aaa">${f.sessions || 0} session(s)</span></div><div style="height:18px;background:#1e1e26;border-radius:4px;overflow:hidden"><div style="width:${Math.min(100, ((Number(f.sessions) || 0) / maxFunnelSessions) * 100)}%;background:${stageColors[f.stage] || '#888'};height:100%"></div></div>${f.stage !== 'closing' ? `<div style="font-size:12px;color:#777;margin-top:3px">Progression suivante: ${f.progression_rate || 0}% - Abandon: ${f.abandon_count || 0} (${f.abandon_rate || 0}%)</div>` : ''}</div>`).join('');
    const topProductsHtml = topProducts.map(p => `<div style="display:grid;grid-template-columns:minmax(0,1fr) 70px 80px 80px;gap:8px;align-items:center;font-size:13px;padding:6px 0;border-bottom:1px solid #24242c"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#ddd">${escHtml(p.produit)}</span><span style="text-align:right;color:#aaa">${p.orders_count || 0} cmd</span><span style="text-align:right;color:#10b981">${p.delivery_rate || 0}% livre</span><span style="text-align:right;color:#f59e0b">${Number(p.revenue || 0).toFixed(0)} DT</span></div>`).join('');

    el.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px;margin-bottom:20px">
      <div class="config-section"><div class="body" style="text-align:center"><div style="font-size:28px;font-weight:700;color:#a78bfa">${s.sessions || 0}</div><div style="font-size:12px;color:#888">Conversations</div></div></div>
      <div class="config-section"><div class="body" style="text-align:center"><div style="font-size:28px;font-weight:700;color:#3b82f6">${s.total_messages || 0}</div><div style="font-size:12px;color:#888">Messages</div></div></div>
      <div class="config-section"><div class="body" style="text-align:center"><div style="font-size:28px;font-weight:700;color:#10b981">${s.total_commandes || 0}</div><div style="font-size:12px;color:#888">Commandes chat</div></div></div>
      <div class="config-section"><div class="body" style="text-align:center"><div style="font-size:28px;font-weight:700;color:#f59e0b">${Number(s.ca_total || 0).toFixed(0)} DT</div><div style="font-size:12px;color:#888">CA chat</div></div></div>
      <div class="config-section"><div class="body" style="text-align:center"><div style="font-size:28px;font-weight:700;color:#f97316">${tauxConv}%</div><div style="font-size:12px;color:#888">Taux conversion</div></div></div>
      <div class="config-section"><div class="body" style="text-align:center"><div style="font-size:28px;font-weight:700;color:#38bdf8">${Number(orderStats.avg_order_value || s.avg_order_value || 0).toFixed(0)} DT</div><div style="font-size:12px;color:#888">Valeur moy. commande</div></div></div>
      <div class="config-section"><div class="body" style="text-align:center"><div style="font-size:28px;font-weight:700;color:#22c55e">${s.avg_messages_to_order || 0}</div><div style="font-size:12px;color:#888">Msg avant commande</div></div></div>
      <div class="config-section"><div class="body" style="text-align:center"><div style="font-size:28px;font-weight:700;color:#ef4444">${orderStats.false_cod_rate || 0}%</div><div style="font-size:12px;color:#888">Faux COD</div></div></div>
      <div class="config-section"><div class="body" style="text-align:center"><div style="font-size:28px;font-weight:700;color:#06b6d4">${s.unique_visitors || 0}</div><div style="font-size:12px;color:#888">Visiteurs uniques</div></div></div>
      <div class="config-section"><div class="body" style="text-align:center"><div style="font-size:28px;font-weight:700;color:#e879f9">${visConvRate}</div><div style="font-size:12px;color:#888">Visiteurs → Conversation</div></div></div>
    </div><div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="config-section" style="grid-column:1 / -1"><div class="head"><i class="fa-solid fa-filter"></i> Progression entonnoir & abandons</div><div class="body">${funnelHtml || '<div style="color:#666;font-size:13px">Aucune donnee</div>'}</div></div>
      <div class="config-section"><div class="head"><i class="fa-solid fa-calendar"></i> Conversations (30j)</div><div class="body">${convChart || '<div style="color:#666;font-size:13px">Aucune donnee</div>'}</div></div>
      <div class="config-section"><div class="head"><i class="fa-solid fa-chart-pie"></i> Modes A/B/C</div><div class="body">${modeChart || '<div style="color:#666;font-size:13px">Aucune donnee</div>'}</div></div>
      <div class="config-section"><div class="head"><i class="fa-solid fa-stairs"></i> Etapes detectees</div><div class="body">${stageChart || '<div style="color:#666;font-size:13px">Aucune donnee</div>'}</div></div>
      <div class="config-section" style="grid-column:1 / -1"><div class="head"><i class="fa-solid fa-ranking-star"></i> Top outils commandes</div><div class="body">${topProductsHtml || '<div style="color:#666;font-size:13px">Aucune commande</div>'}</div></div>
      <div class="config-section"><div class="head"><i class="fa-solid fa-circle-info"></i> Infos</div><div class="body" style="font-size:13px;color:#888">Periode: 30 derniers jours<br><br>Progression: sessions ayant atteint chaque etape ou une etape suivante.<br>Faux COD: statuts annule, injoignable, non qualifie ou echoue.<br>Visiteurs uniques: sessions page excluant l'admin.<br>Visiteurs → Conversation: % de visiteurs ayant envoye un message.</div></div>
    </div>`;
  } catch (e) {
    if (e.message !== 'Session expirée') {
      el.innerHTML = '<div style="color:#f87171;padding:20px;text-align:center"><i class="fa-solid fa-triangle-exclamation"></i> Erreur de chargement: ' + e.message + '</div>';
    }
  }
}

let _refreshBusy = false;
function scheduleRefresh() {
  if (currentView === 'orders' && pageTitle.textContent === 'Commandes' && !_refreshBusy) {
    _refreshBusy = true;
    refreshOrders().finally(() => { _refreshBusy = false; });
  }
}
setInterval(scheduleRefresh, 30000);
