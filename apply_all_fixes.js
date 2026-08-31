const fs = require('fs');
const content = fs.readFileSync(r"C:\Users\yao\Documents\ChatGPT\美妆app\app\src\pages\ReportPage.jsx", "utf-8");

// 1. Add state vars
let result = content.replace(
  'const [tier2LoadError, setTier2LoadError] = useState(null);',
  `const [tier2LoadError, setTier2LoadError] = useState(null);
  const [tier2Generation, setTier2Generation] = useState(null);
  const [tier2Processing, setTier2Processing] = useState(false);`
);

// 2. Replace status effect
const oldStatus = `  // Load tier2 status
  useEffect(() => {
    if (!reportId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(BASE + '/tier2/status?tier1ReportId=' + encodeURIComponent(reportId), {
          headers: { Authorization: \`Bearer \${token}\` },
        });
        if (!res.ok) throw new Error('请求失败: ' + res.status);
        const data = await res.json();
        if (!cancelled) setTier2Status(data);
      } catch { if (!cancelled) setTier2Status({ unlocked: false }); }
    })();
    return () => { cancelled = true; };
  }, [reportId, token]);`;
const newStatus = `  // Load tier2 generation status
  useEffect(() => {
    if (!reportId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(BASE + '/tier2/status?tier1ReportId=' + encodeURIComponent(reportId), {
          headers: { Authorization: \`Bearer \${token}\` },
        });
        if (!res.ok) throw new Error('请求失败: ' + res.status);
        const data = await res.json();
        if (!cancelled) {
          setTier2Status(data);
          if (data.generationStatus === 'ready' && data.content) {
            setTier2Content(data.content);
            setTier2LoadError(null);
          }
        }
      } catch { if (!cancelled) setTier2Status({ generationStatus: 'not_found' }); }
    })();
    return () => { cancelled = true; };
  }, [reportId, token]);`;
if (result.includes(oldStatus)) {
  result = result.replace(oldStatus, newStatus);
  console.log('Step 2: OK');
} else {
  console.log('Step 2: FAIL');
}

