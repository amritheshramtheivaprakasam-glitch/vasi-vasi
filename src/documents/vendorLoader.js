/* ============================================================
   Vasi Vasi — vendor loader
   Lazily loads the vendored parser libraries (pdf.js, JSZip,
   Mammoth, Readability) from ./vendor with a plain <script>
   tag — no CDN, no bundler. Each library loads at most once,
   the first time its format is actually imported, keeping the
   app startup light on low-end phones. The service worker
   caches them after first use, so offline import follows.
   ============================================================ */
(function () {
  'use strict';
  const VV = (window.VV = window.VV || {});

  const FILES = {
    jszip: 'vendor/jszip/jszip.min.js',
    mammoth: 'vendor/mammoth/mammoth.browser.min.js',
    readability: 'vendor/readability/Readability.js',
    pdfjs: 'vendor/pdfjs/pdf.min.js',
    pdfjsWorker: 'vendor/pdfjs/pdf.worker.min.js'
  };
  const GLOBALS = {
    jszip: 'JSZip',
    mammoth: 'mammoth',
    readability: 'Readability',
    pdfjs: 'pdfjsLib'
  };

  const pending = Object.create(null);
  const injected = Object.create(null); // test hook
  let pdfjsConfigured = false;

  function urlFor(rel) {
    return new URL(rel, document.baseURI).href;
  }

  function loadScript(src, key) {
    if (pending[key]) return pending[key];
    pending[key] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Could not load ' + src));
      document.head.appendChild(s);
    });
    return pending[key];
  }

  function configurePdfjs(pdfjs) {
    if (pdfjsConfigured || !pdfjs.GlobalWorkerOptions) return;
    pdfjsConfigured = true;
    pdfjs.GlobalWorkerOptions.workerSrc = urlFor(FILES.pdfjsWorker);
  }

  VV.vendorLoader = {
    /* Returns the library's global (window.JSZip etc.), loading it first. */
    async load(name) {
      if (injected[name]) return injected[name];
      const globalName = GLOBALS[name];
      if (window[globalName]) return window[globalName];
      await loadScript(urlFor(FILES[name]), name);
      const lib = window[globalName];
      if (!lib) throw new Error('The ' + name + ' library failed to load.');
      if (name === 'pdfjs') configurePdfjs(lib);
      return lib;
    },

    /* Test hook: substitute a library without any network/script load. */
    _inject(name, obj) { injected[name] = obj; },
    _urlFor: urlFor
  };
})();
