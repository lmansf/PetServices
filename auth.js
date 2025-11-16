// Auth.js - Client-side authentication logic
let isSignUpMode = false;

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

    // Toggle between sign in and sign up
    toggleLink.addEventListener('click', (e) => {
        e.preventDefault();
        isSignUpMode = !isSignUpMode;

        if (isSignUpMode) {
            authTitle.textContent = 'Sign Up';
            submitButton.textContent = 'Sign Up';
            toggleText.textContent = 'Already have an account?';
            toggleLink.textContent = 'Sign In';
            passwordRequirements.style.display = 'block';
        } else {
            authTitle.textContent = 'Sign In';
            submitButton.textContent = 'Sign In';
            toggleText.textContent = "Don't have an account?";
            toggleLink.textContent = 'Sign Up';
            passwordRequirements.style.display = 'none';
        }

        // Clear messages and form
        hideMessages();
        form.reset();
    });

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

        // Disable button and show loading state
        submitButton.disabled = true;
        submitButton.textContent = isSignUpMode ? 'Creating Account...' : 'Signing In...';
        hideMessages();

        try {
            const endpoint = isSignUpMode ? '/signup' : '/signin';
            const response = await fetch(`${AUTH_API_URL}${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Authentication failed');
            }

            // Success
            showSuccess(data.message);
            form.reset();

            // Store user session (you can enhance this with JWT tokens)
            sessionStorage.setItem('userEmail', data.email);

            // Redirect after a short delay
            setTimeout(() => {
                window.location.href = 'index.html'; // Redirect to home page
            }, 1500);

        } catch (error) {
            showError(error.message);
        } finally {
            // Re-enable button
            submitButton.disabled = false;
            submitButton.textContent = isSignUpMode ? 'Sign Up' : 'Sign In';
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
    window.location.href = 'signin.html';
}

// Export functions for use in other scripts
window.authHelpers = {
    checkAuth,
    signOut,
    getUserEmail: () => sessionStorage.getItem('userEmail')
};
