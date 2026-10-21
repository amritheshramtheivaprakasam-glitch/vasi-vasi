/* ============================================================
   Vasi Vasi — dialogs
   Native <dialog> controllers: settings (with live preview),
   add-text form, confirm prompt, and help. All focus-trapping
   and Esc handling comes for free from the platform dialog.
   ============================================================ */
(function () {
  'use strict';
  const VV = (window.VV = window.VV || {});
  const $ = (id) => document.getElementById(id);

  const els = {};

  /* ---------- Settings ---------- */

  function syncSettingsForm(s) {
    document.querySelectorAll('input[name="theme"]').forEach((r) => {
      r.checked = r.value === s.theme;
    });
    els.fontScale.value = s.fontScale;
    els.fontScaleOut.textContent = Math.round(s.fontScale * 100) + '%';
    els.fontFamily.value = s.fontFamily;
    els.rate.value = s.rate;
    els.rateOut.textContent = Number(s.rate).toFixed(1) + '×';
    els.pitch.value = s.pitch;
    els.pitchOut.textContent = Number(s.pitch).toFixed(2).replace(/0$/, '');
    els.volume.value = s.volume;
    els.volumeOut.textContent = Math.round(s.volume * 100) + '%';
    els.resume.checked = !!s.resumeReading;
    VV.readerView.populateVoiceSelect(els.voice, s.voiceURI, true);
  }

  function bindSettings() {
    document.querySelectorAll('input[name="theme"]').forEach((r) => {
      r.addEventListener('change', () => VV.settingsStore.update({ theme: r.value }));
    });
    els.fontScale.addEventListener('input', () => {
      VV.settingsStore.update({ fontScale: parseFloat(els.fontScale.value) });
      els.fontScaleOut.textContent = Math.round(els.fontScale.value * 100) + '%';
    });
    els.fontFamily.addEventListener('change', () =>
      VV.settingsStore.update({ fontFamily: els.fontFamily.value }));
    els.rate.addEventListener('input', () => {
      VV.settingsStore.update({ rate: parseFloat(els.rate.value) });
      els.rateOut.textContent = Number(els.rate.value).toFixed(1) + '×';
    });
    els.pitch.addEventListener('input', () => {
      VV.settingsStore.update({ pitch: parseFloat(els.pitch.value) });
      els.pitchOut.textContent = Number(els.pitch.value).toFixed(2).replace(/0$/, '');
    });
    els.volume.addEventListener('input', () => {
      VV.settingsStore.update({ volume: parseFloat(els.volume.value) });
      els.volumeOut.textContent = Math.round(els.volume.value * 100) + '%';
    });
    els.voice.addEventListener('change', () =>
      VV.settingsStore.update({ voiceURI: els.voice.value || null }));
    els.resume.addEventListener('change', () =>
      VV.settingsStore.update({ resumeReading: els.resume.checked }));
    els.reset.addEventListener('click', () => {
      VV.settingsStore.reset();
      syncSettingsForm(VV.settingsStore.get());
      VV.announcer.polite('Settings restored to defaults.');
    });
  }

  /* ---------- Add text ---------- */

  function openAdd() {
    els.addError.hidden = true;
    els.addForm.reset();
    els.dlgAdd.showModal();
    setTimeout(() => els.addTitle.focus(), 50);
  }

  function bindAdd() {
    els.addCancel.addEventListener('click', () => els.dlgAdd.close());
    els.addForm.addEventListener('submit', (e) => {
      const title = els.addTitle.value.trim();
      const text = els.addText.value.trim();
      if (!title || !text) {
        e.preventDefault();
        els.addError.textContent = !title
          ? 'Please give this text a title.'
          : 'Please paste or type some text to read.';
        els.addError.hidden = false;
        return;
      }
      if (text.length > VV.config.LIMITS.maxDocumentChars) {
        e.preventDefault();
        els.addError.textContent = 'That text is too large. Try a smaller piece.';
        els.addError.hidden = false;
        return;
      }
      const mode = e.submitter && e.submitter.value === 'read' ? 'read' : 'save';
      VV.app.addDocument(title, text, 'paste', mode === 'read');
    });
  }

  /* ---------- URL import ---------- */

  function openUrl() {
    els.urlError.hidden = true;
    els.urlStatus.textContent = '';
    els.urlForm.reset();
    els.dlgUrl.showModal();
    setTimeout(() => els.urlInput.focus(), 50);
  }

  function bindUrl() {
    els.urlCancel.addEventListener('click', () => els.dlgUrl.close());
    els.urlForm.addEventListener('submit', async (e) => {
      e.preventDefault(); // keep the dialog open while we work
      const url = els.urlInput.value.trim();
      const submitter = els.urlForm.querySelector('button[type="submit"]');
      submitter.disabled = true;
      els.urlError.hidden = true;
      els.urlStatus.textContent = 'Fetching the page…';
      try {
        await VV.app.importUrl(url, (p) => {
          els.urlStatus.textContent =
            p && p.phase === 'extract' ? 'Extracting the article…' : 'Fetching the page…';
        });
        els.dlgUrl.close();
      } catch (err) {
        const msg = err && err.userMessage ? err.userMessage : 'That page could not be imported.';
        els.urlStatus.textContent = '';
        els.urlError.textContent = msg;
        els.urlError.hidden = false;
        VV.announcer.assertive(msg);
      } finally {
        submitter.disabled = false;
      }
    });
  }

  /* ---------- Confirm (promise-based) ---------- */

  function confirmDialog(options) {
    return new Promise((resolve) => {
      $('confirm-title').textContent = options.title || 'Are you sure?';
      $('confirm-message').textContent = options.message || '';
      $('confirm-ok').textContent = options.confirmLabel || 'Delete';
      const dlg = $('dlg-confirm');
      const onClose = () => {
        dlg.removeEventListener('close', onClose);
        resolve(dlg.returnValue === 'ok');
      };
      dlg.addEventListener('close', onClose);
      dlg.showModal();
    });
  }

  /* ---------- Public ---------- */

  VV.dialogs = {
    init() {
      Object.assign(els, {
        dlgSettings: $('dlg-settings'),
        fontScale: $('set-font-scale'),
        fontScaleOut: $('set-font-scale-out'),
        fontFamily: $('set-font-family'),
        voice: $('set-voice'),
        rate: $('set-rate'),
        rateOut: $('set-rate-out'),
        pitch: $('set-pitch'),
        pitchOut: $('set-pitch-out'),
        volume: $('set-volume'),
        volumeOut: $('set-volume-out'),
        resume: $('set-resume'),
        reset: $('btn-reset-settings'),
        dlgAdd: $('dlg-add'),
        addForm: $('add-form'),
        addTitle: $('add-title'),
        addText: $('add-text'),
        addError: $('add-error'),
        addCancel: $('btn-add-cancel'),
        dlgUrl: $('dlg-url'),
        urlForm: $('url-form'),
        urlInput: $('url-input'),
        urlStatus: $('url-status'),
        urlError: $('url-error'),
        urlCancel: $('btn-url-cancel'),
        dlgHelp: $('dlg-help')
      });

      $('btn-settings').addEventListener('click', () => {
        syncSettingsForm(VV.settingsStore.get());
        els.dlgSettings.showModal();
      });
      $('btn-help').addEventListener('click', () => els.dlgHelp.showModal());

      bindSettings();
      bindAdd();
      bindUrl();
    },

    openAdd,
    openUrl,
    openHelp() { els.dlgHelp.showModal(); },
    confirm: confirmDialog
  };
})();
