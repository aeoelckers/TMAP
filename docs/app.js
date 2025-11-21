const formatMoney = (value) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);

const formatCompact = (value) =>
  new Intl.NumberFormat('es-CL', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

const state = {
  listings: [],
  filtered: [],
  sources: [],
};

const normalizeUrl = (rawUrl) => {
  if (!rawUrl) return null;
  if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
  return `https://${rawUrl}`;
};

const describeOriginLink = (url, sourceName) => {
  if (!url) return 'Ver origen →';
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    if (sourceName && !hostname.toLowerCase().includes(sourceName.toLowerCase())) {
      return `Ver en ${sourceName} →`;
    }
    return `Ver en ${hostname} →`;
  } catch (error) {
    return 'Ver origen →';
  }
};

const elements = {
  typeFilter: document.getElementById('typeFilter'),
  regionFilter: document.getElementById('regionFilter'),
  communeFilter: document.getElementById('communeFilter'),
  originFilter: document.getElementById('originFilter'),
  minPrice: document.getElementById('minPrice'),
  maxPrice: document.getElementById('maxPrice'),
  minArea: document.getElementById('minArea'),
  maxArea: document.getElementById('maxArea'),
  keywordInput: document.getElementById('keywordInput'),
  sortSelect: document.getElementById('sortSelect'),
  clearFilters: document.getElementById('clearFilters'),
  resultsSummary: document.getElementById('resultsSummary'),
  cardsContainer: document.getElementById('cardsContainer'),
  totalListings: document.getElementById('totalListings'),
  remateShare: document.getElementById('remateShare'),
  autoGrid: document.getElementById('autoGrid'),
  autoEmpty: document.getElementById('autoEmpty'),
  manualGrid: document.getElementById('sourcesGrid'),
  autoTab: document.getElementById('tabAuto'),
  manualTab: document.getElementById('tabManual'),
  autoPanel: document.getElementById('sourcesAuto'),
  manualPanel: document.getElementById('sourcesManual'),
  autoHint: document.getElementById('autoHint'),
  autoSummary: document.getElementById('autoSummary'),
};

async function bootstrap() {
  const [listingsResponse, sourcesResponse] = await Promise.all([
    fetch('data/listings.json'),
    fetch('data/portals.json'),
  ]);

  const payload = await listingsResponse.json();
  state.listings = payload.listings.map((listing, index) => ({
    ...listing,
    order: index,
  }));

  state.sources = await sourcesResponse.json();

  hydrateFilters();
  renderManualSources();
  setupSourceTabs();
  applyFilters();
}

function hydrateFilters() {
  const types = ['all', ...new Set(state.listings.map((l) => l.terrain_type))];
  fillSelect(elements.typeFilter, types, 'Todos los tipos');

  const regions = ['all', ...new Set(state.listings.map((l) => l.region))];
  fillSelect(elements.regionFilter, regions, 'Todas las regiones');
  updateCommunes();

  elements.typeFilter.addEventListener('change', applyFilters);
  elements.regionFilter.addEventListener('change', () => {
    updateCommunes();
    applyFilters();
  });
  elements.communeFilter.addEventListener('change', applyFilters);
  elements.originFilter.addEventListener('change', applyFilters);

  [elements.minPrice, elements.maxPrice, elements.minArea, elements.maxArea].forEach((input) =>
    input.addEventListener('input', debounce(applyFilters, 250))
  );

  elements.keywordInput.addEventListener('input', debounce(applyFilters, 250));
  elements.sortSelect.addEventListener('change', applyFilters);
  elements.clearFilters.addEventListener('click', clearFilters);
}

function fillSelect(select, values, allLabel) {
  select.innerHTML = '';
  values.forEach((value, index) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = index === 0 ? allLabel : value;
    select.appendChild(option);
  });
}

function updateCommunes() {
  const selectedRegion = elements.regionFilter.value;
  const communes = ['all'];
  state.listings
    .filter((l) => selectedRegion === 'all' || l.region === selectedRegion)
    .forEach((listing) => {
      if (!communes.includes(listing.commune)) communes.push(listing.commune);
    });
  fillSelect(elements.communeFilter, communes, 'Todas las comunas');
}

function clearFilters() {
  elements.typeFilter.value = 'all';
  elements.regionFilter.value = 'all';
  updateCommunes();
  elements.communeFilter.value = 'all';
  elements.originFilter.value = 'all';
  elements.minPrice.value = '';
  elements.maxPrice.value = '';
  elements.minArea.value = '';
  elements.maxArea.value = '';
  elements.keywordInput.value = '';
  elements.sortSelect.value = 'default';
  applyFilters();
}

