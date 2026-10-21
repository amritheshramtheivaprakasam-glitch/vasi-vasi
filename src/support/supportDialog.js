/* ============================================================
   Vasi Vasi — support dialog (optional contributions)
   Renders the voluntary support tiers and institutional
   contact info from VV.supportConfig. Strictly decoupled:
   nothing in core/, services/ or ui/ imports this module,
   and this module never touches reading state.

   Behaviour by configuration:
     • donationUrl set  → "Donate" opens it in a new tab
     • upiId set        → copy-to-clipboard UPI row is shown
     • contactEmail set → institutional mailto link is shown
     • nothing set      → honest "channels are being set up"
       message plus a link to the public repository
   ============================================================ */
(function () {
  'use strict';
  const VV = (window.VV = window.VV || {});

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function buildTiers(config) {
    const wrap = el('div', 'support-tiers');
    config.tiers.forEach((t) => {
      const card = el('div', 'support-tier');
      card.appendChild(el('strong', 'support-amount', '₹' + t.amount));
      card.appendChild(el('span', 'support-what', t.what));
      wrap.appendChild(card);
    });
    const custom = el('div', 'support-tier');
    custom.appendChild(el('strong', 'support-amount', 'Custom'));
    custom.appendChild(el('span', 'support-what', 'Contribute any amount you can.'));
    wrap.appendChild(custom);
    return wrap;
  }

  function buildActions(config, statusEl) {
    const actions = el('menu', 'dialog-actions');
    let hasChannel = false;

    if (config.donationUrl) {
      hasChannel = true;
      const a = el('a', 'btn btn-primary', '♥ Donate securely');
      a.href = config.donationUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      actions.appendChild(a);
    }

    if (config.upiId) {
      hasChannel = true;
      const row = el('div', 'copy-row');
      const code = el('code', null, config.upiId);
      const btn = el('button', 'btn btn-secondary', 'Copy UPI id');
      btn.type = 'button';
      btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(config.upiId);
          statusEl.textContent = 'UPI id copied to clipboard.';
        } catch (e) {
          statusEl.textContent = 'Copy manually: ' + config.upiId;
        }
      });
      row.appendChild(code);
      row.appendChild(btn);
      actions.appendChild(row);
    }

    if (!hasChannel) {
      const a = el('a', 'btn btn-secondary', 'Visit the project repository');
      a.href = config.repoUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      actions.appendChild(a);
    }

    const close = el('button', 'btn btn-ghost', 'Close');
    close.type = 'submit';
    close.value = 'close';
    actions.appendChild(close);
    return actions;
  }

  VV.supportDialog = {
    init() {
      const dlg = document.getElementById('dlg-support');
      const btn = document.getElementById('btn-support');
      const body = dlg.querySelector('.dialog-body-dynamic');
      const config = VV.supportConfig;
      const statusEl = document.getElementById('support-status');

      // Tiers — always informational, never a paywall.
      body.appendChild(el('p', null,
        'Vasi Vasi is free to use, forever, with every reading feature included. ' +
        'Contributions are voluntary and fund maintenance, accessibility testing ' +
        'and language support — they never unlock or block functionality.'));
      body.appendChild(buildTiers(config));

      const hasChannel = config.donationUrl || config.upiId;
      if (!hasChannel) {
        body.appendChild(el('p', 'hint',
          'Contribution channels are being set up. Until then, the most valuable ' +
          'support is sharing Vasi Vasi with someone who needs it.'));
      }

      // Institutional / organizational services block.
      const inst = el('div', 'support-inst');
      inst.appendChild(el('h3', null, 'For organizations'));
      inst.appendChild(el('p', null,
        'Schools, libraries, NGOs and disability organizations can request paid ' +
        'deployment, staff training, accessibility configuration and sponsored ' +
        'installations for their readers.'));
      if (config.contactEmail) {
        const mail = el('a', null, 'Contact: ' + config.contactEmail);
        mail.href = 'mailto:' + config.contactEmail +
          '?subject=' + encodeURIComponent('Vasi Vasi institutional deployment');
        inst.appendChild(mail);
      }
      body.appendChild(inst);

      body.appendChild(buildActions(config, statusEl));

      btn.addEventListener('click', () => {
        statusEl.textContent = '';
        dlg.showModal();
      });
    }
  };
})();
