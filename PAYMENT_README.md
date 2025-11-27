# Payment Page - x402 Protocol Integration

This payment page provides a simple, client-only payment UI for Amanda's Pet Services. It supports common free payment providers (Venmo, PayPal.me, Stripe links) and computes totals from selected services and tips.

## Features

- **Service Selection**: Users can choose quantities for available pet services (House Sitting, Drop In Visit). The payment page now computes totals as the sum of (price × quantity) for all selected services. The "Pet Introduction" free consultation is not included as a billable item on the payment page.
- **Provider Links**: Generates provider-specific payment links (Venmo, PayPal.me, Stripe)
- **Copy-to-Clipboard**: Copies the selected provider link or identifier to the clipboard
- **Payment Status (Demo)**: Includes a demo payment status poller for local testing
- **Responsive Design**: Works on desktop and mobile devices
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Files

1. **payment.html** - Main payment page structure
2. **payment-styles.css** - Styling for the payment interface
3. **payment-script.js** - JavaScript functionality for link generation, totals, tips, and demo status handling

## x402 Protocol

The page focuses on provider link generation for common payment methods. If you require cryptocurrency payments or x402-specific flows, consider adding a backend to mint unique payment addresses and verify on-chain confirmations.

## Payment URI Format

```
bitcoin:<address>?amount=<btc_amount>&label=<service_name>
```

## Usage

1. Navigate to `payment.html`
2. Select quantities for the available services and optionally a tip
3. Choose a payment provider (Venmo, PayPal.me, Stripe)
4. Click the provider button to open the provider link in a new tab, or copy the link using the copy button
5. Complete the payment in the provider's page
6. For demo/testing, observe the simulated payment status updates on the page

## Configuration

To use this in production, update provider handles/links in `payment-script.js` and optionally integrate server-side flows for providers that require it (e.g., Stripe Checkout sessions).

```javascript
const PAYMENT_CONFIG = {
    defaultAddress: 'YOUR_BITCOIN_ADDRESS_HERE',
    paymentServer: 'YOUR_X402_SERVER_ENDPOINT',
    statusCheckInterval: 5000
};
```

### Provider Configuration

The page supports provider link generation. Edit the `PAYMENT_PROVIDERS` array in `payment-script.js` and replace placeholder handles/URLs with your real accounts or hosted payment links. Example providers included:

- `paypal` (e.g. `https://www.paypal.me/<username>/<amount>`)
- `venmo` (e.g. `https://venmo.com/<username>?txn=pay&amount=...`)
- `stripe` (hosted payment link or Checkout URL)

Example snippet (inside `payment-script.js`):

```javascript
const PAYMENT_PROVIDERS = [
    { id: 'venmo', handle: 'YourVenmoUser', /* ... */ },
    { id: 'paypal', handle: 'YourPayPalUser', /* ... */ },
    { id: 'stripe', url: 'https://buy.stripe.com/...' /* ... */ }
];
```

## Integration Notes

- Replace the demo Bitcoin address with your actual address
- Implement a backend server to generate unique payment addresses per transaction
- Connect to a blockchain API for real-time payment verification
- Add webhook handlers for payment confirmations
- Implement proper error handling and retry logic
 - The payment page now supports quantity inputs for services and an optional tip selection. The "Pet Introduction" free service was removed to focus payments on billable services.
 - Quantities: Update service `data-price` attributes in `payment.html` if you change service prices; totals are computed client-side from quantities (price × qty).

## Security Considerations

- Always validate payment amounts on the server side
- Use HTTPS for all payment-related communications
- Implement proper rate limiting on payment status checks
- Store transaction records securely
- Follow PCI compliance guidelines for any card payment integration

## Browser Compatibility

- Modern browsers with ES6+ support
The page uses the Clipboard API for copy functionality
- Clipboard API for copy functionality

## Dependencies

- No external QR library is required for the current link-only flow
- Font Awesome (v6.4.0) - Icons
- Firebase (v9.23.0) - Authentication (optional)

## Future Enhancements

- Credit card payment integration
- Multiple cryptocurrency support
- Payment confirmation email notifications
- Transaction history tracking
- Refund processing
- Subscription/recurring payment support
 - Tip UI: Buttons for quick tip amounts or a custom tip field (default $7 selected). Ensure validation for custom tips (> $5).