function applyFilters() {
  const { typeFilter, regionFilter, communeFilter, originFilter, minPrice, maxPrice, minArea, maxArea, keywordInput } = elements;
  const filtered = state.listings.filter((listing) => {
    if (typeFilter.value !== 'all' && listing.terrain_type !== typeFilter.value) return false;
    if (regionFilter.value !== 'all' && listing.region !== regionFilter.value) return false;
    if (communeFilter.value !== 'all' && listing.commune !== communeFilter.value) return false;
    if (originFilter.value !== 'all' && listing.origin !== originFilter.value) return false;

    const priceMm = listing.price_clp / 1_000_000;
    if (minPrice.value && priceMm < Number(minPrice.value)) return false;
    if (maxPrice.value && priceMm > Number(maxPrice.value)) return false;

    if (minArea.value && listing.surface_m2 < Number(minArea.value)) return false;
    if (maxArea.value && listing.surface_m2 > Number(maxArea.value)) return false;

    if (keywordInput.value) {
      const haystack = `${listing.title} ${listing.terrain_type} ${listing.commune} ${listing.region}`.toLowerCase();
      const needles = keywordInput.value
        .toLowerCase()
        .split(/[,\s]+/)
        .filter(Boolean);
      if (!needles.every((needle) => haystack.includes(needle))) return false;
    }

    return true;
  });

  const sorted = sortListings(filtered, elements.sortSelect.value);
  state.filtered = sorted;

  render();
  renderAutoSearches();
}

function sortListings(listings, sortOption) {
  const cloned = [...listings];
  switch (sortOption) {
    case 'opportunity':
      return cloned.sort((a, b) => opportunityScore(a) - opportunityScore(b));
    case 'discount':
      return cloned.sort((a, b) => discount(b) - discount(a));
    default:
      return cloned.sort((a, b) => b.order - a.order);
  }
}

function opportunityScore(listing) {
  if (!listing.commercial_value) return Number.POSITIVE_INFINITY;
  return listing.price_clp / listing.commercial_value;
}

function discount(listing) {
  if (!listing.commercial_value) return 0;
  return 1 - listing.price_clp / listing.commercial_value;
}

function render() {
  const { cardsContainer, resultsSummary, totalListings, remateShare } = elements;
  totalListings.textContent = state.listings.length;
  const remates = state.listings.filter((l) => l.origin === 'remate').length;
  remateShare.textContent = `${Math.round((remates / state.listings.length) * 100)}%`;

  resultsSummary.textContent = `${state.filtered.length} resultados`;
  cardsContainer.innerHTML = '';

  const template = document.getElementById('listingCardTemplate');
  state.filtered.forEach((listing) => {
    const node = template.content.cloneNode(true);
    const article = node.querySelector('.card');
    const originPill = node.querySelector('.origin');
    originPill.textContent = listing.origin === 'remate' ? 'Remate' : listing.source_name;
    originPill.classList.toggle('remate', listing.origin === 'remate');

    node.querySelector('.title').textContent = listing.title;
    node.querySelector('.location').textContent = `${listing.terrain_type} · ${listing.commune}, ${listing.region}`;

    const link = node.querySelector('.external');
    const normalizedUrl = normalizeUrl(listing.url);
    const articleIsClickable = Boolean(normalizedUrl);

    if (articleIsClickable) {
      link.href = normalizedUrl;
      link.textContent = describeOriginLink(normalizedUrl, listing.source_name);
      link.title = `Abrir publicación original en ${listing.source_name}`;
      link.rel = 'noopener noreferrer';
      link.classList.remove('disabled');
      article.dataset.clickable = 'true';
      article.addEventListener('click', () => window.open(normalizedUrl, '_blank', 'noopener,noreferrer'));
      link.addEventListener('click', (event) => event.stopPropagation());
    } else {
      link.removeAttribute('href');
      link.textContent = 'Sin enlace disponible';
      link.title = 'No hay enlace publicado para este terreno';
      link.classList.add('disabled');
      article.dataset.clickable = 'false';
    }

    node.querySelector('.price').textContent = formatMoney(listing.price_clp);
    node.querySelector('.price-per-m2').textContent = `${formatMoney(listing.price_clp / listing.surface_m2)} /m²`;

    node.querySelector('.fiscal').textContent = listing.fiscal_value ? formatMoney(listing.fiscal_value) : '—';
    node.querySelector('.fiscal-per-m2').textContent = listing.fiscal_value
      ? `${formatMoney(listing.fiscal_value / listing.surface_m2)} /m²`
      : 'Sin dato';

    node.querySelector('.commercial').textContent = listing.commercial_value ? formatMoney(listing.commercial_value) : '—';
    node.querySelector('.commercial-per-m2').textContent = listing.commercial_value
      ? `${formatMoney(listing.commercial_value / listing.surface_m2)} /m²`
      : 'Sin dato';

    const ratio = opportunityScore(listing);
    const ratioLabel = ratio === Number.POSITIVE_INFINITY ? 'Sin avalúo' : `${(ratio * 100).toFixed(0)}% del avalúo`;
    const discountLabel = listing.commercial_value ? `${(discount(listing) * 100).toFixed(1)}% descuento` : 'Sin avalúo comercial';

    node.querySelector('.indicators').textContent = ratioLabel;
    node.querySelector('.opportunity').textContent = discountLabel;

    if (ratio < 0.85) {
      article.classList.add('opportunity');
    }

    cardsContainer.appendChild(node);
  });
}

