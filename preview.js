(function () {
  const TOC_ID = 'ahhong-floating-toc';
  const TOC_TITLE = 'On this page';
  const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';
  const SCROLL_OFFSET = 72;

  let headings = [];
  let tocElement = null;
  let activeId = '';
  let mutationObserver = null;
  let rebuildTimer = 0;
  let isProgrammaticScroll = false;
  let programmaticScrollTimer = 0;
  let lastScrollY = 0;
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  let isDraggingInitialized = false;

  function setupTocDragging() {
    if (!tocElement || isDraggingInitialized) {
      return;
    }

    isDraggingInitialized = true;
    const title = tocElement.querySelector('.ahhong-floating-toc__title');
    if (!title) {
      return;
    }

    title.addEventListener('mousedown', (event) => {
      isDragging = true;
      const rect = tocElement.getBoundingClientRect();
      dragOffsetX = event.clientX - rect.left;
      dragOffsetY = event.clientY - rect.top;
      title.style.cursor = 'grabbing';
      event.preventDefault();
    });

    document.addEventListener('mousemove', (event) => {
      if (!isDragging || !tocElement) {
        return;
      }

      const newX = event.clientX - dragOffsetX;
      const newY = event.clientY - dragOffsetY;

      tocElement.style.setProperty('left', `${newX}px`, 'important');
      tocElement.style.setProperty('top', `${newY}px`, 'important');
      tocElement.style.setProperty('right', 'auto', 'important');
      tocElement.style.setProperty('bottom', 'auto', 'important');
      tocElement.setAttribute('data-position-overridden', 'true');
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        if (title) {
          title.style.cursor = 'grab';
        }
      }
    });

    title.style.cursor = 'grab';
    title.style.userSelect = 'none';
  }
  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
      return;
    }

    fn();
  }

  function slugify(value) {
    return value
      .toLowerCase()
      .trim()
      .replace(/['"`]/g, '')
      .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  function getHeadingText(heading) {
    return (heading.textContent || heading.innerText || '').replace(/\s+/g, ' ').trim();
  }

  function isInsideToc(node) {
    return Boolean(node.closest && node.closest('#' + TOC_ID));
  }

  function collectHeadings() {
    const seen = new Map();
    const usedIds = new Set();

    return Array.from(document.querySelectorAll(HEADING_SELECTOR))
      .filter((heading) => !isInsideToc(heading))
      .map((heading) => {
        const text = getHeadingText(heading);

        if (!text) {
          return null;
        }

        const level = Number(heading.tagName.slice(1));
        const baseId = heading.id && heading.id.trim() ? heading.id.trim() : (slugify(text) || 'heading');
        const nextIndex = (seen.get(baseId) || 0) + 1;
        seen.set(baseId, nextIndex);

        let id = baseId;
        if (nextIndex > 1 || usedIds.has(id)) {
          id = `${baseId}-${nextIndex}`;
        }

        while (usedIds.has(id)) {
          const suffix = (seen.get(baseId) || 1) + 1;
          seen.set(baseId, suffix);
          id = `${baseId}-${suffix}`;
        }

        usedIds.add(id);
        heading.id = id;

        return { id, text, level, element: heading };
      })
      .filter(Boolean);
  }

  function ensureTocElement() {
    if (tocElement && document.body.contains(tocElement)) {
      return tocElement;
    }

    tocElement = document.getElementById(TOC_ID);

    if (!tocElement) {
      tocElement = document.createElement('aside');
      tocElement.id = TOC_ID;
      tocElement.setAttribute('data-floating-toc', 'true');
      tocElement.setAttribute('role', 'navigation');
      tocElement.setAttribute('aria-label', 'Floating table of contents');
      document.body.appendChild(tocElement);
    }

    return tocElement;
  }

  function setActiveHeading(id) {
    if (!tocElement) {
      return;
    }

    activeId = id || '';

    tocElement.querySelectorAll('.ahhong-floating-toc__link').forEach((link) => {
      const isActive = link.getAttribute('data-target-id') === activeId;

      link.classList.toggle('is-active', isActive);
      link.setAttribute('aria-current', isActive ? 'location' : 'false');
    });
  }

  function buildToc() {
    if (mutationObserver) {
      mutationObserver.disconnect();
    }

    // 重置程式捲動旗標，因為 buildToc 表示畫面內容已更新
    isProgrammaticScroll = false;
    window.clearTimeout(programmaticScrollTimer);

    // 重置拖曳初始化旗標，因為 buildToc 會重新建立 DOM
    isDraggingInitialized = false;

    headings = collectHeadings();

    const container = ensureTocElement();

    if (!headings.length) {
      container.hidden = true;
      container.innerHTML = '';
      return;
    }

    container.hidden = false;
    container.innerHTML = '';

    const title = document.createElement('div');
    title.className = 'ahhong-floating-toc__title';
    title.textContent = TOC_TITLE;

    const list = document.createElement('ul');
    list.className = 'ahhong-floating-toc__list';

    headings.forEach((heading) => {
      const item = document.createElement('li');
      item.className = 'ahhong-floating-toc__item';

      const link = document.createElement('a');
      link.className = 'ahhong-floating-toc__link';
      link.href = `#${heading.id}`;
      link.textContent = heading.text;
      link.setAttribute('data-target-id', heading.id);
      link.setAttribute('data-level', String(heading.level));
      link.setAttribute('aria-label', heading.text);

      link.addEventListener('click', (event) => {
        event.preventDefault();

        const target = document.getElementById(heading.id);

        if (!target) {
          return;
        }

        // 鎖定高亮，防止 scroll 事件與 observer 在捲動過程中搶奪
        isProgrammaticScroll = true;
        window.clearTimeout(programmaticScrollTimer);
        setActiveHeading(heading.id);

        const top = target.getBoundingClientRect().top + window.pageYOffset - SCROLL_OFFSET;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        history.replaceState(null, '', `#${heading.id}`);

        // smooth scroll 約 300ms，結束後恢復自動同步
        programmaticScrollTimer = window.setTimeout(() => {
          isProgrammaticScroll = false;
        }, 300);
      });

      item.appendChild(link);
      list.appendChild(item);
    });

    container.appendChild(title);
    container.appendChild(list);

    setupTocDragging();
    updateActiveHeading();
    ensureMutationSync();
  }

  function updateActiveHeading() {
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;

    // 檢測是否有新的 scroll 位置變化，若有則強制重置旗標（使用者主動捲動）
    if (isProgrammaticScroll && scrollY !== lastScrollY) {
      isProgrammaticScroll = false;
      window.clearTimeout(programmaticScrollTimer);
    }
    lastScrollY = scrollY;

    if (isProgrammaticScroll) {
      return;
    }

    const offsetLine = scrollY + SCROLL_OFFSET;
    let current = headings[0];

    for (const heading of headings) {
      if (heading.element.getBoundingClientRect().top + scrollY <= offsetLine) {
        current = heading;
      } else {
        break;
      }
    }

    if (current) {
      setActiveHeading(current.id);
    }
  }

  function scheduleBuild() {
    window.clearTimeout(rebuildTimer);
    rebuildTimer = window.setTimeout(buildToc, 100);
  }

  function ensureMutationSync() {
    if (!mutationObserver) {
      mutationObserver = new MutationObserver((mutations) => {
        if (mutations.some((mutation) => mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
          scheduleBuild();
        }
      });
    }

    mutationObserver.disconnect();
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function bindGlobalEvents() {
    // 同時監聽 window 與 document，提高 VS Code webview 相容性
    window.addEventListener('scroll', updateActiveHeading, { passive: true });
    document.addEventListener('scroll', updateActiveHeading, { passive: true });
    window.addEventListener('resize', scheduleBuild, { passive: true });
    window.addEventListener('load', scheduleBuild, { once: true });
  }

  ready(() => {
    buildToc();
    ensureMutationSync();
    bindGlobalEvents();
  });
})();