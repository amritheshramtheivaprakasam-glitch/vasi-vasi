/* ============================================================
   Vasi Vasi — EPUB adapter (vendored JSZip, MIT)
   An .epub is a zip of XHTML chapters. We read the OPF spine
   (the book's official reading order), extract each chapter's
   block text via textBlocks, and join chapters as paragraphs —
   so Shift+←/→ moves chapter by chapter. DRM-locked EPUBs fail
   with an honest message instead of garble.
   ============================================================ */
(function () {
  'use strict';
  const VV = (window.VV = window.VV || {});

  function userError(message) {
    const err = new Error(message);
    err.userMessage = message;
    return err;
  }

  /* Find first descendant with a given localName (namespace-agnostic). */
  function first(doc, localName) {
    const all = doc.getElementsByTagName('*');
    for (const el of all) if (el.localName === localName) return el;
    return null;
  }

  function resolvePath(base, href) {
    const parts = (base ? base.split('/') : []).concat(href.split('/'));
    const out = [];
    for (const p of parts) {
      if (p === '' || p === '.') continue;
      if (p === '..') out.pop();
      else out.push(p);
    }
    return out.join('/');
  }

  async function read(zip, path) {
    const f = zip.file(path) || zip.file(decodeURIComponent(path));
    return f ? f.async('text') : null;
  }

  /** zip: a JSZip instance (already loaded by importManager). */
  async function extract(zip, onProgress) {
    const containerXml = await read(zip, 'META-INF/container.xml');
    if (!containerXml) {
      throw userError('That file is a zip archive, but not a valid EPUB book.');
    }
    const parser = new DOMParser();
    const container = parser.parseFromString(containerXml, 'text/xml');
    const rootfile = first(container, 'rootfile');
    if (!rootfile) throw userError('This EPUB has no package document.');
    const opfPath = rootfile.getAttribute('full-path');

    const opfText = await read(zip, opfPath);
    if (!opfText) throw userError('This EPUB is missing its package document.');
    const opf = parser.parseFromString(opfText, 'text/xml');

    const titleEl = first(opf, 'title');
    const manifest = {};
    const manifestEls = [];
    (function collect(el) {
      for (const c of el.children) {
        if (c.localName === 'item') manifestEls.push(c);
        collect(c);
      }
    })(opf.documentElement);
    manifestEls.forEach((c) => {
      manifest[c.getAttribute('id')] = {
        href: c.getAttribute('href'),
        type: c.getAttribute('media-type') || ''
      };
    });

    const spineIds = [];
    (function collectSpine(el) {
      for (const c of el.children) {
        if (c.localName === 'itemref') spineIds.push(c.getAttribute('idref'));
        collectSpine(c);
      }
    })(opf.documentElement);

    if (!spineIds.length) throw userError('This EPUB has no readable chapters.');
    const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/')) : '';

    const chapters = [];
    let skipped = 0;
    for (let i = 0; i < spineIds.length; i++) {
      const item = manifest[spineIds[i]];
      if (!item || !/html/i.test(item.type)) { skipped++; continue; }
      const path = resolvePath(opfDir, item.href);
      const html = await read(zip, path);
      if (!html) { skipped++; continue; }
      const blocks = VV.textBlocks.parse(html);
      if (blocks.length) chapters.push(blocks.join('\n\n'));
      if (onProgress) onProgress({ page: i + 1, total: spineIds.length });
    }

    if (!chapters.length) {
      throw userError(
        'No readable chapters were found. This e-book may be DRM-protected, ' +
        'which Vasi Vasi cannot unlock.'
      );
    }

    const warnings = skipped > 0
      ? [skipped + ' non-text section(s) (images, cover or index) were skipped.']
      : [];

    return {
      text: chapters.join('\n\n'),
      title: titleEl && titleEl.textContent ? titleEl.textContent.trim() : null,
      meta: { chapters: chapters.length },
      warnings
    };
  }

  VV.epubAdapter = { extract, _resolvePath: resolvePath };
})();
