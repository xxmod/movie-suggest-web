const adminContainer = document.getElementById('adminWishlist');
const clearForm = document.getElementById('clearForm');
const passwordInput = document.getElementById('adminPassword');
const clearStatus = document.getElementById('clearStatus');
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
const selectAllBtn = document.getElementById('selectAllBtn');
const clearSelectionBtn = document.getElementById('clearSelectionBtn');
const deleteStatus = document.getElementById('deleteStatus');
const deletePasswordInput = document.getElementById('deleteAdminPassword');
const emailStatus = document.getElementById('emailStatus');
const emailForm = document.getElementById('emailConfigForm');
const emailAccountInput = document.getElementById('emailAccount');
const emailPasswordInput = document.getElementById('emailPassword');
const emailAdminPasswordInput = document.getElementById('emailAdminPassword');
const emailSaveStatus = document.getElementById('emailSaveStatus');

let wishlistData = [];
const selectedTmdbIds = new Set();
let masterCheckbox = null;

async function loadWishlist() {
  try {
    const response = await fetch('/api/wishlist');
    if (!response.ok) throw new Error('加载失败');
    wishlistData = await response.json();
    selectedTmdbIds.clear();
    renderWishlistTable();
  } catch (error) {
    console.error(error);
    wishlistData = [];
    selectedTmdbIds.clear();
    masterCheckbox = null;
    adminContainer.className = 'wishlist empty-state';
    adminContainer.textContent = '无法加载愿望单';
  } finally {
    updateSelectionUi();
  }
}

function renderWishlistTable() {
  if (!adminContainer) return;

  if (!wishlistData.length) {
    masterCheckbox = null;
    adminContainer.className = 'wishlist empty-state';
    adminContainer.textContent = '当前没有任何条目。';
    return;
  }

  const visibleItems = wishlistData.slice().reverse();
  adminContainer.classList.remove('empty-state');

  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  const selectTh = document.createElement('th');
  masterCheckbox = document.createElement('input');
  masterCheckbox.type = 'checkbox';
  masterCheckbox.addEventListener('change', handleMasterToggle);
  selectTh.appendChild(masterCheckbox);
  headerRow.appendChild(selectTh);

  ['名称', '类型', 'IMDb ID', '收藏时间'].forEach(label => {
    const th = document.createElement('th');
    th.textContent = label;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  visibleItems.forEach(item => {
    const row = document.createElement('tr');
    const tmdbId = String(item.tmdbId);

    const selectTd = document.createElement('td');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = tmdbId;
    checkbox.checked = selectedTmdbIds.has(tmdbId);
    checkbox.addEventListener('change', event => {
      if (event.target.checked) {
        selectedTmdbIds.add(tmdbId);
      } else {
        selectedTmdbIds.delete(tmdbId);
      }
      setDeleteStatus('');
      updateSelectionUi();
      syncMasterCheckbox(visibleItems.length);
    });
    selectTd.appendChild(checkbox);
    row.appendChild(selectTd);

    const titleTd = document.createElement('td');
    titleTd.textContent = item.title;
    row.appendChild(titleTd);

    const typeTd = document.createElement('td');
    typeTd.textContent = item.mediaType === 'movie' ? '电影' : '剧集';
    row.appendChild(typeTd);

    const imdbTd = document.createElement('td');
    imdbTd.textContent = item.imdbId || '暂无';
    row.appendChild(imdbTd);

    const dateTd = document.createElement('td');
    dateTd.textContent = new Date(item.createdAt).toLocaleString();
    row.appendChild(dateTd);

    tbody.appendChild(row);
  });

  table.appendChild(tbody);

  adminContainer.innerHTML = '';
  adminContainer.appendChild(table);
  syncMasterCheckbox(visibleItems.length);
}

function handleMasterToggle(event) {
  if (!wishlistData.length) return;
  if (event.target.checked) {
    wishlistData.forEach(item => selectedTmdbIds.add(String(item.tmdbId)));
  } else {
    selectedTmdbIds.clear();
  }
  setDeleteStatus('');
  renderWishlistTable();
  updateSelectionUi();
}

function syncMasterCheckbox(totalRows) {
  if (!masterCheckbox) return;
  if (!totalRows) {
    masterCheckbox.checked = false;
    masterCheckbox.indeterminate = false;
    masterCheckbox.disabled = true;
    return;
  }

  masterCheckbox.disabled = false;
  masterCheckbox.checked = selectedTmdbIds.size === totalRows;
  masterCheckbox.indeterminate = selectedTmdbIds.size > 0 && selectedTmdbIds.size < totalRows;
}

function updateSelectionUi() {
  const hasItems = wishlistData.length > 0;
  const hasSelection = selectedTmdbIds.size > 0;
  const hasPassword = deletePasswordInput ? Boolean(deletePasswordInput.value.trim()) : true;

  if (deleteSelectedBtn) {
    deleteSelectedBtn.disabled = !(hasSelection && hasPassword);
  }
  if (selectAllBtn) {
    selectAllBtn.disabled = !hasItems;
  }
  if (clearSelectionBtn) {
    clearSelectionBtn.disabled = !hasSelection;
  }
}

function setDeleteStatus(message, color = '#f87171') {
  if (!deleteStatus) return;
  deleteStatus.textContent = message;
  deleteStatus.style.color = message ? color : '#f87171';
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

async function deleteWishlistItems(tmdbIds, password) {
  const response = await fetch('/api/wishlist', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tmdbIds, password })
  });

  if (!response.ok) {
    const { message } = await response.json().catch(() => ({ message: '删除失败' }));
    throw new Error(message || '删除失败');
  }

  return response.json();
}

