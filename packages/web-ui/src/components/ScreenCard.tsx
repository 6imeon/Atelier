import { useRef, useEffect, useState, memo } from "react";
import { createPortal } from "react-dom";
import { CanvasScreen, useCanvasStore } from "../stores/canvas-store";
import { sendFeedback, apiRateSection } from "../utils/feedback";
import { debugLog } from "../utils/debug";

// Module-level thumbnail cache: screenId -> dataURL
const thumbnailCache = new Map<string, string>();
// Track which HTML was used to generate each thumbnail so we re-capture on changes
const thumbnailHtmlHash = new Map<string, string>();

const THUMB_W = 300;
const THUMB_H = 200;

/** Capture a thumbnail of an iframe's content using an offscreen canvas. */
function captureThumbnail(iframe: HTMLIFrameElement, screenId: string, htmlHash: string): void {
  try {
    const doc = iframe.contentDocument;
    if (!doc?.body) return;

    // Use XMLSerializer to get the full HTML, then draw it into an offscreen canvas
    // via an SVG foreignObject trick (same-origin srcdoc, so DOM access is fine)
    const serializer = new XMLSerializer();
    const htmlString = serializer.serializeToString(doc);

    // Build an SVG that contains the page as foreignObject
    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${iframe.clientWidth || iframe.offsetWidth || 1280}" height="${iframe.clientHeight || iframe.offsetHeight || 800}">
        <foreignObject width="100%" height="100%">
          ${htmlString}
        </foreignObject>
      </svg>`;

    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = THUMB_W;
      canvas.height = THUMB_H;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0, THUMB_W, THUMB_H);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
        thumbnailCache.set(screenId, dataUrl);
        thumbnailHtmlHash.set(screenId, htmlHash);
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
    };
    img.src = url;
  } catch {
    // Cross-origin or other error — silently skip
  }
}

// Script injected into iframe when edit mode is active
const EDIT_INJECTION = `
<script>
(function() {
  var _DBG = false;
  let highlighted = null;
  let overlay = null;
  let inlineEditActive = false; // Issue 65: prevent double finishEdit

  function createOverlay() {
    overlay = document.createElement('div');
    overlay.id = '__canvas_overlay';
    overlay.style.cssText = 'position:fixed;pointer-events:none;border:2px solid #7c5cfc;border-radius:2px;z-index:99999;transition:all 0.1s ease;display:none;';
    document.body.appendChild(overlay);
  }

  // Issue 64: check if in edit mode before processing events
  function isEditMode() {
    return document.documentElement.classList.contains('canvas-editing');
  }

  // Issue 68: use up to 4 classes, skip responsive-prefix classes (md:, lg:, etc.) to avoid escaping issues
  function getSelector(el) {
    if (el.id) return '#' + CSS.escape(el.id);
    const parts = [];
    while (el && el !== document.body) {
      let sel = el.tagName.toLowerCase();
      if (el.className && typeof el.className === 'string') {
        var allClasses = el.className.trim().split(/\\s+/);
        // Prefer non-responsive classes first, then fill with responsive ones
        var stable = allClasses.filter(function(c) { return c && c.indexOf(':') === -1; });
        var responsive = allClasses.filter(function(c) { return c && c.indexOf(':') !== -1; });
        var picked = stable.slice(0, 4);
        if (picked.length < 3) picked = picked.concat(responsive.slice(0, 3 - picked.length));
        picked.forEach(function(c) { if (c) sel += '.' + CSS.escape(c); });
      }
      const parent = el.parentElement;
      if (parent) {
        const siblings = [...parent.children].filter(c => c.tagName === el.tagName);
        if (siblings.length > 1) sel += ':nth-of-type(' + (siblings.indexOf(el) + 1) + ')';
      }
      parts.unshift(sel);
      el = el.parentElement;
    }
    return parts.join(' > ');
  }

  // Issue 62: safe querySelector with logging on failure
  function safeQuery(selector, context) {
    try {
      var el = document.querySelector(selector);
      if (!el) console.warn('[edit] querySelector found nothing for:', selector, '(' + context + ')');
      return el;
    } catch(err) {
      console.error('[edit] querySelector failed for:', selector, '(' + context + ')', err.message);
      return null;
    }
  }

  function init() {
    createOverlay();

    // Issue 64: gate mousemove by edit mode
    document.addEventListener('mousemove', function(e) {
      if (!isEditMode()) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el === document.body || el === document.documentElement || el.id === '__canvas_overlay') return;
      const r = el.getBoundingClientRect();
      overlay.style.display = 'block';
      overlay.style.left = r.left + 'px';
      overlay.style.top = r.top + 'px';
      overlay.style.width = r.width + 'px';
      overlay.style.height = r.height + 'px';
    });

    // Issue 64: gate click by edit mode
    document.addEventListener('click', function(e) {
      if (!isEditMode()) return;
      e.preventDefault();
      e.stopPropagation();
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el === document.body || el === document.documentElement || el.id === '__canvas_overlay') return;

      if (highlighted) highlighted.style.outline = '';
      highlighted = el;
      el.style.outline = '2px solid #7c5cfc';

      // Find the nearest top-level section (direct child of body)
      var section = el;
      while (section && section.parentElement && section.parentElement !== document.body) {
        section = section.parentElement;
      }
      var sectionSelector = section && section !== document.body ? getSelector(section) : null;
      var sectionTag = section && section !== document.body ? section.tagName.toLowerCase() : null;
      // Issue 69: send opening tag + text preview instead of truncated outerHTML
      var sectionPreview = null;
      if (section && section !== document.body) {
        var openTag = section.outerHTML.match(/^<[^>]+>/);
        var textSnippet = (section.textContent || '').trim().slice(0, 200);
        sectionPreview = (openTag ? openTag[0] : '<' + section.tagName.toLowerCase() + '>') + ' — ' + textSnippet;
      }

      var r = el.getBoundingClientRect();
      if(_DBG) console.log('[edit] selected:', el.tagName.toLowerCase(), '"' + (el.textContent || '').slice(0, 40) + '"', 'click:', e.clientX, e.clientY);
      window.parent.postMessage({
        type: 'canvas-element-select',
        selector: getSelector(el),
        tagName: el.tagName.toLowerCase(),
        textContent: (el.textContent || '').slice(0, 200),
        rect: { x: r.left, y: r.top, width: r.width, height: r.height },
        clickX: e.clientX,
        clickY: e.clientY,
        sectionSelector: sectionSelector,
        sectionTagName: sectionTag,
        sectionPreview: sectionPreview,
      }, '*');
    }, true);

    // Issue 64: gate mouseleave by edit mode
    document.addEventListener('mouseleave', function() {
      if (!isEditMode()) return;
      if (overlay) overlay.style.display = 'none';
    });

    // Helper: extract clean HTML and send to parent
    function sendCleanHtml() {
      var clone = document.documentElement.cloneNode(true);
      var ov = clone.querySelector('#__canvas_overlay');
      if (ov) ov.remove();
      // Issue 75: only remove injected scripts, not user scripts (analytics, carousels, etc.)
      clone.querySelectorAll('script').forEach(function(s) {
        var txt = s.textContent || '';
        if (s.src && s.src.indexOf('tailwindcss') !== -1) return; // keep tailwind
        if (s.src) return; // keep external user scripts
        // Remove only canvas-injected scripts (identifiable by their content)
        if (txt.indexOf('canvas-wheel') !== -1 || txt.indexOf('canvas-element-select') !== -1 ||
            txt.indexOf('canvas-content-height') !== -1 || txt.indexOf('render-diag') !== -1 ||
            txt.indexOf('__canvas_overlay') !== -1 || txt.indexOf('img.onerror') !== -1) {
          s.remove();
        }
      });
      clone.querySelectorAll('style').forEach(function(s) {
        if (s.textContent.indexOf('crosshair') !== -1 || s.textContent.indexOf('pointer-events') !== -1) s.remove();
      });
      // Issue 71: only remove the editor's purple outline, not legitimate user outlines
      clone.querySelectorAll('[style*="outline"]').forEach(function(el) {
        if (el.style.outline && el.style.outline.indexOf('7c5cfc') !== -1) {
          el.style.outline = '';
        }
        if (el.style.outlineOffset) el.style.outlineOffset = '';
      });
      clone.querySelectorAll('[contenteditable]').forEach(function(el) { el.removeAttribute('contenteditable'); });
      var htmlStr = '<!DOCTYPE html>' + clone.outerHTML;
      window.parent.postMessage({ type: 'canvas-html-updated', html: htmlStr }, '*');
    }

    // Listen for text update messages from parent
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'canvas-update-text') {
        if(_DBG) console.log('[edit] update-text:', e.data.selector);
        var el = safeQuery(e.data.selector, 'update-text');
        if (el) {
          el.textContent = e.data.newText;
          sendCleanHtml();
          if(_DBG) console.log('[edit] text updated OK');
        }
      }

      // Replace a section's HTML with new content
      if (e.data && e.data.type === 'canvas-replace-section') {
        if(_DBG) console.log('[edit] replace-section:', e.data.selector);
        var el = safeQuery(e.data.selector, 'replace-section');
        if (el) {
          var temp = document.createElement('div');
          temp.innerHTML = e.data.newHtml;
          var newEl = temp.firstElementChild;
          if (newEl) {
            el.replaceWith(newEl);
          } else {
            el.outerHTML = e.data.newHtml;
          }
          sendCleanHtml();
          if(_DBG) console.log('[edit] section replaced OK');
          window.parent.postMessage({ type: 'canvas-replace-result', success: true }, '*');
        } else {
          console.error('[edit] replace-section FAILED: element not found for selector:', e.data.selector);
          window.parent.postMessage({ type: 'canvas-replace-result', success: false, error: 'Element not found — selector may be stale' }, '*');
        }
      }

      // Inline edit: make element contentEditable so user types directly on the page
      if (e.data && e.data.type === 'canvas-inline-edit') {
        if(_DBG) console.log('[inline-edit] selector:', e.data.selector);
        var el = safeQuery(e.data.selector, 'inline-edit');
        if(_DBG) console.log('[inline-edit] found element:', el ? el.tagName + ' "' + (el.textContent || '').slice(0,40) + '"' : 'NULL');
        if (!el) return;

        // Issue 65: prevent double inline edit
        if (inlineEditActive) {
          console.warn('[inline-edit] already active, ignoring');
          return;
        }
        inlineEditActive = true;

        // Remove highlight overlay so it doesn't block typing
        if (overlay) overlay.style.display = 'none';
        if (highlighted) highlighted.style.outline = '';

        el.setAttribute('contenteditable', 'true');
        el.style.outline = '2px solid #7c5cfc';
        el.style.outlineOffset = '2px';
        el.style.minHeight = '1em';
        el.focus();

        // Select all text so user can start typing immediately
        var range = document.createRange();
        range.selectNodeContents(el);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        // Prevent the edit-mode click handler from stealing focus — only block clicks on the editable element
        var blockClicks = function(ev) { if (el.contains(ev.target)) { ev.stopPropagation(); } };
        document.addEventListener('click', blockClicks, true);

        // Issue 65: finished flag prevents double finishEdit from blur+escape race
        var finished = false;
        var finishEdit = function() {
          if (finished) return;
          finished = true;
          inlineEditActive = false;
          if(_DBG) console.log('[inline-edit] finishing, new text:', (el.textContent || '').slice(0, 60));
          el.removeAttribute('contenteditable');
          el.style.outline = '';
          el.style.outlineOffset = '';
          // Issue 63: clear text selection
          var s = window.getSelection();
          if (s) s.removeAllRanges();
          document.removeEventListener('click', blockClicks, true);
          el.removeEventListener('blur', onBlur);
          el.removeEventListener('keydown', onKey);
          sendCleanHtml();
          window.parent.postMessage({ type: 'canvas-inline-edit-done' }, '*');
        };

        var onBlur = function() {
          // Small delay to avoid firing on internal focus shifts
          setTimeout(function() {
            if (!finished && document.activeElement !== el) finishEdit();
          }, 150);
        };

        var onKey = function(ev) {
          if (ev.key === 'Escape') { finishEdit(); }
          // Allow Enter for multi-line but Shift+Enter or just Enter
        };

        el.addEventListener('blur', onBlur);
        el.addEventListener('keydown', onKey);
      }
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
</script>`;

// Image fallback script — prevents broken images from destroying layout
const IMG_FALLBACK = `<script>(function(){
  function fixImages(){
    document.querySelectorAll('img').forEach(function(img){
      img.style.maxWidth='100%';
      if(!img.style.objectFit) img.style.objectFit='cover';
      img.onerror=function(){
        this.onerror=null;
        this.style.background='#e5e7eb';
        this.style.minHeight='120px';
        this.src='data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect fill="%23e5e7eb" width="400" height="300"/><text fill="%239ca3af" font-family="sans-serif" font-size="14" x="50%" y="50%" text-anchor="middle" dy=".3em">Image</text></svg>';
      };
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',fixImages);
  else fixImages();
})()</script>`;

// Height measurement script — reports actual content height to parent (capped at 50000px)
// Uses only body measurements, NOT documentElement.scrollHeight which returns the iframe viewport height
const HEIGHT_SCRIPT = `<script>(function(){function send(){var h=Math.max(document.body.scrollHeight,document.body.offsetHeight);h=Math.min(h,50000);window.parent.postMessage({type:'canvas-content-height',height:h},'*');}if(document.readyState==='complete')send();else window.addEventListener('load',send);setTimeout(send,500);setTimeout(send,2000);})()</script>`;

// Preview mode script — flattens carousels/sliders into visible grids for canvas preview
// Converts overflow-scroll containers into wrapped flex/grid so all items are visible at a glance
const PREVIEW_FLATTEN = `<script>(function(){
  function flatten(){
    document.querySelectorAll('*').forEach(function(el){
      var s = getComputedStyle(el);
      if((s.overflowX==='scroll'||s.overflowX==='auto')&&el.scrollWidth>el.clientWidth+20){
        el.style.overflowX='visible';
        el.style.flexWrap='wrap';
        el.style.whiteSpace='normal';
      }
      if((s.overflowY==='scroll'||s.overflowY==='auto')&&el.scrollHeight>el.clientHeight+100){
        el.style.overflowY='visible';
      }
    });
    // Force all carousel/slider items visible
    document.querySelectorAll('[class*="carousel"],[class*="slider"],[class*="swiper"],[class*="scroll-snap"]').forEach(function(el){
      el.style.overflowX='visible';
      el.style.flexWrap='wrap';
      el.style.scrollSnapType='none';
      Array.from(el.children).forEach(function(c){c.style.scrollSnapAlign='none';c.style.flexShrink='0';});
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',flatten);
  else flatten();
  setTimeout(flatten,1000);
})()</script>`;

// Diagnostic script — reports rendering health back to parent for debugging
const RENDER_DIAGNOSTIC = `<script>(function(){
  var _DBG = false;
  function diagnose(){
    var sections = document.querySelectorAll('section, header, footer, nav, main');
    var visibleCount = 0;
    var hiddenSections = [];
    sections.forEach(function(s, i){
      var rect = s.getBoundingClientRect();
      var style = window.getComputedStyle(s);
      var visible = rect.height > 10 && style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0;
      if(visible) visibleCount++;
      else hiddenSections.push({tag: s.tagName, class: s.className.slice(0,60), h: rect.height, display: style.display});
    });
    var imgs = document.querySelectorAll('img');
    var brokenImgs = 0;
    imgs.forEach(function(img){ if(!img.naturalWidth && img.complete) brokenImgs++; });
    var tw = !!window.tailwind;
    var scripts = document.querySelectorAll('script[src*="tailwind"]');
    var twLoaded = scripts.length > 0 && tw;
    var bodyBg = window.getComputedStyle(document.body).backgroundColor;
    var bodyColor = window.getComputedStyle(document.body).color;
    var totalH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    if(_DBG) console.log('[render-diag] sections: ' + sections.length + ' visible: ' + visibleCount + ' hidden: ' + hiddenSections.length);
    if(_DBG) console.log('[render-diag] images: ' + imgs.length + ' broken: ' + brokenImgs);
    if(_DBG) console.log('[render-diag] tailwind loaded: ' + twLoaded + ', body bg: ' + bodyBg + ', color: ' + bodyColor + ', height: ' + totalH);
    if(hiddenSections.length > 0) console.warn('[render-diag] hidden sections:', JSON.stringify(hiddenSections));
    if(!twLoaded) console.error('[render-diag] ⚠️ Tailwind CDN NOT loaded — page will be unstyled!');
    if(brokenImgs > 0) console.warn('[render-diag] ⚠️ ' + brokenImgs + '/' + imgs.length + ' images failed to load');
  }
  if(document.readyState==='complete') setTimeout(diagnose, 1500);
  else window.addEventListener('load', function(){ setTimeout(diagnose, 1500); });
})()</script>`;

// Why overlay — shows design rationale badges on hover/click when why-mode is active
const WHY_INJECTION = `
<style id="__why_styles">
  html:not(.canvas-why-mode) .__why-badge { display: none !important; }
  html:not(.canvas-why-mode) .__why-popover { display: none !important; }
  html.canvas-why-mode [data-why-type] { cursor: help !important; pointer-events: auto !important; }
  html.canvas-why-mode [data-why-type]:hover { outline: 2px solid #a78bfa !important; outline-offset: -2px; }
  .__why-badge {
    position: absolute; top: 8px; left: 8px; z-index: 99998;
    background: rgba(15,15,20,0.88); color: #e2e0ff; font-family: -apple-system, sans-serif;
    font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 6px;
    border: 1px solid rgba(167,139,250,0.3); pointer-events: none;
    backdrop-filter: blur(8px); white-space: nowrap;
    display: flex; align-items: center; gap: 5px;
  }
  .__why-badge::before {
    content: ''; width: 6px; height: 6px; border-radius: 50%;
    background: #a78bfa; flex-shrink: 0;
  }
  .__why-popover {
    position: fixed; z-index: 99999; max-width: 380px; width: max-content;
    background: rgba(15,15,20,0.95); color: #e2e0ff; font-family: -apple-system, sans-serif;
    font-size: 12px; padding: 14px 16px; border-radius: 10px;
    border: 1px solid rgba(167,139,250,0.3); pointer-events: auto;
    backdrop-filter: blur(12px); line-height: 1.5;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  }
  .__why-popover h4 { margin: 0 0 8px; font-size: 13px; font-weight: 700; color: #a78bfa; display: flex; align-items: center; gap: 6px; }
  .__why-popover p { margin: 0 0 6px; color: #c4c0e0; }
  .__why-popover .why-label { color: #8b86a8; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 8px; }
  .__why-popover .why-tag { display: inline-block; background: rgba(167,139,250,0.15); color: #a78bfa; font-size: 10px; padding: 2px 7px; border-radius: 4px; margin: 2px 2px 0 0; }
  .__why-thumb { background: none; border: 1px solid rgba(255,255,255,0.15); cursor: pointer; font-size: 12px; padding: 3px 10px; border-radius: 4px; color: #c4c0e0; transition: background 0.15s, border-color 0.15s; }
  .__why-thumb:hover { background: rgba(167,139,250,0.2); border-color: rgba(167,139,250,0.4); }
  .__why-thumb[data-vote="up"]:hover { background: rgba(34,197,94,0.2); border-color: rgba(34,197,94,0.4); }
  .__why-thumb[data-vote="down"]:hover { background: rgba(239,68,68,0.2); border-color: rgba(239,68,68,0.4); }
</style>
<script>
(function() {
  var _DBG = false;
  var popover = null;
  var badges = [];

  function isWhyMode() {
    return document.documentElement.classList.contains('canvas-why-mode');
  }

  function clearBadges() {
    badges.forEach(function(b) { b.remove(); });
    badges = [];
  }

  function clearPopover() {
    if (popover) { popover.remove(); popover = null; }
  }

  function showBadges() {
    clearBadges();
    var sections = document.querySelectorAll('[data-why-type]');
    sections.forEach(function(section) {
      var type = section.getAttribute('data-why-type') || 'section';
      var badge = document.createElement('div');
      badge.className = '__why-badge';
      badge.textContent = type.charAt(0).toUpperCase() + type.slice(1);
      section.style.position = section.style.position || 'relative';
      section.appendChild(badge);
      badges.push(badge);
    });
  }

  function showPopover(section, e) {
    clearPopover();
    var type = section.getAttribute('data-why-type') || 'section';
    var label = section.getAttribute('data-why-label') || '';
    var persona = section.getAttribute('data-why-persona') || '';
    var rationale = section.getAttribute('data-why-rationale') || '';
    var source = section.getAttribute('data-why-source') || '';
    var cro = section.getAttribute('data-why-cro') || '';

    popover = document.createElement('div');
    popover.className = '__why-popover';

    var html = '<h4>' + type.charAt(0).toUpperCase() + type.slice(1) + (label ? ' — ' + label : '') + '</h4>';
    if (rationale) html += '<p>' + rationale + '</p>';
    if (persona) html += '<div class="why-label">Persona</div><p>' + persona.replace(/-/g, ' ') + '</p>';
    if (source) {
      var sourceLabel = source === 'library' ? 'Component Library' : source === 'template' ? 'Analytics Template' : 'AI Generated';
      html += '<div class="why-label">Source</div><p>' + sourceLabel + '</p>';
    }
    if (cro) {
      var croLabels = { 'sticky-nav-cta': 'Sticky Nav + CTA', 'single-cta-above-fold': 'Single CTA Above Fold', 'hero-max-100vh': 'Hero ≤ 100vh', 'high-contrast-cta': 'High-Contrast CTA', 'social-proof-2-viewports': 'Social Proof in 2 Viewports', 'form-fields-max-4': 'Form Fields ≤ 4' };
      html += '<div class="why-label">CRO Rules Applied</div><div>';
      cro.split(',').forEach(function(r) { html += '<span class="why-tag">' + (croLabels[r] || r) + '</span>'; });
      html += '</div>';
    }

    // Section rating thumbs
    html += '<div class="__why-thumbs" style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;gap:8px">';
    html += '<span style="font-size:11px;color:#999">Rate:</span>';
    html += '<button class="__why-thumb" data-vote="up" data-section-type="' + type + '">+1</button>';
    html += '<button class="__why-thumb" data-vote="down" data-section-type="' + type + '">-1</button>';
    html += '</div>';

    popover.innerHTML = html;
    document.body.appendChild(popover);

    // Attach thumb click handlers after popover is in the DOM
    var thumbs = popover.querySelectorAll('.__why-thumb');
    for (var ti = 0; ti < thumbs.length; ti++) {
      (function(btn) {
        btn.addEventListener('click', function(ev) {
          ev.stopPropagation();
          ev.preventDefault();
          var vote = btn.getAttribute('data-vote');
          var sType = btn.getAttribute('data-section-type');
          window.parent.postMessage({ type: 'canvas-section-vote', sectionType: sType, vote: vote }, '*');
          var container = btn.parentElement;
          if (container) container.innerHTML = '<span style="font-size:11px;color:#22c55e">Thanks!</span>';
        });
      })(thumbs[ti]);
    }

    // Position near click, keeping within viewport
    var x = e.clientX + 12;
    var y = e.clientY + 12;
    var pw = popover.offsetWidth;
    var ph = popover.offsetHeight;
    if (x + pw > window.innerWidth - 10) x = e.clientX - pw - 12;
    if (y + ph > window.innerHeight - 10) y = e.clientY - ph - 12;
    popover.style.left = Math.max(8, x) + 'px';
    popover.style.top = Math.max(8, y) + 'px';
  }

  // Click handler for sections
  document.addEventListener('click', function(e) {
    if (!isWhyMode()) return;
    clearPopover();
    var el = e.target;
    // Walk up to find nearest section with data-why-type
    while (el && el !== document.body) {
      if (el.getAttribute && el.getAttribute('data-why-type')) {
        e.preventDefault();
        e.stopPropagation();
        showPopover(el, e);
        return;
      }
      el = el.parentElement;
    }
  }, true);

  // Dismiss popover on click outside
  document.addEventListener('mousedown', function(e) {
    if (popover && !popover.contains(e.target)) clearPopover();
  });

  // Watch for class changes to toggle badges
  var observer = new MutationObserver(function() {
    if (isWhyMode()) {
      showBadges();
    } else {
      clearBadges();
      clearPopover();
    }
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  // Listen for postMessage toggle (fallback if contentDocument is cross-origin)
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'canvas-why-mode') {
      if(_DBG) console.log('[why-iframe] postMessage received: enabled=' + e.data.enabled);
      if (e.data.enabled) {
        document.documentElement.classList.add('canvas-why-mode');
      } else {
        document.documentElement.classList.remove('canvas-why-mode');
      }
    }
  });

  // Initial check
  if(_DBG) console.log('[why-iframe] WHY_INJECTION loaded. Sections with data-why-type:', document.querySelectorAll('[data-why-type]').length);
  if (isWhyMode()) showBadges();
})();
</script>`;

// Preview ScrollTrigger neutralizer — disables pin/scrub so pinned sections render inline
// Without this, ScrollTrigger pins sections expecting scroll events that never fire in the iframe
const SCROLLTRIGGER_PREVIEW = `<script>(function(){
  function neutralize(){
    if(typeof gsap==='undefined'||typeof ScrollTrigger==='undefined') return;
    // Kill all ScrollTrigger instances so pins/scrub don't lock sections
    ScrollTrigger.getAll().forEach(function(st){ st.kill(); });
    // Force all elements to their final visible state
    document.querySelectorAll('[style]').forEach(function(el){
      var s = el.style;
      if(s.opacity==='0') s.opacity='1';
      if(s.visibility==='hidden') s.visibility='visible';
      if(s.transform&&s.transform!=='none') s.transform='none';
    });
    // Remove opacity-0 classes that relied on ScrollTrigger to animate in
    document.querySelectorAll('.opacity-0').forEach(function(el){
      el.classList.remove('opacity-0');
    });
    // Remove pin spacers that ScrollTrigger injected
    document.querySelectorAll('.pin-spacer').forEach(function(spacer){
      var pinned = spacer.firstElementChild;
      if(pinned){ spacer.parentNode.insertBefore(pinned,spacer); spacer.remove(); }
    });
  }
  if(document.readyState==='complete') setTimeout(neutralize,500);
  else window.addEventListener('load',function(){ setTimeout(neutralize,500); });
  // Second pass in case late-initializing scripts
  setTimeout(neutralize,2000);
})()</script>`;

// Base style for iframe — disables pointer events in view mode, enables edit cursor
const baseStyle = `<style id="__canvas_mode">
      html, body { margin: 0; overflow: hidden !important; height: auto !important; }
      html:not(.canvas-editing):not(.canvas-why-mode) * { pointer-events: none !important; user-select: none !important; }
      html.canvas-editing body { cursor: crosshair; }
      html.canvas-editing *:hover { outline: 1px dashed #7c5cfc44; }
      /* Prevent h-screen/vh feedback loop — cap viewport-height sections to a sensible size */
      .h-screen, .min-h-screen { height: 900px !important; min-height: 900px !important; }
      [class*="h-screen"] { height: 900px !important; }
      [class*="min-h-screen"] { min-height: 900px !important; }
      /* Catch arbitrary vh values: h-[85vh], h-[100vh], h-[50vh], min-h-[80vh] etc. */
      [class*="h-[50vh]"], [class*="h-[60vh]"], [class*="h-[70vh]"], [class*="h-[75vh]"],
      [class*="h-[80vh]"], [class*="h-[85vh]"], [class*="h-[90vh]"], [class*="h-[95vh]"],
      [class*="h-[100vh]"] { height: 900px !important; }
      [class*="min-h-[50vh]"], [class*="min-h-[60vh]"], [class*="min-h-[70vh]"], [class*="min-h-[75vh]"],
      [class*="min-h-[80vh]"], [class*="min-h-[85vh]"], [class*="min-h-[90vh]"], [class*="min-h-[95vh]"],
      [class*="min-h-[100vh]"] { min-height: 900px !important; }
      /* Prevent images from overflowing and breaking layout */
      img, video, svg { max-width: 100% !important; height: auto !important; }
      /* Static preview: make all animated elements visible without JS */
      .translate-y-full { transform: none !important; }
      .opacity-0:not(.group-hover\\:opacity-100):not([class*="hover\\:opacity"]) { opacity: 1 !important; }
      [data-animate] { opacity: 1 !important; transform: none !important; }
    </style>`;

// Wheel event blocker — forwards scroll events to parent canvas
const wheelBlock = `<script>document.addEventListener('wheel',function(e){e.preventDefault();window.parent.postMessage({type:'canvas-wheel',deltaX:e.deltaX,deltaY:e.deltaY,ctrlKey:e.ctrlKey,metaKey:e.metaKey,clientX:e.clientX,clientY:e.clientY},'*');},{passive:false});</script>`;


export const ScreenCard = memo(function ScreenCard({ screen, isVisible = true }: { screen: CanvasScreen; isVisible?: boolean }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { selectedScreenId, removeScreen, activeTool, editingScreenId, setEditingScreen, setSelectedElement, selectedElement, updateScreen, screenEditLoading, whyMode } = useCanvasStore();
  const isSelected = selectedScreenId === screen.id;
  const isEditing = activeTool === "edit" && editingScreenId === screen.id;
  const isEditLoading = screenEditLoading === screen.id;
  const [hovered, setHovered] = useState(false);
  const [showExportReact, setShowExportReact] = useState(false);
  const SCALE = 0.3;
  const dw = screen.width * SCALE;
  const dh = screen.height * SCALE;

  // Track the html that the iframe is currently showing to avoid unnecessary reloads
  const loadedHtmlRef = useRef<string>("");

  // Listen for messages from THIS iframe only — content height + HTML updates from text edits
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      // Only process messages from this screen's iframe (prevents cross-talk between screens)
      if (e.source !== iframeRef.current?.contentWindow) return;

      if (e.data?.type === "canvas-content-height" && e.data.height > 0) {
        const contentH = e.data.height as number;
        if (Math.abs(contentH - screen.height) > 50) {
          updateScreen(screen.id, { height: contentH });
        }
      }
      if (e.data?.type === "canvas-html-updated" && e.data.html) {
        // Update the stored html WITHOUT reloading the iframe
        // (the iframe already shows the updated content)
        loadedHtmlRef.current = e.data.html;
        updateScreen(screen.id, { html: e.data.html });
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [screen.id, screen.height, updateScreen]);

  // Listen for section rating votes from Why overlay
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.type === "canvas-section-vote" && e.data.sectionType && e.data.vote) {
        const proj = useCanvasStore.getState().project;
        if (proj) {
          apiRateSection(proj.id, screen.id, e.data.sectionType, e.data.vote);
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [screen.id]);

  // Listen for element selection messages from THIS iframe only
  useEffect(() => {
    if (!isEditing) return;
    const handler = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      if (e.data?.type === "canvas-element-select") {
        setSelectedElement({
          screenId: screen.id,
          selector: e.data.selector,
          tagName: e.data.tagName,
          textContent: e.data.textContent,
          rect: e.data.rect,
          clickX: e.data.clickX,
          clickY: e.data.clickY,
          sectionSelector: e.data.sectionSelector,
          sectionTagName: e.data.sectionTagName,
          sectionPreview: e.data.sectionPreview,
        });
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  // setSelectedElement is stable from zustand and deliberately omitted from deps
  }, [isEditing, screen.id]);

  // Load iframe — always inject edit scripts so we can toggle via CSS/postMessage without reloading
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !screen.html) return;

    // Check if iframe is a fresh mount (src is empty) — happens after viewport culling remounts it
    const isFreshMount = !iframe.src || iframe.src === "about:blank";
    const htmlChanged = screen.html !== loadedHtmlRef.current;
    if (!htmlChanged && !isFreshMount) return;

    loadedHtmlRef.current = screen.html;

    // Auto-inject CDN scripts for libraries the AI references but doesn't include
    const html = screen.html;
    const cdnScripts: string[] = [];
    if (html.includes("gsap") && !html.includes("gsap.min.js")) {
      cdnScripts.push(`<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>`);
      cdnScripts.push(`<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>`);
    }
    if (html.includes("Swiper") && !html.includes("swiper-bundle")) {
      cdnScripts.push(`<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.css">`);
      cdnScripts.push(`<script src="https://cdn.jsdelivr.net/npm/swiper@11/swiper-bundle.min.js"></script>`);
    }
    if (html.includes("AOS") && !html.includes("aos.js") && !html.includes("aos@")) {
      cdnScripts.push(`<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/aos/2.3.4/aos.css">`);
      cdnScripts.push(`<script src="https://cdnjs.cloudflare.com/ajax/libs/aos/2.3.4/aos.js"></script>`);
    }
    if (html.includes("anime(") && !html.includes("animejs") && !html.includes("anime.min")) {
      cdnScripts.push(`<script src="https://cdnjs.cloudflare.com/ajax/libs/animejs/3.2.2/anime.min.js"></script>`);
    }
    if (html.includes("Chart(") && !html.includes("chart.js") && !html.includes("Chart.min")) {
      cdnScripts.push(`<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>`);
    }
    const cdnInjection = cdnScripts.join("\n");

    const injection = `${cdnInjection}${baseStyle}${HEIGHT_SCRIPT}${IMG_FALLBACK}${RENDER_DIAGNOSTIC}${SCROLLTRIGGER_PREVIEW}${wheelBlock}${EDIT_INJECTION}${WHY_INJECTION}`;

    const full = screen.html.includes("<html")
      ? screen.html.replace("</head>", `${injection}</head>`)
      : `<!DOCTYPE html><html><head>${injection}</head><body>${screen.html}</body></html>`;

    const blob = new Blob([full], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    iframe.src = url;
    return () => URL.revokeObjectURL(url);
  }, [screen.html, isVisible]);

  // Capture thumbnail when iframe loads (for viewport culling placeholders)
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !isVisible || !screen.html) return;

    const onLoad = () => {
      // Skip if we already have a thumbnail for this exact HTML
      if (thumbnailHtmlHash.get(screen.id) === screen.html) return;
      // Small delay to let styles/images settle
      setTimeout(() => {
        if (iframeRef.current) {
          captureThumbnail(iframeRef.current, screen.id, screen.html);
        }
      }, 500);
    };

    iframe.addEventListener("load", onLoad);
    return () => iframe.removeEventListener("load", onLoad);
  }, [isVisible, screen.id, screen.html]);

  // Toggle edit mode via CSS class on iframe's <html> — no reload needed
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const applyEditMode = () => {
      try {
        const doc = iframe.contentDocument;
        if (!doc?.documentElement) return;
        if (isEditing) {
          doc.documentElement.classList.add("canvas-editing");
        } else {
          doc.documentElement.classList.remove("canvas-editing");
        }
      } catch { /* cross-origin, ignore */ }
    };

    // Apply immediately and also after iframe loads
    applyEditMode();
    iframe.addEventListener("load", applyEditMode);

    // Prevent iframe focus from scrolling the canvas container
    // When edit mode activates, the browser tries to scroll the iframe into view
    const preventFocusScroll = (e: FocusEvent) => {
      if (isEditing) {
        e.preventDefault();
        // Restore scroll position of all ancestors
        let el = iframe.parentElement;
        while (el) {
          el.scrollTop = 0;
          el.scrollLeft = 0;
          el = el.parentElement;
        }
      }
    };
    iframe.addEventListener("focus", preventFocusScroll);

    return () => {
      iframe.removeEventListener("load", applyEditMode);
      iframe.removeEventListener("focus", preventFocusScroll);
    };
  }, [isEditing]);

  // Toggle "Why" overlay mode via CSS class on iframe's <html>
  useEffect(() => {
    const iframe = iframeRef.current;
    debugLog('why', `useEffect fired: whyMode=${whyMode}, iframe=${!!iframe}, screenId=${screen.id}`);
    if (!iframe) return;
    const applyWhyMode = () => {
      try {
        const doc = iframe.contentDocument;
        debugLog('why', `applyWhyMode: doc=${!!doc}, docEl=${!!doc?.documentElement}, whyMode=${whyMode}`);
        if (!doc?.documentElement) {
          console.warn(`[why] No contentDocument — iframe may be cross-origin. Trying postMessage.`);
          iframe.contentWindow?.postMessage({ type: "canvas-why-mode", enabled: whyMode }, "*");
          return;
        }
        const whySections = doc.querySelectorAll("[data-why-type]");
        debugLog('why', `Found ${whySections.length} sections with data-why-type`);
        if (whyMode) {
          doc.documentElement.classList.add("canvas-why-mode");
          debugLog('why', `Added canvas-why-mode class. classList: ${doc.documentElement.classList}`);
        } else {
          doc.documentElement.classList.remove("canvas-why-mode");
          debugLog('why', `Removed canvas-why-mode class`);
        }
      } catch (err) {
        console.error(`[why] Error accessing iframe:`, err);
        iframe.contentWindow?.postMessage({ type: "canvas-why-mode", enabled: whyMode }, "*");
      }
    };
    applyWhyMode();
    iframe.addEventListener("load", applyWhyMode);
    return () => iframe.removeEventListener("load", applyWhyMode);
  }, [whyMode, screen.id]);

  const showActions = (isSelected || hovered) && !isEditing;
  const showElementPopup = isEditing && selectedElement && selectedElement.screenId === screen.id;

  return (
    <div data-screen-id={screen.id}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{ position: "absolute", left: screen.x, top: screen.y, width: dw, cursor: isEditing ? "default" : "grab" }}>

      {/* Title label */}
      <div style={{
        marginBottom: 8, display: "flex", alignItems: "center", gap: 6,
        opacity: showActions || isEditing ? 1 : 0.6, transition: "opacity 0.2s",
      }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isSelected ? "var(--accent)" : "var(--chrome-text-muted)"} strokeWidth="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/>
        </svg>
        <span style={{
          fontSize: 12, fontWeight: 500,
          color: isSelected ? "var(--accent-text)" : "var(--chrome-text-secondary)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: dw - 30,
        }}>
          {screen.prompt.slice(0, 50)}{screen.prompt.length > 50 ? "…" : ""}
        </span>
        {isEditing && (
          <span style={{ fontSize: 10, color: "#7c5cfc", fontWeight: 600, marginLeft: "auto" }}>EDITING</span>
        )}
      </div>

      {/* Frame */}
      {screen.placeholder ? (
        /* Skeleton card placeholder while generating (Concept 3) */
        <div style={{
          width: dw, borderRadius: 8, overflow: "hidden",
          background: "#fff", border: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "0 2px 20px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
          animation: "fadeUp 0.4s ease",
        }}>
          {/* Card header */}
          <div style={{
            padding: "8px 12px", display: "flex", alignItems: "center", justifyContent: "space-between",
            borderBottom: "1px solid #f0f0f0",
          }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#1a1a1a" }}>
              {screen.prompt.slice(0, 30)}{screen.prompt.length > 30 ? "…" : ""}
            </span>
            <span style={{
              fontSize: 9, fontWeight: 500, color: "var(--accent)", background: "var(--accent-bg, rgba(99,102,241,0.1))",
              padding: "2px 8px", borderRadius: 999, display: "flex", alignItems: "center", gap: 4,
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: "50%", background: "var(--accent)",
                animation: "pulse 1.5s ease-in-out infinite",
              }} />
              Generating
            </span>
          </div>
          {/* Shimmer skeleton blocks */}
          <div style={{ padding: 12 }}>
            <div style={{ height: 80, marginBottom: 10, borderRadius: 4, background: "linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)", backgroundSize: "200% 100%", animation: "shimmerBg 1.5s ease-in-out infinite" }} />
            <div style={{ height: 10, width: "75%", marginBottom: 6, borderRadius: 3, background: "linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)", backgroundSize: "200% 100%", animation: "shimmerBg 1.5s ease-in-out infinite" }} />
            <div style={{ height: 10, width: "90%", marginBottom: 6, borderRadius: 3, background: "linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)", backgroundSize: "200% 100%", animation: "shimmerBg 1.5s ease-in-out infinite" }} />
            <div style={{ height: 10, width: "60%", marginBottom: 12, borderRadius: 3, background: "linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)", backgroundSize: "200% 100%", animation: "shimmerBg 1.5s ease-in-out infinite" }} />
            <div style={{ display: "flex", gap: 8 }}>
              {[1,2,3].map(n => <div key={n} style={{ height: 50, flex: 1, borderRadius: 4, background: "linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%)", backgroundSize: "200% 100%", animation: "shimmerBg 1.5s ease-in-out infinite" }} />)}
            </div>
          </div>
          {/* Progress bar */}
          <div style={{
            padding: "8px 12px", borderTop: "1px solid #f0f0f0",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <div style={{ flex: 1, height: 3, background: "#f0f0f0", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: "35%", background: "var(--accent, #6366f1)", borderRadius: 3, animation: "progressGrow 30s ease-in-out forwards" }} />
            </div>
            <span style={{ fontSize: 9, color: "#999", whiteSpace: "nowrap" }}>Generating...</span>
          </div>
        </div>
      ) : (
      <div style={{
        width: dw, height: dh, overflow: "hidden", borderRadius: 8, position: "relative",
        border: isEditing ? "2px solid #7c5cfc" : isSelected ? "2px solid var(--accent)" : "1px solid var(--chrome-border)",
        boxShadow: isEditing
          ? "0 0 0 3px #7c5cfc33, var(--shadow-md)"
          : isSelected
            ? "0 0 0 3px var(--accent-bg), var(--shadow-md)"
            : hovered
              ? "var(--shadow-md)"
              : "var(--shadow-sm)",
        transition: "box-shadow 0.25s, border-color 0.2s",
      }}>
        {isVisible ? (
          <iframe ref={iframeRef} title={screen.prompt} style={{
            width: screen.width, height: screen.height,
            transform: `scale(${SCALE})`, transformOrigin: "top left",
            border: "none", background: "white",
            pointerEvents: (isEditing || whyMode) ? "auto" : "none",
          }} />
        ) : (
          thumbnailCache.has(screen.id) ? (
            <img
              src={thumbnailCache.get(screen.id)}
              alt={screen.prompt.slice(0, 40)}
              style={{
                width: dw, height: dh, objectFit: "cover",
                objectPosition: "top left", display: "block",
                filter: "brightness(0.97)",
              }}
            />
          ) : (
            <div style={{
              width: dw, height: dh, background: "#f8f8f8",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#bbb", fontSize: 11, fontWeight: 500,
            }}>
              {screen.prompt.slice(0, 25)}{screen.prompt.length > 25 ? "…" : ""}
            </div>
          )
        )}

        {/* Edit loading overlay */}
        {isEditLoading && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: 10, borderRadius: 6, zIndex: 5,
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "#7c5cfc",
              animation: "spin 1s linear infinite",
            }} />
            <span style={{ fontSize: 11, color: "#e5e7eb", fontWeight: 500 }}>Applying edit...</span>
          </div>
        )}

        {/* Hover actions (view mode only) */}
        {showActions && (
          <div style={{
            position: "absolute", top: 6, right: 6, display: "flex", gap: 3,
            animation: "fadeUp 0.12s ease",
          }}>
            {[
              { label: "Preview", icon: <><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></>, action: () => { const blob = new Blob([screen.html], { type: "text/html" }); const url = URL.createObjectURL(blob); window.open(url, "_blank"); setTimeout(() => URL.revokeObjectURL(url), 60000); } },
              { label: "Edit", icon: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>, action: () => { useCanvasStore.getState().setTool("edit"); setEditingScreen(screen.id); } },
              { label: "Variants", icon: <><rect x="2" y="2" width="9" height="9" rx="2"/><rect x="13" y="13" width="9" height="9" rx="2"/></>, action: () => {
                useCanvasStore.getState().selectScreen(screen.id);
                window.dispatchEvent(new CustomEvent("canvas-populate-chat", {
                  detail: { text: `Generate 2 variants of "${screen.prompt.slice(0, 40)}"`, autoSend: true },
                }));
              } },
              { label: "Export React", icon: <><path d="M16 18l6-6-6-6"/><path d="M8 6l-6 6 6 6"/></>, action: () => setShowExportReact(true) },
              { label: "Delete", icon: <><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>, action: () => { sendFeedback(screen.projectId, screen.id, "deleted"); removeScreen(screen.id); } },
            ].map(btn => (
              <button key={btn.label} onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); btn.action?.(); }} aria-label={btn.label} title={btn.label} style={{
                width: 26, height: 26, borderRadius: 6, border: "none",
                background: "var(--chrome-surface)", color: "var(--chrome-text-secondary)", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "var(--shadow-sm)", transition: "all 0.15s",
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">{btn.icon}</svg>
              </button>
            ))}
            {/* Device preview separator */}
            <div style={{ width: 1, height: 18, background: "var(--chrome-border)", margin: "4px 1px" }} />
            {/* Device preview toggles */}
            {([
              { label: "Mobile", width: 390, icon: <><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M12 18h.01"/></> },
              { label: "Tablet", width: 768, icon: <><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M12 18h.01"/></> },
              { label: "Desktop", width: 1440, icon: <><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></> },
            ] as const).map(dev => {
              const isActive = screen.width === dev.width;
              return (
                <button key={dev.label} onPointerDown={e => e.stopPropagation()} onClick={e => { e.stopPropagation(); updateScreen(screen.id, { width: dev.width }); }} aria-label={dev.label} title={dev.label} style={{
                  width: 26, height: 26, borderRadius: 6, border: "none",
                  background: isActive ? "var(--accent)" : "var(--chrome-surface)",
                  color: isActive ? "white" : "var(--chrome-text-secondary)",
                  cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "var(--shadow-sm)", transition: "all 0.15s",
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">{dev.icon}</svg>
                </button>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* Element edit popup — appears when an element is selected in edit mode */}
      {showElementPopup && (
        <ElementEditPopup screen={screen} element={selectedElement!} />
      )}

      {/* Variant badge */}
      {screen.variant && (
        <div style={{
          position: "absolute", top: 20, right: -6, width: 18, height: 18, borderRadius: "50%",
          background: "var(--accent)", border: "2px solid var(--canvas-bg)",
          fontSize: 9, fontWeight: 700, color: "white",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>V</div>
      )}

      {/* Export React modal */}
      {showExportReact && createPortal(
        <ExportReactModal html={screen.html} title={screen.prompt} onClose={() => setShowExportReact(false)} />,
        document.body,
      )}
    </div>
  );
});

function generateReactCode(html: string, title: string): string {
  // Extract a component name from the title/prompt
  const name = title
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .slice(0, 3)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("") || "ExportedScreen";

  // Extract the body content if possible, otherwise use full HTML
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyHtml = bodyMatch ? bodyMatch[1].trim() : html;

  // Extract stylesheets/links from head for the comment
  const linkMatches = html.match(/<link[^>]*href="([^"]*)"[^>]*>/gi) || [];
  const cdnComment = linkMatches.length > 0
    ? `// External dependencies (include in your index.html or install via npm):\n${linkMatches.map(l => `//   ${l}`).join("\n")}\n\n`
    : "";

  return `import React from "react";

${cdnComment}export default function ${name}() {
  return (
    <div dangerouslySetInnerHTML={{ __html: \`${bodyHtml.replace(/`/g, "\\`").replace(/\$\{/g, "\\${")}\` }} />
  );
}
`;
}

function ExportReactModal({ html, title, onClose }: { html: string; title: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const code = generateReactCode(html, title);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 99999,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#1a1a25", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)",
          width: "min(90vw, 700px)", maxHeight: "80vh", display: "flex", flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 18px", borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#C59FFF" strokeWidth="2">
              <path d="M16 18l6-6-6-6"/><path d="M8 6l-6 6 6 6"/>
            </svg>
            <span style={{ color: "white", fontWeight: 600, fontSize: 14 }}>Export as React Component</span>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer",
            fontSize: 18, lineHeight: 1, padding: "2px 6px",
          }}>&times;</button>
        </div>

        {/* Code block */}
        <div style={{ flex: 1, overflow: "auto", padding: "0 18px 14px" }}>
          <pre style={{
            background: "#12121a", borderRadius: 8, padding: 14, margin: "14px 0 0",
            fontSize: 12, lineHeight: 1.5, color: "#e0dfe8",
            overflowX: "auto", whiteSpace: "pre-wrap", wordBreak: "break-word",
            border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <code>{code}</code>
          </pre>
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", justifyContent: "flex-end", gap: 8,
          padding: "12px 18px", borderTop: "1px solid rgba(255,255,255,0.08)",
        }}>
          <button onClick={onClose} style={{
            padding: "7px 16px", borderRadius: 6, border: "1px solid rgba(255,255,255,0.15)",
            background: "transparent", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: 13,
          }}>Close</button>
          <button onClick={handleCopy} style={{
            padding: "7px 16px", borderRadius: 6, border: "none",
            background: "#C59FFF", color: "#1a1a25", cursor: "pointer", fontSize: 13, fontWeight: 600,
          }}>{copied ? "Copied!" : "Copy"}</button>
        </div>
      </div>
    </div>
  );
}

function ElementEditPopup({ screen, element }: { screen: CanvasScreen; element: { selector: string; tagName: string; textContent: string; rect: { x: number; y: number; width: number; height: number }; clickX?: number; clickY?: number; sectionSelector?: string; sectionTagName?: string; sectionPreview?: string } }) {
  const { setSelectedElement, setEditingScreen, screenEditLoading, viewport } = useCanvasStore();
  const [mode, setMode] = useState<null | "ai" | "ai-replace">(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [showComponentBrowser, setShowComponentBrowser] = useState(false);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  // Dismiss popup when viewport changes (zoom/pan) — stale position after transform
  const initialViewport = useRef({ x: viewport.x, y: viewport.y, zoom: viewport.zoom });
  useEffect(() => {
    const iv = initialViewport.current;
    if (Math.abs(viewport.zoom - iv.zoom) > 0.01 || Math.abs(viewport.x - iv.x) > 5 || Math.abs(viewport.y - iv.y) > 5) {
      setSelectedElement(null);
    }
  }, [viewport.x, viewport.y, viewport.zoom, setSelectedElement]);

  // Calculate popup position — use click position for accuracy (Issue 83)
  const screenEl = document.querySelector(`[data-screen-id="${screen.id}"]`);
  const iframeEl = screenEl?.querySelector("iframe");
  const iframeRect = iframeEl?.getBoundingClientRect();
  const SCALE = iframeRect ? iframeRect.width / screen.width : 0.3;

  // Zoom-adaptive sizing: popup stays proportional to the element being edited
  // At zoom=1 → scale=1, zoomed in (zoom=3) → scale shrinks, zoomed out (zoom=0.3) → scale grows slightly
  const uiScale = Math.max(0.55, Math.min(1.0, 0.85 / Math.max(viewport.zoom, 0.3)));

  // Use click position mapped to screen coords (much more reliable than element rect for tall pages)
  const clickScreenX = iframeRect && element.clickX != null
    ? iframeRect.left + element.clickX * SCALE
    : iframeRect ? iframeRect.left + (element.rect.x + element.rect.width / 2) * SCALE : window.innerWidth / 2;
  const clickScreenY = iframeRect && element.clickY != null
    ? iframeRect.top + element.clickY * SCALE
    : iframeRect ? iframeRect.top + element.rect.y * SCALE : window.innerHeight / 2;

  // Position popup to the right of click point, or left if near right edge
  const menuW = 200 * uiScale;
  const menuH = 220 * uiScale;
  const gap = 16 * uiScale;

  const fitsRight = clickScreenX + gap + menuW < window.innerWidth - 20;
  const rawX = fitsRight ? clickScreenX + gap : clickScreenX - gap - menuW;
  const rawY = clickScreenY - menuH / 3;

  // Clamp to viewport
  const clampedX = Math.max(12, Math.min(rawX, window.innerWidth - menuW - 12));
  const clampedY = Math.max(12, Math.min(rawY, window.innerHeight - menuH - 12));

  const hasSection = !!element.sectionSelector;
  const close = () => { setSelectedElement(null); setMode(null); };

  const getIframe = (): HTMLIFrameElement | null => {
    const screenEl = document.querySelector(`[data-screen-id="${screen.id}"]`);
    return screenEl?.querySelector("iframe") as HTMLIFrameElement | null;
  };

  const startInlineEdit = () => {
    if (screenEditLoading === screen.id) return;
    const iframe = getIframe();
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: "canvas-inline-edit", selector: element.selector }, "*");
    }
    setSelectedElement(null);
  };

  const sendAiEdit = () => {
    if (!aiPrompt.trim()) return;
    useCanvasStore.getState().selectScreen(screen.id);
    setEditingScreen(null);
    close();
    window.dispatchEvent(new CustomEvent("canvas-populate-chat", {
      detail: {
        text: aiPrompt, autoSend: true,
        editContext: { elementSelector: element.selector, elementTag: element.tagName, sectionSelector: element.sectionSelector || null, sectionHtml: element.sectionPreview || null },
      },
    }));
  };

  const sendAiReplace = () => {
    if (!aiPrompt.trim() || !element.sectionSelector) return;
    useCanvasStore.getState().selectScreen(screen.id);
    setEditingScreen(null);
    close();
    const sectionDesc = element.sectionTagName || "section";
    window.dispatchEvent(new CustomEvent("canvas-populate-chat", {
      detail: {
        text: `Replace the <${sectionDesc}> section with: ${aiPrompt}`, autoSend: true,
        editContext: { elementSelector: element.sectionSelector, elementTag: sectionDesc, sectionSelector: element.sectionSelector, sectionHtml: element.sectionPreview || null },
      },
    }));
  };

  const replaceWithComponent = (html: string) => {
    if (!element.sectionSelector) return;
    if (!html || html.trim().length < 10) return;
    const iframe = getIframe();
    if (iframe?.contentWindow) {
      const resultHandler = (e: MessageEvent) => {
        if (e.source !== iframe.contentWindow) return;
        if (e.data?.type === "canvas-replace-result") {
          window.removeEventListener("message", resultHandler);
          if (!e.data.success) console.error("[edit] Section replacement failed:", e.data.error);
        }
      };
      window.addEventListener("message", resultHandler);
      setTimeout(() => window.removeEventListener("message", resultHandler), 3000);
      iframe.contentWindow.postMessage({ type: "canvas-replace-section", selector: element.sectionSelector, newHtml: html }, "*");
    }
    setShowComponentBrowser(false);
    setEditingScreen(null);
    setSelectedElement(null);
  };

  if (showComponentBrowser) {
    return createPortal(
      <ReplacementBrowser
        sectionTag={element.sectionTagName || "section"}
        sectionPreview={element.sectionPreview || ""}
        textContent={element.textContent || ""}
        onSelect={replaceWithComponent}
        onClose={() => { setShowComponentBrowser(false); setEditingScreen(null); setSelectedElement(null); }}
      />,
      document.body,
    );
  }

  // Shared item style generator
  const itemStyle = (id: string): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 10 * uiScale,
    padding: `${8 * uiScale}px ${14 * uiScale}px`, borderRadius: 10 * uiScale,
    background: hoveredItem === id ? "rgba(124,92,252,0.12)" : "#1c1c20",
    border: hoveredItem === id ? "1px solid rgba(124,92,252,0.4)" : "1px solid #2a2a30",
    cursor: "pointer", transition: "all 0.2s",
    transform: hoveredItem === id ? `translateX(${4 * uiScale}px)` : "none",
    boxShadow: hoveredItem === id ? "0 0 16px rgba(124,92,252,0.12)" : "none",
    color: hoveredItem === id ? "#e4e4e7" : "#a1a1aa",
  });

  const iconSize = Math.round(14 * uiScale);
  const fontSize = Math.round(11 * uiScale);

  // Menu items definition
  const ITEMS = [
    { id: "text", label: "Edit Text", action: startInlineEdit, icon: <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></> },
    { id: "ai", label: "Edit with AI", action: () => setMode("ai"), icon: <><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></> },
  ];
  if (hasSection) {
    ITEMS.push(
      { id: "divider", label: "", action: () => {}, icon: <></> },
      { id: "replace-ai", label: "Replace Section (AI)", action: () => setMode("ai-replace"), icon: <><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/></> },
      { id: "library", label: "From Library", action: () => setShowComponentBrowser(true), icon: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></> },
    );
  }

  return createPortal(
    <div onPointerDown={e => e.stopPropagation()} style={{
      position: "fixed", left: clampedX, top: clampedY, zIndex: 9999,
      animation: "fadeUp 0.15s cubic-bezier(0.16,1,0.3,1)",
    }}>
      {/* Glow backdrop */}
      <div style={{
        position: "absolute", inset: -20 * uiScale, borderRadius: 24 * uiScale,
        background: "radial-gradient(ellipse at center, rgba(124,92,252,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {!mode ? (
        /* ─── Stacked Cards Menu ─── */
        <div style={{ display: "flex", flexDirection: "column", gap: 3 * uiScale, position: "relative" }}>
          {ITEMS.map(item =>
            item.id === "divider" ? (
              <div key="div" style={{ height: 1, background: "#27272a", margin: `${2 * uiScale}px ${8 * uiScale}px` }} />
            ) : (
              <div key={item.id} onClick={item.action}
                onMouseEnter={() => setHoveredItem(item.id)}
                onMouseLeave={() => setHoveredItem(null)}
                style={itemStyle(item.id)}>
                <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ flexShrink: 0 }}>
                  {item.icon}
                </svg>
                <span style={{ fontSize, fontWeight: 500, whiteSpace: "nowrap" }}>{item.label}</span>
              </div>
            )
          )}
          {/* Close button */}
          <div onClick={close}
            onMouseEnter={() => setHoveredItem("close")}
            onMouseLeave={() => setHoveredItem(null)}
            style={{
              ...itemStyle("close"),
              justifyContent: "center", marginTop: 2 * uiScale,
              background: hoveredItem === "close" ? "rgba(248,113,113,0.1)" : "#1c1c20",
              border: hoveredItem === "close" ? "1px solid rgba(248,113,113,0.3)" : "1px solid #2a2a30",
              color: hoveredItem === "close" ? "#f87171" : "#71717a",
            }}>
            <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            <span style={{ fontSize, fontWeight: 500 }}>Dismiss</span>
          </div>
        </div>
      ) : (
        /* ─── AI Input Mode (edit or replace) ─── */
        <div style={{
          background: "#1c1c20", border: "1px solid #2a2a30", borderRadius: 12 * uiScale,
          padding: 12 * uiScale, minWidth: 240 * uiScale, maxWidth: 320 * uiScale,
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
        }}>
          <div style={{ fontSize: 10 * uiScale, color: "#71717a", marginBottom: 6 * uiScale }}>
            {mode === "ai-replace"
              ? `Replacing: <${element.sectionTagName}> section`
              : `Editing: <${element.tagName}> "${element.textContent.slice(0, 25)}"`}
          </div>
          <input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") (mode === "ai" ? sendAiEdit : sendAiReplace)(); if (e.key === "Escape") { setMode(null); setAiPrompt(""); } }}
            autoFocus placeholder={mode === "ai-replace" ? "What should replace this section?" : "Describe the change..."}
            style={{
              width: "100%", border: "1px solid #3f3f46", borderRadius: 8 * uiScale,
              padding: 8 * uiScale, fontSize: 12 * uiScale, fontFamily: "inherit", boxSizing: "border-box",
              color: "#fafafa", background: "#0e0e10", outline: "none",
            }} />
          <div style={{ display: "flex", gap: 6 * uiScale, marginTop: 8 * uiScale, justifyContent: "flex-end" }}>
            <button onClick={() => { setMode(null); setAiPrompt(""); }} style={{
              padding: `${5 * uiScale}px ${10 * uiScale}px`, borderRadius: 8 * uiScale,
              border: "1px solid #3f3f46", background: "transparent", color: "#71717a",
              cursor: "pointer", fontSize: 11 * uiScale, fontFamily: "inherit",
            }}>Back</button>
            <button onClick={mode === "ai" ? sendAiEdit : sendAiReplace} disabled={!aiPrompt.trim()} style={{
              padding: `${5 * uiScale}px ${12 * uiScale}px`, borderRadius: 8 * uiScale, border: "none",
              background: aiPrompt.trim() ? "#7c5cfc" : "#3f3f46",
              color: "white", cursor: aiPrompt.trim() ? "pointer" : "default",
              fontSize: 11 * uiScale, fontWeight: 600, fontFamily: "inherit",
            }}>{mode === "ai-replace" ? "Replace" : "Send"}</button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}

// ─── Replacement Browser — inline component picker for section replacement ───

function detectSectionCategory(tag: string, preview: string, textContent: string): string {
  // Container-level tags contain the whole page - don't try to categorise
  if (tag === "main" || tag === "body" || tag === "html" || tag === "article") return "all";

  const lowerPreview = (preview + " " + textContent).toLowerCase();

  // Tag-level matches (high confidence)
  if (tag === "nav") return "navbar";
  if (tag === "footer") return "footer";
  if (tag === "header") return "hero";
  if (tag === "form") return "forms";

  // Class-based detection from opening tag
  const classMatch = preview.match(/class="([^"]*)"/i);
  const classes = classMatch ? classMatch[1].toLowerCase() : "";

  // Check classes for category hints
  if (/nav|navbar|navigation|menu/.test(classes)) return "navbar";
  if (/hero|banner|jumbotron/.test(classes)) return "hero";
  if (/footer/.test(classes)) return "footer";
  if (/pricing|plan/.test(classes)) return "pricing";
  if (/testimonial|review|quote/.test(classes)) return "testimonials";
  if (/team|people|member/.test(classes)) return "team";
  if (/gallery|portfolio|showcase/.test(classes)) return "gallery";
  if (/faq|accordion|question/.test(classes)) return "faq";
  if (/form|contact|subscribe|newsletter/.test(classes)) return "forms";
  if (/stats|counter|metric|number/.test(classes)) return "stats";
  if (/feature/.test(classes)) return "features";
  if (/card/.test(classes)) return "cards";
  if (/cta|call.to.action/.test(classes)) return "cta";
  if (/modal|dialog|popup/.test(classes)) return "modal";
  if (/sidebar/.test(classes)) return "sidebar";
  if (/banner/.test(classes)) return "banner";

  // Text content-based detection (lower confidence)
  if (/pricing|\/month|\$\d|per month|free plan|enterprise/i.test(lowerPreview)) return "pricing";
  if (/testimonial|what .* say|what our .* think|hear from our|client reviews?\b/i.test(lowerPreview)) return "testimonials";
  if (/faq|frequently asked|question/i.test(lowerPreview)) return "faq";
  if (/meet the team|our team|founder|ceo|designer|engineer/i.test(lowerPreview)) return "team";
  if (/get started|sign up|join|subscribe|newsletter|contact us/i.test(lowerPreview)) return "cta";
  if (/get in touch|send message|email|phone|address/i.test(lowerPreview)) return "forms";
  if (/\d+\+?\s*(projects|clients|years|users|members|downloads)/i.test(lowerPreview)) return "stats";
  if (/features|what we|services|our service|how it works/i.test(lowerPreview)) return "features";
  if (/portfolio|our work|selected work|case stud/i.test(lowerPreview)) return "gallery";

  return "all";
}

function ReplacementBrowser({ sectionTag, sectionPreview, textContent, onSelect, onClose }: {
  sectionTag: string; sectionPreview: string; textContent: string;
  onSelect: (html: string) => void; onClose: () => void;
}) {
  const [components, setComponents] = useState<Array<{ id: string; name: string; category: string; description: string; html: string; tags: string[] }>>([]);
  const [filtered, setFiltered] = useState<typeof components>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<typeof components[0] | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const previewRef = useRef<HTMLIFrameElement>(null);

  const suggestedCategory = detectSectionCategory(sectionTag, sectionPreview, textContent);

  // Issue 77: proper error handling on fetch
  useEffect(() => {
    fetch("/api/components")
      .then(r => {
        if (!r.ok) throw new Error(`Server returned ${r.status}`);
        return r.json();
      })
      .then(data => {
        const comps = data.components || [];
        if (comps.length === 0) {
          setFetchError("No components available in library");
        }
        setComponents(comps);
        setCategory(suggestedCategory);
        debugLog('components', `Loaded ${comps.length} components, detected category: "${suggestedCategory}" from <${sectionTag}>`);
      })
      .catch(err => {
        console.error("[components] Failed to fetch:", err);
        setFetchError(`Failed to load components: ${err.message}`);
      })
      .finally(() => setLoading(false));
  }, []);

  // Issue 78: reset selected when filter changes
  useEffect(() => {
    let result = components;
    if (category !== "all") result = result.filter(c => c.category === category);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
    }
    setFiltered(result);
    // Always select first result when filter changes (fixes stale selection)
    setSelected(result.length > 0 ? result[0] : null);
  }, [components, category, search]);

  const prevBlobRef = useRef<string | null>(null);
  useEffect(() => {
    if (!selected || !previewRef.current) return;
    if (prevBlobRef.current) URL.revokeObjectURL(prevBlobRef.current);
    const html = `<!DOCTYPE html><html><head>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>body{margin:0;}</style>
    </head><body>${selected.html}</body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    prevBlobRef.current = url;
    previewRef.current.src = url;
    return () => { if (prevBlobRef.current) { URL.revokeObjectURL(prevBlobRef.current); prevBlobRef.current = null; } };
  }, [selected]);

  const categories = ["all", ...new Set(components.map(c => c.category))];

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200,
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: "80vw", maxWidth: 1000, height: "75vh",
        background: "var(--chrome-surface, #18181b)", borderRadius: 20,
        border: "1px solid var(--chrome-border, #27272a)", overflow: "hidden",
        display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
      }}>
        {/* Header */}
        <div style={{
          padding: "14px 20px", borderBottom: "1px solid var(--chrome-border, #27272a)",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent, #7c5cfc)" strokeWidth="1.5">
            <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
          </svg>
          <span style={{ fontSize: 14, fontWeight: 600, color: "var(--chrome-text, #fafafa)" }}>
            Replace &lt;{sectionTag}&gt; Section
          </span>
          <div style={{ flex: 1 }} />
          <div style={{ position: "relative", width: 240 }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
              style={{
                width: "100%", padding: "7px 10px 7px 30px", borderRadius: 8,
                border: "1px solid var(--chrome-border, #27272a)", background: "var(--chrome-bg, #0e0e10)",
                color: "var(--chrome-text, #fafafa)", fontSize: 12, fontFamily: "inherit", outline: "none",
              }} />
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
              style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--chrome-text-muted, #71717a)" }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "var(--chrome-text-muted, #71717a)", cursor: "pointer", padding: 6, borderRadius: 8,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Body: split */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Left: category + list */}
          <div style={{ width: 340, borderRight: "1px solid var(--chrome-border, #27272a)", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", gap: 4, padding: "10px 12px", borderBottom: "1px solid var(--chrome-border, #27272a)", overflowX: "auto", flexShrink: 0 }}>
              {categories.map(cat => (
                <button key={cat} onClick={() => setCategory(cat)} style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 500,
                  border: category === cat ? "1px solid var(--accent, #7c5cfc)" : "1px solid var(--chrome-border, #27272a)",
                  background: category === cat ? "rgba(124,92,252,0.08)" : "transparent",
                  color: category === cat ? "var(--accent-text, #a78bfa)" : "var(--chrome-text-muted, #71717a)",
                  cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                }}>
                  {cat === "all" ? "All" : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {loading ? (
                <div style={{ padding: 30, textAlign: "center", color: "var(--chrome-text-muted, #71717a)", fontSize: 12 }}>Loading...</div>
              ) : fetchError ? (
                <div style={{ padding: 30, textAlign: "center", color: "#f87171", fontSize: 12 }}>{fetchError}</div>
              ) : filtered.length === 0 ? (
                <div style={{ padding: 30, textAlign: "center", color: "var(--chrome-text-muted, #71717a)", fontSize: 12 }}>No components found{search ? ` for "${search}"` : category !== "all" ? ` in ${category}` : ""}</div>
              ) : filtered.map(comp => (
                <div key={comp.id} onClick={() => setSelected(comp)} style={{
                  padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid rgba(39,39,42,0.5)",
                  background: selected?.id === comp.id ? "rgba(124,92,252,0.08)" : "transparent",
                  borderLeft: selected?.id === comp.id ? "2px solid var(--accent, #7c5cfc)" : "2px solid transparent",
                }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "var(--chrome-text, #fafafa)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {comp.name}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--chrome-text-muted, #71717a)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {comp.description}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: preview */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--chrome-bg, #0e0e10)" }}>
            {selected ? (
              <>
                <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--chrome-border, #27272a)" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--chrome-text, #fafafa)" }}>{selected.name}</div>
                  <div style={{ fontSize: 11, color: "var(--chrome-text-muted, #71717a)", marginTop: 2 }}>{selected.description}</div>
                </div>
                <div style={{ flex: 1, margin: "12px 20px", borderRadius: 10, overflow: "hidden", border: "1px solid var(--chrome-border, #27272a)", background: "white" }}>
                  <iframe ref={previewRef} title="Preview" style={{ width: "100%", height: "100%", border: "none" }} />
                </div>
                <div style={{ padding: "10px 20px", display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button onClick={onClose} style={{
                    padding: "8px 16px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer",
                    fontFamily: "inherit", background: "transparent", color: "var(--chrome-text-secondary, #a1a1aa)",
                    border: "1px solid var(--chrome-border, #27272a)",
                  }}>Cancel</button>
                  <button onClick={() => onSelect(selected.html)} style={{
                    padding: "8px 20px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    fontFamily: "inherit", border: "none", background: "var(--accent, #7c5cfc)", color: "white",
                  }}>Replace Section</button>
                </div>
              </>
            ) : (
              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--chrome-text-muted, #71717a)", fontSize: 13 }}>
                Select a component
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

