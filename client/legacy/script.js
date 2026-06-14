window.onerror = function(msg, url, line, col, err) {
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#300;color:#f99;padding:8px;font-size:12px;z-index:9999;white-space:pre-wrap';
  d.textContent = `JS Error: ${msg} (${line}:${col})`;
  document.body.appendChild(d);
};

const messagesEl = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const galleryBtn = document.getElementById('galleryBtn');
const fileInput = document.getElementById('fileInput');
const imagePreview = document.getElementById('imagePreview');
const previewImg = document.getElementById('previewImg');
const removeImgBtn = document.getElementById('removeImgBtn');
const typingIndicator = document.getElementById('typingIndicator');

if (!messagesEl || !messageInput || !sendBtn) {
  console.error('Chat: elements essentiels manquants dans le DOM');
  throw new Error('DOM elements manquants');
}
const micBtn = document.getElementById('micBtn');
const recordingBar = document.getElementById('recordingBar');
const recTimer = document.getElementById('recTimer');

// ── Services ──
let servicesCache = [];

async function loadServices() {
  if (servicesCache.length > 0) return;
  const routeEl = document.getElementById('route-data');
  if (routeEl) {
    try {
      const data = JSON.parse(routeEl.textContent);
      if (Array.isArray(data.services) && data.services.length > 0) {
        servicesCache = data.services.map(s => ({
          ...s, price: Number(s.price) || 0, originalPrice: s.originalPrice ? Number(s.originalPrice) : null, benefits: Array.isArray(s.benefits) ? s.benefits : []
        }));
        return;
      }
    } catch (e) {}
  }
  try {
    const response = await fetchWithTimeout('/api/services', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      servicesCache = data.map(s => ({
        ...s, price: Number(s.price) || 0, originalPrice: s.originalPrice ? Number(s.originalPrice) : null, benefits: Array.isArray(s.benefits) ? s.benefits : []
      }));
    }
  } catch (err) {
    console.warn('Services distants non chargés:', err);
  }
}

// ── SPA routing ──
const spaNav = document.getElementById('spaNav');
const spaBackBtn = document.getElementById('spaBackBtn');
const spaTitle = document.getElementById('spaTitle');
const pageView = document.getElementById('pageView');
const chatHeader = document.querySelector('.chat-header');
const trustBar = document.querySelector('.trust-bar');
const chatInputArea = document.querySelector('.chat-input-area');
const chatEls = [chatHeader, trustBar, messagesEl, chatInputArea, imagePreview, recordingBar];

function parseSPAUrl() {
  const p = new URLSearchParams(window.location.search);
  const page = p.get('page') || '';
  const slug = p.get('slug') || '';
  const id = p.get('id') || '';
  if (page === 'product') return { page: 'product', slug: slug || id };
  if (page === 'service') return { page: 'service', slug: slug || id };
  if (page === 'services') return { page: 'services', slug: null };
  const routeEl = document.getElementById('route-data');
  if (routeEl) {
    try {
      const data = JSON.parse(routeEl.textContent);
      if (data.page) return { page: data.page, slug: data.slug || null };
    } catch (e) {}
  }
  const path = window.location.pathname.replace(/\/+$/, '');
  const m = path.match(/^\/(?:produit|orgonite)\/(.+)$/);
  if (m) return { page: 'product', slug: m[1] };
  const ms = path.match(/^\/service\/(.+)$/);
  if (ms) return { page: 'service', slug: ms[1] };
  if (path === '/services') return { page: 'services', slug: null };
  return { page: null, slug: null };
}

function showChat() {
  chatEls.forEach(el => { if (el) el.style.display = ''; });
  spaNav.classList.remove('visible');
  pageView.classList.remove('visible');
  pageView.innerHTML = '';
  history.replaceState(null, '', '/');
}

async function navigateTo(page, params) {
  let url;
  if (page === 'product') url = '/orgonite/' + (params?.slug || '');
  else if (page === 'services') url = '/services';
  else if (page === 'service') url = '/service/' + (params?.slug || '');
  else url = '/';
  history.pushState({ page, params }, '', url);
  await renderSPAPage(page, params);
}

async function renderSPAPage(page, params) {
  chatEls.forEach(el => { if (el) el.style.display = 'none'; });
  spaNav.classList.add('visible');
  pageView.classList.add('visible');
  if (page === 'product') {
    await renderPageProduct(params?.slug);
  } else if (page === 'services') {
    await renderPageServices();
  } else if (page === 'service') {
    await renderPageService(params?.slug);
  } else {
    showChat();
  }
}

function setPageMeta(title, desc, image) {
  document.title = title + ' — Amine Conseiller Énergétique';
  let md = document.querySelector('meta[name="description"]');
  if (!md) { md = document.createElement('meta'); md.name = 'description'; document.head.appendChild(md); }
  md.content = desc;
  const og = [
    ['og:title', title],
    ['og:description', desc],
    ['og:image', image || ''],
    ['og:url', window.location.href],
    ['og:type', 'website']
  ];
  og.forEach(([prop, content]) => {
    let el = document.querySelector('meta[property="' + prop + '"]');
    if (!el) { el = document.createElement('meta'); el.setAttribute('property', prop); document.head.appendChild(el); }
    el.setAttribute('content', content);
  });
}

async function renderPageProduct(slug) {
  const product = productCatalog.find(p => p.slug === slug || p.id === slug) || productCatalog[0];
  if (!product) { showChat(); return; }
  spaTitle.textContent = product.name || 'Produit';
  injectAccentStyles(product.accentColor || '#7c3aed');
  setPageMeta(product.name, (product.benefits || '').substring(0, 150) + ' — Commandez votre ' + product.name + ' en Tunisie.', product.imageUrl);
  pageView.innerHTML = '';
  pageView.appendChild(renderCodProductPage(product, true));
}

async function renderPageServices() {
  if (!servicesCache.length) await loadServices();
  if (!servicesCache.length) { showChat(); return; }
  spaTitle.textContent = 'Services';
  setPageMeta('Services Énergétiques', 'Découvrez mes services de consultation énergétique, numérologie, nettoyage et lecture astrologique en Tunisie.');
  pageView.innerHTML = `
    <div class="services-page">
      <div class="services-hero">
        <h1>Services Énergétiques</h1>
        <p>Séances personnalisées pour t'accompagner dans ton cheminement spirituel et énergétique</p>
      </div>
      <div class="services-grid">
        ${servicesCache.map(s => `
          <div class="service-card" onclick="navigateTo('service', {slug:'${s.slug}'})" style="--accent:${s.color}">
            <div class="service-icon">${s.icon}</div>
            <h3>${escapeHtml(s.name)}</h3>
            <p class="service-subtitle">${escapeHtml(s.subtitle)}</p>
            <div class="service-meta">
              <span>⏱ ${escapeHtml(s.duration)}</span>
              <span>📋 ${escapeHtml(s.format)}</span>
            </div>
            <div class="service-price">
              ${s.originalPrice > s.price ? '<s>' + s.originalPrice + ' DT</s>' : ''}
              <strong>${s.price} DT</strong>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="services-cta">
        <p>💰 Paiement à la livraison ou par virement — <strong>réserve ta séance dès maintenant</strong></p>
        <button class="cod-main-cta" onclick="showChat()" style="max-width:300px;margin:0 auto;display:block;height:50px">💬 Discuter avec Amine</button>
      </div>
    </div>
  `;
}

async function renderPageService(slug) {
  if (!servicesCache.length) await loadServices();
  const service = servicesCache.find(s => s.slug === slug || s.id === slug);
  if (!service) { spaTitle.textContent = 'Service'; renderPageServices(); return; }
  spaTitle.textContent = service.name;
  injectAccentStyles(service.color || '#8b5cf6');
  setPageMeta(service.name, service.subtitle + ' — ' + service.description.substring(0, 120));
  pageView.innerHTML = `
    <div class="service-detail" style="--accent:${service.color}">
      <div class="sd-hero">
        <div class="sd-icon">${service.icon}</div>
        <h1>${escapeHtml(service.name)}</h1>
        <p class="sd-subtitle">${escapeHtml(service.subtitle)}</p>
      </div>
      <div class="sd-body">
        <div class="sd-description">
          <p>${escapeHtml(service.description)}</p>
        </div>
        <div class="sd-info-grid">
          <div class="sd-info-item"><span>⏱</span><div><strong>Durée</strong><p>${escapeHtml(service.duration)}</p></div></div>
          <div class="sd-info-item"><span>📋</span><div><strong>Format</strong><p>${escapeHtml(service.format)}</p></div></div>
          <div class="sd-info-item"><span>💰</span><div><strong>Prix</strong><p>${service.originalPrice > service.price ? '<s>' + service.originalPrice + ' DT</s> ' : ''}<strong style="color:#22C55E">${service.price} DT</strong></p></div></div>
        </div>
        <div class="sd-benefits">
          <h3>Ce que tu recevras</h3>
          <ul>${service.benefits.map(b => '<li>' + escapeHtml(b) + '</li>').join('')}</ul>
        </div>
        <div class="sd-cta">
          <button class="cod-main-cta" onclick="showChat()" style="height:52px">💬 Je réserve cette séance</button>
          <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:8px">Clique pour discuter avec Amine et réserver ta séance</p>
        </div>
      </div>
    </div>
  `;
}

if (spaBackBtn) {
  spaBackBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const { page } = parseSPAUrl();
    if (page === 'service') {
      navigateTo('services', {}).catch(console.warn);
    } else if (page === 'services' || page === 'product') {
      showChat();
      if (!window._chatStarted) {
        window._chatStarted = true;
        initChat().catch(console.warn);
      }
    } else {
      showChat();
    }
  });
}

window.addEventListener('popstate', () => {
  const url = parseSPAUrl();
  if (url.page) {
    renderSPAPage(url.page, { slug: url.slug }).catch(console.warn);
  } else {
    showChat();
  }
});

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeHtml(html) {
  const template = document.createElement('template');
  template.innerHTML = String(html ?? '');
  const allowedTags = new Set(['BR', 'STRONG', 'B', 'EM', 'I', 'U', 'P', 'DIV', 'SPAN', 'IFRAME', 'A']);
  const allowedAttrs = new Set(['src', 'target', 'rel', 'allow', 'allowfullscreen', 'frameborder', 'scrolling', 'style', 'href']);
  template.content.querySelectorAll('*').forEach(node => {
    if (!allowedTags.has(node.tagName)) {
      node.replaceWith(document.createTextNode(node.textContent || ''));
      return;
    }
    [...node.attributes].forEach(attr => {
      const attrName = attr.name.toLowerCase();
      if (attrName.startsWith('on') || attrName.startsWith('javascript:') || !allowedAttrs.has(attrName)) {
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

function formatChatText(text) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

// Initialize fbq queue immediately so trackPurchase() never misses an event
if (!window.fbq) {
  window.fbq = function() {
    window.fbq.callMethod ? window.fbq.callMethod.apply(window.fbq, arguments) : window.fbq.queue.push(arguments);
  };
  if (!window._fbq) window._fbq = window.fbq;
  window.fbq.push = window.fbq;
  window.fbq.loaded = true;
  window.fbq.version = '2.0';
  window.fbq.queue = [];
}

// Also initialize gtag queue
window.dataLayer = window.dataLayer || [];
window.gtag = window.gtag || function(){ window.dataLayer.push(arguments); };

function fetchWithTimeout(url, opts = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  opts.signal = controller.signal;
  return fetch(url, opts).finally(() => clearTimeout(id));
}

function injectScript(src, attrs = {}) {
  if (document.querySelector(`script[src="${src}"]`)) return;
  const script = document.createElement('script');
  script.async = true;
  script.src = src;
  script.onerror = () => console.warn('Échec chargement script:', src);
  Object.entries(attrs).forEach(([key, value]) => script.setAttribute(key, value));
  document.head.appendChild(script);
}

function loadFacebookPixels(pixelIds) {
  if (!Array.isArray(pixelIds) || pixelIds.length === 0) return;
  if (typeof window.fbq !== 'function') {
    window.fbq = function () { (window.fbq.queue = window.fbq.queue || []).push(arguments); };
  }
  injectScript('https://connect.facebook.net/en_US/fbevents.js');
  pixelIds.forEach(id => {
    window.fbq('init', id);
    window.fbq('trackSingle', id, 'PageView');
  });
}

function loadGoogleAnalytics(measurementIds) {
  if (!Array.isArray(measurementIds) || measurementIds.length === 0) return;
  if (typeof window.gtag !== 'function') {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
  }
  window.gtag('js', new Date());
  measurementIds.forEach((id, index) => {
    if (index === 0) injectScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`);
    window.gtag('config', id);
  });
}

