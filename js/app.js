/* ============================================
   ZV DASHBOARD — Alpine.js Application Logic
   ============================================ */

document.addEventListener('alpine:init', () => {

  // Shared auth store for cross-component access
  Alpine.store('authUser', {
    fullname: '',
    username: '',
    initials: '',
    load() {
      const session = localStorage.getItem('zv_session');
      if (session) {
        const u = JSON.parse(session);
        this.fullname = u.fullname;
        this.username = u.username;
        this.initials = u.fullname.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
      }
    },
    set(user) {
      this.fullname = user.fullname;
      this.username = user.username;
      this.initials = user.fullname.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    },
    clear() {
      this.fullname = '';
      this.username = '';
      this.initials = '';
    },
  });

  // ==========================================
  // AUTH SYSTEM
  // ==========================================
  Alpine.data('auth', () => ({
    page: 'login', // 'login' | 'register'
    isLoggedIn: false,
    transitioning: false,
    shaking: false,
    currentUser: null,
    showPw: false,
    showPwConfirm: false,
    errorMsg: '',
    successMsg: '',

    // Form
    loginForm: { username: '', password: '' },
    regForm: { fullname: '', username: '', password: '', confirmPassword: '' },

    init() {
      const session = localStorage.getItem('zv_session');
      if (session) {
        this.currentUser = JSON.parse(session);
        this.isLoggedIn = true;
        Alpine.store('authUser').set(this.currentUser);
      }
    },

    // --- Register ---
    register() {
      this.errorMsg = '';
      const { fullname, username, password, confirmPassword } = this.regForm;

      if (!fullname.trim() || !username.trim() || !password) {
        this.showError('Semua field harus diisi!');
        return;
      }
      if (username.trim().length < 3) {
        this.showError('Username minimal 3 karakter!');
        return;
      }
      if (password.length < 4) {
        this.showError('Password minimal 4 karakter!');
        return;
      }
      if (password !== confirmPassword) {
        this.showError('Konfirmasi password tidak cocok!');
        return;
      }

      // Check if username exists
      const users = JSON.parse(localStorage.getItem('zv_users') || '[]');
      if (users.find(u => u.username === username.trim().toLowerCase())) {
        this.showError('Username sudah digunakan!');
        return;
      }

      // Save user
      const newUser = {
        fullname: fullname.trim(),
        username: username.trim().toLowerCase(),
        password: btoa(password), // simple encoding
        createdAt: new Date().toISOString(),
      };
      users.push(newUser);
      localStorage.setItem('zv_users', JSON.stringify(users));

      // Redirect to login page (user must login manually)
      this.regForm = { fullname: '', username: '', password: '', confirmPassword: '' };
      this.page = 'login';
      this.loginForm.username = newUser.username;
      this.loginForm.password = '';
      this.errorMsg = '';

      // Show success message via a temporary green style
      this.successMsg = 'Akun berhasil dibuat! Silakan masuk dengan username & password kamu.';
      setTimeout(() => { this.successMsg = ''; }, 5000);
    },

    // --- Login ---
    login() {
      this.errorMsg = '';
      const { username, password } = this.loginForm;

      if (!username.trim() || !password) {
        this.showError('Username dan password harus diisi!');
        return;
      }

      const users = JSON.parse(localStorage.getItem('zv_users') || '[]');
      const user = users.find(u => u.username === username.trim().toLowerCase());

      if (!user || atob(user.password) !== password) {
        this.showError('Username atau password salah!');
        return;
      }

      this.currentUser = { fullname: user.fullname, username: user.username };
      localStorage.setItem('zv_session', JSON.stringify(this.currentUser));
      Alpine.store('authUser').set(this.currentUser);

      this.transitioning = true;
      setTimeout(() => {
        this.isLoggedIn = true;
        this.transitioning = false;
      }, 450);
    },

    // --- Logout ---
    logout() {
      localStorage.removeItem('zv_session');
      Alpine.store('authUser').clear();
      this.currentUser = null;
      this.isLoggedIn = false;
      this.loginForm = { username: '', password: '' };
      this.regForm = { fullname: '', username: '', password: '', confirmPassword: '' };
      this.errorMsg = '';
    },

    // --- Helpers ---
    showError(msg) {
      this.errorMsg = msg;
      this.shaking = true;
      setTimeout(() => { this.shaking = false; }, 500);
    },

    switchTab(tab) {
      this.page = tab;
      this.errorMsg = '';
    },

    getInitials() {
      if (!this.currentUser) return '?';
      return this.currentUser.fullname
        .split(' ')
        .map(w => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();
    },

    passwordStrength() {
      const pw = this.regForm.password;
      if (!pw) return { width: '0%', color: 'transparent', label: '' };
      let score = 0;
      if (pw.length >= 4) score++;
      if (pw.length >= 6) score++;
      if (/[A-Z]/.test(pw)) score++;
      if (/[0-9]/.test(pw)) score++;
      if (/[^A-Za-z0-9]/.test(pw)) score++;

      const levels = [
        { width: '20%', color: '#FF007F', label: 'Sangat Lemah' },
        { width: '40%', color: '#FF6B35', label: 'Lemah' },
        { width: '60%', color: '#FBBF24', label: 'Cukup' },
        { width: '80%', color: '#34D399', label: 'Kuat' },
        { width: '100%', color: '#00F0FF', label: 'Sangat Kuat' },
      ];
      return levels[Math.min(score, 4)];
    },
  }));

  // ==========================================
  // MAIN DASHBOARD STORE
  // ==========================================
  Alpine.data('dashboard', () => ({
    // --- State ---
    filter: 'month', // 'today' | 'month' | 'year'
    transactions: [],
    nextId: 1,
    toastMsg: '',
    toastType: 'success',
    toastVisible: false,
    selectedYear: new Date().getFullYear(),

    // --- Form State ---
    form: {
      desc: '',
      amount: '',
      type: 'out',
      category: 'Operasional',
      date: new Date().toISOString().split('T')[0],
    },

    categories: ['Bahan Baku', 'Operasional', 'Gaji', 'Penjualan', 'Investasi', 'Pribadi', 'Lainnya'],

    // --- Init ---
    init() {
      this.loadFromStorage();
      if (this.transactions.length === 0) {
        this.seedDemoData();
      }
      this.$nextTick(() => {
        this.initCharts();
        this.animateFadeIns();
      });
    },

    // --- LocalStorage ---
    loadFromStorage() {
      try {
        const saved = localStorage.getItem('zv_transactions');
        if (saved) {
          this.transactions = JSON.parse(saved);
          this.nextId = Math.max(...this.transactions.map(t => t.id), 0) + 1;
        }
      } catch (e) { console.warn('Failed to load:', e); }
    },

    saveToStorage() {
      localStorage.setItem('zv_transactions', JSON.stringify(this.transactions));
    },

    // --- Demo Data ---
    seedDemoData() {
      const today = new Date();
      const fmt = (d) => d.toISOString().split('T')[0];
      const daysAgo = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return fmt(d); };

      const demoData = [
        { desc: 'Penjualan Paket A', amount: 2500000, type: 'in', category: 'Penjualan', date: fmt(today) },
        { desc: 'Beli Bahan Baku Tepung', amount: 350000, type: 'out', category: 'Bahan Baku', date: fmt(today) },
        { desc: 'Bayar Listrik Toko', amount: 275000, type: 'out', category: 'Operasional', date: daysAgo(1) },
        { desc: 'Penjualan Online', amount: 1800000, type: 'in', category: 'Penjualan', date: daysAgo(1) },
        { desc: 'Gaji Karyawan Mingguan', amount: 500000, type: 'out', category: 'Gaji', date: daysAgo(2) },
        { desc: 'Transfer dari Partner', amount: 3000000, type: 'in', category: 'Investasi', date: daysAgo(3) },
        { desc: 'Beli Packaging', amount: 180000, type: 'out', category: 'Bahan Baku', date: daysAgo(4) },
        { desc: 'Penjualan Langsung', amount: 950000, type: 'in', category: 'Penjualan', date: daysAgo(5) },
        { desc: 'Service Motor', amount: 150000, type: 'out', category: 'Pribadi', date: daysAgo(7) },
        { desc: 'Penjualan Catering', amount: 4200000, type: 'in', category: 'Penjualan', date: daysAgo(10) },
        { desc: 'Sewa Tempat Bulanan', amount: 1500000, type: 'out', category: 'Operasional', date: daysAgo(15) },
        { desc: 'Pembelian Minyak Goreng', amount: 420000, type: 'out', category: 'Bahan Baku', date: daysAgo(20) },
        { desc: 'Pendapatan Event', amount: 5500000, type: 'in', category: 'Penjualan', date: daysAgo(25) },
        { desc: 'Bayar Internet', amount: 350000, type: 'out', category: 'Operasional', date: daysAgo(28) },
      ];

      demoData.forEach(d => {
        this.transactions.push({ id: this.nextId++, ...d });
      });
      this.saveToStorage();
    },

    // --- Filtered Data ---
    get filtered() {
      const now = new Date();
      return this.transactions.filter(t => {
        const d = new Date(t.date);
        if (this.filter === 'today') {
          return d.toDateString() === now.toDateString();
        } else if (this.filter === 'month') {
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        } else {
          return d.getFullYear() === now.getFullYear();
        }
      }).sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    get totalIncome() {
      return this.filtered.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0);
    },

    get totalExpense() {
      return this.filtered.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);
    },

    get netBalance() {
      return this.totalIncome - this.totalExpense;
    },

    get recentTransactions() {
      return this.filtered.slice(0, 7);
    },

    get allTimeSaldo() {
      const inc = this.transactions.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0);
      const exp = this.transactions.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);
      return inc - exp;
    },

    // --- Yearly Totals (selectable year) ---
    get yearlyIncome() {
      return this.transactions
        .filter(t => t.type === 'in' && new Date(t.date).getFullYear() === this.selectedYear)
        .reduce((s, t) => s + t.amount, 0);
    },

    get yearlyExpense() {
      return this.transactions
        .filter(t => t.type === 'out' && new Date(t.date).getFullYear() === this.selectedYear)
        .reduce((s, t) => s + t.amount, 0);
    },

    get yearlyBalance() {
      return this.yearlyIncome - this.yearlyExpense;
    },

    get availableYears() {
      const years = [...new Set(this.transactions.map(t => new Date(t.date).getFullYear()))];
      if (!years.includes(this.selectedYear)) years.push(this.selectedYear);
      return years.sort((a, b) => b - a);
    },

    prevYear() { this.selectedYear--; },
    nextYear() { this.selectedYear++; },

    // --- Spending by Category ---
    get spendingByCategory() {
      const map = {};
      this.filtered.filter(t => t.type === 'out').forEach(t => {
        map[t.category] = (map[t.category] || 0) + t.amount;
      });
      return Object.entries(map)
        .map(([cat, amount]) => ({ category: cat, amount }))
        .sort((a, b) => b.amount - a.amount);
    },

    // --- Format Currency ---
    formatRp(n) {
      return 'Rp ' + Math.abs(n).toLocaleString('id-ID');
    },

    formatDate(dateStr) {
      const d = new Date(dateStr);
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    },

    formatTime(dateStr) {
      const d = new Date(dateStr);
      return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    },

    // --- Add Transaction ---
    addTransaction() {
      const amount = parseInt(this.form.amount);
      if (!this.form.desc.trim() || !amount || amount <= 0) {
        this.showToast('Mohon isi semua data dengan benar!', 'error');
        return;
      }

      this.transactions.push({
        id: this.nextId++,
        desc: this.form.desc.trim(),
        amount: amount,
        type: this.form.type,
        category: this.form.category,
        date: this.form.date || new Date().toISOString().split('T')[0],
      });

      this.saveToStorage();
      this.form.desc = '';
      this.form.amount = '';
      this.form.date = new Date().toISOString().split('T')[0];
      this.showToast('Transaksi berhasil ditambahkan! ✓', 'success');

      this.$nextTick(() => this.updateCharts());
    },

    // --- Delete Transaction ---
    deleteTransaction(id) {
      this.transactions = this.transactions.filter(t => t.id !== id);
      this.saveToStorage();
      this.showToast('Transaksi dihapus.', 'error');
      this.$nextTick(() => this.updateCharts());
    },

    // --- Set Filter ---
    setFilter(f) {
      this.filter = f;
      this.$nextTick(() => this.updateCharts());
    },

    // --- Toast ---
    showToast(msg, type = 'success') {
      this.toastMsg = msg;
      this.toastType = type;
      this.toastVisible = true;
      setTimeout(() => { this.toastVisible = false; }, 2500);
    },

    // --- Chart.js ---
    lineChart: null,
    doughnutChart: null,

    initCharts() {
      this.createLineChart();
      this.createDoughnutChart();
    },

    updateCharts() {
      if (this.lineChart) this.lineChart.destroy();
      if (this.doughnutChart) this.doughnutChart.destroy();
      this.createLineChart();
      this.createDoughnutChart();
    },

    createLineChart() {
      const ctx = document.getElementById('lineChart');
      if (!ctx) return;

      const grouped = {};
      this.filtered.forEach(t => {
        const key = t.date;
        if (!grouped[key]) grouped[key] = { income: 0, expense: 0 };
        if (t.type === 'in') grouped[key].income += t.amount;
        else grouped[key].expense += t.amount;
      });

      const sorted = Object.entries(grouped).sort((a,b) => a[0].localeCompare(b[0]));
      const labels = sorted.map(([d]) => {
        const dt = new Date(d);
        return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      });

      this.lineChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [
            {
              label: 'Pemasukan',
              data: sorted.map(([,v]) => v.income),
              borderColor: '#00F0FF',
              backgroundColor: 'rgba(0,240,255,0.08)',
              fill: true,
              tension: 0.4,
              pointRadius: 4,
              pointBackgroundColor: '#00F0FF',
              pointBorderWidth: 0,
              borderWidth: 2,
            },
            {
              label: 'Pengeluaran',
              data: sorted.map(([,v]) => v.expense),
              borderColor: '#FF007F',
              backgroundColor: 'rgba(255,0,127,0.08)',
              fill: true,
              tension: 0.4,
              pointRadius: 4,
              pointBackgroundColor: '#FF007F',
              pointBorderWidth: 0,
              borderWidth: 2,
            }
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { intersect: false, mode: 'index' },
          plugins: {
            legend: {
              display: true,
              position: 'top',
              align: 'end',
              labels: { color: '#94A3B8', font: { size: 11, family: 'Inter' }, boxWidth: 12, padding: 16 },
            },
            tooltip: {
              backgroundColor: 'rgba(15,23,42,0.95)',
              titleColor: '#F8FAFC',
              bodyColor: '#94A3B8',
              borderColor: 'rgba(255,255,255,0.1)',
              borderWidth: 1,
              cornerRadius: 8,
              padding: 12,
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: Rp ${ctx.parsed.y.toLocaleString('id-ID')}`,
              },
            },
          },
          scales: {
            x: {
              grid: { color: 'rgba(255,255,255,0.03)', drawBorder: false },
              ticks: { color: '#64748B', font: { size: 10 } },
            },
            y: {
              grid: { color: 'rgba(255,255,255,0.03)', drawBorder: false },
              ticks: {
                color: '#64748B',
                font: { size: 10 },
                callback: (v) => v >= 1000000 ? (v/1000000).toFixed(1) + 'jt' : v >= 1000 ? (v/1000) + 'rb' : v,
              },
            },
          },
        },
      });
    },

    createDoughnutChart() {
      const ctx = document.getElementById('doughnutChart');
      if (!ctx) return;

      const data = this.spendingByCategory.slice(0, 5);
      const colors = ['#FF007F', '#00F0FF', '#FBBF24', '#34D399', '#A78BFA'];

      if (data.length === 0) {
        this.doughnutChart = new Chart(ctx, {
          type: 'doughnut',
          data: { labels: ['Belum ada data'], datasets: [{ data: [1], backgroundColor: ['rgba(255,255,255,0.05)'], borderWidth: 0 }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
        });
        return;
      }

      this.doughnutChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: data.map(d => d.category),
          datasets: [{
            data: data.map(d => d.amount),
            backgroundColor: colors.slice(0, data.length),
            borderWidth: 0,
            hoverOffset: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: 'rgba(15,23,42,0.95)',
              titleColor: '#F8FAFC',
              bodyColor: '#94A3B8',
              borderColor: 'rgba(255,255,255,0.1)',
              borderWidth: 1,
              cornerRadius: 8,
              padding: 12,
              callbacks: {
                label: (ctx) => ` ${ctx.label}: Rp ${ctx.parsed.toLocaleString('id-ID')}`,
              },
            },
          },
        },
      });
    },

    // --- Fade-in animation ---
    animateFadeIns() {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.05 });
      document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));
    },

    // --- Reset Data ---
    resetAllData() {
      if (confirm('Hapus semua data transaksi? Tindakan ini tidak bisa dibatalkan.')) {
        this.transactions = [];
        this.nextId = 1;
        this.saveToStorage();
        this.showToast('Semua data telah direset.', 'error');
        this.$nextTick(() => this.updateCharts());
      }
    },
  }));
});
