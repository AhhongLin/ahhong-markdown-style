(function () {
  const TOC_ID = 'ahhong-floating-toc';
  const TOC_TITLE = 'On this page';
  const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';
  const SCROLL_OFFSET = 72;

  const headingIndex = createHeadingIndex();
  let tocElement = null;
  let activeId = '';
  let mutationObserver = null;
  let rebuildTimer = 0;
  let isProgrammaticScroll = false;
  let programmaticScrollTimer = 0;
  let lastScrollY = 0;
  let destroyPointerInteractions = null;

  let isCollapsed = true;

  let listClickHandler = null;

  const DRAG_MOVE_THRESHOLD = 15;
  const MIN_HEIGHT = 100;

  // Scroll 節流 - 使用 requestAnimationFrame
  let scrollFrameId = null;

  function setupPointerInteractions() {
    const title = tocElement.querySelector('.ahhong-floating-toc__title');
    const toggleButton = tocElement.querySelector('.ahhong-floating-toc__toggle');
    const resizeHandle = tocElement.querySelector('.ahhong-floating-toc__resize-handle');
    let mode = 'idle';
    let activePointerId = null;
    let captureElement = null;
    let dragSource = null;
    let startX = 0;
    let startY = 0;
    let offsetX = 0;
    let offsetY = 0;
    let startHeight = 0;
    let suppressNextClick = false;

    function capturePointer(event) {
      captureElement = event.currentTarget;
      if (captureElement.setPointerCapture) {
        captureElement.setPointerCapture(event.pointerId);
      }
    }

    function canStart(event) {
      return mode === 'idle' && event.isPrimary !== false && event.button === 0;
    }

    function startDrag(event) {
      if (!canStart(event)) {
        return;
      }

      mode = 'pressed';
      activePointerId = event.pointerId;
      dragSource = event.currentTarget;
      startX = event.clientX;
      startY = event.clientY;
      const rect = tocElement.getBoundingClientRect();
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      title.style.cursor = 'grabbing';
      capturePointer(event);
      event.preventDefault();
    }

    function startResize(event) {
      if (!canStart(event)) {
        return;
      }

      mode = 'resizing';
      activePointerId = event.pointerId;
      startY = event.clientY;
      startHeight = tocElement.offsetHeight;
      capturePointer(event);
      event.preventDefault();
    }

    function movePointer(event) {
      if (event.pointerId !== activePointerId) {
        return;
      }

      if (mode === 'pressed') {
        const movedDistance = Math.hypot(event.clientX - startX, event.clientY - startY);
        if (movedDistance <= DRAG_MOVE_THRESHOLD) {
          return;
        }
        mode = 'dragging';
        suppressNextClick = dragSource === toggleButton;
      }

      if (mode === 'dragging') {
        const newX = event.clientX - offsetX;
        const newY = event.clientY - offsetY;
        const width = tocElement.getBoundingClientRect().width;
        const newRight = window.innerWidth - newX - width;

        tocElement.style.setProperty('top', `${newY}px`, 'important');
        tocElement.style.setProperty('right', `${newRight}px`, 'important');
        tocElement.style.setProperty('left', 'auto', 'important');
        tocElement.style.setProperty('bottom', 'auto', 'important');
        tocElement.setAttribute('data-position-overridden', 'true');
      }

      if (mode !== 'resizing') {
        return;
      }

      const deltaY = event.clientY - startY;
      const newHeight = Math.max(MIN_HEIGHT, startHeight + deltaY);
      tocElement.style.maxHeight = `${newHeight}px`;
    }

    function resetInteraction(event) {
      if (activePointerId === null || (event.pointerId !== undefined && event.pointerId !== activePointerId)) {
        return;
      }

      const element = captureElement;
      const pointerId = activePointerId;
      mode = 'idle';
      activePointerId = null;
      captureElement = null;
      dragSource = null;
      title.style.cursor = 'grab';

      if (element && element.hasPointerCapture && element.hasPointerCapture(pointerId)) {
        element.releasePointerCapture(pointerId);
      }
    }

    function toggleClick(event) {
      if (suppressNextClick) {
        suppressNextClick = false;
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      toggleCollapsed();
    }

    function togglePointerDown(event) {
      startDrag(event);
      event.stopPropagation();
    }

    title.addEventListener('pointerdown', startDrag);
    toggleButton.addEventListener('pointerdown', togglePointerDown);
    toggleButton.addEventListener('click', toggleClick);
    resizeHandle.addEventListener('pointerdown', startResize);
    tocElement.addEventListener('pointermove', movePointer);
    tocElement.addEventListener('pointerup', resetInteraction);
    tocElement.addEventListener('pointercancel', resetInteraction);
    tocElement.addEventListener('lostpointercapture', resetInteraction);

    return () => {
      title.removeEventListener('pointerdown', startDrag);
      toggleButton.removeEventListener('pointerdown', togglePointerDown);
      toggleButton.removeEventListener('click', toggleClick);
      resizeHandle.removeEventListener('pointerdown', startResize);
      tocElement.removeEventListener('pointermove', movePointer);
      tocElement.removeEventListener('pointerup', resetInteraction);
      tocElement.removeEventListener('pointercancel', resetInteraction);
      tocElement.removeEventListener('lostpointercapture', resetInteraction);
      resetInteraction({ pointerId: activePointerId });
    };
  }

  function ready(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn, { once: true });
      return;
    }

    fn();
  }

  function isInsideToc(node) {
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    return Boolean(element && element.closest('#' + TOC_ID));
  }

  function createHeadingIndex() {
    let entries = [];
    let fingerprint = null;

    function slugify(value) {
      return value
        .toLowerCase()
        .trim()
        .replace(/['"`]/g, '')
        .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
    }

    function getText(heading) {
      return (heading.textContent || heading.innerText || '').replace(/\s+/g, ' ').trim();
    }

    function collect() {
      const seen = new Map();
      const usedIds = new Set();

      return Array.from(document.querySelectorAll(HEADING_SELECTOR))
        .filter((heading) => !isInsideToc(heading))
        .map((heading) => {
          const text = getText(heading);
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

    return {
      refresh() {
        const nextEntries = collect();
        const nextFingerprint = nextEntries.map(({ id, text, level }) => `${id}\u0000${text}\u0000${level}`).join('\u0001');
        const changed = nextFingerprint !== fingerprint;
        entries = nextEntries;
        fingerprint = nextFingerprint;
        return changed;
      },
      getEntries() {
        return entries;
      },
      findActive(scrollY, offset) {
        const offsetLine = scrollY + offset;
        let current = entries[0];

        for (const heading of entries) {
          if (heading.element.getBoundingClientRect().top + scrollY <= offsetLine) {
            current = heading;
          } else {
            break;
          }
        }

        return current;
      },
    };
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

      const title = document.createElement('div');
      title.className = 'ahhong-floating-toc__title';

      const titleText = document.createElement('span');
      titleText.className = 'ahhong-floating-toc__title-text';
      titleText.textContent = TOC_TITLE;
      title.appendChild(titleText);

      const toggleButton = document.createElement('button');
      toggleButton.type = 'button';
      toggleButton.className = 'ahhong-floating-toc__toggle';

      const list = document.createElement('ul');
      list.className = 'ahhong-floating-toc__list';

      const resizeHandle = document.createElement('div');
      resizeHandle.className = 'ahhong-floating-toc__resize-handle';

      tocElement.appendChild(title);
      tocElement.appendChild(toggleButton);
      tocElement.appendChild(list);
      tocElement.appendChild(resizeHandle);
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

  function setupTocNavigation() {
    const list = tocElement.querySelector('.ahhong-floating-toc__list');

    listClickHandler = (event) => {
      const link = event.target.closest && event.target.closest('.ahhong-floating-toc__link');
      if (!link || !list.contains(link)) {
        return;
      }

      event.preventDefault();
      const targetId = link.getAttribute('data-target-id');
      const target = document.getElementById(targetId);

      if (!target) {
        return;
      }

      isProgrammaticScroll = true;
      window.clearTimeout(programmaticScrollTimer);
      setActiveHeading(targetId);

      const top = target.getBoundingClientRect().top + window.pageYOffset - SCROLL_OFFSET;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      history.replaceState(null, '', `#${targetId}`);

      programmaticScrollTimer = window.setTimeout(() => {
        isProgrammaticScroll = false;
      }, 300);
    };

    list.addEventListener('click', listClickHandler);
  }

  function refreshToc() {
    const container = ensureTocElement();
    const headingsChanged = headingIndex.refresh();
    const headings = headingIndex.getEntries();

    if (!headingsChanged) {
      return;
    }

    container.hidden = !headings.length;

    const list = container.querySelector('.ahhong-floating-toc__list');
    const fragment = document.createDocumentFragment();

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

      item.appendChild(link);
      fragment.appendChild(item);
    });

    list.replaceChildren(fragment);

    if (!destroyPointerInteractions) {
      destroyPointerInteractions = setupPointerInteractions();
      setupTocNavigation();
    }
    applyCollapsedState();
    if (headings.some((heading) => heading.id === activeId)) {
      setActiveHeading(activeId);
    } else {
      updateActiveHeading();
    }
  }

  function applyCollapsedState() {
    if (!tocElement) {
      return;
    }

    tocElement.classList.toggle('is-collapsed', isCollapsed);

    const toggleButton = tocElement.querySelector('.ahhong-floating-toc__toggle');
    if (toggleButton) {
      toggleButton.textContent = isCollapsed ? '☰' : '－';
      toggleButton.setAttribute('aria-expanded', String(!isCollapsed));
      toggleButton.setAttribute('aria-label', isCollapsed ? '展開目錄' : '最小化目錄');
    }
  }

  function toggleCollapsed() {
    isCollapsed = !isCollapsed;
    applyCollapsedState();
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

    const current = headingIndex.findActive(scrollY, SCROLL_OFFSET);

    if (current) {
      setActiveHeading(current.id);
    }
  }

  // Scroll 節流包裝函數 - 使用 requestAnimationFrame
  function scheduleActiveHeadingUpdate() {
    if (scrollFrameId !== null) {
      return; // 已有待執行的更新，跳過
    }

    scrollFrameId = window.requestAnimationFrame(() => {
      updateActiveHeading();
      scrollFrameId = null;
    });
  }

  function scheduleRefresh() {
    window.clearTimeout(rebuildTimer);
    rebuildTimer = window.setTimeout(refreshToc, 100);
  }

  function ensureMutationSync() {
    if (!mutationObserver) {
      mutationObserver = new MutationObserver((mutations) => {
        const documentChanged = mutations.some((mutation) => !isInsideToc(mutation.target));
        if (documentChanged) {
          scheduleRefresh();
        }
      });
    }

    mutationObserver.disconnect();
    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['id'],
    });
  }

  function bindGlobalEvents() {
    // 同時監聽 window 與 document，提高 VS Code webview 相容性
    // 使用節流包裝函數減少計算頻率
    window.addEventListener('scroll', scheduleActiveHeadingUpdate, { passive: true });
    document.addEventListener('scroll', scheduleActiveHeadingUpdate, { passive: true });
    window.addEventListener('resize', scheduleRefresh, { passive: true });
    window.addEventListener('load', scheduleRefresh, { once: true });
    window.addEventListener('pagehide', destroyToc, { once: true });
  }

  function destroyToc() {
    window.clearTimeout(rebuildTimer);
    window.clearTimeout(programmaticScrollTimer);
    if (scrollFrameId !== null) {
      window.cancelAnimationFrame(scrollFrameId);
      scrollFrameId = null;
    }
    if (mutationObserver) {
      mutationObserver.disconnect();
    }

    const list = tocElement && tocElement.querySelector('.ahhong-floating-toc__list');

    if (list && listClickHandler) list.removeEventListener('click', listClickHandler);
    if (destroyPointerInteractions) {
      destroyPointerInteractions();
      destroyPointerInteractions = null;
    }
    window.removeEventListener('scroll', scheduleActiveHeadingUpdate);
    document.removeEventListener('scroll', scheduleActiveHeadingUpdate);
    window.removeEventListener('resize', scheduleRefresh);
    window.removeEventListener('load', scheduleRefresh);
  }

  ready(() => {
    refreshToc();
    ensureMutationSync();
    bindGlobalEvents();
  });
})();