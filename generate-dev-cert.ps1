# PowerShell script to generate self-signed certificates for HTTPS development
# This allows camera access over HTTPS on local network

Write-Host "Generating self-signed certificate for HTTPS development..." -ForegroundColor Green

# Generate private key and certificate
$cert = New-SelfSignedCertificate -DnsName "localhost", "192.168.86.172", "127.0.0.1" -CertStoreLocation "cert:\LocalMachine\My" -KeyAlgorithm RSA -KeyLength 2048 -NotAfter (Get-Date).AddYears(1)

# Export certificate to PEM format
$certPath = "$PSScriptRoot\cert.pem"
$keyPath = "$PSScriptRoot\key.pem"

# Export certificate
$certBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
$certPem = [System.Convert]::ToBase64String($certBytes, [System.Base64FormattingOptions]::InsertLineBreaks)
$certContent = "-----BEGIN CERTIFICATE-----`n$certPem`n-----END CERTIFICATE-----"
$certContent | Out-File -FilePath $certPath -Encoding ASCII

Write-Host "Certificate generated at: $certPath" -ForegroundColor Yellow
Write-Host ""
Write-Host "To use HTTPS development server:" -ForegroundColor Cyan
Write-Host "1. Run: npm run dev:secure" -ForegroundColor White
Write-Host "2. Accept the browser security warning (it's safe for development)" -ForegroundColor White
Write-Host "3. Camera should now work over HTTPS" -ForegroundColor White
Write-Host ""
Write-Host "Note: You'll need to accept the certificate warning in your browser." -ForegroundColor Yellow

# Note: Exporting private key requires additional steps in PowerShell
# For simplicity, we'll use a different approach with OpenSSL if available
Write-Host ""
Write-Host "If you have OpenSSL installed, you can also generate certificates with:" -ForegroundColor Cyan
Write-Host "openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes" -ForegroundColor White