function trackPurchase(order) {
  if (!order || !order.id || order.created === false || trackedPurchaseIds.has(order.id)) return;
  trackedPurchaseIds.add(order.id);

  const value = Number(order.totalCommande ?? order.prixProduit ?? 0);
  const qty = Number(order.nombreArticles) || 1;
  const unitPrice = qty > 1 ? Math.round((value / qty) * 100) / 100 : value;
  const currency = 'TND';
  const productName = order.produit || 'Commande Orgonite';

  if (window.fbq) {
    window.fbq('track', 'Purchase', {
      value, currency,
      content_name: productName,
      content_type: 'product',
      order_id: order.id,
      num_items: qty,
      contents: [{ id: order.id, quantity: qty }]
    }, { eventID: order.id });
  }

  if (window.gtag) {
    window.gtag('event', 'purchase', {
      transaction_id: order.id, value, currency,
      items: [{ item_name: productName, price: unitPrice, quantity: qty }]
    });
  }
}

function adminChatHeaders() {
  const token = sessionStorage.getItem('admin_token') || localStorage.getItem('admin_token');
  return token ? { 'Authorization': 'Bearer ' + token } : {};
}

function trackVisit() {
  const url = window.location.pathname + window.location.search || '/';
  fetch('/api/track-visit?url=' + encodeURIComponent(url), {
    method: 'GET', cache: 'no-store',
    headers: { ...adminChatHeaders() }
  }).catch(() => {});
}

async function loadTrackingConfig() {
  trackVisit();
  try {
    const response = await fetchWithTimeout('/api/tracking', { cache: 'no-store' });
    if (!response.ok) return;
    const tracking = await response.json();
    loadFacebookPixels(tracking.facebookPixelIds);
    loadGoogleAnalytics(tracking.googleAnalyticsIds);
    if (tracking.welcomeMessage) {
      const el = document.getElementById('welcomeText');
      if (el) {
        const meta = el.querySelector('.msg-meta');
        const textContainer = document.createElement('div');
        textContainer.className = 'amine-text';
        el.insertBefore(textContainer, meta);
        const msg = sanitizeHtml(tracking.welcomeMessage);
        el.style.display = 'none';
        setTimeout(() => {
          el.style.display = '';
          textContainer.innerHTML = msg;
        }, 600);
      }
    }
  } catch (err) {
    console.warn('Tracking non chargé:', err);
  }
}

let productCatalog = [
  { id:"coeur_vert_protection", name:"Collier Cœur Vert Royale™", price:49, currency:"DT", imageUrl:"https://orgonite-tunisie.com/wp-content/uploads/2026/04/17753389517d0f.webp", benefits:"Bouclier vibratoire nomade qui repousse les énergies lourdes du quotidien, réduit la fatigue accumulée et stimule la vitalité naturelle. Malachite, Aventurine Verte, Serpentine.", taille:"3.5 cm", accentColor:"#10b981", productType:"protection", welcomeSequence:["Je sens que vous êtes ici parce que vous cherchez une protection… Quelque chose de lourd vous a suivi aujourd'hui, n'est-ce pas ? ☽","Le mauvais œil, les tensions au travail, la fatigue inexplicable… Votre aura a besoin d'un bouclier.","Laissez-moi vous montrer ce qui va vous protéger. ✦"] },
  { id:"coeur_amethyste", name:"Collier Cœur Améthyste Royale™", price:49, currency:"DT", imageUrl:"https://orgonite-tunisie.com/wp-content/uploads/2026/03/Nano_Banana_2_Luxury_product_photography_of_a_heart_shaped_orgonite_resin_pendant_centered_on_a_deep.webp", benefits:"Apporte clarté mentale, sérénité et équilibre émotionnel. Améthyste, Fluorite Violette, Quartz Cristal.", taille:"3.5 cm", accentColor:"#a855f7", productType:"spiritual", welcomeSequence:["Vous cherchez un moment de calme dans votre quotidien agité ? Les pensées qui tournent en rond, le stress qui s'accumule… Vous avez besoin de clarté.","L'Améthyste est reconnue depuis des siècles pour apaiser l'esprit et dissiper les énergies négatives.","Laissez-moi vous montrer ce qui va vous aider à retrouver la sérénité. ✦"] },
  { id:"coeur_rose_amour", name:"Collier Cœur Rose Royale™", price:49, currency:"DT", imageUrl:"https://orgonite-tunisie.com/wp-content/uploads/2026/05/ChatGPT-Image-May-5-2026-09_06_24-AM.webp", benefits:"Programmable avec votre intention pour attirer l'amour, protéger votre relation et renforcer l'énergie du cœur. Quartz Rose.", taille:"3.5 cm", accentColor:"#ec4899", productType:"love", welcomeSequence:["L'amour commence par soi-même. Mais parfois, on a besoin d'un rappel… Vous sentez que votre cœur a besoin d'être protégé ou ouvert ?","Le Quartz Rose est la pierre de l'amour inconditionnel. Elle attire, elle guérit, elle rayonne.","Ce collier a été créé pour vous accompagner dans cette énergie. ✦"] },
  { id:"cone_voiture", name:"Cône Orgonite pour Voiture", price:59, currency:"DT", imageUrl:"https://orgonite-tunisie.com/wp-content/uploads/2026/02/Gemini_Generated_Image_n086oon086oon086.webp", benefits:"Protège votre véhicule du mauvais œil et des énergies négatives. Apporte sérénité au volant. Quartz naturel de Madagascar.", taille:"3 cm", accentColor:"#f59e0b", productType:"protection", welcomeSequence:["Vous passez beaucoup de temps sur la route ? On ne choisit pas toujours les énergies qu'on croise…","Le mauvais œil au volant, les tensions dans les embouteillages… Votre véhicule a besoin d'un bouclier.","Voici la solution compacte conçue pour votre voiture. ✦"] },
  { id:"dome_abondance", name:"Dôme Orgonite Abondance", price:70, currency:"DT", imageUrl:"https://orgonite-tunisie.com/wp-content/uploads/2026/03/Gemini_Generated_Image_kyptohkyptohkypt.webp", benefits:"Purifie l'énergie de votre espace et attire l'abondance. Turquoise, Rhodonite, Cristal de Quartz.", taille:"9 cm", accentColor:"#14b8a6", productType:"abundance", welcomeSequence:["Vous avez l'impression de travailler dur sans voir les résultats arriver ? L'énergie de l'abondance commence par l'espace dans lequel vous vivez.","Un espace purifié attire les opportunités, la prospérité, la fluidité.","Ce Dôme a été conçu pour transformer l'énergie de votre intérieur. ✦"] },
  { id:"orgonite_anti_ondes", name:"Orgonite Anti-Ondes (Dôme 9cm)", price:80, currency:"DT", imageUrl:"https://orgonite-tunisie.com/wp-content/uploads/2026/03/1773221638771b.webp", benefits:"Protège des ondes électromagnétiques (WiFi, 4G/5G). Améliore le sommeil, réduit le stress. 9 couches, améthyste, tourmaline, quartz.", taille:"9 cm", accentColor:"#6366f1", productType:"protection", welcomeSequence:["Vous dormez mal ? Maux de tête fréquents ? Fatigue inexplicable ? Les ondes WiFi et 4G/5G traversent nos murs sans qu'on le sache.","Ce n'est pas de la paranoïa — c'est de la prévention. Votre corps vous remerciera.","Ce Dôme neutralise les ondes électromagnétiques de votre espace. ✦"] },
  { id:"orgonite_islamique", name:"Orgonite Islamique Personnalisé", price:80, currency:"DT", imageUrl:"https://orgonite-tunisie.com/wp-content/uploads/2026/03/177478574547d8.webp", benefits:"Allie orgone et versets coraniques pour Baraka et protection spirituelle. 17 intentions disponibles. Fabriqué sur commande.", accentColor:"#65a30d", productType:"islamic", welcomeSequence:["La protection spirituelle est essentielle dans notre vie quotidienne. Vous cherchez à renforcer votre Baraka et à éloigner le mauvais œil par la Grâce d'Allah ?","Notre Orgonite Islamique allie les vertus des pierres naturelles et la force des versets coraniques.","Découvrez ce modèle conçu pour vous protéger et vous bénir. ✦"] },
  { id:"orgonedisc_recharge", name:"OrgonDisc Fleur de Vie", price:50, currency:"DT", imageUrl:"https://orgonite-tunisie.com/wp-content/uploads/2026/04/17754938878cdc.webp", benefits:"Recharge et purifie tous vos bracelets en cristaux pendant votre sommeil. Compatible avec toutes les pierres (améthyste, labradorite, citrine, quartz rose, etc.). Ne nécessite pas de pierres supplémentaires. Intègre la Fleur de Vie pour une programmation d'intention vibratoire. ⌀ 12cm.", taille:"12 cm", accentColor:"#06b6d4", productType:"accessory", welcomeSequence:["Vous avez déjà des bracelets en pierres naturelles ? Saviez-vous qu'ils ont besoin d'être rechargés régulièrement pour garder leur puissance ?","Sans recharge, vos pierres perdent leur efficacité après quelques semaines.","Ce disque Fleur de Vie rechargera tous vos cristaux en une nuit. ✦"] },
  { id:"orgonite_perso", name:"Orgonite Personnalisée", price:76, currency:"DT", imageUrl:"https://orgonite-tunisie.com/wp-content/uploads/2026/05/perso.webp", benefits:"Composée sur mesure selon votre profil astrologique et numérologique. Analyse vibratoire personnalisée + feuille de profil + activation guidée. Prix selon format : 76 DT collier, 79 DT cône voiture, 89 DT dôme.", accentColor:"#d946ef", productType:"custom", welcomeSequence:["Vous êtes unique, votre protection也应该 l'être. Votre profil astrologique et numérologique révèle les pierres exactes dont vous avez besoin.","Chaque combinaison est calculée avec précision pour aligner votre énergie personnelle avec les cristaux.","Laissez-moi créer la pièce unique qui vous correspond. ✦"] }
];

