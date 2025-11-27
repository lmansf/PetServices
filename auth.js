// Auth.js - Client-side authentication logic
let isSignUpMode = false;
const PROMOTION_CODE = 'DOGMOM';
const PROMOTION_BADGE_KEY = 'promotionBadge';
const GUEST_MODE_KEY = 'guestExploring';
const LAST_PROVIDER_KEY = 'lastAuthProvider';
const PROVIDER_LABELS = {
    google: 'Google',
    twitter: 'Twitter',
    facebook: 'Facebook'
};

const ADMIN_EMAILS = ['amansfld@gmail.com', 'lmansf96@gmail.com'];

function notifyPromotionBadgeChange() {
    try {
        window.dispatchEvent(new Event('promotion-badge-change'));
    } catch (err) {
        // Safe to ignore if window unavailable
    }
}

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
            hideMessages();
            beginAnonymousExplore();
        });
    }

    const providerButtons = document.querySelectorAll('[data-provider-signin]');
    providerButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const providerKey = button.getAttribute('data-provider-signin');
            startProviderSignIn(providerKey, button);
        });
    });

    async function startProviderSignIn(providerKey, triggerButton) {
        if (!providerKey) {
            return;
        }

        hideMessages();
        const label = formatProviderLabel(providerKey);
        const authInstance = getFirebaseAuthInstance();

        if (!authInstance) {
            showError('Sign-in is temporarily unavailable. Please refresh and try again.');
            return;
        }

        const provider = createAuthProvider(providerKey);
        if (!provider) {
            showError(`${label} sign-in is not configured yet. Please use email/password for now.`);
            return;
        }

        setButtonBusy(triggerButton, true);

        try {
            const result = await authInstance.signInWithPopup(provider);
            await handleFirebaseProviderResult(result?.user, providerKey);
        } catch (error) {
            handleProviderError(error, providerKey);
        } finally {
            setButtonBusy(triggerButton, false);
        }
    }

    function createAuthProvider(providerKey) {
        switch (providerKey) {
            case 'google': {
                const googleProvider = new firebase.auth.GoogleAuthProvider();
                googleProvider.setCustomParameters({ prompt: 'select_account' });
                return googleProvider;
            }
            case 'facebook':
                return new firebase.auth.FacebookAuthProvider();
            case 'twitter':
                return new firebase.auth.TwitterAuthProvider();
            default:
                return null;
        }
    }

    function setButtonBusy(button, isBusy) {
        if (!button) return;
        button.disabled = !!isBusy;
        button.setAttribute('aria-busy', isBusy ? 'true' : 'false');
        button.classList.toggle('is-busy', !!isBusy);
    }

    async function handleFirebaseProviderResult(user, providerKey) {
        if (!user) {
            showError('Unable to finish sign-in. Please try again.');
            return;
        }

        const email = extractUserEmail(user);
        if (!email) {
            showError(`${formatProviderLabel(providerKey)} did not return an email address. Please share your email with that provider or sign up with email/password.`);
            try {
                const authInstance = getFirebaseAuthInstance();
                await authInstance?.signOut();
            } catch (err) {
                console.warn('Failed to sign out after missing email', err);
            }
            return;
        }

        sessionStorage.setItem('userEmail', email);
        sessionStorage.removeItem(GUEST_MODE_KEY);
        sessionStorage.setItem(LAST_PROVIDER_KEY, providerKey);

        let profileStatus = { exists: false, autoCreated: false };
        try {
            profileStatus = await syncBadgeFromProfile(email);
        } catch (err) {
            console.warn('Unable to sync promotion badge after provider sign-in', err);
        }

        showSuccess('Signed in successfully! Redirecting...');
        setTimeout(() => {
            const needsOnboarding = !profileStatus.exists || profileStatus.autoCreated;
            if (ADMIN_EMAILS.includes(email.toLowerCase())) {
                window.location.href = 'admin.html';
            } else {
                window.location.href = needsOnboarding ? 'firstform.html' : 'index.html';
            }
        }, 1200);
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
            sessionStorage.removeItem(PROMOTION_BADGE_KEY);
            notifyPromotionBadgeChange();
            return false;
        }
        const normalized = code.trim().toUpperCase();
        const hasBadge = normalized === PROMOTION_CODE;
        if (hasBadge) {
            sessionStorage.setItem(PROMOTION_BADGE_KEY, PROMOTION_CODE);
        } else {
            sessionStorage.removeItem(PROMOTION_BADGE_KEY);
        }
        notifyPromotionBadgeChange();
        return hasBadge;
    };

    const syncBadgeFromProfile = async (email) => {
        const defaultStatus = { exists: false, autoCreated: false };
        if (!email) {
            sessionStorage.removeItem(PROMOTION_BADGE_KEY);
            notifyPromotionBadgeChange();
            return defaultStatus;
        }
        try {
            const profileFn = firebase.functions().httpsCallable('getUserProfile');
            // SECURITY UPDATE: Do not pass email. The function now uses the authenticated user's ID.
            const result = await profileFn();
            const profile = result?.data ?? result;

            // Check completion
            const hasName = profile.firstName && profile.lastName;
            const hasPhone = profile.phone;
            const hasAddress = profile.address && profile.address.street && profile.address.city && profile.address.state && profile.address.zip;
            const hasPets = profile.pets && profile.pets.length > 0;
            const isComplete = (hasName && hasPhone && hasAddress && hasPets) ? 'true' : 'false';
            sessionStorage.setItem('profileComplete', isComplete);

            const hasBadge = Object.keys(profile || {}).some(
                key => key.toUpperCase() === PROMOTION_CODE && profile[key]
            );
            if (hasBadge) {
                sessionStorage.setItem(PROMOTION_BADGE_KEY, PROMOTION_CODE);
            } else {
                sessionStorage.removeItem(PROMOTION_BADGE_KEY);
            }
            notifyPromotionBadgeChange();
            return {
                exists: !!profile,
                autoCreated: !!profile?.providerAutoCreated
            };
        } catch (err) {
            console.warn('Unable to sync promotion badge', err);
            return defaultStatus;
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
            const authInstance = getFirebaseAuthInstance();
            if (!authInstance) throw new Error('Authentication service unavailable');

            if (isSignUpMode) {
                // 1. Create User in Firebase Auth
                const userCredential = await authInstance.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;

                // 2. Prepare Profile Data
                const formData = {
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

                // 3. Save Profile to Firestore via Cloud Function
                const submitForm = firebase.functions().httpsCallable('submitForm');
                await submitForm(formData);

                // Success
                sessionStorage.setItem('userEmail', email);
                sessionStorage.removeItem(GUEST_MODE_KEY);
                sessionStorage.setItem(LAST_PROVIDER_KEY, 'password');
                
                const promoInput = document.getElementById('discount-code');
                setBadgeFromCode(promoInput ? promoInput.value : '');
                
                // Show success modal
                document.getElementById('success-modal').style.display = 'flex';
                
            } else {
                // Sign-in mode: Authenticate with Firebase
                await authInstance.signInWithEmailAndPassword(email, password);

                // Success
                showSuccess('Signed in successfully!');
                sessionStorage.setItem('userEmail', email);
                sessionStorage.removeItem(GUEST_MODE_KEY);
                sessionStorage.setItem(LAST_PROVIDER_KEY, 'password');
                
                // Sync profile/badge
                await syncBadgeFromProfile(email);

                // Redirect after a short delay
                setTimeout(() => {
                    if (ADMIN_EMAILS.includes(email.toLowerCase())) {
                        window.location.href = 'admin.html';
                    } else {
                        window.location.href = 'index.html';
                    }
                }, 1500);
            }

        } catch (error) {
            console.error('Error:', error);
            let msg = error.message;
            
            if (error.code === 'auth/email-already-in-use') {
                msg = 'An account with this email already exists. Please sign in.';
            } else if (error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
                msg = 'Invalid email or password.';
            } else if (error.code === 'auth/weak-password') {
                msg = 'Password is too weak.';
            }

            if (error.code === 'functions/invalid-argument' && msg.includes('discount')) {
                if (discountWarning) {
                    discountWarning.style.display = 'block';
                }
                document.getElementById('discount-code').value = '';
                document.getElementById('discount-code').focus();
            } else {
                showError(msg || 'An error occurred. Please try again.');
            }
        } finally {
            // Re-enable button
            submitButton.disabled = false;
            submitButton.textContent = isSignUpMode ? 'Create Account' : 'Sign In';
        }
    });

    if (window.authHelpers) {
        window.authHelpers.startProviderSignIn = (providerKey) => startProviderSignIn(providerKey);
    }
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

