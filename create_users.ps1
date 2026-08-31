# Create 5 diverse test users with different face characteristics
$users = @(
  @{phone="15961962401", pwd="Test1234", name="User-A"},
  @{phone="15961962402", pwd="Test1234", name="User-B"},
  @{phone="15961962403", pwd="Test1234", name="User-C"},
  @{phone="15961962404", pwd="Test1234", name="User-D"},
  @{phone="15961962405", pwd="Test1234", name="User-E"}
)
$baseDir = "C:\Users\yao\Documents\ChatGPT\美妆app\pages-functions"

foreach ($u in $users) {
  # Register user via API to get session (which also creates password_hash)
  $body = @{account=$u.phone; password=$u.pwd; confirmPassword=$u.pwd} | ConvertTo-Json
  $r = Invoke-WebRequest -Uri "http://127.0.0.1:8788/api/auth/register" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 10
  Write-Host "$($u.name) register: $($r.Content)"
}
