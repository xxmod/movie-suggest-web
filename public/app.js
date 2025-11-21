const searchForm = document.getElementById('searchForm');
const searchInput = document.getElementById('searchInput');
const resultsContainer = document.getElementById('results');
const wishlistContainer = document.getElementById('wishlist');

let wishlistCache = [];

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
    renderWishlist();
  } catch (error) {
    console.error(error);
    setWishlistState('无法加载愿望单');
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
    overview.textContent = item.overview;

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

function renderWishlist() {
  if (!wishlistCache.length) {
    setWishlistState('愿望单为空，去添加一些吧！');
    return;
  }

  wishlistContainer.classList.remove('empty-state');
  wishlistContainer.innerHTML = '';

  wishlistCache.slice().reverse().forEach(item => {
    const card = document.createElement('div');
    card.className = 'card';

    const content = document.createElement('div');
    content.className = 'card-content';

    const title = document.createElement('h3');
    title.className = 'card-title';
    title.textContent = `${item.title} (${item.mediaType === 'movie' ? '电影' : '剧集'})`;

    const meta = document.createElement('p');
    meta.className = 'card-meta';
    meta.textContent = `IMDb：${item.imdbId || '暂无'} ｜ 收藏时间：${new Date(item.createdAt).toLocaleString()}`;

    content.appendChild(title);
    content.appendChild(meta);
    card.appendChild(content);
    wishlistContainer.appendChild(card);
  });
}

function setResultsState(message) {
  resultsContainer.className = 'results empty-state';
  resultsContainer.textContent = message;
}

function setWishlistState(message) {
  wishlistContainer.className = 'wishlist empty-state';
  wishlistContainer.textContent = message;
}

fetchWishlist();
