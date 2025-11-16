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
    const signupFields = document.querySelectorAll('.signup-fields');

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
        }

        // Clear messages and form
        hideMessages();
        form.reset();
        // Clear pets container
        const petsContainer = document.getElementById('pets-container');
        if (petsContainer) petsContainer.innerHTML = '';
        if (window.petCount) window.petCount = 0;
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

                const authData = await authResponse.json();

                if (!authResponse.ok) {
                    throw new Error(authData.error || 'Authentication failed');
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

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Authentication failed');
                }

                // Success
                showSuccess(data.message);
                sessionStorage.setItem('userEmail', data.email);

                // Redirect after a short delay
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 1500);
            }

        } catch (error) {
            console.error('Error:', error);
            
            // Check for discount code error
            if (error.code === 'functions/invalid-argument' && error.message && error.message.includes('discount')) {
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
    window.location.href = 'signin.html';
}

// Export functions for use in other scripts
window.authHelpers = {
    checkAuth,
    signOut,
    getUserEmail: () => sessionStorage.getItem('userEmail')
};
