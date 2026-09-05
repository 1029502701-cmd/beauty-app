path = r'C:\Users\yao\Documents\ChatGPT\美妆app\app\src\pages\Home.jsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Remove path from ai-beauty product
content = content.replace(
    "{ id: 'ai-beauty', label: 'AI 美妆', icon: '\U0001f484', path: '/report' }",
    "{ id: 'ai-beauty', label: 'AI 美妆', icon: '\U0001f484' }"
)

# Fix 2: Update onClick for ai-beauty  
content = content.replace(
    'onClick={() => navigate(p.path)}',
    "onClick={p.id === 'ai-beauty' ? handleAiBeautyClick : () => navigate(p.path)}"
)

# Fix 3: Add handleAiBeautyClick function before return
old_return = '  return ('
new_return = '''  const handleAiBeautyClick = async () => {
    const storedId = sessionStorage.getItem('capture_report_id');
    if (storedId) {
      navigate('/report?id=' + encodeURIComponent(storedId));
      return;
    }
    try {
      const res = await fetch(BASE + '/reports/mine', {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.tier1Report?.id) {
          sessionStorage.setItem('capture_report_id', data.tier1Report.id);
          navigate('/report?id=' + encodeURIComponent(data.tier1Report.id));
          return;
        }
      }
    } catch {}
    navigate('/report');
  };

  return ('''
content = content.replace(old_return, new_return)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('Home.jsx updated successfully')