// ── State ────────────────────────────────────────────────────────────────────
let currentUser      = null;
let transactions     = [];
let isLoginMode      = true;
let currentTxType    = 'expense';
let currentTxFilter  = 'all';
let editingTxId      = null;
let searchQuery      = '';
let selectedMonth    = new Date().getMonth();
let selectedYear     = new Date().getFullYear();
let currentAccountType = 'personal';

// ── Utils ────────────────────────────────────────────────────────────────────
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatCurrencyWithSign(value) {
    const f = formatCurrency(Math.abs(value));
    return value < 0 ? `- ${f}` : f;
}

function parseCurrency(str) {
    return parseFloat(str.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0;
}

function maskCurrency(input) {
    let v = input.value.replace(/\D/g, '');
    if (!v) { input.value = ''; return; }
    v = (parseInt(v) / 100).toFixed(2);
    input.value = 'R$ ' + v.replace('.', ',').replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
}

function formatDate(dateStr) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function animateCounter(el, target, formatter) {
    const duration = 650;
    const start    = performance.now();
    const tick = now => {
        const t    = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        el.textContent = formatter(target * ease);
        if (t < 1) requestAnimationFrame(tick);
        else el.textContent = formatter(target);
    };
    requestAnimationFrame(tick);
}

function maskDocument(input) {
    let v = input.value.replace(/\D/g, '').slice(0, 14);
    if (v.length <= 11) {
        v = v.replace(/(\d{3})(\d)/, '$1.$2')
             .replace(/(\d{3})(\d)/, '$1.$2')
             .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
        v = v.replace(/(\d{2})(\d)/, '$1.$2')
             .replace(/(\d{3})(\d)/, '$1.$2')
             .replace(/(\d{3})(\d)/, '$1/$2')
             .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    }
    input.value = v;
}

function showOverlay(overlayId, boxId) {
    const overlay = document.getElementById(overlayId);
    overlay.classList.remove('hidden');
    setTimeout(() => {
        overlay.classList.remove('opacity-0');
        document.getElementById(boxId).classList.remove('scale-95');
    }, 10);
}

function hideOverlay(overlayId, boxId) {
    const overlay = document.getElementById(overlayId);
    overlay.classList.add('opacity-0');
    document.getElementById(boxId).classList.add('scale-95');
    setTimeout(() => overlay.classList.add('hidden'), 300);
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const isSuccess = type === 'success';
    const icon    = isSuccess ? 'check_circle' : 'info';
    const color   = isSuccess ? 'text-brand-green' : 'text-blue-500';
    const bgColor = isSuccess ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-blue-50 dark:bg-blue-900/20';
    toast.className = `flex items-center gap-3 bg-white dark:bg-brand-darkCard border border-gray-100 dark:border-brand-darkBorder shadow-lg rounded-xl p-4 toast-enter`;
    toast.innerHTML = `
        <div class="w-8 h-8 rounded-full ${bgColor} flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined ${color} text-[18px]">${icon}</span>
        </div>
        <p class="text-sm font-medium text-gray-900 dark:text-white">${message}</p>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.replace('toast-enter', 'toast-leave');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function exportCSV() {
    const headers = ['Descrição', 'Categoria', 'Tipo', 'Valor', 'Data', 'Recorrente'];
    const rows = transactions
        .filter(tx => {
            const d = new Date(tx.date + 'T00:00:00');
            return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
        })
        .map(tx => [
            `"${tx.desc}"`,
            tx.category,
            tx.type === 'income' ? 'Receita' : 'Despesa',
            tx.value.toFixed(2).replace('.', ','),
            tx.date,
            tx.recurring ? 'Sim' : 'Não',
        ]);
    const csv  = [headers, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: `centz_${selectedYear}_${String(selectedMonth + 1).padStart(2, '0')}.csv` });
    a.click();
    URL.revokeObjectURL(url);
}

// ── Data ─────────────────────────────────────────────────────────────────────
function loadData() {
    transactions = JSON.parse(localStorage.getItem(`centz_tx_${currentUser.email}`) || '[]');
    updateAllViews();
}

function saveData() {
    localStorage.setItem(`centz_tx_${currentUser.email}`, JSON.stringify(transactions));
    updateAllViews();
}

// ── Auth ─────────────────────────────────────────────────────────────────────
function checkAuth() {
    const user = localStorage.getItem('centz_user');
    if (user) { currentUser = JSON.parse(user); showApp(); }
    else showAuth();
}

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    ['account-type-field', 'name-field', 'document-field'].forEach(id =>
        document.getElementById(id).classList.toggle('hidden', isLoginMode));
    document.getElementById('auth-btn-text').textContent    = isLoginMode ? 'Entrar'              : 'Criar Conta';
    document.getElementById('auth-toggle-text').textContent = isLoginMode ? 'Não tem uma conta?' : 'Já tem uma conta?';
    if (!isLoginMode) setAccountType('personal');
}

function setAccountType(type) {
    currentAccountType = type;
    const activeCls   = 'flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-md bg-white dark:bg-brand-darkCard text-gray-900 dark:text-white shadow-sm transition-all';
    const inactiveCls = 'flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-700 transition-all';
    document.getElementById('btn-type-personal').className = type === 'personal' ? activeCls : inactiveCls;
    document.getElementById('btn-type-business').className = type === 'business'  ? activeCls : inactiveCls;
    const isBusiness = type === 'business';
    document.getElementById('name-label').textContent     = isBusiness ? 'Razão Social'  : 'Nome Completo';
    document.getElementById('document-label').textContent = isBusiness ? 'CNPJ'          : 'CPF';
    const docInput = document.getElementById('auth-document');
    docInput.placeholder = isBusiness ? '00.000.000/0000-00' : '000.000.000-00';
    docInput.maxLength   = isBusiness ? 18 : 14;
    docInput.value       = '';
}

function showAuth() {
    document.getElementById('app-view').classList.add('hidden');
    document.getElementById('auth-view').classList.remove('hidden');
}

function showApp() {
    document.getElementById('auth-view').classList.add('hidden');
    document.getElementById('app-view').classList.remove('hidden');
    document.getElementById('user-name-display').textContent = currentUser.name;
    document.getElementById('user-avatar').textContent       = currentUser.name.charAt(0).toUpperCase();
    loadData();
}

function logout() {
    localStorage.removeItem('centz_user');
    currentUser = null;
    showAuth();
}

function loadDemoData() {
    const email = 'demo@centz.app';
    const now   = new Date();
    const y     = now.getFullYear();
    const mo    = now.getMonth();
    const d     = (day, offset = 0) => {
        const total = mo + offset;
        const m     = ((total % 12) + 12) % 12;
        const yr    = y + Math.floor(total / 12);
        return `${yr}-${String(m + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    };
    const tx = [
        { id:1,  type:'income',  value:5500,  desc:'Salário',           category:'Receita',     date:d(5),     recurring:true  },
        { id:2,  type:'income',  value:900,   desc:'Freelance Design',  category:'Receita',     date:d(18),    recurring:false },
        { id:3,  type:'expense', value:1400,  desc:'Aluguel',           category:'Moradia',     date:d(1),     recurring:true  },
        { id:4,  type:'expense', value:680,   desc:'Supermercado',      category:'Alimentação', date:d(8),     recurring:false },
        { id:5,  type:'expense', value:260,   desc:'Combustível',       category:'Transporte',  date:d(6),     recurring:false },
        { id:6,  type:'expense', value:200,   desc:'Academia',          category:'Saúde',       date:d(3),     recurring:true  },
        { id:7,  type:'expense', value:160,   desc:'Cinema + Jantar',   category:'Lazer',       date:d(20),    recurring:false },
        { id:8,  type:'expense', value:89.90, desc:'Netflix + Spotify', category:'Lazer',       date:d(5),     recurring:true  },
        { id:9,  type:'income',  value:5500,  desc:'Salário',           category:'Receita',     date:d(5,-1),  recurring:true  },
        { id:10, type:'expense', value:1400,  desc:'Aluguel',           category:'Moradia',     date:d(1,-1),  recurring:true  },
        { id:11, type:'expense', value:720,   desc:'Supermercado',      category:'Alimentação', date:d(10,-1), recurring:false },
        { id:12, type:'expense', value:310,   desc:'Combustível',       category:'Transporte',  date:d(7,-1),  recurring:false },
    ];
    localStorage.setItem('centz_user',        JSON.stringify({ name:'Ana Silva', email }));
    localStorage.setItem(`centz_tx_${email}`, JSON.stringify(tx));
    currentUser = { name:'Ana Silva', email };
    showApp();
    showToast('Dados de demonstração carregados!');
}

document.getElementById('auth-form').addEventListener('submit', e => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value;
    if (!isLoginMode) {
        const name      = document.getElementById('auth-name').value || 'Usuário';
        const docNumber = document.getElementById('auth-document').value;
        currentUser = { name, email, docNumber, accountType: currentAccountType };
        localStorage.setItem('centz_user',        JSON.stringify(currentUser));
        localStorage.setItem(`centz_tx_${email}`, JSON.stringify([]));
        showToast('Conta criada com sucesso!');
    } else {
        const saved = JSON.parse(localStorage.getItem('centz_user') || '{}');
        currentUser = { name: saved.name || email.split('@')[0], email };
        localStorage.setItem('centz_user', JSON.stringify(currentUser));
        showToast('Login realizado!');
    }
    showApp();
});

// ── Dashboard ─────────────────────────────────────────────────────────────────
function navigateMonth(dir) {
    selectedMonth += dir;
    if (selectedMonth > 11) { selectedMonth = 0; selectedYear++; }
    if (selectedMonth < 0)  { selectedMonth = 11; selectedYear--; }
    updateAllViews();
}

function updateMonthLabel() {
    const label = new Date(selectedYear, selectedMonth, 1)
        .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    document.getElementById('month-label').textContent = label.charAt(0).toUpperCase() + label.slice(1);
    const now = new Date();
    const isCurrentMonth = selectedMonth === now.getMonth() && selectedYear === now.getFullYear();
    document.getElementById('btn-next-month').disabled = isCurrentMonth;
    document.getElementById('btn-next-month').classList.toggle('opacity-30', isCurrentMonth);
}

function updateDashboard() {
    updateMonthLabel();
    let totalIncome = 0, totalExpense = 0, totalBalance = 0;

    transactions.forEach(tx => {
        const d          = new Date(tx.date + 'T00:00:00');
        const isSelected = d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
        if (tx.type === 'income') {
            totalBalance += tx.value;
            if (isSelected) totalIncome += tx.value;
        } else {
            totalBalance -= tx.value;
            if (isSelected) totalExpense += tx.value;
        }
    });

    const saldoEl = document.getElementById('card-saldo');
    saldoEl.className = `text-3xl font-bold mb-4 ${totalBalance < 0 ? 'text-red-500' : 'text-gray-900 dark:text-white'}`;
    animateCounter(saldoEl, totalBalance, v => formatCurrencyWithSign(v));
    animateCounter(document.getElementById('card-receitas-mini'), totalIncome,  formatCurrency);
    animateCounter(document.getElementById('card-despesas-mini'), totalExpense, formatCurrency);
    animateCounter(document.getElementById('card-income'),        totalIncome,  formatCurrency);
    animateCounter(document.getElementById('card-expense'),       totalExpense, formatCurrency);

    const expensePct = totalIncome > 0 ? Math.min((totalExpense / totalIncome) * 100, 100) : 0;
    document.getElementById('expense-bar').style.width      = `${expensePct}%`;
    document.getElementById('expense-pct-text').textContent = `${Math.round(expensePct)}% da sua renda gasta`;

    const statusEl = document.getElementById('expense-status');
    if (expensePct > 80)      { statusEl.textContent = 'Crítico';  statusEl.className = 'text-xs font-semibold text-red-500'; }
    else if (expensePct > 50) { statusEl.textContent = 'Atenção';  statusEl.className = 'text-xs font-semibold text-amber-500'; }
    else                      { statusEl.textContent = 'Saudável'; statusEl.className = 'text-xs font-semibold text-brand-green'; }

    const savingsRate = totalIncome > 0 ? Math.max(0, (totalIncome - totalExpense) / totalIncome) : 0;
    const score       = Math.min(100, Math.max(0, Math.round(savingsRate * 100)));
    const scoreEl     = document.getElementById('health-score');
    const scoreLbl    = document.getElementById('health-label');
    const scoreBar    = document.getElementById('health-bar');
    animateCounter(scoreEl, score, v => Math.round(v).toString());
    scoreBar.style.width = `${score}%`;
    if (score >= 70)      { scoreBar.style.backgroundColor = '#059669'; scoreLbl.textContent = 'Excelente'; scoreLbl.className = 'text-xs font-semibold text-brand-green'; }
    else if (score >= 40) { scoreBar.style.backgroundColor = '#f59e0b'; scoreLbl.textContent = 'Regular';   scoreLbl.className = 'text-xs font-semibold text-amber-500'; }
    else                  { scoreBar.style.backgroundColor = '#ef4444'; scoreLbl.textContent = 'Crítico';   scoreLbl.className = 'text-xs font-semibold text-red-500'; }

    renderRecentTransactions();
}

function renderRecentTransactions() {
    const tbody  = document.getElementById('tx-table-body');
    const recent = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
    tbody.innerHTML = recent.length === 0
        ? `<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500">Nenhuma transação recente.</td></tr>`
        : recent.map(generateTxRow).join('');
}

// ── Transactions ──────────────────────────────────────────────────────────────
function generateTxRow(tx) {
    const isIncome   = tx.type === 'income';
    const colorClass = isIncome ? 'text-brand-green' : 'text-gray-900 dark:text-white';
    const prefix     = isIncome ? '+' : '-';
    const catColor   = CATEGORY_COLORS[tx.category] || CATEGORY_COLORS['Outros'];
    const recurBadge = tx.recurring
        ? `<span class="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-500 border border-blue-200 dark:border-blue-800">↻ FIXO</span>`
        : '';
    return `
        <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group">
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-100 dark:bg-[#0B1121]">
                        <span class="material-symbols-outlined text-[18px] ${isIncome ? 'text-brand-green' : 'text-gray-500'}">${isIncome ? 'south_west' : 'north_east'}</span>
                    </div>
                    <span class="font-medium text-gray-900 dark:text-white">${tx.desc}</span>${recurBadge}
                </div>
            </td>
            <td class="px-6 py-4">
                <span class="px-2.5 py-1 rounded-full text-[10px] font-semibold border" style="color:${catColor};border-color:${catColor}40;background-color:${catColor}10">${tx.category}</span>
            </td>
            <td class="px-6 py-4 text-gray-500 dark:text-gray-400 text-xs">${formatDate(tx.date)}</td>
            <td class="px-6 py-4 text-right font-semibold ${colorClass}">${prefix} ${formatCurrency(tx.value)}</td>
            <td class="px-6 py-4 text-center">
                <div class="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="editTx(${tx.id})" class="text-gray-400 hover:text-brand-green">
                        <span class="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button onclick="deleteTx(${tx.id})" class="text-gray-400 hover:text-red-500">
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                </div>
            </td>
        </tr>`;
}

function filterTx(type) {
    currentTxFilter = type;
    const btns = { all: 'filter-all', income: 'filter-income', expense: 'filter-expense' };
    Object.entries(btns).forEach(([k, id]) => {
        const btn = document.getElementById(id);
        if (k === type) {
            btn.classList.add('bg-gray-100', 'dark:bg-gray-800', 'text-gray-900', 'dark:text-white');
            btn.classList.remove('text-gray-500');
        } else {
            btn.classList.remove('bg-gray-100', 'dark:bg-gray-800', 'text-gray-900', 'dark:text-white');
            btn.classList.add('text-gray-500');
        }
    });
    renderAllTransactions();
}

function renderAllTransactions() {
    const tbody  = document.getElementById('all-tx-table-body');
    let filtered = [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (currentTxFilter !== 'all') filtered = filtered.filter(t => t.type === currentTxFilter);
    if (searchQuery)
        filtered = filtered.filter(t =>
            t.desc.toLowerCase().includes(searchQuery) ||
            t.category.toLowerCase().includes(searchQuery));
    tbody.innerHTML = filtered.length === 0
        ? `<tr><td colspan="5" class="px-6 py-8 text-center text-gray-500">${searchQuery ? `Nenhum resultado para "${searchQuery}".` : 'Nenhuma transação encontrada.'}</td></tr>`
        : filtered.map(generateTxRow).join('');
}

function editTx(id) {
    const tx = transactions.find(t => t.id === id);
    if (!tx) return;
    editingTxId = id;
    setTxType(tx.type);
    document.getElementById('tx-val').value       = formatCurrency(tx.value);
    document.getElementById('tx-desc').value      = tx.desc;
    document.getElementById('tx-cat').value       = tx.category;
    document.getElementById('tx-date').value      = tx.date;
    document.getElementById('tx-recurring').checked = !!tx.recurring;
    document.getElementById('modal-title').textContent   = 'Editar Transação';
    document.getElementById('tx-submit-btn').textContent = 'Atualizar';
    openModal(true);
}

function deleteTx(id) {
    showConfirm('Excluir esta transação? Esta ação não pode ser desfeita.', () => {
        transactions = transactions.filter(t => t.id !== id);
        saveData();
        showToast('Transação excluída.', 'info');
    });
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal(keepValues = false) {
    if (!keepValues) {
        editingTxId = null;
        document.getElementById('tx-form').reset();
        document.getElementById('tx-date').valueAsDate = new Date();
        document.getElementById('modal-title').textContent   = 'Nova Transação';
        document.getElementById('tx-submit-btn').textContent = 'Salvar Transação';
        setTxType('expense');
    }
    showOverlay('modal-overlay', 'modal-box');
}

function closeModal() {
    hideOverlay('modal-overlay', 'modal-box');
    setTimeout(() => { editingTxId = null; }, 300);
}

function setTxType(type) {
    currentTxType   = type;
    const activeCls   = 'flex-1 py-1.5 text-sm font-semibold rounded-md bg-white dark:bg-brand-darkCard text-gray-900 dark:text-white shadow-sm transition-all';
    const inactiveCls = 'flex-1 py-1.5 text-sm font-semibold rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 transition-all';
    document.getElementById('btn-type-expense').className = type === 'expense' ? activeCls : inactiveCls;
    document.getElementById('btn-type-income').className  = type === 'income'  ? activeCls : inactiveCls;
    const catSelect = document.getElementById('tx-cat');
    catSelect.innerHTML = type === 'expense'
        ? CATEGORIES.map(c => `<option value="${c}">${c}</option>`).join('')
        : `<option value="Receita">Receita / Salário</option>`;
}

document.getElementById('tx-form').addEventListener('submit', e => {
    e.preventDefault();
    const value = parseCurrency(document.getElementById('tx-val').value);
    if (value <= 0) return alert('Insira um valor válido.');
    const txData = {
        type:      currentTxType,
        value,
        desc:      document.getElementById('tx-desc').value.trim(),
        category:  document.getElementById('tx-cat').value,
        date:      document.getElementById('tx-date').value,
        recurring: document.getElementById('tx-recurring').checked,
    };
    if (editingTxId !== null) {
        const idx = transactions.findIndex(t => t.id === editingTxId);
        if (idx !== -1) transactions[idx] = { ...transactions[idx], ...txData };
        showToast('Transação atualizada!');
    } else {
        transactions.push({ id: Date.now(), ...txData });
        showToast('Transação salva com sucesso!');
    }
    saveData();
    closeModal();
});

// ── App ───────────────────────────────────────────────────────────────────────
function switchTab(tabId) {
    document.querySelectorAll('.page-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`page-${tabId}`).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-gray-100', 'dark:bg-gray-800', 'text-gray-900', 'dark:text-white');
        btn.classList.add('text-gray-500', 'dark:text-gray-400');
    });
    const btn = document.getElementById(`nav-${tabId}`);
    btn.classList.remove('text-gray-500', 'dark:text-gray-400');
    btn.classList.add('bg-gray-100', 'dark:bg-gray-800', 'text-gray-900', 'dark:text-white');
    closeSidebar();
}

function updateAllViews() {
    updateDashboard();
    renderAllTransactions();
}

function toggleSidebar() {
    const sidebar  = document.getElementById('sidebar');
    const overlay  = document.getElementById('sidebar-overlay');
    const isHidden = sidebar.classList.contains('-translate-x-full');
    sidebar.classList.toggle('-translate-x-full', !isHidden);
    overlay.classList.toggle('hidden', !isHidden);
}

function closeSidebar() {
    document.getElementById('sidebar').classList.add('-translate-x-full');
    document.getElementById('sidebar-overlay').classList.add('hidden');
}

function showConfirm(message, onConfirm) {
    document.getElementById('confirm-msg').textContent = message;
    document.getElementById('confirm-yes').onclick = () => { hideOverlay('confirm-modal', 'confirm-box'); onConfirm(); };
    document.getElementById('confirm-no').onclick  = () => hideOverlay('confirm-modal', 'confirm-box');
    showOverlay('confirm-modal', 'confirm-box');
}

function handleSearch(query) {
    searchQuery = query.toLowerCase().trim();
    if (searchQuery && document.getElementById('page-transactions').classList.contains('hidden'))
        switchTab('transactions');
    renderAllTransactions();
}

function checkTheme() {
    const saved       = localStorage.getItem('centz_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (saved === 'dark' || (!saved && prefersDark)) {
        document.documentElement.classList.add('dark');
        document.getElementById('theme-icon').textContent = 'light_mode';
    } else {
        document.documentElement.classList.remove('dark');
        document.getElementById('theme-icon').textContent = 'dark_mode';
    }
}

function toggleTheme() {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        localStorage.setItem('centz_theme', 'light');
        document.getElementById('theme-icon').textContent = 'dark_mode';
    } else {
        html.classList.add('dark');
        localStorage.setItem('centz_theme', 'dark');
        document.getElementById('theme-icon').textContent = 'light_mode';
    }
}

window.onload = () => {
    checkTheme();
    checkAuth();
};