function beginAnonymousExplore() {
    try {
        hideMessages();
    } catch (err) {
        // ignore if DOM not ready
    }
    startAnonymousSession();
}

function startAnonymousSession() {
    const authInstance = getFirebaseAuthInstance();
    if (authInstance?.signInAnonymously) {
        authInstance.signInAnonymously().catch((error) => {
            console.warn('Anonymous Firebase sign-in failed', error);
        });
    }
    setGuestSessionAndRedirect();
}

function setGuestSessionAndRedirect() {
    sessionStorage.removeItem('userEmail');
    sessionStorage.removeItem(PROMOTION_BADGE_KEY);
    sessionStorage.removeItem(LAST_PROVIDER_KEY);
    sessionStorage.setItem(GUEST_MODE_KEY, 'true');
    notifyPromotionBadgeChange();
    window.location.href = 'index.html';
}

function formatProviderLabel(providerKey) {
    return PROVIDER_LABELS[providerKey] || 'Social';
}

function extractUserEmail(user) {
    if (!user) return '';
    if (user.email) return user.email;
    const providerEmail = (user.providerData || [])
        .map((profile) => profile?.email)
        .find(Boolean);
    return providerEmail || '';
}

function getFirebaseAuthInstance() {
    if (window.auth) {
        return window.auth;
    }
    if (window.firebase && typeof window.firebase.auth === 'function') {
        try {
            return window.firebase.auth();
        } catch (err) {
            console.warn('Unable to initialize Firebase Auth instance', err);
        }
    }
    return null;
}

