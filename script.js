const API_BASE = 'https://server-license.onrender.com';
let authToken = null;
let hourlyChart = null;
let categoryChart = null;

// DOM elements
const authSection = document.getElementById('authSection');
const dashboard = document.getElementById('dashboard');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const adminKeyInput = document.getElementById('adminKey');
const status = document.getElementById('status');
const timePeriodSelect = document.getElementById('timePeriod');
const refreshBtn = document.getElementById('refreshBtn');
const lastUpdated = document.getElementById('lastUpdated');

// Event listeners
loginBtn.addEventListener('click', login);
logoutBtn.addEventListener('click', logout);
refreshBtn.addEventListener('click', loadDashboardData);
timePeriodSelect.addEventListener('change', loadDashboardData);

// Check for existing auth on load
window.addEventListener('load', () => {
    const savedToken = localStorage.getItem('authToken');
    if (savedToken) {
        authToken = savedToken;
        showDashboard();
        loadDashboardData();
    }
});

async function login() {
    const adminKey = adminKeyInput.value.trim();
    if (!adminKey) {
        showStatus('Please enter admin key', 'error');
        return;
    }

    try {
        loginBtn.textContent = 'Accessing...';
        loginBtn.disabled = true;

        const response = await fetch(`${API_BASE}/admin/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'admin-key': adminKey
            }
        });

        if (response.ok) {
            const data = await response.json();
            authToken = data.token;
            localStorage.setItem('authToken', authToken);
            showStatus('Access granted', 'success');
            showDashboard();
            loadDashboardData();
        } else {
            showStatus('Invalid admin key', 'error');
        }
    } catch (error) {
        showStatus('Connection failed', 'error');
    } finally {
        loginBtn.textContent = 'Access Dashboard';
        loginBtn.disabled = false;
    }
}

function logout() {
    authToken = null;
    localStorage.removeItem('authToken');
    hideDashboard();
    adminKeyInput.value = '';
    showStatus('', '');
}

function showDashboard() {
    authSection.classList.add('hidden');
    dashboard.classList.remove('hidden');
    // Force a reflow before adding visible class
    dashboard.offsetHeight; 
    dashboard.classList.add('visible');
}

function hideDashboard() {
    dashboard.classList.remove('visible');
    setTimeout(() => {
        dashboard.classList.add('hidden');
        authSection.classList.remove('hidden');
    }, 300);
}

async function loadDashboardData() {
    if (!authToken) return;

    try {
        refreshBtn.textContent = 'Loading...';
        refreshBtn.disabled = true;

        const timePeriod = timePeriodSelect.value;
        const hours = getHoursFromPeriod(timePeriod);

        const statsResponse = await fetch(`${API_BASE}/api/multipliers/stats?hours=${hours}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (!statsResponse.ok) {
            if (statsResponse.status === 401) {
                logout();
                showStatus('Session expired', 'error');
                return;
            }
            throw new Error('Failed to load data');
        }

        const statsData = await statsResponse.json();
        updateDashboard(statsData);
        lastUpdated.textContent = `Updated ${new Date().toLocaleTimeString()}`;

    } catch (error) {
        showStatus('Failed to load data', 'error');
    } finally {
        refreshBtn.textContent = 'Refresh';
        refreshBtn.disabled = false;
    }
}

function getHoursFromPeriod(period) {
    const map = { '1h': 1, '6h': 6, '24h': 24, '7d': 168 };
    return map[period] || 24;
}

function updateDashboard(data) {
    // Update stats
    const totalRounds = data.hourly_distribution.reduce((sum, h) => sum + h.total_count, 0);
    const avgMultiplier = data.hourly_distribution.length > 0 ? 
        (data.hourly_distribution.reduce((sum, h) => sum + (h.avg_multiplier * h.total_count), 0) / totalRounds).toFixed(2) : 0;
    const highMultipliers = data.top_multipliers.filter(m => m.value >= 10).length;
    const extremeMultipliers = data.top_multipliers.filter(m => m.value >= 50).length;

    document.getElementById('totalRounds').textContent = totalRounds.toLocaleString();
    document.getElementById('avgMultiplier').textContent = avgMultiplier + 'x';
    document.getElementById('highMultipliers').textContent = highMultipliers;
    document.getElementById('extremeMultipliers').textContent = extremeMultipliers;

    // Update charts
    updateHourlyChart(data.hourly_distribution);
    updateCategoryChart(data.category_distribution);
    updateTopMultipliers(data.top_multipliers.slice(0, 20));
}

function updateHourlyChart(hourlyData) {
    const ctx = document.getElementById('hourlyChart').getContext('2d');
    
    if (hourlyChart) {
        hourlyChart.destroy();
    }

    hourlyChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: hourlyData.map(h => h.hour_of_day + ':00'),
            datasets: [
                {
                    label: 'Blue',
                    data: hourlyData.map(h => h.blue_count),
                    backgroundColor: '#3b82f6'
                },
                {
                    label: 'Purple',
                    data: hourlyData.map(h => h.purple_count),
                    backgroundColor: '#a855f7'
                },
                {
                    label: 'Pink',
                    data: hourlyData.map(h => h.pink_count),
                    backgroundColor: '#ec4899'
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: {
                        color: '#fff',
                        font: { family: 'Inter' }
                    }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    ticks: { color: '#666' },
                    grid: { color: '#222' }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    ticks: { color: '#666' },
                    grid: { color: '#222' }
                }
            }
        }
    });
}


function updateCategoryChart(categoryData) {
    const ctx = document.getElementById('categoryChart').getContext('2d');
    
    if (categoryChart) {
        categoryChart.destroy();
    }

    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: categoryData.map(c => c.color_category),
            datasets: [{
                data: categoryData.map(c => c.count),
                backgroundColor: ['#3b82f6', '#a855f7', '#ec4899'],
                borderColor: '#000',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#fff',
                        font: { family: 'Inter' },
                        padding: 20
                    }
                }
            }
        }
    });
}

function updateTopMultipliers(topMultipliers) {
    const container = document.getElementById('topMultipliersList');
    container.innerHTML = '';

    topMultipliers.forEach((mult, index) => {
        const item = document.createElement('div');
        item.className = 'multiplier-item';
        const color = mult.value >= 10 ? '#ec4899' : (mult.value >= 2 ? '#a855f7' : '#3b82f6');
        item.innerHTML = `
            <span class="multiplier-rank">#${index + 1}</span>
            <span class="multiplier-value" style="background:${color};padding:2px 8px;border-radius:12px;color:#fff;font-size:0.85rem;">
                ${mult.value}x
            </span>
            <span class="multiplier-time">${new Date(mult.estimated_timestamp).toLocaleString()}</span>
        `;
        container.appendChild(item);
    });
}

function showStatus(message, type) {
    status.textContent = message;
    status.className = `status status-${type}`;
    if (message) {
        setTimeout(() => {
            status.textContent = '';
            status.className = 'status';
        }, 3000);
    }
}
