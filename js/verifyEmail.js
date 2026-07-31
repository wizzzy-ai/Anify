/*  */// Verification Page JavaScript
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // Get email from URL parameter or localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get('email') || authService?.getRegisterEmail() || localStorage.getItem('registerEmail');
    
    if (email) {
        document.getElementById('verify-email-display').textContent = email;
        localStorage.setItem('registerEmail', email);
        if (authService) {
            authService.setRegisterEmail(email);
        }
    } else {
        // No email provided, redirect to register
        window.location.href = '/anify.html#register';
        return;
    }

    // OTP Input Elements
    const otpInputs = document.querySelectorAll('.verify-otp-input');
    const otpContainer = document.getElementById('otp-container');
    
    // Timer Elements
    const timerDisplay = document.getElementById('timer-display');
    const resendBtn = document.getElementById('resend-btn');
    const resendCountdown = document.getElementById('resend-countdown');
    const resendText = document.querySelector('.verify-resend-text');
    
    // Button Elements
    const verifyBtn = document.getElementById('verify-btn');
    const verifyBtnText = document.querySelector('.verify-btn-text');
    const verifyBtnLoader = document.querySelector('.verify-btn-loader');
    const changeEmailBtn = document.getElementById('change-email-btn');
    
    // Error Element
    const errorElement = document.getElementById('verify-error');
    
    // Success Elements
    const verifySuccess = document.getElementById('verify-success');
    const verifyContent = document.querySelector('.verify-content');
    
    // Back to login
    const backToLogin = document.getElementById('back-to-login');
    
    // Timer variables
    let timerInterval;
    let resendTimerInterval;
    let timeLeft = 600; // 10 minutes in seconds
    let resendCooldown = 0;
    
    // Initialize OTP inputs
    otpInputs.forEach((input, index) => {
        // Handle input
        input.addEventListener('input', (e) => {
            const value = e.target.value;
            
            // Only allow numbers
            if (!/^\d*$/.test(value)) {
                e.target.value = '';
                return;
            }
            
            // Auto-focus next input
            if (value.length === 1 && index < otpInputs.length - 1) {
                otpInputs[index + 1].focus();
            }
            
            // Clear error state
            clearError();
        });
        
        // Handle backspace
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                otpInputs[index - 1].focus();
            }
        });
        
        // Handle paste
        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const pastedData = e.clipboardData.getData('text').slice(0, 6);
            
            if (/^\d+$/.test(pastedData)) {
                pastedData.split('').forEach((digit, i) => {
                    if (otpInputs[i]) {
                        otpInputs[i].value = digit;
                    }
                });
                
                // Focus last filled input or next empty one
                const lastIndex = Math.min(pastedData.length, otpInputs.length) - 1;
                if (otpInputs[lastIndex]) {
                    otpInputs[lastIndex].focus();
                }
                
                clearError();
            }
        });
        
        // Handle focus
        input.addEventListener('focus', (e) => {
            e.target.select();
        });
    });
    
    // Start timer
    startTimer();
    
    // Verify button click
    verifyBtn.addEventListener('click', handleVerify);
    
    // Resend button click
    resendBtn.addEventListener('click', handleResend);
    
    // Change email button click
    changeEmailBtn.addEventListener('click', handleChangeEmail);
    
    // Back to login
    backToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = '/anify.html#login';
    });
    
    // Functions
    function startTimer() {
        timeLeft = 600;
        updateTimerDisplay();
        
        if (timerInterval) clearInterval(timerInterval);
        
        timerInterval = setInterval(() => {
            timeLeft--;
            updateTimerDisplay();
            
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                showResendButton();
            }
        }, 1000);
    }
    
    function updateTimerDisplay() {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    
    function showResendButton() {
        resendBtn.style.display = 'flex';
        document.getElementById('verify-timer').style.display = 'none';
    }
    
    function startResendCooldown(seconds) {
        resendCooldown = seconds;
        resendText.style.display = 'none';
        resendCountdown.style.display = 'inline';
        resendBtn.disabled = true;
        
        updateResendCountdown();
        
        if (resendTimerInterval) clearInterval(resendTimerInterval);
        
        resendTimerInterval = setInterval(() => {
            resendCooldown--;
            updateResendCountdown();
            
            if (resendCooldown <= 0) {
                clearInterval(resendTimerInterval);
                resendText.style.display = 'inline';
                resendCountdown.style.display = 'none';
                resendBtn.disabled = false;
            }
        }, 1000);
    }
    
    function updateResendCountdown() {
        resendCountdown.textContent = `Resend available in ${resendCooldown}s`;
    }
    
    function getOtpCode() {
        return Array.from(otpInputs).map(input => input.value).join('');
    }
    
    function clearError() {
        errorElement.classList.remove('show');
        errorElement.textContent = '';
        otpInputs.forEach(input => input.classList.remove('error'));
    }
    
    function showError(message) {
        errorElement.textContent = message;
        errorElement.classList.add('show');
        otpInputs.forEach(input => input.classList.add('error'));
        
        // Remove error class after animation
        setTimeout(() => {
            otpInputs.forEach(input => input.classList.remove('error'));
        }, 500);
    }
    
    function setLoading(loading) {
        verifyBtn.disabled = loading;
        verifyBtnText.style.opacity = loading ? '0' : '1';
        verifyBtnLoader.style.display = loading ? 'block' : 'none';
    }
    
    async function handleVerify() {
        const code = getOtpCode();
        
        if (code.length !== 6) {
            showError('Please enter all 6 digits');
            return;
        }
        
        setLoading(true);
        clearError();
        
        try {
            // Get last watched data for resume after registration
            const lastAnime = localStorage.getItem('lastWatchedAnime');
            const lastEpisode = localStorage.getItem('lastWatchedEpisode');
            const lastPlaybackTime = localStorage.getItem('lastWatchedTime');
            
            const requestBody = {
                email: email,
                code: code
            };
            
            // Include last watched data if available
            if (lastAnime && lastEpisode) {
                requestBody.lastAnime = lastAnime;
                requestBody.lastEpisode = lastEpisode;
                requestBody.lastPlaybackTime = lastPlaybackTime || 0;
            }
            
            const response = await fetch('/api/auth/verify-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            const data = await response.json();
            
            if (!response.ok || !data.ok) {
                throw new Error(data.error || 'Verification failed');
            }
            
            // Store token and user data
            if (data.token) {
                localStorage.setItem('anify-token', data.token);
            }
            if (data.user) {
                localStorage.setItem('anify-user-profile', JSON.stringify(data.user));
            }
            
            // Clear register email
            localStorage.removeItem('registerEmail');
            if (authService) {
                authService.setRegisterEmail('');
            }
            
            // Success with resume data
            showSuccess(data.resumeWatch);
            
        } catch (error) {
            showError(error.message || 'Invalid verification code');
        } finally {
            setLoading(false);
        }
    }
    
    async function handleResend() {
        resendBtn.disabled = true;
        
        try {
            const response = await fetch('/api/auth/resend-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    email: email
                })
            });
            
            const data = await response.json();
            
            if (!response.ok || !data.ok) {
                throw new Error(data.error || 'Failed to resend code');
            }
            
            // Reset timer
            resendBtn.style.display = 'none';
            document.getElementById('verify-timer').style.display = 'block';
            startTimer();
            
            // Clear OTP inputs
            otpInputs.forEach(input => input.value = '');
            otpInputs[0].focus();
            
            clearError();
            
            // Start cooldown
            if (data.cooldownRemaining) {
                startResendCooldown(data.cooldownRemaining);
            }
            
        } catch (error) {
            showError(error.message || 'Failed to resend code');
            resendBtn.disabled = false;
            
            // Handle cooldown from error response
            if (error.message.includes('wait') || error.message.includes('seconds')) {
                const match = error.message.match(/(\d+)\s*seconds/);
                if (match) {
                    startResendCooldown(parseInt(match[1]));
                }
            }
        }
    }
    
    function handleChangeEmail() {
        // Clear current email and redirect to register
        localStorage.removeItem('registerEmail');
        if (authService) {
            authService.setRegisterEmail('');
        }
        window.location.href = '/anify.html#register';
    }
    
    function showSuccess() {
        verifyContent.style.display = 'none';
        verifySuccess.style.display = 'block';
        
        // Redirect after 2 seconds
        setTimeout(() => {
            // Clear localStorage
            localStorage.removeItem('registerEmail');
            localStorage.removeItem('registerUsername');
            localStorage.removeItem('registerPassword');
            localStorage.removeItem('lastWatchedAnime');
            localStorage.removeItem('lastWatchedEpisode');
            localStorage.removeItem('lastWatchedTime');
            
            // A newly verified account always starts at the home page.
            window.location.href = '/anify.html';
        }, 2000);
    }
    
    // Focus first input on load
    setTimeout(() => {
        otpInputs[0].focus();
    }, 100);
});
