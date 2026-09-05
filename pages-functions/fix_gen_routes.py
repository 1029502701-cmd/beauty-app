import sys
sys.stdout.reconfigure(encoding='utf-8')
path = r'gen-routes.js'
content = open(path, encoding='utf-8-sig').read()
# Fix: also convert top-level [key].ts files to :key* format
old = '''    } else if (entry.name.endsWith(".ts") && !entry.name.startsWith("_")) {
      const route = mountPath + "/" + entry.name.replace(".ts", "");
      routes.push(route);
    }'''
new = '''    } else if (entry.name.endsWith(".ts") && !entry.name.startsWith("_")) {
      let name = entry.name.replace(".ts", "");
      // Convert [param] to :param* for Cloudflare Pages routing
      const paramMatch = name.match(/^\\[(\\w+)\\]$/);
      if (paramMatch) {
        name = ":" + paramMatch[1] + "*";
      }
      const route = mountPath + "/" + name;
      routes.push(route);
    }'''
if old in content:
    content = content.replace(old, new)
    open(path, 'w', encoding='utf-8-sig').write(content)
    print('FIXED gen-routes.js')
else:
    print('NOT FOUND')
    # Show the relevant section
    idx = content.find('.endsWith(".ts")')
    print(repr(content[max(0,idx-50):idx+300]))
