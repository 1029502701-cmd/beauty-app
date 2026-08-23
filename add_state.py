content = open(r'C:\Users\yao\Documents\ChatGPT\美妆app\app\src\pages\ReportPage.jsx', 'r', encoding='utf-8').read()
old = '  const [tier3LoadError, setTier3LoadError] = useState(null);\n  const [tier3CurrentQuestionIndex]'
new = '  const [tier3LoadError, setTier3LoadError] = useState(null);\n  const [tier3PreviewText, setTier3PreviewText] = useState(\"\");\n  const [tier3PreviewLoading, setTier3PreviewLoading] = useState(true);\n  const [tier3CurrentQuestionIndex]'
if old in content:
    content = content.replace(old, new)
    print('state vars added')
else:
    print('pattern not found')
open(r'C:\Users\yao\Documents\ChatGPT\美妆app\app\src\pages\ReportPage.jsx', 'w', encoding='utf-8').write(content)