// 3. Replace generate effect
const oldGen = `  // Load tier2 content when unlocked
  useEffect(() => {
    if (!reportId || !tier2Status?.unlocked) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(BASE + '/tier2/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` },
          body: JSON.stringify({ reportId: tier2Status?.tier2ReportId || reportId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || '请求失败 ' + res.status);
        if (!cancelled) { setTier2Content(data.content); setTier2LoadError(null); }
      } catch (e) { if (!cancelled) setTier2LoadError(e.message); }
    }
    void load();
    return () => { cancelled = true; };
  }, [reportId, tier2Status, token]);`;
const newGen = `  // Poll tier2 generation status until ready or failed
  useEffect(() => {
    const genData = tier2Status;
    if (!reportId || !genData) return;
    const { generationStatus, tier2ReportId } = genData;
    if (generationStatus === 'ready') return;
    if (generationStatus === 'failed') return;
    if (generationStatus !== 'not_found' && generationStatus !== 'pending') return;

    let cancelled = false;
    let intervalId = null;

    async function doGenerate() {
      try {
        const res = await fetch(BASE + '/tier2/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: \`Bearer \${token}\` },
          body: JSON.stringify({ reportId: tier2ReportId || reportId }),
        });
        const data = await res.json();
        if (!cancelled) {
          if (!res.ok) {
            setTier2Generation({ generationStatus: 'failed', tier2ReportId: tier2ReportId || reportId });
            setTier2LoadError(data?.error || '请求失败 ' + res.status);
          } else {
            setTier2Generation(data);
            setTier2Processing(true);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setTier2Generation({ generationStatus: 'failed', tier2ReportId: tier2ReportId || reportId });
          setTier2LoadError('网络异常');
        }
      }
    }

    async function pollStatus() {
      if (!tier2ReportId) return;
      try {
        const res = await fetch(BASE + '/tier2/status?tier2Id=' + encodeURIComponent(tier2ReportId), {
          headers: { Authorization: \`Bearer \${token}\` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        setTier2Generation(data);
        if (data.generationStatus === 'ready') {
          setTier2Processing(false);
          if (data.content) {
            setTier2Content(data.content);
            setTier2LoadError(null);
          }
        } else if (data.generationStatus === 'failed') {
          setTier2Processing(false);
          if (!tier2LoadError) setTier2LoadError('生成失败，请稍后重试');
        }
      } catch {}
    }

    doGenerate().then(() => {
      if (cancelled) return;
      if (tier2Generation?.generationStatus === 'processing') {
        intervalId = setInterval(pollStatus, 2000);
      }
    });

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [reportId, tier2Status, token]);`;
if (result.includes(oldGen)) {
  result = result.replace(oldGen, newGen);
  console.log('Step 3: OK');
} else {
  console.log('Step 3: FAIL - pattern not found');
  // Debug
  const idx = result.indexOf('// Load tier2 content when unlocked');
  if (idx >= 0) console.log('Found at', idx, 'len:', result.substring(idx, idx+200));
}

// 4. Update unlock-by-ad handler
const oldAd = `      if (data?.tier2ReportId) {
        setTier2Status({ unlocked: true, tier2ReportId: data.tier2ReportId });
      }`;
const newAd = `      if (data?.tier2ReportId) {
        setTier2Generation({ generationStatus: 'processing', tier2ReportId: data.tier2ReportId });
        setTier2Processing(true);
      }`;
if (result.includes(oldAd)) {
  result = result.replace(oldAd, newAd);
  console.log('Step 4: OK');
} else {
  console.log('Step 4: FAIL');
}

// 5. Update handleShareReport
const oldShare = `      setShareDone(true);
    } catch (err) { console.error('[ReportPage] 分享异常:', err); }
    finally { setShareLoading(false); }
  }, [shareLoading, reportId, token]);`;
const newShare = `      setShareDone(true);
      // 分享成功后，查询 tier2 记录并启动异步生成轮询
      try {
        const statusRes = await fetch(BASE + '/tier2/status?tier1ReportId=' + encodeURIComponent(reportId), {
          headers: { Authorization: \`Bearer \${token}\` },
        });
        if (statusRes.ok) {
          const statusData = await statusRes.json();
          if (statusData.tier2ReportId && statusData.generationStatus === 'pending') {
            setTier2Generation({ generationStatus: 'processing', tier2ReportId: statusData.tier2ReportId });
            setTier2Processing(true);
          }
        }
      } catch {}
    } catch (err) { console.error('[ReportPage] 分享异常:', err); }
    finally { setShareLoading(false); }
  }, [shareLoading, reportId, token]);`;
if (result.includes(oldShare)) {
  result = result.replace(oldShare, newShare);
  console.log('Step 5: OK');
} else {
  console.log('Step 5: FAIL');
  const idx = result.indexOf('setShareDone(true)');
  if (idx >= 0) console.log('Found at', idx, ':', result.substring(idx-20, idx+200));
}

// 6. Replace rendering block
const oldRenderStart = ': !tier2Status ? <div className="report-loading">加载中...</div>';
const oldRenderEnd = ') : !t2 ? <div className="report-loading">正在生成进阶报告...</div> : (';
const renderIdx = result.indexOf(oldRenderStart);
if (renderIdx >= 0) {
  // Find the end of the block
  const blockStart = result.lastIndexOf('\n            ', renderIdx);
  const blockEnd = result.indexOf(oldRenderEnd, renderIdx);
  if (blockEnd > blockStart) {
    const newRender = `            : !tier2Generation ? <div className="report-loading">加载中...</div>
            : tier2Generation.generationStatus === 'processing' ? (
              <div className="report-loading">
                <div className="report-loading-spinner" />
                <p>AI 正在为你生成进阶报告，请稍候…</p>
              </div>
            ) : tier2Generation.generationStatus === 'failed' ? (
              <div className="report-error">
                <p>生成失败，请稍后重试</p>
                <button onClick={() => { setTier2Generation(null); setTier2Content(null); setTier2LoadError(null); }}>重试</button>
              </div>
            ) : !tier2Generation.tier2ReportId ? (
              <div className="report-unlock-prompt">
                <div className="report-unlock-icon">🔒</div>
                <p className="report-unlock-text">选择方式解锁进阶报告</p>
                <div className="report-unlock-options">
                  <button
                    className="report-unlock-btn"
                    onClick={handleShareReport}
                    disabled={shareLoading || !reportId}
                  >
                    {shareLoading ? '生成分享中…' : '分享解锁'}
                  </button>
                  <button
                    className="report-unlock-btn-alt"
                    onClick={handleAdFinishForTier2}
                    disabled={adUnlockLoading || !reportId}
                  >
                    {adUnlockLoading ? '解锁中…' : '看广告解锁'}
                  </button>
                </div>
                <p className="report-unlock-hint">分享邀请好友完成分析，或观看5秒广告即可解锁</p>
                {shareDailyLimitExceeded && (
                  <p className="report-daily-limit-text">今日进阶报告次数已用完，明天再来吧</p>
                )}
                <button className="report-unlock-btn" onClick={handleShareReport} disabled={shareLoading || !reportId}>
                  {shareLoading ? '生成分享中…' : '去分享解锁'}
                </button>

              </div>
            ) : tier2LoadError ? (
              <div className="report-error">
                <p>加载失败：{tier2LoadError}</p>
                <button onClick={() => { setTier2Content(null); setTier2LoadError(null); setTier2Generation(null); }}>重试</button>
              </div>`;
    result = result.substring(0, blockStart + 1) + newRender + result.substring(blockEnd);
    console.log('Step 6: OK - rendering replaced');
  } else {
    console.log('Step 6: FAIL - could not find block end');
  }
} else {
  console.log('Step 6: FAIL - render start not found');
}

fs.writeFileSync(r"C:\Users\yao\Documents\ChatGPT\美妆app\app\src\pages\ReportPage.jsx", result, "utf-8");
console.log('File written, size:', result.length);