function handleProviderError(error, providerKey) {
    const label = formatProviderLabel(providerKey);
    const code = error?.code || '';
    console.error(`[auth] ${label} sign-in failed`, error);

    if (code === 'auth/popup-closed-by-user') {
        showError(`${label} sign-in was closed before we finished. Please try again.`);
        return;
    }
    if (code === 'auth/cancelled-popup-request') {
        showError(`Another ${label} window was already open. Please close other popups and try again.`);
        return;
    }
    if (code === 'auth/account-exists-with-different-credential') {
        showError(`${label} is linked to a different sign-in method. Sign in with your original provider, then link ${label} from your profile settings.`);
        return;
    }
    if (code === 'auth/unauthorized-domain') {
        showError('This domain is not authorized for OAuth with Firebase. Please contact support.');
        return;
    }

    showError(error?.message || `Unable to sign in with ${label}. Please try again.`);
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
    sessionStorage.removeItem(PROMOTION_BADGE_KEY);
    sessionStorage.removeItem(GUEST_MODE_KEY);
    sessionStorage.removeItem(LAST_PROVIDER_KEY);
    const authInstance = getFirebaseAuthInstance();
    if (authInstance?.signOut) {
        authInstance.signOut().catch((error) => console.warn('Firebase sign-out failed', error));
    }
    window.location.href = 'signin.html';
}

// Export functions for use in other scripts
window.authHelpers = {
    checkAuth,
    signOut,
    getUserEmail: () => sessionStorage.getItem('userEmail'),
    beginAnonymousExplore,
    startProviderSignIn: () => {
        console.warn('Provider sign-in helpers are not ready yet.');
    }
};
