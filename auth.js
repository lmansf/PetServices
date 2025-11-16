// Auth.js - Client-side authentication logic
let isSignUpMode = false;
const LOYALTY_CODE = 'dogmom';
const LOYALTY_BADGE_KEY = 'loyaltyBadge';

// Get Firebase Cloud Function URL
const AUTH_API_URL = 'https://us-central1-amandaspetservices-55506.cloudfunctions.net/auth';

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('auth-form');
    const toggleLink = document.getElementById('toggle-link');
    const submitButton = document.getElementById('submit-button');
    const authTitle = document.getElementById('auth-title');
    const toggleText = document.getElementById('toggle-text');
    const errorMessage = document.getElementById('error-message');
    const successMessage = document.getElementById('success-message');
    const passwordRequirements = document.getElementById('password-requirements');
    const signupFields = document.querySelectorAll('.signup-fields');
    const guestButton = document.getElementById('guest-button');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const confirmWarning = document.getElementById('confirm-warning');

    if (guestButton) {
        guestButton.addEventListener('click', () => {
            sessionStorage.removeItem('userEmail');
            sessionStorage.removeItem(LOYALTY_BADGE_KEY);
            window.location.href = 'index.html';
        });
    }

    const syncConfirmWarning = () => {
        if (!confirmPasswordInput || !confirmWarning) return;
        if (!isSignUpMode) {
            confirmWarning.style.display = 'none';
            return;
        }
        const matches = confirmPasswordInput.value === (passwordInput?.value || '');
        confirmWarning.style.display = matches ? 'none' : 'block';
    };

    if (confirmPasswordInput) {
        confirmPasswordInput.addEventListener('input', syncConfirmWarning);
    }

    if (passwordInput && confirmPasswordInput) {
        passwordInput.addEventListener('input', () => {
            if (isSignUpMode) syncConfirmWarning();
        });
    }

    // Toggle between sign in and sign up
    toggleLink.addEventListener('click', (e) => {
        e.preventDefault();
        isSignUpMode = !isSignUpMode;

        if (isSignUpMode) {
            authTitle.textContent = 'Sign Up';
            submitButton.textContent = 'Create Account';
            toggleText.textContent = 'Already have an account?';
            toggleLink.textContent = 'Sign In';
            passwordRequirements.style.display = 'block';
            signupFields.forEach(el => el.style.display = 'block');
            
            // Make sign-up fields required
            ['first-name', 'last-name', 'phone', 'street-address', 'city', 'state', 'zip'].forEach(id => {
                const field = document.getElementById(id);
                if (field) field.required = true;
            });
            if (confirmPasswordInput) confirmPasswordInput.required = true;
        } else {
            authTitle.textContent = 'Sign In';
            submitButton.textContent = 'Sign In';
            toggleText.textContent = "Don't have an account?";
            toggleLink.textContent = 'Sign Up';
            passwordRequirements.style.display = 'none';
            signupFields.forEach(el => el.style.display = 'none');
            
            // Make sign-up fields not required
            ['first-name', 'last-name', 'phone', 'street-address', 'city', 'state', 'zip'].forEach(id => {
                const field = document.getElementById(id);
                if (field) field.required = false;
            });
            if (confirmPasswordInput) confirmPasswordInput.required = false;
        }

        // Clear messages and form
        hideMessages();
        form.reset();
        if (confirmWarning) confirmWarning.style.display = 'none';
        // Clear pets container
        const petsContainer = document.getElementById('pets-container');
        if (petsContainer) petsContainer.innerHTML = '';
        if (window.petCount) window.petCount = 0;
        syncConfirmWarning();
    });

    const setBadgeFromCode = (code) => {
        if (!code) {
            sessionStorage.removeItem(LOYALTY_BADGE_KEY);
            return false;
        }
        const normalized = code.trim().toLowerCase();
        const hasBadge = normalized === LOYALTY_CODE;
        if (hasBadge) {
            sessionStorage.setItem(LOYALTY_BADGE_KEY, 'dogMom');
        } else {
            sessionStorage.removeItem(LOYALTY_BADGE_KEY);
        }
        return hasBadge;
    };

    const syncBadgeFromProfile = async (email) => {
        if (!email) {
            sessionStorage.removeItem(LOYALTY_BADGE_KEY);
            return;
        }
        try {
            const profileFn = firebase.functions().httpsCallable('getUserProfile');
            const result = await profileFn({ email });
            const profile = result?.data ?? result;
            const hasBadge = Object.keys(profile || {}).some(
                key => key.toLowerCase() === LOYALTY_CODE && profile[key]
            );
            if (hasBadge) {
                sessionStorage.setItem(LOYALTY_BADGE_KEY, 'dogMom');
            } else {
                sessionStorage.removeItem(LOYALTY_BADGE_KEY);
            }
        } catch (err) {
            console.warn('Unable to sync loyalty badge', err);
        }
    };

    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        // Validate password length for sign up
        if (isSignUpMode && password.length < 8) {
            showError('Password must be at least 8 characters');
            return;
        }

        if (isSignUpMode) {
            const confirmPassword = document.getElementById('confirm-password').value;
            if (password !== confirmPassword) {
                showError('Passwords must match');
                const warning = document.getElementById('confirm-warning');
                if (warning) warning.style.display = 'block';
                return;
            }
        }

        // Disable button and show loading state
        submitButton.disabled = true;
        submitButton.textContent = isSignUpMode ? 'Creating Account...' : 'Signing In...';
        hideMessages();
        
        // Hide discount warning
        const discountWarning = document.getElementById('discount-warning');
        if (discountWarning) discountWarning.style.display = 'none';

        try {
            if (isSignUpMode) {
                // Sign-up mode: create account and submit profile data
                
                // First, create the auth account
                const authResponse = await fetch(`${AUTH_API_URL}/signup`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });

                let authData = {};
                try {
                    authData = await authResponse.json();
                } catch (err) {
                    authData = {};
                }

                if (!authResponse.ok) {
                    const requestError = new Error(authData.error || 'Authentication failed');
                    if (authData.code) {
                        requestError.code = authData.code;
                    }
                    throw requestError;
                }

                // Then, submit the profile data
                const formData = {
                    submittedAt: new Date().toISOString(),
                    firstName: document.getElementById('first-name').value,
                    lastName: document.getElementById('last-name').value,
                    email: email,
                    phone: document.getElementById('phone').value,
                    address: {
                        street: document.getElementById('street-address').value,
                        apt: document.getElementById('apt-suite').value || '',
                        city: document.getElementById('city').value,
                        state: document.getElementById('state').value,
                        zip: document.getElementById('zip').value
                    },
                    pets: [],
                    additionalComments: document.getElementById('additional-comments').value || '',
                    discountCode: document.getElementById('discount-code').value.trim()
                };

                // Collect pet information
                if (window.petCount) {
                    for (let i = 1; i <= window.petCount; i++) {
                        const petNameInput = document.getElementById(`pet-name-${i}`);
                        if (petNameInput && petNameInput.value) {
                            formData.pets.push({
                                name: petNameInput.value,
                                type: document.getElementById(`pet-type-${i}`).value,
                                breed: document.getElementById(`pet-breed-${i}`).value,
                                description: document.getElementById(`pet-description-${i}`).value,
                                medication: document.getElementById(`pet-medication-${i}`).value,
                                careComments: document.getElementById(`pet-care-comments-${i}`).value
                            });
                        }
                    }
                }

                // Submit profile data to Firebase Function
                const submitForm = firebase.functions().httpsCallable('submitForm');
                const profileResult = await submitForm(formData);

                // Success
                sessionStorage.setItem('userEmail', authData.email);
                const loyaltyInput = document.getElementById('discount-code');
                setBadgeFromCode(loyaltyInput ? loyaltyInput.value : '');
                
                // Show success modal
                document.getElementById('success-modal').style.display = 'flex';
                
            } else {
                // Sign-in mode: just authenticate
                const response = await fetch(`${AUTH_API_URL}/signin`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });

                let data = {};
                try {
                    data = await response.json();
                } catch (err) {
                    data = {};
                }

                if (!response.ok) {
                    const requestError = new Error(data.error || 'Authentication failed');
                    if (data.code) {
                        requestError.code = data.code;
                    }
                    throw requestError;
                }

                // Success
                showSuccess(data.message);
                sessionStorage.setItem('userEmail', data.email);
                await syncBadgeFromProfile(data.email);

                // Redirect after a short delay
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
            }

        } catch (error) {
            console.error('Error:', error);

            const dropboxErrors = ['DROPBOX_TOKEN_EXPIRED', 'DROPBOX_AUTH_ERROR'];

            if (dropboxErrors.includes(error.code)) {
                showError(error.message || 'Sign-ins are temporarily unavailable while we refresh secure storage. Please try again soon.');
            } else if (error.code === 'functions/invalid-argument' && error.message && error.message.includes('discount')) {
                if (discountWarning) {
                    discountWarning.style.display = 'block';
                }
                document.getElementById('discount-code').value = '';
                document.getElementById('discount-code').focus();
            } else {
                showError(error.message || 'An error occurred. Please try again.');
            }
        } finally {
            // Re-enable button
            submitButton.disabled = false;
            submitButton.textContent = isSignUpMode ? 'Create Account' : 'Sign In';
        }
    });
});

function showError(message) {
    const errorMessage = document.getElementById('error-message');
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    
    const successMessage = document.getElementById('success-message');
    successMessage.style.display = 'none';
}

function showSuccess(message) {
    const successMessage = document.getElementById('success-message');
    successMessage.textContent = message;
    successMessage.style.display = 'block';
    
    const errorMessage = document.getElementById('error-message');
    errorMessage.style.display = 'none';
}

function hideMessages() {
    document.getElementById('error-message').style.display = 'none';
    document.getElementById('success-message').style.display = 'none';
}

// Check if user is already logged in
function checkAuth() {
    const userEmail = sessionStorage.getItem('userEmail');
    if (userEmail) {
        // User is logged in
        return true;
    }
    return false;
}

// Sign out function (can be called from other pages)
function signOut() {
    sessionStorage.removeItem('userEmail');
    sessionStorage.removeItem(LOYALTY_BADGE_KEY);
    window.location.href = 'signin.html';
}

// Export functions for use in other scripts
window.authHelpers = {
    checkAuth,
    signOut,
    getUserEmail: () => sessionStorage.getItem('userEmail')
};