function renderManualSources() {
  const grid = elements.manualGrid;
  const counter = document.getElementById('sourcesCount');
  const template = document.getElementById('sourceCardTemplate');

  counter.textContent = state.sources.length;
  grid.innerHTML = '';

  state.sources.forEach((source) => {
    const node = template.content.cloneNode(true);
    node.querySelector('.source-name').textContent = source.name;
    node.querySelector('.source-meta').textContent = [source.category, source.tag]
      .filter(Boolean)
      .join(' · ');

    const link = node.querySelector('.source-link');
    link.href = source.url;
    link.title = `Abrir ${source.name} en una pestaña nueva`;

    grid.appendChild(node);
  });
}

function buildQueryFromFilters() {
  const { typeFilter, regionFilter, communeFilter, minPrice, maxPrice, minArea, maxArea, keywordInput } = elements;
  const tokens = [];

  if (typeFilter.value !== 'all') tokens.push(typeFilter.value);
  if (communeFilter.value !== 'all') tokens.push(communeFilter.value);
  if (regionFilter.value !== 'all') tokens.push(regionFilter.value);

  if (keywordInput.value) tokens.push(keywordInput.value.trim());

  const priceTokens = [];
  if (minPrice.value) priceTokens.push(`≥${minPrice.value}MM`);
  if (maxPrice.value) priceTokens.push(`≤${maxPrice.value}MM`);
  if (priceTokens.length) tokens.push(`precio ${priceTokens.join(' / ')}`);

  const areaTokens = [];
  if (minArea.value) areaTokens.push(`≥${minArea.value}m²`);
  if (maxArea.value) areaTokens.push(`≤${maxArea.value}m²`);
  if (areaTokens.length) tokens.push(`superficie ${areaTokens.join(' / ')}`);

  const query = tokens.join(' ');
  return { query, summary: tokens.join(' · ') };
}

function buildPortalSearchUrl(source, query) {
  if (source.search_template) {
    return source.search_template.replace('{query}', encodeURIComponent(query));
  }
  return source.url;
}

function renderAutoSearches() {
  const { query, summary } = buildQueryFromFilters();
  const { autoGrid, autoEmpty, autoHint, autoSummary } = elements;
  const template = document.getElementById('autoSourceCardTemplate');

  autoGrid.innerHTML = '';

  if (!query) {
    autoEmpty.classList.add('visible');
    autoHint.textContent = 'Elige tipo, ubicación o escribe palabras clave para armar búsquedas en cada portal.';
    autoSummary.textContent = 'Sin filtros activos.';
    return;
  }

  autoEmpty.classList.remove('visible');
  autoHint.textContent = 'Abre las búsquedas generadas con tus filtros en los portales de origen.';
  autoSummary.textContent = `Consulta activa: ${summary || query}`;

  state.sources.forEach((source) => {
    const node = template.content.cloneNode(true);
    node.querySelector('.source-name').textContent = source.name;
    node.querySelector('.search-query').textContent = summary || query;

    const link = node.querySelector('.source-link');
    const url = buildPortalSearchUrl(source, query);
    link.href = url;
    link.title = `Buscar "${summary || query}" en ${source.name}`;
    link.rel = 'noopener noreferrer';

    autoGrid.appendChild(node);
  });
}

function setupSourceTabs() {
  const { autoTab, manualTab, autoPanel, manualPanel } = elements;

  const activate = (target) => {
    const showAuto = target === 'auto';
    autoTab.classList.toggle('active', showAuto);
    manualTab.classList.toggle('active', !showAuto);
    autoPanel.classList.toggle('active', showAuto);
    manualPanel.classList.toggle('active', !showAuto);
  };

  autoTab.addEventListener('click', () => activate('auto'));
  manualTab.addEventListener('click', () => activate('manual'));
}

function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

bootstrap();
