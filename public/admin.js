const adminContainer = document.getElementById('adminWishlist');
const clearForm = document.getElementById('clearForm');
const passwordInput = document.getElementById('adminPassword');
const clearStatus = document.getElementById('clearStatus');
const emailStatus = document.getElementById('emailStatus');
const emailForm = document.getElementById('emailConfigForm');
const emailAccountInput = document.getElementById('emailAccount');
const emailPasswordInput = document.getElementById('emailPassword');
const emailAdminPasswordInput = document.getElementById('emailAdminPassword');
const emailSaveStatus = document.getElementById('emailSaveStatus');

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
