const API_BASE = 'https://server-license.onrender.com';
let authToken = null;
let hourlyChart = null;
let categoryChart = null;

// DOM elements
const loginBtn = document.getElementById('loginBtn');
const adminKeyInput = document.getElementById('adminKey');
const status = document.getElementById('status');
const dashboard = document.getElementById('dashboard');
const timePeriodSelect = document.getElementById('timePeriod');
const refreshBtn = document.getElementById('refreshBtn');
const lastUpdated = document.getElementById('lastUpdated');

// Event listeners
loginBtn.addEventListener('click', login);
refreshBtn.addEventListener('click', loadDashboardData);
timePeriodSelect.addEventListener('change', loadDashboardData);

async function login() {
    const adminKey = adminKeyInput.value.trim();
    if (!adminKey) {
        showStatus('Please enter admin key', 'error');
        return;
    }

    try {
        loginBtn.textContent = 'Logging in...';
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
            showStatus('Login successful', 'success');
            dashboard.classList.remove('hidden');
            loadDashboardData();
        } else {
            showStatus('Invalid admin key', 'error');
        }
    } catch (error) {
        showStatus('Login failed: ' + error.message, 'error');
    } finally {
        loginBtn.textContent = 'Login';
        loginBtn.disabled = false;
    }
}

async function loadDashboardData() {
    if (!authToken) return;

    try {
        refreshBtn.textContent = 'Loading...';
        refreshBtn.disabled = true;

        const timePeriod = timePeriodSelect.value;
        const hours = getHoursFromPeriod(timePeriod);

        // Load stats
        const statsResponse = await fetch(`${API_BASE}/api/multipliers/stats?hours=${hours}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        if (!statsResponse.ok) {
            throw new Error('Failed to load stats');
        }

        const statsData = await statsResponse.json();
        updateDashboard(statsData);
        lastUpdated.textContent = new Date().toLocaleString();

    } catch (error) {
        showStatus('Failed to load data: ' + error.message, 'error');
    } finally {
        refreshBtn.textContent = 'Refresh Data';
        refreshBtn.disabled = false;
    }
}

function getHoursFromPeriod(period) {
    const map = { '1h': 1, '6h': 6, '24h': 24, '7d': 168 };
    return map[period] || 24;
}

function updateDashboard(data) {
    // Update stats cards
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
            datasets: [{
                label: 'Total Rounds',
                data: hourlyData.map(h => h.total_count),
                backgroundColor: 'rgba(102, 126, 234, 0.6)',
                borderColor: 'rgba(102, 126, 234, 1)',
                borderWidth: 1
            }, {
                label: 'High Multipliers (10x+)',
                data: hourlyData.map(h => h.high_count),
                backgroundColor: 'rgba(231, 76, 60, 0.6)',
                borderColor: 'rgba(231, 76, 60, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
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

    const colors = {
        'blue': 'rgba(52, 152, 219, 0.8)',
        'purple': 'rgba(155, 89, 182, 0.8)',
        'pink': 'rgba(231, 76, 60, 0.8)'
    };

    categoryChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: categoryData.map(c => c.color_category + ' (' + c.avg_value + 'x avg)'),
            datasets: [{
                data: categoryData.map(c => c.count),
                backgroundColor: categoryData.map(c => colors[c.color_category] || 'rgba(149, 165, 166, 0.8)')
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
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
        item.innerHTML = `
            <span>#${index + 1}</span>
            <span class="multiplier-value">${mult.value}x</span>
            <span>${new Date(mult.estimated_timestamp).toLocaleString()}</span>
        `;
        container.appendChild(item);
    });
}

function showStatus(message, type) {
    status.textContent = message;
    status.className = `status-${type}`;
    setTimeout(() => {
        status.textContent = '';
        status.className = '';
    }, 5000);
}
