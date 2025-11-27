// Payment page functionality for x402 protocol

// Configuration
const PAYMENT_CONFIG = {
    // Demo Bitcoin address - replace with your actual x402 payment address
    defaultAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
    // x402 payment server endpoint (if you have one)
    paymentServer: null,
    // Polling interval for payment status (milliseconds)
    statusCheckInterval: 5000
};

// Providers configuration (disconnected/offline friendly)
// Updated to only include Venmo (top & highlighted), PayPal, and Stripe.
// Replace the placeholder handles/URLs with your real account URLs when ready.
const PAYMENT_PROVIDERS = [
    {
        id: 'venmo',
        name: 'Venmo',
        type: 'url',
        // replace with your Venmo username
        handle: 'amanda-mansfield-82153',
        makeUrl: (amount, service) => `https://venmo.com/${encodeURIComponent('amanda-mansfield-82153')}?txn=pay&amount=${encodeURIComponent(amount)}&note=${encodeURIComponent(service)}`
    },
    {
        id: 'paypal',
        name: 'PayPal.me',
        type: 'url',
        // replace with your PayPal.me username
        handle: 'YourPayPalUser',
        makeUrl: (amount, service) => `https://www.paypal.me/${encodeURIComponent('YourPayPalUser')}/${encodeURIComponent(amount.toString())}`
    },
    {
        id: 'stripe',
        name: 'Stripe',
        type: 'url',
        // Stripe usually requires a hosted Checkout session or Payment Link — use your hosted link here.
        // Placeholder: replace with your real Stripe checkout/payment link that accepts an amount parameter.
        handle: 'your-stripe-checkout',
        makeUrl: (amount, service) => `https://example.com/stripe-checkout?amount=${encodeURIComponent(amount)}&service=${encodeURIComponent(service)}`
    }
];

// State
let currentAmount = 0;
let currentService = 'Multiple Services';
let paymentAddress = PAYMENT_CONFIG.defaultAddress;
let statusCheckTimer = null;
let selectedProvider = PAYMENT_PROVIDERS[0];
let lastGeneratedString = '';
// Tip state (default $7 as requested)
let tipAmount = 7.00;
let tipSelected = '7';

// Webstore service fee (automatically added when services are selected)
const WEBSTORE_FEE = 2.00;

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
    initializeQuantityInputs();
    initializeProviders();
    initializeTipButtons();
    // initialize totals/UI
    updateTotalsFromQuantities();
    setupFeeModal();
    selectProvider(selectedProvider.id);
    initializeCopyButton();

    // Start checking for payment status (keeps existing demo crypto poll behavior)
    startPaymentStatusCheck();
});

// Service selection handling
// Quantity inputs handling for each service
function initializeQuantityInputs() {
    const qtyInputs = document.querySelectorAll('.qty-input');
    qtyInputs.forEach(input => {
        input.addEventListener('input', () => {
            updateTotalsFromQuantities();
            generateProviderPayment();
        });
    });

    // wire up left/right qty buttons
    const qtyButtons = document.querySelectorAll('.qty-btn');
    qtyButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = btn.dataset.target;
            if (!targetId) return;
            const input = document.getElementById(targetId);
            if (!input) return;

            const step = 1;
            const min = Number(input.min || 0);
            let val = Number(input.value || 0);
            if (btn.classList.contains('qty-increase')) {
                val = val + step;
            } else if (btn.classList.contains('qty-decrease')) {
                val = val - step;
            }
            if (isNaN(val) || val < min) val = min;
            input.value = val;

            // trigger the same handlers as typing
            input.dispatchEvent(new Event('input', { bubbles: true }));
            // update totals and provider links
            updateTotalsFromQuantities();
            generateProviderPayment();
        });
    });
}

