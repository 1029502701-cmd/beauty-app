const fs = require("fs");
let content = fs.readFileSync("app/src/pages/Capture.jsx", "utf8");

const oldRetry = "  const handleRetry = useCallback(() => {\n    if (!preview) return;\n    controllerRef.current?.abort();\n    if (completionTimeoutRef.current !== null) {\n      clearTimeout(completionTimeoutRef.current);\n      completionTimeoutRef.current = null;\n    }\n    setStage('analyzing');\n    startAnalysis(preview);\n  }, [preview, startAnalysis]);";

const newRetry = "  const handleRetry = useCallback(async () => {\n    if (!preview) return;\n    controllerRef.current?.abort();\n    if (completionTimeoutRef.current !== null) {\n      clearTimeout(completionTimeoutRef.current);\n      completionTimeoutRef.current = null;\n    }\n    setStage('analyzing');\n    // 重新走完整压缩流程（与首次上传 handleFileChange 一致），\n    // 避免 preview 是未压缩原图时把大 token 数据发出去\n    try {\n      const byteStr = atob(preview.split(',')[1]);\n      const arr = new Uint8Array(byteStr.length);\n      for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i);\n      const blob = new Blob([arr], { type: 'image/jpeg' });\n      const resizedDataUrl = await checkAndResize(blob);\n      startAnalysis(resizedDataUrl);\n    } catch (e) {\n      setError(e.message);\n      setStage('error');\n    }\n  }, [preview, startAnalysis]);";

if (!content.includes(oldRetry)) { console.log("ERROR: oldRetry not found"); process.exit(1); }
content = content.replace(oldRetry, newRetry);
fs.writeFileSync("app/src/pages/Capture.jsx", content);
console.log("Capture.jsx updated OK");
