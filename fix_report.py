import sys
sys.stdout.reconfigure(encoding='utf-8')
path = r'C:\Users\yao\Documents\ChatGPT\美妆app\app\src\pages\ReportPage.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add Tier2Result import after line 3
content = content.replace(
    "import RequireAuth from '../router/RequireAuth.jsx';\n",
    "import RequireAuth from '../router/RequireAuth.jsx';\nimport Tier2Result from './Tier2Result.jsx';\n"
)
print('Import added:', 'Tier2Result' in content)

# 2. Remove STYLE_EMOJIS
content = content.replace("const STYLE_EMOJIS = ['💄', '✨', '🌸', '💎'];\n", '')
print('STYLE_EMOJIS removed')

# 3. Remove MOCK_INFLUENCERS
old_mock = """const MOCK_INFLUENCERS = [
  { id: 1, name: '林小美妆', fans: '238万', style: '清透日常妆', avatar: '👩', desc: '擅长根据脸型定制妆容，分享超多平价好物' },
  { id: 2, name: '化妆师Amy', fans: '156万', style: '高级晚宴妆', avatar: '💁‍♀️', desc: '专业舞台化妆师，揭秘明星同款妆容技巧' },
  { id: 3, name: '甜美妆娘', fans: '312万', style: '元气少女风', avatar: '🧚‍♀️', desc: '学生党必备，百元内打造精致妆感' },
];
"""
content = content.replace(old_mock, '')
print('MOCK_INFLUENCERS removed:', 'MOCK_INFLUENCERS' not in content)

# 4. Remove expandedDims state
content = content.replace("  const [expandedDims, setExpandedDims] = useState({});\n", '')
print('expandedDims removed')

# 5. Remove toggleDim
content = content.replace("  const toggleDim = (dim) => setExpandedDims((prev) => ({ ...prev, [dim]: !prev[dim] }));\n", '')
print('toggleDim removed')

# 6. Remove dimOrder and dimLabels
content = content.replace("  const dimOrder = ['faceShape', 'skinType', 'eyebrowShape', 'eyeShape', 'threeFiveRatio', 'symmetry'];\n", '')
content = content.replace("  const dimLabels = { faceShape: '脸型', skinType: '肤质', eyebrowShape: '眉形', eyeShape: '眼型', threeFiveRatio: '三庭五眼', symmetry: '五官对称度' };\n", '')
print('dimOrder/dimLabels removed')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('File written successfully')
