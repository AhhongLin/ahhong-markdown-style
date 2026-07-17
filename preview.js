(function () {
  const TOC_ID = 'ahhong-floating-toc';
  const TOC_TITLE = 'On this page';
  const HEADING_SELECTOR = 'h1, h2, h3, h4, h5, h6';
  const SCROLL_OFFSET = 72;

  let headings = [];
  let tocElement = null;
  let activeId = '';
  let observer = null;
  let mutationObserver = null;
  let rebuildTimer = 0;

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
      .map((heading, index) => {
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

        return {
          id,
          text,
          level,
          index,
          element: heading,
        };
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
      item.style.paddingLeft = `${Math.max(0, heading.level - 1) * 10}px`;

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

        const top = target.getBoundingClientRect().top + window.pageYOffset - SCROLL_OFFSET;
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
        history.replaceState(null, '', `#${heading.id}`);
        setActiveHeading(heading.id);
      });

      item.appendChild(link);
      list.appendChild(item);
    });

    container.appendChild(title);
    container.appendChild(list);

    ensureScrollSync();
    updateActiveHeading();
    ensureMutationSync();
  }

  function ensureScrollSync() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    if (!headings.length || !('IntersectionObserver' in window)) {
      return;
    }

    observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.boundingClientRect.top - a.boundingClientRect.top);

      if (visible.length > 0) {
        setActiveHeading(visible[0].target.id);
      }
    }, {
      rootMargin: '-20% 0px -65% 0px',
      threshold: [0, 1],
    });

    headings.forEach((heading) => observer.observe(heading.element));
  }

  function updateActiveHeading() {
    const offsetLine = window.scrollY + SCROLL_OFFSET;
    let current = headings[0];

    for (const heading of headings) {
      if (heading.element.getBoundingClientRect().top + window.scrollY <= offsetLine) {
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
    window.addEventListener('scroll', updateActiveHeading, { passive: true });
    window.addEventListener('resize', scheduleBuild, { passive: true });
    window.addEventListener('load', scheduleBuild, { once: true });
  }

  ready(() => {
    buildToc();
    ensureMutationSync();
    bindGlobalEvents();
  });
})();