function updateTotalsFromQuantities() {
    const qtyInputs = document.querySelectorAll('.qty-input');
    let total = 0;
    const breakdown = [];

    qtyInputs.forEach(input => {
        const qty = Math.max(0, parseInt(input.value || '0', 10));
        const price = parseFloat(input.dataset.price || '0');
        // find service name from nearby DOM
        let name = '';
        const row = input.closest('.service-row');
        if (row) {
            const nameEl = row.querySelector('.service-name');
            if (nameEl) name = nameEl.textContent.trim();
        }
        if (qty > 0) {
            const lineTotal = qty * price;
            breakdown.push({ name, qty, price, lineTotal });
            total += lineTotal;
        }
    });

    // subtotal is the sum of service lines (before fee)
    const subtotal = total;
    // fee applies only when there are selected services; show fee row always but fee value will be 0 when no services selected
    const feeValue = subtotal > 0 ? WEBSTORE_FEE : 0;

    if (breakdown.length === 0) {
        currentService = 'No items selected';
    } else {
        currentService = breakdown.map(b => `${b.qty} × ${b.name}`).join(', ');
    }

    // If there are selected services, add the webstore fee as a line item in the breakdown for itemized view
    if (subtotal > 0) {
        breakdown.push({ name: 'Webstore Fee', qty: 1, price: WEBSTORE_FEE, lineTotal: WEBSTORE_FEE });
    }

    // total before tip
    const totalBeforeTip = Number((subtotal + feeValue).toFixed(2));
    // currentAmount represents subtotal + fee (before tip)
    currentAmount = totalBeforeTip;

    updatePaymentDetailsDisplay(/*subtotal=*/ subtotal, breakdown);
}

function updatePaymentDetailsDisplay(amount, breakdown) {
    const subtotal = amount;
    // compute fee based on subtotal (always show fee row; value 0 when no items)
    const fee = subtotal > 0 ? WEBSTORE_FEE : 0;
    const total = Number((subtotal + fee + (Number(tipAmount) || 0)).toFixed(2));

    document.getElementById('selected-service').textContent = breakdown.length ? currentService : 'No items selected';
    // Update the explicit rows: fee, subtotal, tip, total
    const subtotalEl = document.getElementById('payment-subtotal');
    const feeEl = document.getElementById('payment-fee');
    const tipEl = document.getElementById('payment-tip');
    const totalEl = document.getElementById('payment-total');
    if (feeEl) {
        feeEl.textContent = formatCurrency(fee);
        feeEl.style.display = 'inline';
    }
    if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);
    if (tipEl) tipEl.textContent = formatCurrency(Number(tipAmount) || 0);
    if (totalEl) totalEl.textContent = formatCurrency(total);

    // show breakdown (only itemized lines) under details
    let breakdownContainer = document.getElementById('breakdown-container');
    if (!breakdownContainer) {
        breakdownContainer = document.createElement('div');
        breakdownContainer.id = 'breakdown-container';
        breakdownContainer.style.marginTop = '0.8rem';
        const detailsCard = document.querySelector('.payment-details-card');
        if (detailsCard) detailsCard.appendChild(breakdownContainer);
    }

    breakdownContainer.innerHTML = '';
    if (breakdown.length === 0) {
        breakdownContainer.textContent = 'No services selected.';
    } else {
        breakdown.forEach(b => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.justifyContent = 'space-between';
            row.style.padding = '4px 0';
            row.innerHTML = `<span>${b.qty} × ${b.name}</span><span>${formatCurrency(b.lineTotal)}</span>`;
            breakdownContainer.appendChild(row);
        });
    }
}

// Update payment details display
function updatePaymentDetails(amount, service) {
    currentAmount = amount;
    currentService = service;
    
    document.getElementById('selected-service').textContent = service;
    const subtotalEl = document.getElementById('payment-subtotal');
    const tipEl = document.getElementById('payment-tip');
    const totalEl = document.getElementById('payment-total');
    if (subtotalEl) subtotalEl.textContent = formatCurrency(amount);
    if (tipEl) tipEl.textContent = formatCurrency(0);
    if (totalEl) totalEl.textContent = formatCurrency(amount);
}

// Format currency
function formatCurrency(amount) {
    if (amount === 0) return 'Free';
    return `$${amount.toFixed(2)}`;
}

// Fee modal setup
function setupFeeModal() {
    const openBtn = document.getElementById('fee-info');
    const modal = document.getElementById('fee-modal');
    const backdrop = document.getElementById('fee-modal-backdrop');
    const closeBtn = document.getElementById('fee-modal-close');

    if (!openBtn || !modal) return;

    function openModal() {
        modal.hidden = false;
        modal.removeAttribute('aria-hidden');
        // focus trap: move focus to close button
        if (closeBtn) closeBtn.focus();
        // disable body scroll
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        openBtn.focus();
    }

    openBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openModal();
    });

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (backdrop) backdrop.addEventListener('click', closeModal);

    // close on ESC
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal && !modal.hidden) {
            closeModal();
        }
    });
}

