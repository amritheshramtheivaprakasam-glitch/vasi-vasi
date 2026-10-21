/* ============================================================
   Vasi Vasi — library view
   Renders the document list with metadata and progress,
   handles Add / Import / Read / Delete actions.
   ============================================================ */
(function () {
  'use strict';
  const VV = (window.VV = window.VV || {});
  const $ = (id) => document.getElementById(id);
  const { estimateMinutes, langLabel, truncate } = VV.util;

  let listEl, emptyEl, fileInput;

  function docCard(doc) {
    const li = document.createElement('li');
    li.className = 'doc-card';

    const main = document.createElement('div');
    main.className = 'doc-main';

    const title = document.createElement('h2');
    title.className = 'doc-title';
    title.textContent = doc.title;
    main.appendChild(title);

    const meta = document.createElement('p');
    meta.className = 'doc-meta';

    const lang = document.createElement('span');
    lang.className = 'chip';
    lang.textContent = langLabel(doc.lang);
    meta.appendChild(lang);

    if (doc.meta && doc.meta.format && doc.meta.format !== 'text') {
      const fmt = document.createElement('span');
      fmt.className = 'chip';
      fmt.textContent = doc.meta.format.toUpperCase();
      meta.appendChild(fmt);
    }

    const info = document.createElement('span');
    const rate = VV.settingsStore.get().rate;
    const pageInfo = doc.meta && doc.meta.pageCount ? ` · ${doc.meta.pageCount} pages` : '';
    const chapterInfo = doc.meta && doc.meta.chapters ? ` · ${doc.meta.chapters} chapters` : '';
    info.textContent =
      `${doc.stats.sentences} sentences${pageInfo}${chapterInfo} · about ${estimateMinutes(doc.stats.words, rate)} min`;
    meta.appendChild(info);

    if (doc.meta && doc.meta.warnings && doc.meta.warnings.length) {
      const warn = document.createElement('span');
      warn.className = 'chip chip-warning';
      warn.textContent = `⚠ ${doc.meta.warnings.length} notice${doc.meta.warnings.length > 1 ? 's' : ''}`;
      warn.title = doc.meta.warnings.join('\n');
      meta.appendChild(warn);
    }

    const percent = VV.libraryStore.progressPercent(doc);
    if (percent > 0) {
      const chip = document.createElement('span');
      chip.className = 'chip chip-progress';
      chip.textContent = percent >= 97 ? 'Finished ✓' : `Read ${percent}%`;
      meta.appendChild(chip);
    }
    main.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'doc-actions';

    const readBtn = document.createElement('button');
    readBtn.type = 'button';
    readBtn.className = 'btn btn-primary';
    readBtn.textContent = '▶ Read';
    readBtn.setAttribute('aria-label', `Read "${truncate(doc.title, 60)}" aloud`);
    readBtn.addEventListener('click', () => VV.app.openDocument(doc.id));

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn-ghost';
    delBtn.textContent = 'Delete';
    delBtn.setAttribute('aria-label', `Delete "${truncate(doc.title, 60)}"`);
    delBtn.addEventListener('click', async () => {
      const ok = await VV.dialogs.confirm({
        title: 'Delete this text?',
        message: `"${truncate(doc.title, 80)}" will be permanently removed from your library.`,
        confirmLabel: 'Delete'
      });
      if (ok) {
        VV.libraryStore.remove(doc.id);
        VV.announcer.polite(`Deleted "${truncate(doc.title, 40)}".`);
      }
    });

    actions.appendChild(readBtn);
    actions.appendChild(delBtn);

    li.appendChild(main);
    li.appendChild(actions);
    return li;
  }

  function render() {
    const docs = VV.libraryStore.all();
    listEl.textContent = '';
    docs.forEach((d) => listEl.appendChild(docCard(d)));
    emptyEl.hidden = docs.length > 0;
  }

  function setBusy(busy) {
    ['btn-import-file', 'btn-import-url', 'btn-add-text'].forEach((id) => {
      $(id).disabled = busy;
    });
  }

  /* Every file import flows through the import manager: byte-signature
     routing → format adapter → quality gate. Rejected text never enters
     the library and never reaches the speech engine. */
  async function importFile(file) {
    if (!file) return;
    setBusy(true);
    VV.app.setImportStatus(`Importing “${truncate(file.name || 'file', 60)}”…`);
    try {
      const result = await VV.documentImport.importFile(file, {
        onProgress: (p) => {
          if (p && p.total) {
            VV.app.setImportStatus(`Extracting page ${p.page} of ${p.total}…`);
          }
        }
      });
      const doc = VV.app.addDocument(result.title, result.text, 'file', true, {
        format: result.format,
        pageCount: result.meta.pageCount,
        chapters: result.meta.chapters,
        warnings: result.warnings
      });
      VV.app.setImportStatus('');
      VV.announcer.polite(`Imported "${truncate(doc.title, 40)}" (${result.format.toUpperCase()}). ` +
        (result.warnings.length ? result.warnings.join(' ') : 'Ready to read.'));
    } catch (err) {
      const msg = err && err.userMessage ? err.userMessage : 'That file could not be imported.';
      VV.app.setImportStatus('');
      VV.announcer.assertive(msg);
    } finally {
      setBusy(false);
    }
  }

  VV.libraryView = {
    init() {
      listEl = $('doc-list');
      emptyEl = $('library-empty');
      fileInput = $('file-input');

      $('btn-add-text').addEventListener('click', () => VV.dialogs.openAdd());
      $('btn-import-file').addEventListener('click', () => fileInput.click());
      $('btn-import-url').addEventListener('click', () => VV.dialogs.openUrl());
      fileInput.addEventListener('change', () => {
        importFile(fileInput.files && fileInput.files[0]);
        fileInput.value = ''; // allow re-importing the same file
      });

      VV.libraryStore.onChange(render);
      render();
    },
    render
  };
})();