let conversationHistory = [];
let selectedImageData = null;
let isProcessing = false;
let welcomeLock = false;
let pendingProductId = null;
let currentProduct = null;
let conversationMode = 'A';
const trackedPurchaseIds = new Set();

function pushHistory(msg) {
  conversationHistory.push(msg);
  if (conversationHistory.length > 60) {
    conversationHistory.splice(0, conversationHistory.length - 60);
  }
}


function isoToChatTime(timestamp) {
  const date = timestamp ? new Date(timestamp) : new Date();
  if (Number.isNaN(date.getTime())) return 'Maintenant';
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function stripInternalPromptTags(text) {
  return String(text || '')
    .replace(/\[(?:MODE A|MODE B|MODE C)\]\s*/gi, '')
    .replace(/\[INSTRUCTION\][\s\S]*?\[\/INSTRUCTION\]\s*/gi, '')
    .trim();
}

function cleanBotText(text) {
  return stripInternalPromptTags(text)
    .replace(/\[RENDER_PRODUCT:\s*[a-zA-Z0-9_]+\]/g, '')
    .trim();
}

function normalizeForMatch(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[œŒ]/g, 'oe')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[™®©]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cartItemFromProduct(product) {
  if (!product) return null;
  return {
    id: product.id || '',
    name: product.name || '',
    quantity: 1,
    unit_price: Number(product.price) || 0,
    currency: product.currency || 'DT'
  };
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function money(value) {
  return `${Math.round(toNumber(value) * 100) / 100} DT`;
}

function productImage(product) {
  return product.image_url || product.imageUrl || '';
}

function productOriginalPrice(product) {
  const price = toNumber(product.price);
  return toNumber(product.price_original || product.priceOriginal, price + Math.max(20, Math.round(price * 0.35)));
}

function productSavings(product) {
  return Math.max(0, productOriginalPrice(product) - toNumber(product.price));
}

function productStock(product) {
  return Math.max(3, Math.min(18, toNumber(product.stock, Math.floor(Math.random() * 8) + 6)));
}

function productViewers(product) {
  return Math.max(8, Math.min(39, toNumber(product.viewers, Math.floor(Math.random() * 18) + 12)));
}

function productUpsellPrice(product) {
  return toNumber(product.upsell_price || product.upsellPrice, Math.max(1, (toNumber(product.price) * 2) - 8));
}

function normalizeBenefits(product) {
  if (Array.isArray(product.benefits)) return product.benefits.slice(0, 3);
  const text = String(product.benefits || '');
  const chunks = text.split(/[.;]\s+/).filter(Boolean);
  const defaults = [
    { icon: '🛡️', title: 'Protection immédiate', description: `${chunks[0] || 'Tu te sens plus protégée face aux énergies lourdes du quotidien.'}` },
    { icon: '😴', title: 'Calme intérieur', description: `${chunks[1] || 'Tu retrouves une sensation de calme quand les pensées deviennent trop présentes.'}` },
    { icon: '✨', title: 'Énergie retrouvée', description: `${chunks[2] || 'Tu avances avec une intention plus claire et une énergie plus stable.'}` }
  ];
  return defaults;
}

function normalizeReviews(product) {
  if (Array.isArray(product.reviews) && product.reviews.length) return product.reviews.slice(0, 3);
  return [
    { name: 'Meriem', city: 'Tunis', rating: 5, text: 'Je me sens plus légère depuis que je le porte. Livraison rapide et paiement à la réception.' },
    { name: 'Sarra', city: 'Sousse', rating: 5, text: 'J’étais hésitante, mais l’équipe m’a appelée avant la livraison. Très sérieux.' },
    { name: 'Ines', city: 'Nabeul', rating: 5, text: 'Belle énergie, bien emballé, et zéro surprise sur le prix à la livraison.' }
  ];
}

function normalizeFaq(product) {
  if (Array.isArray(product.faq) && product.faq.length) return product.faq.slice(0, 3);
  return [
    { question: 'Est-ce que ça marche vraiment ?', answer: 'Les clientes parlent surtout d’un ressenti plus léger et plus protégé. Meriem de Tunis dit qu’elle le porte chaque jour depuis sa livraison.' },
    { question: 'Combien de temps pour la livraison ?', answer: 'La livraison prend généralement 2 à 4 jours ouvrés selon la région. Tunis, Ariana et Ben Arous sont souvent plus rapides.' },
    { question: 'Est-ce que je peux refuser à la livraison ?', answer: 'Tu peux vérifier ton colis, mais confirme seulement si tu es sérieuse. Un refus COD bloque le livreur et pénalise les vraies clientes.' }
  ];
}

function clearChatMessages() {
  [...messagesEl.children].forEach(child => {
    if (child.id !== 'scrollAnchor') child.remove();
  });
  scrollChatToBottom('auto', true);
}

function isNearChatBottom(threshold = 160) {
  return messagesEl.scrollHeight - messagesEl.scrollTop - messagesEl.clientHeight <= threshold;
}

function scrollChatToBottom(behavior = 'smooth', force = false) {
  if (!messagesEl) return;
  if (!force && !isNearChatBottom()) return;
  requestAnimationFrame(() => {
    messagesEl.scrollTo({
      top: messagesEl.scrollHeight,
      behavior
    });
  });
}

function inferSalesStep(text, hasOrder = false) {
  const value = String(text || '').toLowerCase();
  if (hasOrder || value.includes('<order>') || value.includes('commande confirmee')) return 'Closing';
  if (value.includes('livraison offerte') || value.includes('2 articles') || value.includes('reduction') || value.includes('offre')) return 'Upsell';
  if (/\[render_product:\s*\w+\]/i.test(value) || value.includes('modele') || value.includes('prix')) return 'Argumentation';
  if (value.includes('telephone') || value.includes('téléphone') || value.includes('adresse') || value.includes('gouvernorat') || value.includes('nom')) return 'Qualification';
  if (value.includes('besoin') || value.includes('ressenti') || value.includes('cherchez') || value.includes('proteger')) return 'Ecoute';
  return 'Accueil';
}

function autoResize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

messageInput.addEventListener('input', () => {
  autoResize(messageInput);
  updateSendButton();
});

messageInput.addEventListener('paste', (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  let hasImage = false;
  for (const item of items) {
    if (item.type.startsWith('image/')) { hasImage = true; break; }
  }
  if (!hasImage) return;
  e.preventDefault();
  const text = e.clipboardData.getData('text/plain');
  if (text) {
    const start = messageInput.selectionStart;
    const end = messageInput.selectionEnd;
    const val = messageInput.value;
    messageInput.value = val.substring(0, start) + text + val.substring(end);
    messageInput.selectionStart = messageInput.selectionEnd = start + text.length;
    autoResize(messageInput);
    updateSendButton();
  }
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) addImagePreview(file);
      break;
    }
  }
});

messageInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

function updateSendButton() {
  const hasText = messageInput.value.trim().length > 0;
  const hasImage = selectedImageData !== null;
  sendBtn.disabled = !(hasText || hasImage);
  if (!sendBtn.disabled) sendBtn.classList.add('active');
}

function addMessage(role, text, imageDataUrl, options = {}) {
  const div = document.createElement('div');
  const visibleText = stripInternalPromptTags(text);
  const shouldFollow = role === 'user' || role === 'error' || isNearChatBottom();

  if (role === 'error') {
    div.className = 'bubble bubble-error';
    div.textContent = visibleText;
    messagesEl.insertBefore(div, document.getElementById('scrollAnchor'));
    scrollChatToBottom('smooth', shouldFollow);
    return;
  }

  div.className = `bubble ${role === 'user' ? 'bubble-user' : 'bubble-amine'}`;
  div.innerHTML = formatChatText(visibleText);

  if (imageDataUrl) {
    const img = document.createElement('img');
    img.className = 'chat-image';
    img.src = imageDataUrl;
    img.alt = 'Image jointe';
    div.appendChild(img);
  }

  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  meta.textContent = isoToChatTime(options.timestamp);
  div.appendChild(meta);

  messagesEl.insertBefore(div, document.getElementById('scrollAnchor'));
  scrollChatToBottom('smooth', shouldFollow);
}

window.sendOrderIntent = async function(productName) {
  if (isProcessing || welcomeLock) return;

  const text = `Je veux commander le modèle : ${productName}`;

  addMessage('user', text, null);

  pushHistory({
    role: 'user', text, imageBase64: null, imageMimeType: null
  });

  isProcessing = true;
  sendBtn.disabled = true;
  const t0 = Date.now();
  showTyping();

  try {
    const response = await fetchWithTimeout('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...adminChatHeaders() },
      body: JSON.stringify({
        message: text,
        imageBase64: null,
        imageMimeType: null,
        productId: pendingProductId || currentProduct?.id || null,
        productType: currentProduct?.productType || 'general',
        conversationMode,
        orderConfirmed: true,
        history: conversationHistory.slice(0, -1).map(msg => ({
          role: msg.role, text: msg.text,
          imageBase64: msg.imageBase64, imageMimeType: msg.imageMimeType
        }))
      })
    });
    pendingProductId = null;

    const data = await response.json();
    if (data.error) {
      hideTyping();
      addMessage('error', data.error);
      conversationHistory.pop();
      isProcessing = false;
      updateSendButton();
      return;
    }

    const elapsed = Date.now() - t0;
    const step = inferSalesStep(data.reply, Boolean(data.order));
    afficherMessageAmine(data.reply, data.products || (data.product ? [data.product] : []), { step, hasOrder: Boolean(data.order), elapsed });
    if (data.order) trackPurchase(data.order);

    pushHistory({
      role: 'model',
      text: cleanBotText(data.reply),
      imageBase64: null, imageMimeType: null
    });
  } catch (err) {
    hideTyping();
    addMessage('error', 'Erreur de connexion au serveur.');
    conversationHistory.pop();
    pendingProductId = null;
  }

  isProcessing = false;
  updateSendButton();
};

function humanizeDelay(len) {
  return Math.min(4500, Math.max(800, len * 65));
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function afficherMessageAmine(apiResponseText, apiProducts = [], options = {}) {
  const productRegex = /\[RENDER_PRODUCT:\s*([a-zA-Z0-9_]+)\]/g;
  let match;
  const extractedIds = [];

  while ((match = productRegex.exec(apiResponseText)) !== null) {
    extractedIds.push(match[1]);
  }
  const apiProductIds = Array.isArray(apiProducts)
    ? apiProducts.map(p => p && (p.id || p.slug)).filter(Boolean)
    : [];

  let cleanedText = cleanBotText(apiResponseText);
  const inferredProducts = apiProductIds.length || extractedIds.length
    ? []
    : inferProductsFromText(cleanedText);
  const inferredProductIds = inferredProducts.map(p => p.id || p.slug).filter(Boolean);
  const productIdsToRender = [...new Set([...extractedIds, ...apiProductIds, ...inferredProductIds])];
  let formattedHtml = formatChatText(cleanedText);

  const messageBubble = document.createElement('div');
  messageBubble.className = 'bubble bubble-amine';

  const textContainer = document.createElement('div');
  textContainer.className = 'amine-text';
  messageBubble.appendChild(textContainer);

  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  meta.textContent = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  messageBubble.appendChild(meta);

  const anchor = document.getElementById('scrollAnchor');
  messagesEl.insertBefore(messageBubble, anchor);
  scrollChatToBottom('smooth', true);

  const elapsed = options.elapsed || 0;
  const totalDelay = humanizeDelay(cleanedText.length);
  const remaining = Math.max(100, totalDelay - elapsed);

  setTimeout(() => {
    hideTyping();
    textContainer.innerHTML = formattedHtml;
    scrollChatToBottom('smooth', true);
    if (productIdsToRender.length > 0) {
      const delay = options.cardDelay || 600;
      productIdsToRender.forEach((id, i) => {
        setTimeout(() => {
          const apiProduct = Array.isArray(apiProducts) ? apiProducts.find(p => p && (p.id === id || p.slug === id)) : null;
          const inferredProduct = inferredProducts.find(p => p && (p.id === id || p.slug === id));
          const product = apiProduct || inferredProduct || productCatalog.find(p => p.id === id || p.slug === id);
          if (!product) return;
          messagesEl.insertBefore(renderProductCardWithButtons(product), anchor);
          scrollChatToBottom('smooth', true);
        }, delay + i * 200);
      });
    }
  }, remaining);
}

function inferProductsFromText(text) {
  const normalizedText = normalizeForMatch(text);
  if (!normalizedText || !Array.isArray(productCatalog) || !productCatalog.length) return [];

  const aliasesById = {
    orgonite_islamique: ['protection islamique', 'orgonite islamique', 'baraka', 'verset', 'coran', 'mauvais oeil islamique'],
    orgonite_anti_ondes: ['anti ondes', 'anti onde', 'ondes electromagnetiques', 'wifi', 'wi fi', '4g', '5g', 'sommeil', 'emf'],
    coeur_rose_amour: ['quartz rose', 'coeur rose', 'collier coeur quartz rose', 'collier quartz rose', 'collier amour', 'amour', 'relation', 'couple', 'blocages affectifs', 'energie du coeur'],
    dome_abondance: ['abondance', 'prosperite', 'argent', 'opportunite', 'fluidite', 'dome abondance'],
    cone_voiture: ['voiture', 'vehicule', 'route', 'conduite', 'cone voiture', 'orgonite voiture'],
    orgonite_perso: ['personnalisee', 'personnalise', 'sur mesure', 'astrologique', 'numerologique', 'profil vibratoire'],
    orgonedisc_recharge: ['orgondisc', 'fleur de vie', 'recharge', 'recharger', 'purifie', 'bracelet', 'cristaux'],
    coeur_amethyste: ['amethyste', 'clarte mentale', 'serenite', 'equilibre emotionnel', 'collier violet'],
    coeur_vert_protection: ['collier protection', 'collier de protection', 'coeur vert', 'collier vert', 'protection', 'proteger', 'bouclier', 'mauvais oeil', 'fatigue', 'stress', 'energies lourdes']
  };

  let best = null;
  productCatalog.forEach(product => {
    const generatedAliases = [
      String(product.id || '').replace(/_/g, ' '),
      product.slug || '',
      product.name || '',
      String(product.name || '').replace(/\b(royale|royal|tm)\b/gi, '')
    ];
    const configuredAliases = aliasesById[product.id] || [];
    [...generatedAliases, ...configuredAliases]
      .map(normalizeForMatch)
      .filter(alias => alias.length >= 4)
      .forEach(alias => {
        if (!normalizedText.includes(alias)) return;
        const configured = configuredAliases.map(normalizeForMatch).includes(alias);
        const score = alias.length + (configured ? 40 : 0);
        if (!best || score > best.score) best = { product, score };
      });
  });

  return best ? [best.product] : [];
}

function showTyping() {
  const anchor = document.getElementById('scrollAnchor');
  messagesEl.insertBefore(typingIndicator, anchor);
  typingIndicator.style.display = 'flex';
  scrollChatToBottom('smooth', true);
}

function hideTyping() {
  typingIndicator.style.display = 'none';
}

function addImagePreview(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    selectedImageData = {
      dataUrl,
      base64: dataUrl.split(',')[1],
      mimeType: file.type
    };
    previewImg.src = dataUrl;
    imagePreview.style.display = 'block';
    updateSendButton();
  };
  reader.onerror = () => {
    console.warn('Erreur lecture image');
    removeImage();
  };
  reader.readAsDataURL(file);
}

function removeImage() {
  selectedImageData = null;
  imagePreview.style.display = 'none';
  previewImg.src = '';
  fileInput.value = '';
  updateSendButton();
}

galleryBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) addImagePreview(file);
});

removeImgBtn.addEventListener('click', removeImage);

sendBtn.addEventListener('click', sendMessage);

