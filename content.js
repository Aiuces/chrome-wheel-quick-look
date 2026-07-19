let longPressDuration = 700;
let clickBehavior = 'newTab';
let latestX = 0;
let latestY = 0;

chrome.storage.local.get(['holdDuration', 'clickBehavior'], (res) => {
  if (res.holdDuration) longPressDuration = res.holdDuration;
  if (res.clickBehavior) clickBehavior = res.clickBehavior;
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.holdDuration) longPressDuration = changes.holdDuration.newValue;
  if (changes.clickBehavior) clickBehavior = changes.clickBehavior.newValue;
});

function checkIsPreview() {
  if (window.location.href.includes('qlook_preview=true')) return true;
  if (window.name === 'qlook_preview_frame') return true;
  try {
    let p = window;
    while (p !== window.top) {
      if (p.name === 'qlook_preview_frame' || p.location.href.includes('qlook_preview=true')) {
        return true;
      }
      p = p.parent;
    }
  } catch (e) {}
  return false;
}

const IS_PREVIEW = checkIsPreview();

if (!IS_PREVIEW && window.self === window.top) {
  const scrollMatch = window.location.href.match(/[#&]qlook_scroll=(\d+)_(\d+)/);
  if (scrollMatch) {
    const scrollX = parseInt(scrollMatch[1], 10);
    const scrollY = parseInt(scrollMatch[2], 10);

    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }

    const restoreScroll = () => window.scrollTo(scrollX, scrollY);

    restoreScroll();
    document.addEventListener('DOMContentLoaded', restoreScroll);
    window.addEventListener('load', restoreScroll);
    setTimeout(restoreScroll, 100);
    setTimeout(restoreScroll, 400);

    const cleanUrl = window.location.href.replace(/[#&]qlook_scroll=\d+_\d+/, '');
    history.replaceState(null, null, cleanUrl);
  }
}

if (IS_PREVIEW) {
  window.top.postMessage({ type: 'PAGE_INTERACTIVE_QUICK_LOOK' }, '*');

  // Auto-scroll states and functions
  let isAutoScrolling = false;
  let justStoppedAutoScroll = false;
  let autoScrollStartX = 0;
  let autoScrollStartY = 0;
  let autoScrollCurrentX = 0;
  let autoScrollCurrentY = 0;
  let autoScrollMovedDistance = 0;
  let autoScrollAnimationFrame = null;
  let localScrollableElementsX = [];

  const isMainPreviewFrame = window.location.href.includes('qlook_preview=true') || window.name === 'qlook_preview_frame';

  function cacheLocalScrollableElementsX() {
    localScrollableElementsX = [];
    const els = document.querySelectorAll('div, section, table, main, article, body, html, p');
    for (const el of els) {
      if (el.scrollWidth > el.clientWidth) {
        const style = window.getComputedStyle(el);
        if (style.overflowX === 'auto' || style.overflowX === 'scroll') {
          localScrollableElementsX.push(el);
        }
      }
    }
  }

  function scrollLocalElementsX(scrollX) {
    for (const el of localScrollableElementsX) {
      el.scrollLeft += scrollX;
    }
  }

  function startAutoScrollCentral(startX, startY) {
    isAutoScrolling = true;
    justStoppedAutoScroll = false;
    autoScrollStartX = startX;
    autoScrollStartY = startY;
    autoScrollCurrentX = startX;
    autoScrollCurrentY = startY;
    autoScrollMovedDistance = 0;

    cacheLocalScrollableElementsX();
    broadcastScrollState(true);
    autoScrollLoopCentral();
  }

  function stopAutoScrollCentral() {
    if (!isAutoScrolling) return;
    isAutoScrolling = false;
    if (autoScrollAnimationFrame) {
      cancelAnimationFrame(autoScrollAnimationFrame);
      autoScrollAnimationFrame = null;
    }
    broadcastScrollState(false);
  }

  function autoScrollLoopCentral() {
    if (!isAutoScrolling) return;

    const dx = autoScrollCurrentX - autoScrollStartX;
    const dy = autoScrollCurrentY - autoScrollStartY;
    const deadzone = 8;
    
    let scrollX = 0;
    let scrollY = 0;

    if (Math.abs(dx) > deadzone) {
      scrollX = (dx > 0 ? dx - deadzone : dx + deadzone) * 0.08;
    }
    if (Math.abs(dy) > deadzone) {
      scrollY = (dy > 0 ? dy - deadzone : dy + deadzone) * 0.08;
    }

    if (scrollX !== 0 || scrollY !== 0) {
      if (scrollY !== 0) {
        window.scrollBy(0, scrollY);
      }
      if (scrollX !== 0) {
        window.scrollBy(scrollX, 0);
        scrollLocalElementsX(scrollX);
        
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
          try {
            iframe.contentWindow.postMessage({ type: 'QLOOK_SUB_SCROLL_X', scrollX: scrollX }, '*');
          } catch(err) {}
        }
      }
    }

    autoScrollAnimationFrame = requestAnimationFrame(autoScrollLoopCentral);
  }

  function broadcastScrollState(active) {
    const msg = { type: 'QLOOK_STATE_NOTIFY', active: active };
    const send = (win) => {
      try { win.postMessage(msg, '*'); } catch(err){}
      for (let i = 0; i < win.frames.length; i++) { send(win.frames[i]); }
    };
    send(window.top);
  }

  const fixStyle = document.createElement('style');
  fixStyle.innerText = `
    html, body {
      overflow: auto !important;
      height: auto !important;
      max-height: none !important;
    }
    iframe, object, embed {
      pointer-events: none !important;
    }
  `;
  (document.head || document.documentElement).appendChild(fixStyle);

  window.addEventListener('scroll', () => {
    try {
      window.top.postMessage({
        type: 'QLOOK_SCROLL_SYNC',
        x: window.scrollX || window.pageXOffset,
        y: window.scrollY || window.pageYOffset
      }, '*');
    } catch (e) {}
  }, { passive: true });

  if (window.self !== window.top) {
    const sendHeight = () => {
      const height = document.documentElement.scrollHeight || document.body.scrollHeight;
      window.parent.postMessage({ type: 'QLOOK_FRAME_RESIZE', height: height }, '*');
    };

    window.addEventListener('load', sendHeight);
    document.addEventListener('DOMContentLoaded', sendHeight);
    
    if (window.ResizeObserver) {
      const observer = new ResizeObserver(() => sendHeight());
      observer.observe(document.documentElement);
    } else {
      setInterval(sendHeight, 500);
    }
  }

  window.addEventListener('message', (e) => {
    if (!e.data) return;

    if (e.data.type === 'QLOOK_FRAME_RESIZE') {
      const iframes = document.querySelectorAll('iframe');
      for (const iframe of iframes) {
        if (iframe.contentWindow === e.source) {
          iframe.style.setProperty('height', e.data.height + 'px', 'important');
          break;
        }
      }
    }

    if (e.data.type === 'QLOOK_STATE_NOTIFY') {
      isAutoScrolling = e.data.active;
      if (e.data.active) {
        cacheLocalScrollableElementsX();
      } else {
        justStoppedAutoScroll = true;
        setTimeout(() => { justStoppedAutoScroll = false; }, 300);
        localScrollableElementsX = [];
      }
    }

    if (e.data.type === 'QLOOK_SUB_SCROLL_X') {
      window.scrollBy(e.data.scrollX, 0);
      scrollLocalElementsX(e.data.scrollX);
      
      const iframes = document.querySelectorAll('iframe');
      for (const iframe of iframes) {
        try {
          iframe.contentWindow.postMessage({ type: 'QLOOK_SUB_SCROLL_X', scrollX: e.data.scrollX }, '*');
        } catch(err) {}
      }
    }

    if (isMainPreviewFrame) {
      if (e.data.type === 'QLOOK_M_DOWN') {
        if (isAutoScrolling) stopAutoScrollCentral();
        else startAutoScrollCentral(e.data.screenX, e.data.screenY);
      } else if (e.data.type === 'QLOOK_M_DOWN_OTHER') {
        if (isAutoScrolling) stopAutoScrollCentral();
      } else if (e.data.type === 'QLOOK_M_MOVE') {
        if (isAutoScrolling) {
          autoScrollCurrentX = e.data.screenX;
          autoScrollCurrentY = e.data.screenY;
          const dx = autoScrollCurrentX - autoScrollStartX;
          const dy = autoScrollCurrentY - autoScrollStartY;
          autoScrollMovedDistance = Math.max(autoScrollMovedDistance, Math.sqrt(dx * dx + dy * dy));
        }
      } else if (e.data.type === 'QLOOK_M_UP') {
        if (isAutoScrolling && autoScrollMovedDistance > 10) {
          stopAutoScrollCentral();
        }
      }
    }
  });

  window.addEventListener('mousedown', (e) => {
    if (e.button === 3) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
      try {
        window.top.postMessage({ type: 'QLOOK_M_DOWN', screenX: e.screenX, screenY: e.screenY }, '*');
      } catch (err) {}
    } else {
      if (isAutoScrolling) {
        try {
          window.top.postMessage({ type: 'QLOOK_M_DOWN_OTHER' }, '*');
        } catch (err) {}
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }, { capture: true, passive: false });

  window.addEventListener('mousemove', (e) => {
    if (isAutoScrolling) {
      try {
        window.top.postMessage({ type: 'QLOOK_M_MOVE', screenX: e.screenX, screenY: e.screenY }, '*');
      } catch (err) {}
    }
  }, { capture: true, passive: true });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 3) {
      e.preventDefault();
      e.stopPropagation();
      window.top.postMessage({ type: 'CLOSE_QUICK_LOOK' }, '*');
    }
    if (e.button === 1) {
      try {
        window.top.postMessage({ type: 'QLOOK_M_UP', screenX: e.screenX, screenY: e.screenY }, '*');
      } catch (err) {}
    }
  }, { capture: true, passive: false });

  window.addEventListener('click', (e) => {
    if (justStoppedAutoScroll) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const scrollX = window.scrollX || window.pageXOffset;
    const scrollY = window.scrollY || window.pageYOffset;
    
    const cleanUrl = window.location.href.replace(/[#&]qlook_preview=true/, '');
    const delimiter = cleanUrl.includes('#') ? '&' : '#';
    const newUrl = cleanUrl + delimiter + 'qlook_scroll=' + scrollX + '_' + scrollY;

    if (clickBehavior === 'newTab') {
      window.open(newUrl, '_blank');
    } else {
      window.top.location.href = newUrl;
    }
    window.top.postMessage({ type: 'CLOSE_QUICK_LOOK' }, '*');
  }, { capture: true });

  window.addEventListener('auxclick', (e) => {
    if (e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, { capture: true });
}

if (!IS_PREVIEW) {
  let longPressTimer = null;
  let currentTargetUrl = null;
  let isLongPressTriggered = false;
  let isWheelDown = false;

  document.addEventListener('mousedown', (e) => {
    if (e.button !== 1) return;

    window.viewportScreenX = e.screenX - e.clientX * window.devicePixelRatio;
    window.viewportScreenY = e.screenY - e.clientY * window.devicePixelRatio;

    const anchor = e.target.closest('a');
    if (!anchor || !anchor.href) return;

    e.preventDefault(); 
    isWheelDown = true;
    isLongPressTriggered = false;
    currentTargetUrl = anchor.href;

    longPressTimer = setTimeout(() => {
      isLongPressTriggered = true;
      window.top.postMessage({ type: 'OPEN_QUICK_LOOK', url: currentTargetUrl }, '*');
    }, longPressDuration);
  }, { passive: false });

  document.addEventListener('mouseup', (e) => {
    if (e.button !== 1 || !isWheelDown) return;
    
    e.preventDefault();
    isWheelDown = false;

    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }

    if (!isLongPressTriggered && currentTargetUrl) {
      window.open(currentTargetUrl, '_blank');
    }
  }, { passive: false });

  document.addEventListener('auxclick', (e) => {
    if (e.button === 1) e.preventDefault();
  }, { passive: false });

  document.addEventListener('mouseleave', () => {
    if (longPressTimer) clearTimeout(longPressTimer);
    isWheelDown = false;
  });
}

if (window.self === window.top) {
  let previewOverlay = null;
  let loadingOverlay = null;
  let isPopupActive = false;
  let blurTrapArmed = false;
  let autoScrollElem = null;
  
  let scrollShieldElem = null;
  let mainJustStoppedAutoScroll = false;
  let mainJustStoppedTimer = null;

  window.viewportScreenX = window.screenLeft;
  window.viewportScreenY = window.screenTop;

  window.addEventListener('mousemove', (e) => {
    window.viewportScreenX = e.screenX - e.clientX * window.devicePixelRatio;
    window.viewportScreenY = e.screenY - e.clientY * window.devicePixelRatio;
  }, { passive: true });

  window.addEventListener('blur', () => {
    if (isPopupActive && blurTrapArmed) {
      if (mainJustStoppedAutoScroll) return;

      setTimeout(() => {
        if (document.activeElement && document.activeElement.tagName === 'IFRAME') {
          // Prevent focus stealing from preview frames
          if (document.activeElement.name === 'qlook_preview_frame') {
            return;
          }

          const delimiter = currentTargetUrl.includes('#') ? '&' : '#';
          const newUrl = currentTargetUrl + delimiter + 'qlook_scroll=' + latestX + '_' + latestY;

          if (clickBehavior === 'newTab') {
            window.open(newUrl, '_blank');
          } else {
            window.top.location.href = newUrl;
          }
          closePreviewPopup();
        }
      }, 0);
    }
  });

  document.addEventListener('mousedown', (e) => {
    if (e.button === 3 && isPopupActive) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, { capture: true, passive: false });

  document.addEventListener('mouseup', (e) => {
    if (e.button === 3 && isPopupActive) {
      e.preventDefault();
      e.stopPropagation();
      closePreviewPopup();
    }
  }, { capture: true, passive: false });

  window.addEventListener('message', (e) => {
    if (e.data) {
      if (e.data.type === 'OPEN_QUICK_LOOK') {
        openPreviewPopup(e.data.url);
      } else if (e.data.type === 'CLOSE_QUICK_LOOK') {
        closePreviewPopup();
      } else if (e.data.type === 'PAGE_INTERACTIVE_QUICK_LOOK') {
        removeLoadingOverlay();
      } else if (e.data.type === 'QLOOK_SCROLL_SYNC') {
        latestX = e.data.x;
        latestY = e.data.y;
      }
      
      if (e.data.type === 'QLOOK_M_DOWN') {
        if (isPopupActive) {
          if (!autoScrollElem) {
            const clientX = (e.data.screenX - window.viewportScreenX) / window.devicePixelRatio;
            const clientY = (e.data.screenY - window.viewportScreenY) / window.devicePixelRatio;

            if (!document.getElementById('qlook-marker-style')) {
              const style = document.createElement('style');
              style.id = 'qlook-marker-style';
              style.innerText = `
                @keyframes qlookMarkerPop {
                  0% { transform: translate(-50%, -50%) scale(0.5); opacity: 0; }
                  100% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
                }
              `;
              document.head.appendChild(style);
            }

            autoScrollElem = document.createElement('div');
            Object.assign(autoScrollElem.style, {
              position: 'fixed',
              left: clientX + 'px',
              top: clientY + 'px',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'rgba(255, 255, 255, 0.75)',
              backdropFilter: 'blur(5px)',
              webkitBackdropFilter: 'blur(5px)',
              border: '2.5px solid #6c584c',
              zIndex: '1000000',
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(108, 88, 76, 0.3)',
              animation: 'qlookMarkerPop 0.15s cubic-bezier(0.34, 1.56, 0.64, 1) forwards'
            });
            
            autoScrollElem.innerHTML = `
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6c584c" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="1.5" fill="#6c584c"/>
                <polyline points="12 6 12 3 12 6"/>
                <polyline points="12 18 12 21 12 18"/>
                <polyline points="6 12 3 12 6"/>
                <polyline points="18 12 21 12 18"/>
              </svg>
            `;
            document.body.appendChild(autoScrollElem);
          }

          const iframe = previewOverlay?.querySelector('iframe');
          if (iframe) {
            iframe.contentWindow.postMessage(e.data, '*');
          }
        }
      } else if (e.data.type === 'QLOOK_M_DOWN_OTHER' || e.data.type === 'QLOOK_M_MOVE' || e.data.type === 'QLOOK_M_UP') {
        if (previewOverlay) {
          const iframe = previewOverlay.querySelector('iframe');
          if (iframe) {
            iframe.contentWindow.postMessage(e.data, '*');
          }
        }
      } else if (e.data.type === 'QLOOK_STATE_NOTIFY') {
        if (e.data.active) {
          mainJustStoppedAutoScroll = false;
          if (mainJustStoppedTimer) clearTimeout(mainJustStoppedTimer);

          if (!scrollShieldElem && previewOverlay) {
            const container = previewOverlay.querySelector('div');
            if (container) {
              scrollShieldElem = document.createElement('div');
              Object.assign(scrollShieldElem.style, {
                position: 'absolute',
                top: '0',
                left: '0',
                width: '100%',
                height: '100%',
                backgroundColor: 'transparent',
                zIndex: '9998',
                pointerEvents: 'auto'
              });

              scrollShieldElem.addEventListener('mousedown', (se) => {
                se.preventDefault();
                se.stopPropagation();
                const iframe = previewOverlay.querySelector('iframe');
                if (iframe) {
                  if (se.button === 1) {
                    iframe.contentWindow.postMessage({ type: 'QLOOK_M_DOWN', screenX: se.screenX, screenY: se.screenY }, '*');
                  } else {
                    iframe.contentWindow.postMessage({ type: 'QLOOK_M_DOWN_OTHER' }, '*');
                  }
                }
              }, { capture: true });

              scrollShieldElem.addEventListener('mousemove', (se) => {
                window.viewportScreenX = se.screenX - se.clientX * window.devicePixelRatio;
                window.viewportScreenY = se.screenY - se.clientY * window.devicePixelRatio;
                
                const iframe = previewOverlay.querySelector('iframe');
                if (iframe) {
                  iframe.contentWindow.postMessage({ type: 'QLOOK_M_MOVE', screenX: se.screenX, screenY: se.screenY }, '*');
                }
              }, { passive: true });

              scrollShieldElem.addEventListener('mouseup', (se) => {
                if (se.button === 1 || se.button === 3) {
                  se.preventDefault();
                  se.stopPropagation();
                }
                const iframe = previewOverlay.querySelector('iframe');
                if (iframe) {
                  if (se.button === 1) {
                    iframe.contentWindow.postMessage({ type: 'QLOOK_M_UP', screenX: se.screenX, screenY: se.screenY }, '*');
                  } else if (se.button === 3) {
                    iframe.contentWindow.postMessage({ type: 'CLOSE_QUICK_LOOK' }, '*');
                  }
                }
              }, { capture: true });

              container.appendChild(scrollShieldElem);
            }
          }
        } else {
          if (scrollShieldElem) {
            scrollShieldElem.remove();
            scrollShieldElem = null;
          }
          if (autoScrollElem) {
            autoScrollElem.remove();
            autoScrollElem = null;
          }
          
          mainJustStoppedAutoScroll = true;
          if (mainJustStoppedTimer) clearTimeout(mainJustStoppedTimer);
          mainJustStoppedTimer = setTimeout(() => { mainJustStoppedAutoScroll = false; }, 300);
        }
      }
    }
  });

  function removeLoadingOverlay() {
    if (loadingOverlay) {
      loadingOverlay.style.opacity = '0';
      const targetOverlay = loadingOverlay;
      loadingOverlay = null;
      setTimeout(() => targetOverlay.remove(), 300);
      
      setTimeout(() => {
        if (isPopupActive) {
          window.focus(); 
          blurTrapArmed = true;
        }
      }, 400);
    }
  }

  function openPreviewPopup(url) {
    if (isPopupActive) return;
    isPopupActive = true;
    blurTrapArmed = false;
    latestX = 0;
    latestY = 0;
    currentTargetUrl = url.replace(/[#&]qlook_preview=true/, '');

    previewOverlay = document.createElement('div');
    Object.assign(previewOverlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      zIndex: '999999',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backdropFilter: 'blur(3px)'
    });

    const container = document.createElement('div');
    Object.assign(container.style, {
      position: 'relative',
      width: '85%',
      height: '85%',
      backgroundColor: '#ffffff',
      borderRadius: '12px',
      boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
      overflow: 'hidden',
      animation: 'scaleUp 0.15s cubic-bezier(0.16, 1, 0.3, 1)'
    });

    const styleSheet = document.createElement('style');
    styleSheet.innerText = `
      @keyframes scaleUp { 
        from { transform: scale(0.96); opacity: 0; } 
        to { transform: scale(1); opacity: 1; } 
      }
      .preview-loader-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: #fffbf0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 10;
        transition: opacity 0.3s ease;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      }
      .preview-cloud-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        margin-bottom: 20px;
      }
      .preview-cloud {
        width: 80px;
        height: 45px;
        background: #a2d2ff;
        border-radius: 30px;
        position: relative;
        animation: floatCloud 1.6s infinite ease-in-out;
      }
      .preview-cloud::before {
        content: '';
        position: absolute;
        width: 40px;
        height: 40px;
        background: #a2d2ff;
        border-radius: 50%;
        top: -20px;
        left: 15px;
      }
      .preview-cloud::after {
        content: '';
        position: absolute;
        width: 30px;
        height: 30px;
        background: #a2d2ff;
        border-radius: 50%;
        top: -12px;
        right: 12px;
      }
      .cloud-eye {
        width: 6px;
        height: 6px;
        background: #2b2b2b;
        border-radius: 50%;
        position: absolute;
        top: 15px;
        z-index: 5;
      }
      .cloud-eye.left { left: 24px; }
      .cloud-eye.right { right: 24px; }
      .cloud-mouth {
        width: 8px;
        height: 4px;
        border: 2px solid #2b2b2b;
        border-top: none;
        border-radius: 0 0 8px 8px;
        position: absolute;
        top: 22px;
        left: 34px;
        z-index: 5;
      }
      .preview-shadow {
        width: 50px;
        height: 6px;
        background: rgba(0, 0, 0, 0.08);
        border-radius: 50%;
        margin-top: 15px;
        animation: shadowScale 1.6s infinite ease-in-out;
      }
      .preview-loader-text {
        color: #6c584c;
        font-size: 16px;
        font-weight: bold;
        letter-spacing: -0.5px;
        animation: textPulse 1.6s infinite ease-in-out;
      }
      @keyframes floatCloud {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-12px); }
      }
      @keyframes shadowScale {
        0%, 100% { transform: scaleX(1); opacity: 0.8; }
        50% { transform: scaleX(0.7); opacity: 0.3; }
      }
      @keyframes textPulse {
        0%, 100% { opacity: 0.6; }
        50% { opacity: 1; }
      }
    `;
    document.head.appendChild(styleSheet);

    const iframe = document.createElement('iframe');
    iframe.name = 'qlook_preview_frame';
    
    const delimiter = url.includes('#') ? '&' : '#';
    iframe.src = url + delimiter + 'qlook_preview=true';
    
    Object.assign(iframe.style, {
      width: '100%',
      height: '100%',
      border: 'none'
    });

    loadingOverlay = document.createElement('div');
    loadingOverlay.className = 'preview-loader-overlay';

    const cloudContainer = document.createElement('div');
    cloudContainer.className = 'preview-cloud-container';

    const cloud = document.createElement('div');
    cloud.className = 'preview-cloud';

    const eyeLeft = document.createElement('div');
    eyeLeft.className = 'cloud-eye left';
    const eyeRight = document.createElement('div');
    eyeRight.className = 'cloud-eye right';
    const mouth = document.createElement('div');
    mouth.className = 'cloud-mouth';

    cloud.appendChild(eyeLeft);
    cloud.appendChild(eyeRight);
    cloud.appendChild(mouth);

    const shadow = document.createElement('div');
    shadow.className = 'preview-shadow';

    cloudContainer.appendChild(cloud);
    cloudContainer.appendChild(shadow);

    const text = document.createElement('div');
    text.className = 'preview-loader-text';
    text.innerText = 'Loading the page... 🐾';

    loadingOverlay.appendChild(cloudContainer);
    loadingOverlay.appendChild(text);

    container.appendChild(loadingOverlay);
    container.appendChild(iframe);
    previewOverlay.appendChild(container);
    document.body.appendChild(previewOverlay);

    iframe.onload = () => removeLoadingOverlay();

    previewOverlay.addEventListener('click', (e) => {
      if (e.target === previewOverlay) {
        closePreviewPopup();
      }
    });
  }

  function closePreviewPopup() {
    if (!isPopupActive) return;
    blurTrapArmed = false;
    if (previewOverlay) {
      previewOverlay.remove();
      previewOverlay = null;
    }
    if (loadingOverlay) {
      loadingOverlay.remove();
      loadingOverlay = null;
    }
    if (autoScrollElem) {
      autoScrollElem.remove();
      autoScrollElem = null;
    }
    if (scrollShieldElem) {
      scrollShieldElem.remove();
      scrollShieldElem = null;
    }
    isPopupActive = false;
    window.focus();
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isPopupActive) {
      closePreviewPopup();
    }
  });
}