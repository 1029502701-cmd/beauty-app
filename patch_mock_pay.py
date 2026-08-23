html = open('app/public/mock-pay.html', 'r', encoding='utf-8').read()

old_redeem = '<div class=\"redeem-code\" id=\"redeemCodeDisplay\">--------</div>\n          <p class=\"redeem-hint\">返回 App 后，在\"专属报告\"页面输入此兑换码即可绑定使用</p>'
new_redeem = '<div class=\"redeem-code\" id=\"redeemCodeDisplay\">--------</div>\n          <button class=\"redeem-copy-btn\" id=\"redeemCopyBtn\" onclick=\"copyRedeemCode()\">复制</button>\n          <p class=\"redeem-hint\">返回 App 后，在\"专属报告\"页面输入此兑换码即可绑定使用</p>'
html = html.replace(old_redeem, new_redeem)

old_style = '.redeem-hint { font-size: 13px; color: #666; margin-top: 8px; }'
new_style = '.redeem-hint { font-size: 13px; color: #666; margin-top: 8px; }\n    .redeem-copy-btn { width: 100%; padding: 10px; border: 1px dashed #1890ff; border-radius: 8px; font-size: 14px; color: #1890ff; background: #fff; cursor: pointer; margin-top: 8px; transition: background .2s; }\n    .redeem-copy-btn:hover { background: #f0f9ff; }'
html = html.replace(old_style, new_style)

old_script = 'function goBack() { history.back(); }\n  </script>'
new_script = \"\"\"function goBack() { history.back(); }
    function copyRedeemCode() {
      const code = document.getElementById(\"redeemCodeDisplay\").textContent;
      const btn = document.getElementById(\"redeemCopyBtn\");
      if (!code || code === \"--------\") return;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(() => {
          btn.textContent = \"已复制\";
          setTimeout(() => { btn.textContent = \"复制\"; }, 1500);
        });
      } else {
        const ta = document.createElement(\"textarea\");
        ta.value = code;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand(\"copy\");
        document.body.removeChild(ta);
        btn.textContent = \"已复制\";
        setTimeout(() => { btn.textContent = \"复制\"; }, 1500);
      }
    }
  </script>\"\"\"
html = html.replace(old_script, new_script)

open('app/public/mock-pay.html', 'w', encoding='utf-8').write(html)
print('mock-pay.html updated')