async function sendMessage() {
  const text = messageInput.value.trim();
  const imageData = selectedImageData;

  if (!text && !imageData) return;
  if (isProcessing || welcomeLock) return;
  welcomeLock = true;

  if (text) {
    addMessage('user', text, imageData?.dataUrl || null);
  } else if (imageData) {
    addMessage('user', '(Image envoyée)', imageData.dataUrl);
  }

  pushHistory({
    role: 'user',
    text: text,
    imageBase64: imageData?.base64 || null,
    imageMimeType: imageData?.mimeType || null
  });

  messageInput.value = '';
  messageInput.style.height = 'auto';
  if (imageData) removeImage();
  updateSendButton();
  isProcessing = true;
  sendBtn.disabled = true;
  const t0 = Date.now();
  showTyping();

  try {
    const response = await fetchWithTimeout('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...adminChatHeaders() },
      body: JSON.stringify({
        message: text,
        imageBase64: imageData?.base64 || null,
        imageMimeType: imageData?.mimeType || null,
        productId: pendingProductId,
        productType: currentProduct?.productType || 'general',
        conversationMode,
        orderConfirmed: false,
        history: conversationHistory.slice(0, -1).map(msg => ({
          role: msg.role, text: msg.text,
          imageBase64: msg.imageBase64, imageMimeType: msg.imageMimeType
        }))
      })
    });
    pendingProductId = null;

    const data = await response.json();

    if (data.error) {
      hideTyping();
      addMessage('error', String(data.error));
      conversationHistory.pop();
      return;
    }

    const elapsed = Date.now() - t0;
    const step = inferSalesStep(data.reply, Boolean(data.order));
    afficherMessageAmine(data.reply, data.products || (data.product ? [data.product] : []), { step, hasOrder: Boolean(data.order), elapsed });
    if (data.order) {
      trackPurchase(data.order);
    }

    pushHistory({
      role: 'model',
      text: cleanBotText(data.reply),
      imageBase64: null, imageMimeType: null
    });

  } catch (err) {
    hideTyping();
    addMessage('error', 'Erreur de connexion au serveur. Vérifiez que le serveur est bien démarré.');
    conversationHistory.pop();
    pendingProductId = null;
  } finally {
    isProcessing = false;
    updateSendButton();
    welcomeLock = false;
  }
}

// ─── Messenger-style Welcome Sequence ────────────────────

window.learnMoreProduct = async function(productName) {
  messageInput.value = `Je veux en savoir plus sur ${productName}`;
  autoResize(messageInput);
  updateSendButton();
  sendMessage();
};

