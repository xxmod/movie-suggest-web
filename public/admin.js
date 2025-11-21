const adminContainer = document.getElementById('adminWishlist');
const clearForm = document.getElementById('clearForm');
const passwordInput = document.getElementById('adminPassword');
const clearStatus = document.getElementById('clearStatus');

async function loadWishlist() {
  try {
    const response = await fetch('/api/wishlist');
    if (!response.ok) throw new Error('加载失败');
    const data = await response.json();

    if (!data.length) {
      adminContainer.className = 'wishlist empty-state';
      adminContainer.textContent = '当前没有任何条目。';
      return;
    }

    adminContainer.classList.remove('empty-state');
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>名称</th><th>类型</th><th>IMDb ID</th><th>收藏时间</th></tr>';
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    data.slice().reverse().forEach(item => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.title}</td>
        <td>${item.mediaType === 'movie' ? '电影' : '剧集'}</td>
        <td>${item.imdbId || '暂无'}</td>
        <td>${new Date(item.createdAt).toLocaleString()}</td>
      `;
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    adminContainer.innerHTML = '';
    adminContainer.appendChild(table);
  } catch (error) {
    console.error(error);
    adminContainer.className = 'wishlist empty-state';
    adminContainer.textContent = '无法加载愿望单';
  }
}

async function clearWishlist(password) {
  const response = await fetch('/api/wishlist/clear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password })
  });

  if (!response.ok) {
    const { message } = await response.json().catch(() => ({ message: '操作失败' }));
    throw new Error(message || '操作失败');
  }
}

if (clearForm) {
  clearForm.addEventListener('submit', async event => {
    event.preventDefault();
    const password = passwordInput.value.trim();
    if (!password) {
      clearStatus.textContent = '请输入密码。';
      return;
    }

    const submitBtn = clearForm.querySelector('button');
    submitBtn.disabled = true;
    submitBtn.textContent = '清空中...';
    clearStatus.textContent = '';

    try {
      await clearWishlist(password);
      clearStatus.textContent = '已清空愿望单。';
      passwordInput.value = '';
      await loadWishlist();
    } catch (error) {
      clearStatus.textContent = error.message;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '清空愿望单';
    }
  });
}

loadWishlist();
