const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const resultsContainer = document.getElementById('results');
const wishlistContainer = document.getElementById('wishlist');
const addedContainer = document.getElementById('addedList');
const onHoldContainer = document.getElementById('onHoldList');

let wishlistCache = [];

function truncateText(text, maxLength = 100) {
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

searchForm.addEventListener('submit', async event => {
  event.preventDefault();
  const query = searchInput.value.trim();
  if (!query) return;

  setResultsState('正在搜索...');
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    if (!response.ok) {
      throw new Error('搜索失败');
    }
    const { results } = await response.json();
    renderResults(results);
  } catch (error) {
    console.error(error);
    setResultsState('搜索失败，请稍后重试。');
  }
});

async function fetchWishlist() {
  try {
    const response = await fetch('/api/wishlist');
    if (!response.ok) throw new Error('Failed to load wishlist');
    wishlistCache = await response.json();
    renderWishlistSections();
  } catch (error) {
    console.error(error);
    setContainerState(wishlistContainer, '无法加载愿望单');
    setContainerState(addedContainer, '无法加载已添加列表', 'wishlist added-list empty-state');
    setContainerState(onHoldContainer, '无法加载暂挂区', 'wishlist on-hold-list empty-state');
  }
}

function renderResults(items = []) {
  if (!items.length) {
    setResultsState('没有找到匹配的作品。');
    return;
  }

  resultsContainer.classList.remove('empty-state');
  resultsContainer.innerHTML = '';

  const existingIds = new Set(wishlistCache.map(item => String(item.tmdbId)));

  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'card';

    if (item.posterPath) {
      const img = document.createElement('img');
      img.src = item.posterPath;
      img.alt = item.title;
      card.appendChild(img);
    }

    const content = document.createElement('div');
    content.className = 'card-content';

    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = `${item.title} (${item.mediaType === 'movie' ? '电影' : '剧集'})`;

    const meta = document.createElement('p');
    meta.className = 'card-meta';
    meta.textContent = `评分：${item.rating ?? '暂无'} ｜ IMDb：${item.imdbId || '暂无'} `;

    const overview = document.createElement('p');
    overview.textContent = truncateText(item.overview);

    const actions = document.createElement('div');

    const addBtn = document.createElement('button');
    addBtn.textContent = existingIds.has(String(item.tmdbId)) ? '已在愿望单' : '加入愿望单';
    addBtn.disabled = existingIds.has(String(item.tmdbId));
    addBtn.addEventListener('click', () => addToWishlist(item, addBtn));

    actions.appendChild(addBtn);

    content.appendChild(title);
    content.appendChild(meta);
    content.appendChild(overview);
    content.appendChild(actions);

    card.appendChild(content);
    resultsContainer.appendChild(card);
  });
}

async function addToWishlist(item, buttonEl) {
  buttonEl.disabled = true;
  buttonEl.textContent = '提交中...';

  try {
    const response = await fetch('/api/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tmdbId: item.tmdbId,
        title: item.title,
        mediaType: item.mediaType,
        imdbId: item.imdbId
      })
    });

    if (!response.ok) {
      const { message } = await response.json().catch(() => ({ message: '添加失败' }));
      throw new Error(message || '添加失败');
    }

    await fetchWishlist();
    buttonEl.textContent = '已加入';
  } catch (error) {
    alert(error.message || '添加失败');
    buttonEl.disabled = false;
    buttonEl.textContent = '加入愿望单';
  }
}

function renderWishlistSections() {
  const onHoldItems = wishlistCache.filter(item => item.onHoldAt && !item.addedAt);
  const pendingItems = wishlistCache.filter(item => !item.addedAt && !item.onHoldAt);
  const addedItems = wishlistCache.filter(item => item.addedAt);

  renderCardList(pendingItems, wishlistContainer, '愿望单为空，去添加一些吧！', {
    metaLabel: '收藏时间',
    metaKey: 'createdAt',
    emptyClass: 'wishlist empty-state',
    containerClass: 'wishlist'
  });
  renderCardList(onHoldItems, onHoldContainer, '暂挂区为空。', {
    metaLabel: '暂挂时间',
    metaKey: 'onHoldAt',
    cardClass: 'on-hold-card',
    emptyClass: 'wishlist on-hold-list empty-state',
    containerClass: 'wishlist on-hold-list'
  });
  renderCardList(addedItems, addedContainer, '还没有标记“已添加”的作品。', {
    metaLabel: '标记时间',
    metaKey: 'addedAt',
    cardClass: 'added-card',
    emptyClass: 'wishlist added-list empty-state',
    containerClass: 'wishlist added-list'
  });
}

function renderCardList(items, container, emptyMessage, options = {}) {
  if (!container) return;
  const {
    metaLabel = '时间',
    metaKey = 'createdAt',
    cardClass = '',
    emptyClass = 'wishlist empty-state',
    containerClass = 'wishlist'
  } = options;

  if (!items.length) {
    setContainerState(container, emptyMessage, emptyClass);
    return;
  }

  container.className = containerClass;
  container.innerHTML = '';

  items.slice().reverse().forEach(item => {
    const card = document.createElement('div');
    card.className = `card ${cardClass}`.trim();

    const content = document.createElement('div');
    content.className = 'card-content';

    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = `${item.title} (${item.mediaType === 'movie' ? '电影' : '剧集'})`;

    const meta = document.createElement('p');
    meta.className = 'card-meta';
    const timestamp = item?.[metaKey];
    const timeText = timestamp ? new Date(timestamp).toLocaleString() : '暂无';
    meta.textContent = `IMDb：${item.imdbId || '暂无'} ｜ ${metaLabel}：${timeText}`;

    content.appendChild(title);
    content.appendChild(meta);
    card.appendChild(content);
    container.appendChild(card);
  });
}

function setResultsState(message) {
  resultsContainer.className = 'results empty-state';
  resultsContainer.textContent = message;
}

function setContainerState(container, message, className = 'wishlist empty-state') {
  if (!container) return;
  container.className = className;
  container.textContent = message;
}

fetchWishlist();
