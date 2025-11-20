const formatMoney = (value) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);

const formatCompact = (value) =>
  new Intl.NumberFormat('es-CL', { notation: 'compact', maximumFractionDigits: 1 }).format(value);

const state = {
  listings: [],
  filtered: [],
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
  sortSelect: document.getElementById('sortSelect'),
  clearFilters: document.getElementById('clearFilters'),
  resultsSummary: document.getElementById('resultsSummary'),
  cardsContainer: document.getElementById('cardsContainer'),
  totalListings: document.getElementById('totalListings'),
  remateShare: document.getElementById('remateShare'),
};

async function bootstrap() {
  const response = await fetch('data/listings.json');
  const payload = await response.json();
  state.listings = payload.listings.map((listing, index) => ({
    ...listing,
    order: index,
  }));

  hydrateFilters();
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
  elements.sortSelect.value = 'default';
  applyFilters();
}

function applyFilters() {
  const { typeFilter, regionFilter, communeFilter, originFilter, minPrice, maxPrice, minArea, maxArea } = elements;
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

    return true;
  });

  const sorted = sortListings(filtered, elements.sortSelect.value);
  state.filtered = sorted;

  render();
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

function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

bootstrap();
