$tokens = @{
  "15961962401" = "3f17a773-85e1-477a-a2ec-a7e8621dc901"
  "15961962402" = "6239dc9e-fca2-46d1-8aa7-487c9b369e7c"
  "15961962403" = "72830263-3c27-4ef6-829d-2fb55bf6183c"
  "15961962404" = "7d9a853d-d3fc-4cb9-ba98-64f822ec6227"
  "15961962405" = "397ff435-7f39-400b-9b98-8250d6dabf86"
}
$reports = @{
  "15961962401" = "tier2-test-a"
  "15961962402" = "tier2-test-b"
  "15961962403" = "tier2-test-c"
  "15961962404" = "tier2-test-d"
  "15961962405" = "tier2-test-e"
}
$base = "http://127.0.0.1:8788/api/tier2/generate"

foreach ($phone in $tokens.Keys) {
  $token = $tokens[$phone]
  $reportId = $reports[$phone]
  $headers = @{"Authorization"="Bearer $token"; "Content-Type"="application/json"}
  $body = '{"reportId":"' + $reportId + '"}'
  
  Write-Host "========================================"
  Write-Host "User: $phone  Report: $reportId"
  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  try {
    $r = Invoke-WebRequest -Uri $base -Method POST -ContentType "application/json" -Body $body -Headers $headers -TimeoutSec 90
    $sw.Stop()
    Write-Host "Status: $($r.StatusCode)  Time: $([math]::Round($sw.Elapsed.TotalSeconds,1))s"
    $j = $r.Content | ConvertFrom-Json
    if ($j.content) {
      $ka = $j.content.keyAreas
      Write-Host "keyAreas count: $($ka.Count)"
      Write-Host "coreMakeup: $($j.content.coreMakeup)"
      Write-Host "style: $($j.content.style)"
      Write-Host "Has formula: $(($j.content.formula -ne $null))"
      Write-Host "Has productRecs: $(($j.content.productRecs -ne $null))"
      $pr = $j.content.productRecs
      if ($pr) {
        Write-Host "productRecs dims: $(($pr.PSObject.Properties.Name -join ', '))"
      }
    } else {
      Write-Host "ERROR: $($r.Content)"
    }
  } catch {
    $sw.Stop()
    Write-Host "Status: $($_.Exception.Response.StatusCode)  Time: $([math]::Round($sw.Elapsed.TotalSeconds,1))s"
    Write-Host "Body: $($_.ErrorDetails.Message)"
  }
  Write-Host ""
}
