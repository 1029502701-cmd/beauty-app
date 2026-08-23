import sys
sys.stdout.reconfigure(encoding='utf-8')
path = r'C:\Users\yao\Documents\ChatGPT\美妆app\app\src\pages\ReportPage.jsx'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Fix 1: insert tier3Content check after line 743 (0-indexed: 742)
# Change line 744 (index 743) from ') : !tier3TokenStatus.hasToken ? (' 
# to ') : tier3Content ? (\n              <Tier3Report .../>\n            ) : !tier3TokenStatus.hasToken ? ('
old_line = lines[743]
new_lines = [
    '            ) : tier3Content ? (\n',
    '              <Tier3Report content={tier3Content} onRefresh={handleTier3Refresh} />\n',
    '            ) : !tier3TokenStatus.hasToken ? (\n',
]
lines[743:744] = new_lines
print(f'Fix 1 done: inserted tier3Content priority check (was line 744)')

# Fix 2: remove the old redundant tier3Content check
# After fix 1, the old line 836 is now at index 838 (shifted by +2 - 1 = +1)
# Search for the pattern
for i in range(830, 845):
    if i < len(lines):
        stripped = lines[i].strip()
        if stripped == ') : tier3Content ? (' and i+1 < len(lines) and 'Tier3Report' in lines[i+1]:
            # Replace these 3 lines with ') : null}'
            lines[i:i+3] = ['            ) : null}\n']
            print(f'Fix 2 done: removed redundant tier3Content check at index {i}')
            break
else:
    print('ERROR: could not find redundant tier3Content check')
    sys.exit(1)

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('File written successfully')
