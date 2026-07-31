// Account Banned Page JavaScript
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Get user info from localStorage or API
    const token = localStorage.getItem('anify-token');
    const userInfo = JSON.parse(localStorage.getItem('anify-user-profile') || '{}');

    // DOM Elements
    const banReasonEl = document.getElementById('ban-reason');
    const banStatusEl = document.getElementById('ban-status');
    const banDateEl = document.getElementById('ban-date');
    const banEndsEl = document.getElementById('ban-ends');
    const refreshStatusBtn = document.getElementById('refresh-status');
    const contactSupportBtn = document.getElementById('contact-support');
    const logoutBtn = document.getElementById('logout-btn');

    // Fetch ban details from server
    async function fetchBanDetails() {
        if (!token) {
            // No token, redirect to login
            window.location.href = '/anify.html#login';
            return;
        }

        try {
            const response = await fetch('/api/auth/user', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                // If unauthorized, redirect to login
                if (response.status === 401) {
                    window.location.href = '/anify.html#login';
                    return;
                }
                throw new Error('Failed to fetch user details');
            }

            const data = await response.json();
            
            if (data.ok && data.user) {
                updateBanDetails(data.user);
            }
        } catch (error) {
            console.error('Failed to fetch ban details:', error);
        }
    }

    // Update UI with ban details
    function updateBanDetails(user) {
        const banInfo = user.banInfo || {};
        
        // Update reason
        if (banInfo.reason) {
            banReasonEl.textContent = banInfo.reason;
        } else {
            banReasonEl.textContent = 'Violation of Community Guidelines';
        }

        // Update status
        const isTemporary = banInfo.banEnds && new Date(banInfo.banEnds) > new Date();
        banStatusEl.textContent = isTemporary ? 'Temporary' : 'Permanent';
        banStatusEl.className = `banned-info-value banned-status-badge ${isTemporary ? 'temporary' : 'permanent'}`;

        // Update ban date
        if (banInfo.bannedAt) {
            const bannedDate = new Date(banInfo.bannedAt);
            banDateEl.textContent = formatDate(bannedDate);
        } else {
            banDateEl.textContent = new Date().toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'long',
                year: 'numeric'
            });
        }

        // Update ban ends
        if (isTemporary && banInfo.banEnds) {
            const endDate = new Date(banInfo.banEnds);
            banEndsEl.textContent = formatDate(endDate);
            refreshStatusBtn.style.display = 'flex';
        } else {
            banEndsEl.textContent = 'Permanent';
            refreshStatusBtn.style.display = 'none';
        }
    }

    // Format date
    function formatDate(date) {
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'long',
            year: 'numeric'
        });
    }

    // Refresh status (for temporary bans)
    async function refreshStatus() {
        refreshStatusBtn.disabled = true;
        const originalIcon = refreshStatusBtn.querySelector('svg');
        originalIcon.classList.add('animate-spin');

        try {
            await fetchBanDetails();
            
            // Check if user is still banned
            const response = await fetch('/api/auth/user', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.ok && data.user && data.user.status !== 'Banned') {
                    // User is no longer banned, redirect to home
                    alert('Your account has been restored! Redirecting to home...');
                    window.location.href = '/anify.html';
                    return;
                }
            }
        } catch (error) {
            console.error('Failed to refresh status:', error);
        } finally {
            refreshStatusBtn.disabled = false;
            originalIcon.classList.remove('animate-spin');
        }
    }

    // Contact support
    function contactSupport() {
        const subject = encodeURIComponent('Account Suspension Inquiry');
        const body = encodeURIComponent(`Hello Anify Support Team,\n\nI am writing to inquire about my account suspension.\n\nUsername: ${userInfo.username || 'N/A'}\nEmail: ${userInfo.email || 'N/A'}\n\nPlease provide more information about why my account was suspended and if there is anything I can do to resolve this issue.\n\nThank you.`);
        
        window.location.href = `mailto:support@anify.com?subject=${subject}&body=${body}`;
    }

    // Logout
    function logout() {
        localStorage.removeItem('anify-token');
        localStorage.removeItem('anify-user-id');
        localStorage.removeItem('anify-user-profile');
        window.location.href = '/anify.html#login';
    }

    // Event listeners
    if (refreshStatusBtn) {
        refreshStatusBtn.addEventListener('click', refreshStatus);
    }

    if (contactSupportBtn) {
        contactSupportBtn.addEventListener('click', contactSupport);
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    // Prevent navigation away from banned page
    window.addEventListener('beforeunload', (e) => {
        if (userInfo.status === 'Banned') {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    // Initial fetch
    fetchBanDetails();

    // Auto-refresh status every 30 seconds for temporary bans
    setInterval(() => {
        const banEndsEl = document.getElementById('ban-ends');
        if (banEndsEl && banEndsEl.textContent !== 'Permanent') {
            refreshStatus();
        }
    }, 30000);
});