async function loadEmailConfig() {
  if (!emailStatus) return;
  try {
    const response = await fetch('/api/email-config');
    if (!response.ok) throw new Error('加载失败');
    const data = await response.json();

    emailStatus.classList.remove('empty-state');
    if (data.configured && data.email) {
      emailStatus.textContent = `当前邮箱：${data.email}`;
    } else {
      emailStatus.classList.add('empty-state');
      emailStatus.textContent = '尚未配置邮箱通知。';
    }

    if (data.email && emailAccountInput) {
      emailAccountInput.value = data.email;
    }
  } catch (error) {
    console.error(error);
    emailStatus.textContent = '无法读取邮箱配置。';
  }
}

async function updateEmailConfig(payload) {
  const response = await fetch('/api/email-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const { message } = await response.json().catch(() => ({ message: '保存失败' }));
    throw new Error(message || '保存失败');
  }
}

if (selectAllBtn) {
  selectAllBtn.addEventListener('click', () => {
    if (!wishlistData.length) return;
    wishlistData.forEach(item => selectedTmdbIds.add(String(item.tmdbId)));
    setDeleteStatus('');
    renderWishlistTable();
    updateSelectionUi();
  });
}

if (clearSelectionBtn) {
  clearSelectionBtn.addEventListener('click', () => {
    selectedTmdbIds.clear();
    setDeleteStatus('');
    renderWishlistTable();
    updateSelectionUi();
  });
}

if (deleteSelectedBtn) {
  deleteSelectedBtn.addEventListener('click', async () => {
    const ids = Array.from(selectedTmdbIds);
    if (!ids.length) return;

    const password = deletePasswordInput ? deletePasswordInput.value.trim() : '';
    if (!password) {
      setDeleteStatus('请输入后台密码。');
      deletePasswordInput?.focus();
      return;
    }

    deleteSelectedBtn.disabled = true;
    deleteSelectedBtn.textContent = '删除中...';
    setDeleteStatus('');

    try {
      const result = await deleteWishlistItems(ids, password);
      const removed = result?.removed ?? ids.length;
      setDeleteStatus(`已删除 ${removed} 项。`, '#10b981');
      selectedTmdbIds.clear();
      if (deletePasswordInput) {
        deletePasswordInput.value = '';
      }
      await loadWishlist();
    } catch (error) {
      setDeleteStatus(error.message || '删除失败', '#f87171');
    } finally {
      deleteSelectedBtn.textContent = '删除选中条目';
      updateSelectionUi();
    }
  });
}

if (deletePasswordInput) {
  deletePasswordInput.addEventListener('input', () => {
    setDeleteStatus('');
    updateSelectionUi();
  });
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

if (emailForm) {
  emailForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!emailAccountInput || !emailPasswordInput || !emailAdminPasswordInput) return;

    const payload = {
      email: emailAccountInput.value.trim(),
      password: emailPasswordInput.value.trim(),
      adminPassword: emailAdminPasswordInput.value.trim()
    };

    if (!payload.email || !payload.password || !payload.adminPassword) {
      if (emailSaveStatus) {
        emailSaveStatus.textContent = '请填写完整信息。';
        emailSaveStatus.style.color = '#ef4444';
      }
      return;
    }

    const submitBtn = emailForm.querySelector('button');
    submitBtn.disabled = true;
    submitBtn.textContent = '保存中...';
    if (emailSaveStatus) emailSaveStatus.textContent = '';

    try {
      await updateEmailConfig(payload);
      if (emailSaveStatus) {
        emailSaveStatus.textContent = '邮箱配置已更新。';
        emailSaveStatus.style.color = '#10b981';
      }
      emailPasswordInput.value = '';
      emailAdminPasswordInput.value = '';
      await loadEmailConfig();
    } catch (error) {
      if (emailSaveStatus) {
        emailSaveStatus.textContent = error.message;
        emailSaveStatus.style.color = '#ef4444';
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '保存邮箱设置';
    }
  });
}

loadWishlist();
loadEmailConfig();