// Payment method selection
// Initialize provider buttons (Venmo, Cash App, PayPal, Zelle, Bitcoin, Ethereum)
function initializeProviders() {
    const container = document.getElementById('payment-providers');
    if (!container) return;

    container.innerHTML = '';
    PAYMENT_PROVIDERS.forEach(p => {
        // Use anchor so it's an embedded link; href will be updated dynamically when totals change
        const btn = document.createElement('a');
        btn.className = 'payment-method-btn';
        btn.dataset.provider = p.id;
        btn.title = p.name;
        btn.href = '#';
        btn.target = '_blank';
        btn.setAttribute('role', 'button');

        const icon = document.createElement('div');
        icon.className = 'provider-icon';
        icon.textContent = providerIconFor(p.id);
        btn.appendChild(icon);

        const label = document.createElement('div');
        label.className = 'provider-name';
        label.textContent = p.name;
        btn.appendChild(label);

        // When clicked, update the link for the current total and show instructions.
        btn.addEventListener('click', (e) => {
            // compute current total including tip
            const totalAmount = Number((Number(currentAmount || 0) + Number(tipAmount || 0)).toFixed(2));

            // build a provider-specific URL (if possible) and set href so the anchor opens the correct page
            let out = '#';
            if (p.type === 'url' && typeof p.makeUrl === 'function') {
                out = p.makeUrl(totalAmount, currentService);
            } else if (p.type === 'crypto' && typeof p.makeUri === 'function') {
                out = p.makeUri(totalAmount, currentService);
            } else if (p.type === 'plain' && typeof p.makeText === 'function') {
                // plain types won't have a direct link; keep href as '#'
                out = '#';
            } else {
                out = p.handle || '#';
            }

            // set the href so the browser will open the payment link (new tab)
            btn.href = out;

            // visually mark active and select
            document.querySelectorAll('#payment-providers .payment-method-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectProvider(p.id);

            // regenerate provider details for the selected provider (this also updates other UI)
            generateProviderPayment();

            // Allow default anchor behavior to open the link in a new tab (target=_blank)
        });

        container.appendChild(btn);
    });
}

function providerIconFor(id) {
    switch (id) {
        case 'venmo': return '📱';
        case 'paypal': return '💸';
        case 'stripe': return '💳';
        default: return '🔗';
    }
}

function selectProvider(providerId) {
    const provider = PAYMENT_PROVIDERS.find(p => p.id === providerId) || PAYMENT_PROVIDERS[0];
    selectedProvider = provider;
    const providerTitleEl = document.getElementById('provider-title');
    if (providerTitleEl) providerTitleEl.textContent = provider.name;
    // Update active class on provider buttons
    document.querySelectorAll('#payment-providers .payment-method-btn').forEach(b => {
        if (b.dataset.provider === providerId) b.classList.add('active'); else b.classList.remove('active');
    });
    generateProviderPayment();
}

// Tip buttons initialization and handling
function initializeTipButtons() {
    const tipButtonsContainer = document.getElementById('tip-buttons');
    const customBtn = document.getElementById('tip-custom-btn');
    const customInputWrap = document.getElementById('tip-custom-input');
    const customInput = document.getElementById('tip-custom-value');

    if (!tipButtonsContainer) return;

    // set default selection ($7)
    tipButtonsContainer.querySelectorAll('.tip-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const t = btn.dataset.tip;
            tipButtonsContainer.querySelectorAll('.tip-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            if (t === 'custom') {
                // show custom input
                if (customInputWrap) customInputWrap.style.display = 'block';
                tipSelected = 'custom';
                tipAmount = Number(customInput.value) || 0;
                // focus input
                if (customInput) setTimeout(() => customInput.focus(), 100);
            } else {
                // hide custom input
                if (customInputWrap) customInputWrap.style.display = 'none';
                tipSelected = t;
                tipAmount = Number(t) || 0;
            }

            // update totals
            updateTotalsFromQuantities();
            generateProviderPayment();
        });
    });

    // set default ($7) active on load
    const defaultBtn = tipButtonsContainer.querySelector('.tip-btn[data-tip="7"]');
    if (defaultBtn) {
        defaultBtn.classList.add('active');
        tipSelected = '7';
        tipAmount = 7;
    }

    if (customInput) {
        customInput.addEventListener('input', () => {
            const val = parseFloat(customInput.value || '0');
            if (!isNaN(val) && val >= 0) {
                tipAmount = Number(val.toFixed(2));
            } else {
                tipAmount = 0;
            }
            updateTotalsFromQuantities();
            generateProviderPayment();
        });
    }
}

