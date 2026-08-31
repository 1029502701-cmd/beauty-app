const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://127.0.0.1:8788";
const OUT = "C:\\\\Users\\\\yao\\\\Documents\\\\ChatGPT\\\\\\u7f8e\\u5986app\\\\test_output";

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pg = await ctx.newPage();

  await pg.goto(BASE + "/login", { waitUntil: "networkidle", timeout: 15000 });
  await pg.waitForTimeout(2000);

  // Get all clickable elements
  const allElements = await pg.evaluate(() => {
    const els = Array.from(document.querySelectorAll("*"));
    return els.filter(el => {
      const text = el.textContent?.trim();
      return text && text.length < 50 && (
        el.tagName === "BUTTON" || 
        el.tagName === "DIV" && el.onclick !== null ||
        el.classList.contains("tab") ||
        el.classList.contains("tab-item") ||
        el.classList.contains("login-tab") ||
        el.getAttribute("role") === "tab"
      );
    }).map(el => ({
      tag: el.tagName,
      text: el.textContent.trim().substring(0, 30),
      class: el.className.substring(0, 80),
      clickable: el.onclick !== null || el.getAttribute("role") === "tab" || el.tagName === "BUTTON"
    }));
  });
  console.log("Clickable elements:", JSON.stringify(allElements, null, 2));

  // Try clicking on anything that looks like a tab
  const tabTexts = await pg.evaluate(() => {
    return Array.from(document.querySelectorAll("*")).filter(el => {
      const t = el.textContent?.trim();
      return t && (t.includes("验证码") || t.includes("SMS") || t.includes("短信") || t.includes("密码") || t.includes("Password"));
    }).map(el => ({ tag: el.tagName, text: el.textContent.trim(), class: el.className }));
  });
  console.log("Tab-like elements:", JSON.stringify(tabTexts, null, 2));

  await browser.close();
})().catch(e => { console.error("Failed:", e.message); process.exit(1); });
