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

    const info = document.createElement('span');
    const rate = VV.settingsStore.get().rate;
    info.textContent =
      `${doc.stats.sentences} sentences · about ${estimateMinutes(doc.stats.words, rate)} min`;
    meta.appendChild(info);

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

  function importFile(file) {
    if (!file) return;
    if (file.size > VV.config.LIMITS.importMaxChars) {
      VV.announcer.assertive('That file is too large. Please choose a smaller text file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '').trim();
      if (!text) {
        VV.announcer.assertive('That file looks empty.');
        return;
      }
      const title = file.name.replace(/\.(txt|md|text)$/i, '').trim() || file.name;
      const doc = VV.app.addDocument(title, text, 'file', true);
      VV.announcer.polite(`Imported "${truncate(doc.title, 40)}" and started reading view.`);
    };
    reader.onerror = () => VV.announcer.assertive('Could not read that file.');
    reader.readAsText(file);
  }

  VV.libraryView = {
    init() {
      listEl = $('doc-list');
      emptyEl = $('library-empty');
      fileInput = $('file-input');

      $('btn-add-text').addEventListener('click', () => VV.dialogs.openAdd());
      $('btn-import-file').addEventListener('click', () => fileInput.click());
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