// Generate provider-specific payment link
function generateProviderPayment() {
    const providerLinkEl = document.getElementById('provider-link');
    const addressText = document.getElementById('address-text');
    const instructions = document.getElementById('provider-instructions');

    if (!selectedProvider) return;

    // Compute total including tip
    const totalAmount = Number((Number(currentAmount || 0) + Number(tipAmount || 0)).toFixed(2));

    // Build link or text depending on provider type
    let out = '';
    if (selectedProvider.type === 'url' && typeof selectedProvider.makeUrl === 'function') {
        out = selectedProvider.makeUrl(totalAmount, currentService);
        if (providerLinkEl) {
            providerLinkEl.href = out;
            providerLinkEl.textContent = out;
            providerLinkEl.style.display = 'inline';
        }
        if (addressText) addressText.style.display = 'none';
    } else if (selectedProvider.type === 'crypto' && typeof selectedProvider.makeUri === 'function') {
        out = selectedProvider.makeUri(totalAmount, currentService);
        if (providerLinkEl) {
            providerLinkEl.href = out;
            providerLinkEl.textContent = out;
            providerLinkEl.style.display = 'inline';
        }
        if (addressText) addressText.style.display = 'none';
    } else if (selectedProvider.type === 'plain' && typeof selectedProvider.makeText === 'function') {
        out = selectedProvider.makeText(currentAmount, currentService);
        if (providerLinkEl) {
            providerLinkEl.href = '#';
            providerLinkEl.textContent = selectedProvider.handle;
            providerLinkEl.style.display = 'inline';
        }
        if (addressText) {
            addressText.style.display = 'inline';
            addressText.textContent = out;
        }
    } else {
        // Fallback: show handle
        out = selectedProvider.handle || '';
        if (providerLinkEl) {
            providerLinkEl.href = '#';
            providerLinkEl.textContent = out;
            providerLinkEl.style.display = 'inline';
        }
        if (addressText) {
            addressText.style.display = out ? 'inline' : 'none';
            addressText.textContent = out;
        }
    }

    // Update provider buttons' hrefs so they reflect the current total (keeps links in sync)
    const providerButtons = document.querySelectorAll('#payment-providers .payment-method-btn');
    providerButtons.forEach(b => {
        const pid = b.dataset.provider;
        const prov = PAYMENT_PROVIDERS.find(x => x.id === pid);
        if (!prov) return;
        let href = '#';
        if (prov.type === 'url' && typeof prov.makeUrl === 'function') {
            href = prov.makeUrl(totalAmount, currentService);
        } else {
            href = prov.handle || '#';
        }
        if (b.tagName && b.tagName.toLowerCase() === 'a') b.href = href;
    });

    // Store last generated link/text for copy functionality
    lastGeneratedString = out;

    // Provider-specific instructions (if the instructions container exists)
    if (instructions) {
        instructions.innerHTML = '';
        if (selectedProvider.id === 'zelle') {
            instructions.innerHTML = `<h3>How to pay with Zelle</h3><ol><li>Open your banking app or Zelle-enabled app.</li><li>Send ${formatCurrency(totalAmount)} to <strong>${selectedProvider.handle}</strong>.</li><li>Include a note: ${currentService}.</li></ol>`;
        } else if (selectedProvider.id === 'paypal') {
            instructions.innerHTML = `<h3>How to pay with PayPal</h3><p>Click the PayPal.me link above to pay the exact amount (${formatCurrency(totalAmount)}). If your wallet asks, confirm USD as currency.</p>`;
        } else if (selectedProvider.id === 'venmo') {
            instructions.innerHTML = `<h3>How to pay with Venmo</h3><p>Click the Venmo link above. Your Venmo app will open to complete the payment for ${formatCurrency(totalAmount)}.</p>`;
        } else if (selectedProvider.id === 'cashapp') {
            instructions.innerHTML = `<h3>How to pay with Cash App</h3><p>Click the Cash App link (or open the app) and send ${formatCurrency(totalAmount)} to <strong>$${selectedProvider.handle}</strong>.</p>`;
        } else if (selectedProvider.id === 'bitcoin') {
            instructions.innerHTML = `<h3>How to pay with Bitcoin</h3><ol><li>Open your Bitcoin wallet.</li><li>Click the link above to open the payment URI for ${formatCurrency(totalAmount)}.</li><li>Send the exact BTC amount shown by your wallet.</li></ol>`;
        } else if (selectedProvider.id === 'ethereum') {
            instructions.innerHTML = `<h3>How to pay with Ethereum</h3><p>Open your wallet and click the link above to see the payment instructions. Confirm network fees before sending.</p>`;
        } else {
            instructions.innerHTML = `<p>Follow the link above to pay using ${selectedProvider.name}.</p>`;
        }
    }
    }