function injectCodProductStyles() {
  if (document.getElementById('cod-product-styles')) return;
  const style = document.createElement('style');
  style.id = 'cod-product-styles';
  style.textContent = `
    .cod-product-page {
      width: min(100%, 430px);
      margin: 8px auto 16px;
      background: #0D1B2A;
      color: #F8F6F0;
      border: 1px solid rgba(212, 168, 67, 0.16);
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 24px 70px rgba(0, 0, 0, 0.45);
      font-size: 15px;
      line-height: 1.7;
      animation: messageIn 0.35s ease;
    }
    .cod-product-page * { letter-spacing: 0; }
    .cod-hero {
      position: relative;
      min-height: 0;
      max-height: 340px;
      background: #08111d;
      display: flex;
      align-items: stretch;
      overflow: hidden;
    }
    .cod-hero-img {
      width: 100%;
      aspect-ratio: 4 / 5;
      height: auto;
      min-height: 0;
      max-height: 340px;
      object-fit: cover;
      display: block;
    }
    .cod-hero::after {
      content: '';
      position: absolute;
      inset: auto 0 0;
      height: 48%;
      background: linear-gradient(180deg, transparent, rgba(13, 27, 42, 0.96));
      pointer-events: none;
    }
    .cod-hero-badges {
      position: absolute;
      top: 12px;
      left: 12px;
      right: 12px;
      z-index: 2;
      display: grid;
      gap: 7px;
      justify-items: start;
    }
    .cod-live-badge, .cod-stock-badge {
      max-width: 100%;
      padding: 7px 10px;
      border-radius: 999px;
      background: rgba(8, 17, 29, 0.78);
      border: 1px solid rgba(248, 246, 240, 0.14);
      color: #F8F6F0;
      font-size: 12px;
      font-weight: 700;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }
    .cod-live-badge { animation: viewerPulse 2.2s ease-in-out infinite; }
    .cod-stock-badge { color: #FCA5A5; }
    @keyframes viewerPulse {
      0%, 100% { transform: scale(1); box-shadow: 0 0 0 rgba(212, 168, 67, 0); }
      50% { transform: scale(1.025); box-shadow: 0 0 22px rgba(212, 168, 67, 0.24); }
    }
    .cod-hero-content {
      position: absolute;
      z-index: 2;
      left: 16px;
      right: 16px;
      bottom: 18px;
    }
    .cod-title {
      font-size: clamp(22px, 6vw, 28px);
      line-height: 1.15;
      font-weight: 800;
      margin-bottom: 10px;
      text-shadow: 0 2px 20px rgba(0, 0, 0, 0.55);
    }
    .cod-price-row {
      display: flex;
      align-items: baseline;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 4px;
    }
    .cod-price-old {
      color: #6B7280;
      text-decoration: line-through;
      font-weight: 700;
      font-size: 16px;
    }
    .cod-price-now {
      color: #22C55E;
      font-size: 22px;
      font-weight: 800;
    }
    .cod-saving { color: #D4A843; font-size: 14px; font-weight: 700; }
    .cod-above-fold-cod {
      display: inline-flex;
      margin-top: 9px;
      padding: 7px 10px;
      border-radius: 999px;
      background: rgba(34, 197, 94, 0.14);
      border: 1px solid rgba(34, 197, 94, 0.34);
      color: #DCFCE7;
      font-size: 12px;
      font-weight: 800;
    }
    .cod-section { padding: 18px 16px; border-top: 1px solid rgba(248, 246, 240, 0.07); }
    .cod-hook strong { display: block; font-size: 21px; line-height: 1.3; margin-bottom: 8px; }
    .cod-hook p { color: #A0A8B8; }
    .cod-trust-strip {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding: 12px 16px;
      scrollbar-width: none;
      border-top: 1px solid rgba(248, 246, 240, 0.07);
      border-bottom: 1px solid rgba(248, 246, 240, 0.07);
    }
    .cod-trust-strip::-webkit-scrollbar { display: none; }
    .cod-trust-badge {
      flex: 0 0 auto;
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      padding: 8px 10px;
      border-radius: 8px;
      background: #152338;
      color: #F8F6F0;
      border: 1px solid rgba(124, 58, 237, 0.24);
      font-size: 12px;
      font-weight: 700;
      white-space: nowrap;
    }
    .cod-benefit {
      display: grid;
      grid-template-columns: 34px 1fr;
      gap: 10px;
      padding: 12px 0;
      border-bottom: 1px solid rgba(248, 246, 240, 0.06);
    }
    .cod-benefit:last-child { border-bottom: 0; }
    .cod-benefit-icon { font-size: 23px; line-height: 1; }
    .cod-benefit-title { font-weight: 800; font-size: 15px; }
    .cod-benefit-desc { color: #A0A8B8; font-size: 14px; line-height: 1.55; }
    .cod-review-grid { display: grid; gap: 10px; }
    .cod-review {
      background: linear-gradient(135deg, rgba(124, 58, 237, 0.14), rgba(34, 197, 94, 0.10));
      border: 1px solid rgba(248, 246, 240, 0.08);
      border-radius: 8px;
      padding: 12px;
    }
    .cod-review-head { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; font-weight: 800; }
    .cod-stars { color: #D4A843; white-space: nowrap; }
    .cod-review p { color: #D8DEE9; font-size: 13px; line-height: 1.55; margin-top: 5px; }
    .cod-live-order {
      margin-top: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      background: rgba(34, 197, 94, 0.13);
      border: 1px solid rgba(34, 197, 94, 0.27);
      color: #DCFCE7;
      font-size: 13px;
      transform: translateY(0);
      transition: opacity 0.28s, transform 0.28s;
    }
    .cod-live-order.is-refreshing { opacity: 0; transform: translateY(14px); }
    .cod-offer-grid { display: grid; gap: 10px; }
    .cod-offer {
      position: relative;
      min-height: 64px;
      border-radius: 8px;
      border: 1px solid rgba(248, 246, 240, 0.10);
      background: #152338;
      padding: 12px;
    }
    .cod-offer.is-popular { border-color: rgba(212, 168, 67, 0.75); box-shadow: inset 0 0 0 1px rgba(212, 168, 67, 0.20); }
    .cod-popular-badge {
      position: absolute;
      top: -10px;
      right: 10px;
      background: #D4A843;
      color: #0D1B2A;
      border-radius: 999px;
      padding: 3px 8px;
      font-size: 11px;
      font-weight: 900;
    }
    .cod-offer-title { font-weight: 800; }
    .cod-offer-sub { color: #A0A8B8; font-size: 13px; }
    .cod-qty-row { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; }
    .cod-qty-control { display: flex; align-items: center; gap: 8px; }
    .cod-qty-btn {
      width: 44px;
      height: 44px;
      border: 0;
      border-radius: 8px;
      background: #7C3AED;
      color: #fff;
      font-size: 20px;
      font-weight: 800;
      cursor: pointer;
    }
    .cod-qty-value { min-width: 36px; text-align: center; font-weight: 900; font-size: 18px; }
    .cod-sticky-cta {
      position: sticky;
      bottom: 0;
      z-index: 4;
      padding: 10px 12px max(10px, env(safe-area-inset-bottom));
      background: linear-gradient(180deg, rgba(13, 27, 42, 0.76), #0D1B2A 28%);
      border-top: 1px solid rgba(248, 246, 240, 0.08);
    }
    .cod-main-cta {
      width: 100%;
      height: 56px;
      border: 0;
      border-radius: 12px;
      background: #7C3AED;
      color: #fff;
      font-size: 16px;
      font-weight: 900;
      cursor: pointer;
      box-shadow: 0 14px 30px rgba(124, 58, 237, 0.28);
      transition: transform 0.14s ease;
    }
    .cod-main-cta:active { transform: scale(0.97); }
    .cod-cta-note { text-align: center; color: #A0A8B8; font-size: 11px; margin-top: 6px; font-weight: 800; }
    .cod-form-grid { display: grid; gap: 10px; }
    .cod-form-grid label { display: grid; gap: 5px; color: #A0A8B8; font-size: 12px; font-weight: 800; }
    .cod-form-grid input, .cod-form-grid select {
      width: 100%;
      min-height: 44px;
      border: 1px solid rgba(248, 246, 240, 0.12);
      border-radius: 8px;
      background: rgba(255,255,255,0.04);
      color: #F8F6F0;
      padding: 10px 12px;
      font-size: 15px;
      outline: none;
    }
    .cod-form-grid select option { color: #0D1B2A; }
    .cod-form-commit { color: #A0A8B8; font-size: 12px; line-height: 1.55; margin: 12px 0; }
    @media (min-width: 680px) {
      .cod-product-page { width: min(100%, 560px); }
      .cod-hero, .cod-hero-img { max-height: 440px; }
      .cod-section { padding: 22px; }
    }

    /* ── Full page overrides ── */
    .cod-product-page.is-fullpage {
      width: 100%; max-width: 100%;
      margin: 0; border-radius: 0; border: none;
      box-shadow: none; background: transparent;
      animation: none;
    }
    .cod-product-page.is-fullpage .cod-hero {
      min-height: 0;
      max-height: 520px;
    }
    .cod-product-page.is-fullpage .cod-hero-img {
      min-height: 0;
      max-height: 520px;
      aspect-ratio: 4 / 3;
    }
    .cod-product-page.is-fullpage .cod-hero-badges {
      top: 16px; left: 16px; right: 16px;
    }
    .cod-product-page.is-fullpage .cod-hero-content {
      left: 20px; right: 20px; bottom: 24px;
    }
    .cod-product-page.is-fullpage .cod-sticky-cta {
      position: fixed; bottom: 0; left: 50%; transform: translateX(-50%);
      z-index: 50; width: 100%; max-width: 768px;
      background: linear-gradient(180deg, rgba(7,7,13,0.85), #07070d 20%);
      border-top: 1px solid rgba(140,110,255,0.12);
    }
    .cod-product-page.is-fullpage .cod-sticky-cta-inner {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 14px max(8px, env(safe-area-inset-bottom));
    }
    .cod-product-page.is-fullpage .cod-sticky-price {
      flex-shrink: 0; text-align: right;
    }
    .cod-product-page.is-fullpage .cod-sticky-price-old {
      font-size: 11px; color: #6B7280; text-decoration: line-through;
    }
    .cod-product-page.is-fullpage .cod-sticky-price-now {
      font-size: 17px; font-weight: 800; color: #22C55E; display: block;
    }
    .cod-product-page.is-fullpage .cod-sticky-qty {
      display: flex; align-items: center; gap: 6px;
    }
    .cod-product-page.is-fullpage .cod-sticky-qty button {
      width: 36px; height: 36px; border: 0; border-radius: 8px;
      background: rgba(124,58,237,0.2); color: #e0e0e0;
      font-size: 18px; font-weight: 700; cursor: pointer;
      transition: background 0.15s;
    }
    .cod-product-page.is-fullpage .cod-sticky-qty button:hover { background: rgba(124,58,237,0.35); }
    .cod-product-page.is-fullpage .cod-sticky-qty span {
      min-width: 28px; text-align: center; font-weight: 700; font-size: 15px;
    }
    .cod-product-page.is-fullpage .cod-main-cta {
      flex: 1; height: 48px; font-size: 15px;
      box-shadow: 0 8px 24px rgba(124,58,237,0.3);
    }
    .cod-product-page.is-fullpage .cod-cta-note { display: none; }

    /* ── Scroll animations ── */
    .cod-animate {
      opacity: 0; transform: translateY(24px);
      transition: opacity 0.6s cubic-bezier(0.16,1,0.3,1), transform 0.6s cubic-bezier(0.16,1,0.3,1);
    }
    .cod-animate.is-visible { opacity: 1; transform: translateY(0); }

    /* ── Action buttons ── */
    .cod-actions { display: flex; flex-direction: column; gap: 10px; padding: 0 16px; }
    .cod-btn {
      display: block; width: 100%; padding: 14px 20px; border: 0; border-radius: 12px;
      font-size: 15px; font-weight: 700; cursor: pointer; text-align: center;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .cod-btn:active { transform: scale(0.97); }
    .cod-btn-primary {
      background: linear-gradient(135deg, #7c3aed, #6d28d9);
      color: #fff; box-shadow: 0 4px 16px rgba(124,58,237,0.3);
    }
    .cod-btn-primary:hover { box-shadow: 0 6px 24px rgba(124,58,237,0.45); }
    .cod-btn-secondary {
      background: rgba(124,58,237,0.1); color: #c084fc;
      border: 1px solid rgba(124,58,237,0.25);
    }
    .cod-btn-secondary:hover { background: rgba(124,58,237,0.18); }

    /* ── Related products ── */
    .cod-related { padding: 20px 16px 120px; }
    .cod-related h3 { font-size: 16px; font-weight: 700; margin-bottom: 12px; color: #c084fc; }
    .cod-related-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .cod-related-item {
      background: rgba(12,12,22,0.6); border: 1px solid rgba(140,110,255,0.1);
      border-radius: 12px; overflow: hidden; cursor: pointer;
      transition: transform 0.2s, border-color 0.2s;
    }
    .cod-related-item:hover { transform: scale(1.02); border-color: rgba(140,110,255,0.3); }
    .cod-related-item img { width: 100%; aspect-ratio: 1; object-fit: cover; }
    .cod-related-item div { padding: 8px 10px; }
    .cod-related-item .name { font-size: 13px; font-weight: 600; color: #e2e8f0; }
    .cod-related-item .price { font-size: 14px; font-weight: 700; color: #22C55E; }
    .cod-related-item .price s { color: #6B7280; font-weight: 400; margin-right: 6px; }

    /* ── Social proof counter ── */
    .cod-proof-bar {
      display: flex; justify-content: center; align-items: center; gap: 6px;
      padding: 10px 16px; font-size: 12px; color: #94a3b8;
      border-top: 1px solid rgba(140,110,255,0.06);
    }
    .cod-proof-bar strong { color: #22C55E; }

    .chat-product-card {
      width: 100%; max-width: 360px;
      align-self: flex-start;
      margin: 4px 0 14px;
      border-radius: 18px;
      overflow: hidden;
      background: rgba(18, 18, 32, 0.96);
      border: 1px solid rgba(140, 110, 255, 0.18);
      box-shadow: 0 16px 42px rgba(0, 0, 0, 0.38);
      color: #e2e8f0;
      animation: cardSlideIn 0.45s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .chat-product-card img {
      width: 100%;
      aspect-ratio: 4 / 3;
      max-height: 220px;
      object-fit: cover;
      display: block;
      background: #0f172a;
    }
    .chat-product-body {
      padding: 13px 14px 14px;
    }
    .chat-product-title {
      font-size: 15px;
      font-weight: 800;
      color: #f8fafc;
      margin-bottom: 5px;
    }
    .chat-product-price {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #22c55e;
      font-size: 18px;
      font-weight: 900;
      margin-bottom: 8px;
    }
    .chat-product-benefits {
      color: #a0a8b8;
      font-size: 13px;
      line-height: 1.5;
      margin-bottom: 12px;
    }
    .chat-product-actions {
      display: grid;
      grid-template-columns: 1fr;
      gap: 8px;
    }
    .chat-product-actions .cod-btn {
      padding: 11px 14px;
      border-radius: 12px;
      font-size: 14px;
    }
  `;
  document.head.appendChild(style);
}

