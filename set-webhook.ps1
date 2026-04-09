# set-webhook.ps1
$response = Invoke-RestMethod -Method POST -Uri "http://localhost:3000/set-webhook"
Write-Host "Webhook response: $($response | ConvertTo-Json)"