// Generate payment address (demo implementation)
function generatePaymentAddress() {
    // In production, this should call your x402 payment server to generate a unique address
    // For demo purposes, we'll use a static address
    return PAYMENT_CONFIG.defaultAddress;
}

// convertUSDToBTC removed — crypto URI generation is not used in this simplified flow.

// Copy address to clipboard
function initializeCopyButton() {
    const copyBtn = document.getElementById('copy-address');
    
    if (!copyBtn) return;
    
    copyBtn.addEventListener('click', async () => {
        try {
            // Copy the last generated link/text for the selected provider
            const textToCopy = lastGeneratedString || paymentAddress || selectedProvider.handle || '';
            await navigator.clipboard.writeText(textToCopy);
            
            // Show success feedback
            copyBtn.classList.add('copied');
            copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
            
            // Reset after 2 seconds
            setTimeout(() => {
                copyBtn.classList.remove('copied');
                copyBtn.innerHTML = '<i class="fa-solid fa-copy"></i>';
            }, 2000);
        } catch (err) {
            console.error('Failed to copy address:', err);
            showError('Failed to copy address');
        }
    });
}

// Payment status checking
function startPaymentStatusCheck() {
    // Clear any existing timer
    if (statusCheckTimer) {
        clearInterval(statusCheckTimer);
    }
    
    // Check payment status periodically
    statusCheckTimer = setInterval(() => {
        checkPaymentStatus();
    }, PAYMENT_CONFIG.statusCheckInterval);
}

// Check payment status
async function checkPaymentStatus() {
    // In production, this would call your x402 payment server to check transaction status
    // For demo purposes, we'll simulate this
    
    try {
        // Simulate API call
        // const response = await fetch(`/api/payment/status?address=${paymentAddress}`);
        // const data = await response.json();
        
        // Demo: Randomly show success after some time (for demonstration only)
        const randomSuccess = Math.random() > 0.95; // 5% chance per check
        
        if (randomSuccess) {
            handlePaymentSuccess();
        }
    } catch (error) {
        console.error('Error checking payment status:', error);
    }
}

// Handle successful payment
function handlePaymentSuccess() {
    // Stop checking
    if (statusCheckTimer) {
        clearInterval(statusCheckTimer);
    }
    
    // Update status display
    const statusElement = document.getElementById('payment-status');
    if (statusElement) {
        statusElement.classList.add('success');
        statusElement.innerHTML = `
            <div class="status-message">
                <i class="fa-solid fa-check-circle"></i>
                <span>Payment received successfully!</span>
            </div>
        `;
    }

    // Success handled in-page; no blocking alert.
}

// Show error message
function showError(message) {
    const statusElement = document.getElementById('payment-status');
    if (statusElement) {
        statusElement.style.background = '#ffe6e6';
        statusElement.style.borderColor = '#ff4d4d';
        statusElement.innerHTML = `
            <div class="status-message" style="color: #cc0000;">
                <i class="fa-solid fa-exclamation-circle"></i>
                <span>${message}</span>
            </div>
        `;
    } else {
        // fallback to alert if no status element is present
        alert(message);
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (statusCheckTimer) {
        clearInterval(statusCheckTimer);
    }
});

// x402 protocol helpers removed — this simplified page uses direct provider links only.
