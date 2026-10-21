/* ============================================================
   Vasi Vasi — support configuration
   Everything about voluntary contributions and institutional
   contact lives HERE and nowhere else. The reading core never
   imports this file: if every value below stays empty, the app
   works identically and completely.

   To activate a support channel, fill in the values and save:

     donationUrl   e.g. a Buy Me a Coffee / GitHub Sponsors page
     upiId         Indian UPI id for direct contributions
     contactEmail  for institutional deployment enquiries

   No payment SDK is ever bundled. Links open in a new tab.
   ============================================================ */
(function () {
  'use strict';
  const VV = (window.VV = window.VV || {});

  VV.supportConfig = {
    donationUrl: '',
    upiId: '',
    contactEmail: '',
    repoUrl: 'https://github.com/amritheshramtheivaprakasam-glitch/vasi-vasi',
    tiers: [
      { amount: 29, what: 'Help cover maintenance of the free reader.' },
      { amount: 99, what: 'Help fund accessibility testing on real devices.' },
      { amount: 299, what: 'Support development and new language features.' }
    ]
  };
})();
