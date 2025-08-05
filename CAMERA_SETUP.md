# Camera Development Setup

## The Issue
Modern browsers require HTTPS for camera access when not on localhost. This is a security restriction to prevent malicious websites from accessing cameras without permission.

## Quick Solutions

### Option 1: Use localhost instead of IP address
Access your site via `http://localhost:8081` or `http://127.0.0.1:8081` instead of `http://192.168.86.172:8081`. 

Browsers allow camera access on localhost even over HTTP.

### Option 2: Enable HTTPS for development

1. **Generate certificates** (run in PowerShell):
   ```powershell
   .\generate-dev-cert.ps1
   ```

2. **Or manually with OpenSSL** (if installed):
   ```bash
   openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes
   ```

3. **Start HTTPS dev server**:
   ```bash
   npm run dev:secure
   ```

4. **Accept certificate warning** in browser (safe for development)

### Option 3: Browser flags (Chrome/Edge)
For testing only, you can disable this security check:
1. Close all browser windows
2. Start browser with: `chrome.exe --unsafely-treat-insecure-origin-as-secure=http://192.168.86.172:8081 --user-data-dir=temp`

⚠️ **Warning**: Only use this for development, never for production!

## Current Status
- ✅ Camera detection and fallback logic implemented
- ✅ Progressive camera configuration testing (rear → front → any)
- ✅ Detailed error logging for troubleshooting
- ❌ HTTPS required for camera access over network

## Recommended Solution
**Use localhost**: Change your bookmark/URL from `http://192.168.86.172:8081` to `http://localhost:8081` for development.