function renderCodProductPage(product, isFullPage) {
  injectCodProductStyles();
  const price = toNumber(product.price);
  const original = productOriginalPrice(product);
  const savings = product.savings || productSavings(product);
  const viewers = productViewers(product);
  const stock = productStock(product);
  const upsell = productUpsellPrice(product);
  const benefits = normalizeBenefits(product);
  const reviews = normalizeReviews(product);
  const hook = product.hook || 'Tu te réveilles épuisé(e) même après 8h de sommeil ?';
  const transition = product.hook_transition || 'Cet outil agit comme un filtre invisible contre les énergies lourdes qui te drainent.';

  const root = document.createElement('article');
  root.className = 'cod-product-page product-card' + (isFullPage ? ' is-fullpage' : '');
  root.dataset.productId = product.id || '';
  root.innerHTML = `
    <!-- [BLOC 1] HERO VISUEL -->
    <section class="cod-hero${isFullPage ? ' cod-animate' : ''}">
      <img class="cod-hero-img" src="${escapeHtml(productImage(product))}" alt="${escapeHtml(product.name || 'Orgonite')}" loading="${isFullPage ? 'eager' : 'lazy'}">
      <div class="cod-hero-badges">
        <span class="cod-live-badge">⏳ <span class="cod-viewers">${viewers}</span> personnes regardent</span>
        <span class="cod-stock-badge">🔴 Stock limité — <span class="cod-stock">${stock}</span> restants</span>
      </div>
      <div class="cod-hero-content">
        <h2 class="cod-title">${escapeHtml(product.name || '')}</h2>
        <div class="cod-price-row">
          <span class="cod-price-old">${money(original)}</span>
          <span class="cod-price-now">${money(price)}</span>
        </div>
        <div class="cod-saving">Vous économisez ${money(savings)} aujourd'hui</div>
        <div class="cod-above-fold-cod">Vous ne payez qu'à la réception</div>
      </div>
    </section>

    <!-- [BLOC 2] ACCROCHE ÉMOTIONNELLE -->
    <section class="cod-section cod-hook${isFullPage ? ' cod-animate' : ''}">
      <strong>${escapeHtml(hook)}</strong>
      <p>${escapeHtml(transition)}</p>
    </section>

    <!-- [BLOC 3] BADGES DE RÉASSURANCE -->
    <section class="cod-trust-strip${isFullPage ? ' cod-animate' : ''}" aria-label="Garanties">
      <span class="cod-trust-badge">✅ 4.9/5 — 1 247 avis vérifiés</span>
      <span class="cod-trust-badge">🚚 Livraison partout en Tunisie</span>
      <span class="cod-trust-badge">💳 Paiement à la livraison uniquement</span>
      <span class="cod-trust-badge">🔒 Commande 100% sécurisée</span>
    </section>

    <!-- [BLOC 4] BÉNÉFICES PRODUIT -->
    <section class="cod-section${isFullPage ? ' cod-animate' : ''}">
      ${benefits.map(b => `
        <div class="cod-benefit">
          <div class="cod-benefit-icon">${escapeHtml(b.icon || '✨')}</div>
          <div>
            <div class="cod-benefit-title">${escapeHtml(b.title || '')}</div>
            <div class="cod-benefit-desc">${escapeHtml(b.description || '')}</div>
          </div>
        </div>
      `).join('')}
    </section>

    <!-- [BLOC 5] PREUVE SOCIALE -->
    <section class="cod-section${isFullPage ? ' cod-animate' : ''}">
      <div class="cod-review-grid">
        ${reviews.map(r => `
          <div class="cod-review">
            <div class="cod-review-head">
              <span>${escapeHtml(r.name || 'Cliente')} — ${escapeHtml(r.city || 'Tunis')}</span>
              <span class="cod-stars">${'★'.repeat(Math.max(1, Math.min(5, toNumber(r.rating, 5))))}</span>
            </div>
            <p>${escapeHtml(r.text || '')}</p>
          </div>
        `).join('')}
      </div>
    </section>

    <!-- [BLOC 6] BOUTONS ACTION -->
    <section class="cod-section cod-actions${isFullPage ? ' cod-animate' : ''}">
      <button class="cod-btn cod-btn-primary" type="button" onclick="chatAboutProduct('${escapeHtml(product.id)}', 'commander')">Commander</button>
      <button class="cod-btn cod-btn-secondary" type="button" onclick="chatAboutProduct('${escapeHtml(product.id)}', 'question')">Poser une question à Amine</button>
    </section>

    <!-- [BLOC 10] RELATED PRODUCTS (full page only) -->
    ${isFullPage ? '' : ''}
  `;

  // Scroll animations for full page
  if (isFullPage) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
    root.querySelectorAll('.cod-animate').forEach(el => observer.observe(el));
  }

  return root;
}

function renderRelatedProducts(current) {
  const related = productCatalog.filter(p => p.id !== current.id && p.visible !== 0).slice(0, 4);
  if (related.length === 0) return '';
  return `
    <section class="cod-related">
      <h3>Vous aimerez aussi</h3>
      <div class="cod-related-grid">
        ${related.map(p => {
          const orig = productOriginalPrice(p);
          return `
            <div class="cod-related-item" onclick="navigateTo('product', {slug:'${escapeHtml(p.slug || p.id)}'})" role="link">
              <img src="${escapeHtml(productImage(p))}" alt="${escapeHtml(p.name)}" loading="lazy">
              <div>
                <div class="name">${escapeHtml(p.name)}</div>
                <div class="price">${orig > Number(p.price) ? '<s>' + money(orig) + '</s>' : ''}${money(p.price)}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </section>
  `;
}

function renderProductCardWithButtons(product) {
  return renderChatProductCardWithButtons(product);
}

function renderChatProductCardWithButtons(product) {
  injectCodProductStyles();
  const root = document.createElement('article');
  const productId = product.id || product.slug || '';
  const benefits = String(product.benefits || '').split('.').filter(Boolean).slice(0, 2).join('. ') || 'Un outil vibratoire a porter au quotidien.';
  root.className = 'chat-product-card';
  root.dataset.productId = productId;
  root.innerHTML = `
    <img src="${escapeHtml(productImage(product))}" alt="${escapeHtml(product.name || 'Orgonite')}" loading="lazy">
    <div class="chat-product-body">
      <div class="chat-product-title">${escapeHtml(product.name || 'Orgonite')}</div>
      <div class="chat-product-price">${money(product.price)}</div>
      <div class="chat-product-benefits">${escapeHtml(benefits)}</div>
      <div class="chat-product-actions">
        <button class="cod-btn cod-btn-primary" type="button" onclick="chatAboutProduct('${escapeHtml(productId)}', 'commander')">Commander</button>
        <button class="cod-btn cod-btn-secondary" type="button" onclick="chatAboutProduct('${escapeHtml(productId)}', 'question')">Poser une question</button>
      </div>
    </div>
  `;
  return root;
}

function chatAboutProduct(productId, action) {
  const product = productCatalog.find(p => p.id === productId || p.slug === productId);
  if (!product) return;
  currentProduct = product;
  conversationMode = product.id === 'orgonite_perso' ? 'C' : 'B';
  chatEls.forEach(el => { if (el) el.style.display = ''; });
  spaNav.classList.remove('visible');
  pageView.classList.remove('visible');
  pageView.innerHTML = '';
  const msg = action === 'commander'
    ? `Je veux commander ${product.name}`
    : `J'ai une question sur ${product.name}`;
  requestAnimationFrame(() => {
    messageInput.value = msg;
    autoResize(messageInput);
    sendMessage();
    setTimeout(() => scrollChatToBottom('smooth', true), 150);
  });
}

function afficherSuggestionsAccueil() {
  const container = document.createElement('div');
  container.className = 'quick-reply-container';

  const title = document.createElement('div');
  title.className = 'quick-reply-title';
  container.appendChild(title);

  const suggestions = [
    {
      label: "🛡️  Je veux me PROTÉGER",
      subtitle: "mauvais œil, fatigue, stress, envies",
      message: "J'ai besoin de protection. Je me sens fatigué, comme si quelque chose de lourd pesait sur moi au quotidien."
    },
    {
      label: "💜  J'ai besoin d'AMOUR",
      subtitle: "relation, cœur, confiance en soi",
      message: "Je cherche à attirer l'amour ou à renforcer une relation importante pour moi."
    },
    {
      label: "✨  Je cherche l'ABONDANCE",
      subtitle: "argent, opportunités, fluidité",
      message: "Je veux attirer l'abondance et la prospérité dans ma vie. J'ai l'impression de stagner."
    },
    {
      label: "📿  Protection ISLAMIQUE",
      subtitle: "Baraka, mauvais œil, versets",
      message: "Je cherche une protection spirituelle islamique contre le mauvais œil et pour attirer la Baraka."
    },
    {
      label: "💜  Je ne sais pas...",
      subtitle: "Guide-moi, Amine 🙏",
      message: "Je ne sais pas exactement ce que je cherche. Peux-tu m'aider à comprendre ce dont j'ai besoin ?"
    }
  ];

  messagesEl.insertBefore(container, document.getElementById('scrollAnchor'));
  scrollChatToBottom('auto', true);

  const fullTitle = "Qu'est-ce qui t'amène ? Choisis ce qui résonne avec toi 👇";
  title.textContent = fullTitle;
  suggestions.forEach((s, i) => {
    setTimeout(() => {
      const pill = document.createElement('button');
      pill.className = 'quick-reply-pill';
      pill.innerHTML = `<strong>${s.label}</strong><br><span class="pill-subtitle">${s.subtitle}</span>`;
      pill.addEventListener('click', () => {
        messageInput.value = s.message;
        autoResize(messageInput);
        sendMessage();
      });
      container.appendChild(pill);
      scrollChatToBottom('smooth', true);
    }, i * 120);
  });
}

async function startNewProspect(product, productId) {
  if (welcomeLock) return;
  welcomeLock = true;
  try {
    pendingProductId = productId;
    clearChatMessages();

    injectAccentStyles(product.accentColor || '#7c3aed');

    const messages = (product.welcomeSequence || []).slice(0, 3);
    for (const msg of messages) {
      showTyping();
      const d = humanizeDelay(msg.length);
      await sleep(d);
      hideTyping();
      addMessage('assistant', msg);
    }

    const immediateProductContainer = document.createElement('div');
    immediateProductContainer.className = 'flex flex-wrap gap-4 my-3 justify-center w-full product-card-accent';
    immediateProductContainer.appendChild(renderProductCardWithButtons(product));
    messagesEl.insertBefore(immediateProductContainer, document.getElementById('scrollAnchor'));
    scrollChatToBottom('smooth', true);
  } finally {
    welcomeLock = false;
    updateSendButton();
  }
}

