# Wheel Quick Look ☁️

A Chrome extension that allows you to preview links in a central modal popup using a mouse wheel long-press, eliminating unnecessary tab clutter.

![Version](https://img.shields.io/badge/version-1.2-a2d2ff?style=flat-square&logo=github)
![Manifest](https://img.shields.io/badge/manifest-v3-e6e0d8?style=flat-square&logo=googlechrome)
![License](https://img.shields.io/badge/license-Custom-ffb3c1?style=flat-square&logo=opensourceinitiative)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat-square&logo=css3&logoColor=white)
![Discord](https://img.shields.io/badge/Discord-hj.hive-5865F2?style=flat-square&logo=discord&logoColor=white)

<p align="center">
  <img src="assets/loading.png" width="48%" alt="Loading State" />
  <img src="assets/preview.png" width="48%" alt="Preview Opened" />
</p>

---

## ✨ Features

* **Instant Preview**: Long-press the mouse wheel (middle click) on any link to trigger a central preview popup.
* **Advanced Auto-Scroll**: Middle-click inside the popup to activate a smooth auto-scroll mode, complete with a polished glassmorphism crosshair UI and a clean, modern full-page loader.
* **Smart Navigation**: Click links inside the preview popup to seamlessly open them in a new tab or redirect the current window, based on your preferences.
* **Scroll Restoration**: The extension automatically memorizes your exact vertical/horizontal scroll coordinates and flawlessly restores your view on the destination page.
* **Anti-Focus Stealing**: Built-in state trapping to isolate intrusive advertisements and protect user interaction layout.
* **Instant Close Shortcuts**: Dismiss the preview modal instantly by pressing the `Escape` key, clicking the dim backdrop overlay, or simply clicking your mouse back button (Button 3).
* **Fully Customizable**: Tweak long-press thresholds (200ms - 2000ms) and window click behaviors via a beautifully tailored extension control panel.
* **Serverless & Secure**: All configurations are securely stored inside your local machine using `chrome.storage.local`.

---

## 🛠️ Installation (Developer Mode)

Since this extension is optimized for local performance, you can run it directly via Chrome's Developer Mode:

1. **[Download](https://github.com/Aiuces/chrome-wheel-quick-look/releases)** or clone this repository to your local machine.
2. Open Google Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** by toggling the switch in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select the root folder containing `manifest.json`.
6. Pin **Wheel Quick Look** to your toolbar and enjoy!

> 🔄 **Important Note for Code Modifications:**  
> If you make any changes to the source code (e.g., modifying `content.js`), you **must reload the extension** on the `chrome://extensions/` page **AND completely refresh your active webpage tabs** for the updates to take effect.

---

## ⚙️ Configuration

<p align="center">
  <img src="assets/config.png" width="35%" alt="Control Panel" />
</p>

Click the extension icon in your toolbar to access the control panel:
* **Click Action inside Popup**: Toggle whether to open nested previews into a new tab or redirect the current view.
* **Long-Press Timer**: Tweak the middle-click hold duration threshold (200ms - 2000ms).

---

## 🔒 Advanced: Security & Compatibility (rules.json)

By default, certain advanced network rules in `rules.json` are prefixed with `disabled-` (e.g., `disabled-content-security-policy`). 

* **Why they are disabled**: Some strict websites actively block themselves from being loaded inside an iframe, which may cause a "Connection Refused" error in the preview popup.
* **How to use**: If specific websites fail to load properly, you can remove the `disabled-` prefix from one or both rules to bypass their framing restrictions.
* ⚠️ **Security Warning**: Un-disabling (enabling) these rules will force the removal of strict security headers (`Content-Security-Policy` and `X-Frame-Options`) within the preview context. While this significantly improves website compatibility, it **may expose the preview sandbox to potential security vulnerabilities** on untrusted sites. Please use with caution.

---

## 📄 License

Copyright (c) 2026 Aiuces. All rights reserved.  

Licensed under a strict **Custom Non-Commercial & Anti-Redistribution License**. See the [LICENSE](LICENSE) file for full details. Prohibits any commercial exploitation and un-authorized web-store re-hosting.
