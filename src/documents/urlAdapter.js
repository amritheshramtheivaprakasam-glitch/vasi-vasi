/* ============================================================
   Vasi Vasi — URL adapter (vendored Mozilla Readability, Apache-2.0)
   Imports a readable article from a web address. Honest by
   design: browsers block cross-origin reads on most sites, so
   failures explain themselves and offer the paste fallback —
   we never route private reading through a third-party proxy.
   ============================================================ */
(function () {
  'use strict';
  const VV = (window.VV = window.VV || {});

  const MAX_BYTES = 3_000_000;
  const TIMEOUT_MS = 15000;

  function userError(message) {
    const err = new Error(message);
    err.userMessage = message;
    return err;
  }

  async function importUrl(url, onProgress) {
    let u;
    try {
      u = new URL(String(url || '').trim());
    } catch (e) {
      throw userError("That doesn't look like a valid web address.");
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw userError('Only web addresses starting with http:// or https:// can be imported.');
    }

    if (onProgress) onProgress({ phase: 'fetch' });
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    let res;
    try {
      res = await fetch(u.href, { signal: ctrl.signal, credentials: 'omit', redirect: 'follow' });
    } catch (e) {
      throw userError(
        'Your browser could not read that page — many websites block direct browser access ' +
        '(this is normal). Open the page yourself, copy the article text, and use “Add text”.'
      );
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      throw userError(
        'The website returned an error (' + res.status + '). ' +
        'Copy the article text and use “Add text” instead.'
      );
    }
    const type = res.headers.get('content-type') || '';
    if (type && !/text\/html|application\/xhtml/i.test(type)) {
      throw userError('That link is not a readable web page (it looks like ' +
        type.split(';')[0] + ').');
    }

    let html = await res.text();
    const warnings = [];
    if (html.length > MAX_BYTES) {
      html = html.slice(0, MAX_BYTES);
      warnings.push('The page was very long and was shortened to the first part.');
    }

    if (onProgress) onProgress({ phase: 'extract' });
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const ReadabilityLib = await VV.vendorLoader.load('readability');

    let article = null;
    try {
      article = new ReadabilityLib(doc.cloneNode(true)).parse();
    } catch (e) { /* fall back to raw page */ }

    const contentHtml = article && article.content ? article.content : html;
    const paragraphs = VV.textBlocks.parse(contentHtml);

    if (!paragraphs.length) {
      throw userError(
        'No readable article text was found on that page. ' +
        'Copy the text manually and use “Add text”.'
      );
    }

    const title =
      (article && article.title && article.title.trim()) ||
      (doc.title && doc.title.trim()) ||
      (u.hostname + u.pathname).replace(/\/$/, '').slice(0, 80);

    return {
      title,
      text: paragraphs.join('\n\n'),
      meta: { sourceUrl: u.href, siteName: (article && article.siteName) || u.hostname },
      warnings
    };
  }

  VV.urlAdapter = { importUrl };
})();