function injectQuickReplyStyles() {
  if (document.getElementById('quick-reply-styles')) return;
  const style = document.createElement('style');
  style.id = 'quick-reply-styles';
  style.textContent = `
    .quick-reply-container {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      padding: 16px 0;
      justify-content: center;
    }
    .quick-reply-title {
      width: 100%;
      color: #c084fc;
      font-size: 13px;
      text-align: center;
      margin-bottom: 4px;
      font-weight: 500;
      animation: pillIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .quick-reply-pill {
      flex: 1 1 calc(50% - 10px);
      min-width: 140px;
      max-width: 220px;
      background: rgba(124, 58, 237, 0.1);
      border: 1px solid rgba(124, 58, 237, 0.2);
      color: #e2e8f0;
      padding: 12px 14px;
      border-radius: 14px;
      cursor: pointer;
      font-size: 13px;
      line-height: 1.4;
      text-align: left;
      transition: all 0.25s ease;
      backdrop-filter: blur(4px);
      animation: pillIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    .quick-reply-pill:hover {
      background: rgba(124, 58, 237, 0.25);
      border-color: rgba(124, 58, 237, 0.5);
      transform: scale(1.03);
    }
    .quick-reply-pill:active {
      transform: scale(0.97);
    }
    .pill-subtitle {
      font-size: 11px;
      color: #94a3b8;
      font-weight: 400;
    }
    @media (max-width: 480px) {
      .quick-reply-pill {
        flex: 1 1 100%;
        max-width: 100%;
      }
    }
  `;
  document.head.appendChild(style);
}

function injectAccentStyles(color) {
  const existing = document.getElementById('dynamic-accent');
  if (existing) existing.remove();
  const style = document.createElement('style');
  style.id = 'dynamic-accent';
  style.textContent = `
    :root { --accent: ${color}; }
    .badge-cod { background: ${color}15; border-color: ${color}30; color: ${color}; }
    .btn-confirm { background: ${color}; }
    .btn-confirm:hover { background: ${color}dd; }
    .bubble-amine .highlight { color: ${color}; }
    .price-badge { background: ${color}20; color: ${color}e0; border-color: ${color}40; }
  `;
  document.head.appendChild(style);
}

function createAmineBubble() {
  const div = document.createElement('div');
  div.className = 'bubble bubble-amine';
  const textContainer = document.createElement('div');
  textContainer.className = 'amine-text';
  div.appendChild(textContainer);
  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  meta.textContent = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  div.appendChild(meta);
  messagesEl.insertBefore(div, document.getElementById('scrollAnchor'));
  scrollChatToBottom('smooth', true);
  return div;
}

async function renderAwaitCatalog(page, params) {
  if ((page === 'services' || page === 'service') && !servicesCache.length) {
    try { await loadServices(); } catch (e) { console.warn('services retry:', e); }
  }
  await renderSPAPage(page, params);
}

async function initChat() {
  try {
    await Promise.race([
      Promise.all([loadServices(), loadTrackingConfig()]),
      new Promise(r => setTimeout(r, 5000))
    ]);
  } catch (e) { console.warn('Init error:', e); }

  const params = new URLSearchParams(window.location.search);
  const spaPage = parseSPAUrl();

  // SPA page mode (product page, services, etc.)
  if (spaPage.page) {
    renderAwaitCatalog(spaPage.page, { slug: spaPage.slug }).catch(console.warn);
    welcomeLock = false;
    updateSendButton();
    return;
  }

  if (!params.has('product')) {
    injectQuickReplyStyles();
    messageInput.placeholder = "Parle-moi de ce que tu cherches... ✨";
    setTimeout(() => afficherSuggestionsAccueil(), 800);
    welcomeLock = false;
    updateSendButton();
    return;
  }

  const productId = params.get('product') || productCatalog[0]?.id || 'coeur_vert_protection';
  const product = productCatalog.find(p => p.id === productId) || productCatalog[0] || {
    id: productId,
    name: 'Collier Coeur Vert Royale'
  };
  currentProduct = product;
  conversationMode = product.id === 'orgonite_perso' ? 'C' : 'B';

  // SEO
  document.title = `${product.name} — Amine Conseiller Énergétique`;
  let metaDesc = document.querySelector('meta[name="description"]');
  if (!metaDesc) { metaDesc = document.createElement('meta'); metaDesc.name = 'description'; document.head.appendChild(metaDesc); }
  metaDesc.content = `${(product.benefits || '').substring(0, 150)} — Commandez votre ${product.name} en Tunisie. Paiement à la livraison.`;
  // OG tags
  const baseUrl = window.location.origin;
  const ogTags = [
    ['og:title', `${product.name} — Amine Conseiller Énergétique`],
    ['og:description', `Découvrez ${product.name} — ${(product.benefits || '').substring(0, 120)}`],
    ['og:image', product.imageUrl || ''],
    ['og:url', `${baseUrl}/orgonite/${product.slug || product.id}`],
    ['og:type', 'website']
  ];
  ogTags.forEach(([prop, content]) => {
    let el = document.querySelector(`meta[property="${prop}"]`);
    if (!el) { el = document.createElement('meta'); el.setAttribute('property', prop); document.head.appendChild(el); }
    el.setAttribute('content', content);
  });

  const welcomeEl = document.getElementById('welcomeMessage');
  if (welcomeEl) welcomeEl.style.display = 'none';

  startNewProspect(product, product.id);
}

// ─── Voice Recording ────────────────────────────────────────
let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = null;
let recordingTimerInterval = null;

function formatRecTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function updateRecTimer() {
  if (!recordingStartTime) return;
  const elapsed = (Date.now() - recordingStartTime) / 1000;
  recTimer.textContent = formatRecTime(Math.min(elapsed, 30));
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}

micBtn.addEventListener('click', async () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    stopRecording();
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    addMessage('error', 'Enregistrement vocal non supporté sur ce navigateur.');
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    try {
      mediaRecorder = new MediaRecorder(stream, { mimeType });
    } catch (err) {
      stream.getTracks().forEach(t => t.stop());
      addMessage('error', 'Codec audio non supporté sur ce navigateur.');
      return;
    }

    mediaRecorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      clearInterval(recordingTimerInterval);
      recordingTimerInterval = null;
      recordingStartTime = null;
      micBtn.classList.remove('recording');
      recordingBar.style.display = 'none';

      stream.getTracks().forEach(t => t.stop());

      const blob = new Blob(audioChunks, { type: mimeType });
      audioChunks = [];

      if (blob.size < 100) {
        isProcessing = false;
        micBtn.disabled = false;
        updateSendButton();
        return;
      }

      // Show user message
      const duration = recTimer.textContent;
      addMessage('user', `🎤 Message vocal (${duration})`);

      pushHistory({
        role: 'user',
        text: '(Message vocal)',
        imageBase64: null, imageMimeType: null,
        audioBase64: null, audioMimeType: null
      });

      isProcessing = true;
      micBtn.disabled = true;
      sendBtn.disabled = true;
      const t0 = Date.now();
      showTyping();

      try {
        const formData = new FormData();
        formData.append('audio', blob, 'recording.webm');
        formData.append('message', '');
        formData.append('productId', pendingProductId || '');
        formData.append('productType', currentProduct?.productType || 'general');
        formData.append('orderConfirmed', 'false');
        formData.append('conversationMode', conversationMode);
        formData.append('history', JSON.stringify(conversationHistory.slice(0, -1).map(msg => ({
          role: msg.role, text: msg.text,
          imageBase64: msg.imageBase64, imageMimeType: msg.imageMimeType
        }))));

        const response = await fetchWithTimeout('/api/chat/voice', {
          method: 'POST',
          body: formData
        });
        pendingProductId = null;

        const data = await response.json();

        if (data.error) {
          hideTyping();
          addMessage('error', String(data.error));
          conversationHistory.pop();
          isProcessing = false;
          micBtn.disabled = false;
          updateSendButton();
          return;
        }

        const elapsed = Date.now() - t0;
        const step = inferSalesStep(data.reply, Boolean(data.order));
        afficherMessageAmine(data.reply, data.products || (data.product ? [data.product] : []), { step, hasOrder: Boolean(data.order), elapsed });
        if (data.order) {
          trackPurchase(data.order);
        }

        pushHistory({
          role: 'model',
          text: cleanBotText(data.reply),
          imageBase64: null, imageMimeType: null,
          audioBase64: null, audioMimeType: null
        });

      } catch (err) {
        hideTyping();
        addMessage('error', 'Erreur de connexion lors de l\'envoi vocal.');
        conversationHistory.pop();
        pendingProductId = null;
      }

      isProcessing = false;
      micBtn.disabled = false;
      updateSendButton();
    };

    mediaRecorder.onerror = () => {
      clearInterval(recordingTimerInterval);
      recordingTimerInterval = null;
      recordingStartTime = null;
      micBtn.classList.remove('recording');
      recordingBar.style.display = 'none';
      stream.getTracks().forEach(t => t.stop());
      isProcessing = false;
      micBtn.disabled = false;
      updateSendButton();
    };

    recordingStartTime = Date.now();
    recTimer.textContent = '0:00';
    micBtn.classList.add('recording');
    recordingBar.style.display = 'flex';
    micBtn.disabled = false;

    recordingTimerInterval = setInterval(() => {
      if (!recordingStartTime) return;
      const elapsed = (Date.now() - recordingStartTime) / 1000;
      if (elapsed >= 30) stopRecording();
      else updateRecTimer();
    }, 200);

    try {
      mediaRecorder.start();
    } catch (err) {
      clearInterval(recordingTimerInterval);
      recordingTimerInterval = null;
      recordingStartTime = null;
      micBtn.classList.remove('recording');
      recordingBar.style.display = 'none';
      stream.getTracks().forEach(t => t.stop());
      addMessage('error', 'Erreur au démarrage de l\'enregistrement.');
      return;
    }

  } catch (err) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      addMessage('error', 'Merci d\'autoriser l\'accès au micro pour envoyer un message vocal.');
    } else {
      addMessage('error', 'Impossible d\'accéder au microphone.');
    }
  }
});

// Initialize send button state on page load
updateSendButton();
initChat();
