/* ==========================================================================
   BloodNet Bangladesh — prototype application logic
   Vanilla JS. Views are sections in the document; a hash router shows one at
   a time so the browser back button works across the whole journey.
   ========================================================================== */

(function () {
  'use strict';

  var D = BloodNet;
  var GROUPS = D.bloodGroups;
  var TODAY = parseISO(D.meta.today);

  /* ---------- small helpers ------------------------------------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function parseISO(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function icon(name, cls) {
    return '<svg class="ico ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDate(v) {
    var d = typeof v === 'string' ? parseISO(v) : v;
    return String(d.getDate()).padStart(2, '0') + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  }
  function addMonths(d, n) {
    var r = new Date(d.getTime());
    var day = r.getDate();
    r.setMonth(r.getMonth() + n);
    if (r.getDate() < day) r.setDate(0); // clamp end-of-month overflow
    return r;
  }
  function dayDiff(a, b) { return Math.round((a - b) / 86400000); }
  function relative(v) {
    var n = dayDiff(typeof v === 'string' ? parseISO(v) : v, TODAY);
    if (n === 0) return 'today';
    if (n === 1) return 'tomorrow';
    if (n === -1) return 'yesterday';
    return n > 0 ? 'in ' + n + ' days' : n * -1 + ' days ago';
  }

  /* ---------- derived business rules ----------------------------------- */
  /* Availability is computed, never stored — the proposed three-month
     cooldown from the last recorded donation. */
  function availability(donor) {
    if (!donor.lastDonation) return { available: true, next: null };
    var next = addMonths(parseISO(donor.lastDonation), D.meta.cooldownMonths);
    return { available: next <= TODAY, next: next };
  }
  function stockStatus(units) {
    if (units === 0) return { key: 'out', label: 'OUT' };
    if (units <= D.meta.stockLow) return { key: 'low', label: 'LOW' };
    return { key: 'instock', label: 'IN STOCK' };
  }

  /* ---------- state ----------------------------------------------------- */
  var nextRequestNo = 143, nextDonorNo = 1059;

  var state = {
    donors: D.donors.slice(),
    requests: D.requests.slice(),
    home: { district: 'Chattogram', upazila: 'Boalkhali', area: 'Kadurkhil', group: 'O+' },
    donorFilter: { q: '', district: 'Chattogram', upazila: 'Boalkhali', area: 'All', group: 'All', avail: 'All' },
    stockFilter: { q: '', district: 'Chattogram', group: 'All', status: 'All' },
    lastFocus: null
  };

  /* ==========================================================================
     Location selects
     ========================================================================== */
  function fillSelect(sel, values, allLabel, selected) {
    var html = allLabel ? '<option value="All">' + esc(allLabel) + '</option>' : '';
    values.forEach(function (v) { html += '<option value="' + esc(v) + '">' + esc(v) + '</option>'; });
    sel.innerHTML = html;
    if (selected && (values.indexOf(selected) > -1 || selected === 'All')) sel.value = selected;
  }

  /* Wires a District -> Upazila -> Area chain. `allLabels` is null for the
     required chains (the home search) and a label set everywhere a blank or
     "all" option is needed. The returned `apply()` sets the whole chain at
     once without firing onChange, so callers can restore saved filters
     without the intermediate states leaking back into app state. */
  function wireCascade(dSel, uSel, aSel, allLabels, onChange, initial) {
    var silent = false;

    function paintUpazilas(pick) {
      var d = dSel.value;
      var ups = (d !== 'All' && D.locations[d]) ? Object.keys(D.locations[d]) : [];
      fillSelect(uSel, ups, allLabels && allLabels[1], pick);
      uSel.disabled = ups.length === 0;
    }
    function paintAreas(pick) {
      var d = dSel.value, u = uSel.value;
      var areas = (d !== 'All' && u !== 'All' && D.locations[d] && D.locations[d][u]) ? D.locations[d][u] : [];
      fillSelect(aSel, areas, allLabels && allLabels[2], pick);
      aSel.disabled = areas.length === 0;
    }
    function fire() { if (!silent && onChange) onChange(); }

    function apply(v) {
      silent = true;
      if (v.district) dSel.value = v.district;
      paintUpazilas(v.upazila);
      paintAreas(v.area);
      silent = false;
    }

    fillSelect(dSel, Object.keys(D.locations), allLabels && allLabels[0]);
    apply(initial || {});

    dSel.addEventListener('change', function () { paintUpazilas(); paintAreas(); fire(); });
    uSel.addEventListener('change', function () { paintAreas(); fire(); });
    aSel.addEventListener('change', fire);

    return { apply: apply };
  }

  /* ==========================================================================
     Router
     ========================================================================== */
  var ROUTES = ['home', 'donors', 'hospitals', 'emergency', 'register', 'contact'];

  function route() {
    var hash = location.hash.replace(/^#\/?/, '');
    var parts = hash.split('/');
    var view = parts[0] || 'home';

    if (view === 'donor' && parts[1]) {
      showView('donors');
      openDonor(parts[1]);
      return;
    }
    if (ROUTES.indexOf(view) === -1) view = 'home';
    closeModal(true);
    showView(view);
  }

  function showView(name) {
    $$('.view').forEach(function (v) { v.classList.toggle('is-active', v.dataset.view === name); });
    $$('.nav__link').forEach(function (a) {
      var match = a.getAttribute('href') === '#/' + name;
      if (match) { a.setAttribute('aria-current', 'page'); } else { a.removeAttribute('aria-current'); }
    });
    document.title = ({
      home: 'BloodNet Bangladesh — Every Drop. Connected.',
      donors: 'Donor directory — BloodNet Bangladesh',
      hospitals: 'Hospital blood banks — BloodNet Bangladesh',
      emergency: 'Emergency requests — BloodNet Bangladesh',
      register: 'Register as a donor — BloodNet Bangladesh',
      contact: 'Contact us — BloodNet Bangladesh'
    })[name];
    closeNav();
    if (state.ready) window.scrollTo(0, 0);
    state.ready = true;
  }

  function go(view) { location.hash = '#/' + view; }

  /* ==========================================================================
     Header navigation
     ========================================================================== */
  function closeNav() {
    var nav = $('#primary-nav');
    nav.classList.remove('is-open');
    $('#nav-toggle').setAttribute('aria-expanded', 'false');
  }
  function initNav() {
    var toggle = $('#nav-toggle'), nav = $('#primary-nav');
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.innerHTML = open ? icon('close') : icon('menu');
    });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) closeNav(); });
    window.addEventListener('resize', function () { if (window.innerWidth > 920) closeNav(); });
  }

  /* ==========================================================================
     Blood-group chip groups
     ========================================================================== */
  function buildChips(container, name, selected) {
    container.innerHTML = GROUPS.map(function (g, i) {
      return '<label class="chip"><input type="radio" name="' + name + '" value="' + esc(g) + '"' +
        (g === selected ? ' checked' : '') + '><span>' + esc(g) + '</span></label>';
    }).join('');
  }
  function chipValue(container) {
    var c = $('input:checked', container);
    return c ? c.value : null;
  }

  /* mirrors :checked onto the label for browsers without :has() */
  function syncChips(container) {
    $$('.chip', container).forEach(function (l) { l.classList.toggle('is-on', $('input', l).checked); });
  }

  /* ==========================================================================
     HOME — search console
     ========================================================================== */
  function initHome() {
    var d = $('#home-district'), u = $('#home-upazila'), a = $('#home-area');
    var chips = $('#home-groups');
    buildChips(chips, 'home-group', state.home.group);
    syncChips(chips);
    wireCascade(d, u, a, null, updateHomeCount, state.home);
    chips.addEventListener('change', function () { syncChips(chips); updateHomeCount(); });

    $('#home-search-form').addEventListener('submit', function (e) {
      e.preventDefault();
      state.home = { district: d.value, upazila: u.value, area: a.value, group: chipValue(chips) };
      state.donorFilter = {
        q: '', district: state.home.district, upazila: state.home.upazila,
        area: state.home.area, group: state.home.group, avail: 'All'
      };
      syncDonorFilterUI();
      go('donors');
      renderDonors();
    });

    updateHomeCount();
  }

  function homeMatches() {
    var d = $('#home-district').value, u = $('#home-upazila').value, a = $('#home-area').value;
    var g = chipValue($('#home-groups'));
    return state.donors.filter(function (x) {
      return x.district === d && x.upazila === u && x.area === a && x.group === g;
    });
  }

  function updateHomeCount() {
    var all = homeMatches();
    var free = all.filter(function (x) { return availability(x).available; });
    var el = $('#home-count');
    if (!all.length) {
      el.innerHTML = 'No sample donor matches this exact area and group yet — the results page will widen the search.';
    } else {
      el.innerHTML = '<b>' + all.length + '</b> matching donor' + (all.length > 1 ? 's' : '') +
        ' in this area · <b>' + free.length + '</b> available now';
    }
  }

  /* ==========================================================================
     DONOR DIRECTORY
     ========================================================================== */
  function initDonors() {
    var d = $('#f-district'), u = $('#f-upazila'), a = $('#f-area');
    state.donorCascade = wireCascade(d, u, a, ['All districts', 'All upazilas', 'All areas'], function () {
      state.donorFilter.district = d.value;
      state.donorFilter.upazila = u.value;
      state.donorFilter.area = a.value;
      renderDonors();
    }, state.donorFilter);

    fillSelect($('#f-group'), GROUPS, 'All groups', state.donorFilter.group);
    $('#f-group').addEventListener('change', function () { state.donorFilter.group = this.value; renderDonors(); });
    $('#f-avail').addEventListener('change', function () { state.donorFilter.avail = this.value; renderDonors(); });
    $('#f-q').addEventListener('input', function () { state.donorFilter.q = this.value; renderDonors(); });

    $('#f-reset').addEventListener('click', function () {
      state.donorFilter = { q: '', district: 'All', upazila: 'All', area: 'All', group: 'All', avail: 'All' };
      syncDonorFilterUI();
      renderDonors();
    });

    $('#donor-list').addEventListener('click', function (e) {
      var row = e.target.closest('.donor-row');
      if (row) location.hash = '#/donor/' + row.dataset.id;
    });

    renderDonors();
  }

  function syncDonorFilterUI() {
    var f = state.donorFilter;
    $('#f-q').value = f.q;
    state.donorCascade.apply(f);
    $('#f-group').value = f.group;
    $('#f-avail').value = f.avail;
  }

  function filteredDonors() {
    var f = state.donorFilter;
    var q = f.q.trim().toLowerCase();
    return state.donors.filter(function (x) {
      if (f.district !== 'All' && x.district !== f.district) return false;
      if (f.upazila !== 'All' && x.upazila !== f.upazila) return false;
      if (f.area !== 'All' && x.area !== f.area) return false;
      if (f.group !== 'All' && x.group !== f.group) return false;
      if (f.avail !== 'All') {
        var ok = availability(x).available;
        if (f.avail === 'Available' && !ok) return false;
        if (f.avail === 'Unavailable' && ok) return false;
      }
      if (q && (x.name + ' ' + x.area + ' ' + x.upazila).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
  }

  function donorRow(x) {
    var av = availability(x);
    return '<button type="button" class="donor-row" data-id="' + x.id + '" ' +
      'aria-label="Open profile for ' + esc(x.name) + '">' +
      '<span class="bg-mark">' + icon('drop') + '<span>' + esc(x.group) + '</span></span>' +
      '<span><span class="donor-row__name">' + esc(x.name) + '</span>' +
      '<span class="donor-row__sub">' + icon('id', 'ico--sm') + esc(x.id) + '</span></span>' +
      '<span class="donor-row__loc">' + icon('pin', 'ico--sm') + '<span>' + esc(x.area) + ', ' + esc(x.upazila) + '</span></span>' +
      '<span class="badge badge--' + (av.available ? 'available">AVAILABLE' : 'unavailable">UNAVAILABLE') + '</span>' +
      '<span class="donor-row__meta">' + (!x.lastDonation ? 'first-time donor'
        : av.available ? 'last ' + fmtDate(x.lastDonation)
          : 'free ' + fmtDate(av.next)) + '</span>' +
      '<span class="donor-row__go">' + icon('chevron-right') + '</span>' +
      '</button>';
  }

  function renderDonors() {
    var list = filteredDonors();
    var el = $('#donor-list');
    var f = state.donorFilter;

    $('#donor-count').innerHTML = '<b>' + list.length + '</b> of ' + state.donors.length + ' sample donor records';

    if (!list.length) {
      var scopeMiss = f.district !== 'All' && f.district !== 'Chattogram';
      el.innerHTML = '<div class="empty">' +
        '<div class="empty__mark">' + icon('search') + '</div>' +
        '<h3>No donors match these filters</h3>' +
        '<p>' + (scopeMiss
          ? 'The Segment 1 sample set only contains donor records for Chattogram district. Other districts are listed to show how the location filter will work once real data is loaded.'
          : 'Try widening the area or removing the blood-group filter. Nearby upazilas often have compatible donors.') + '</p>' +
        '<div class="empty__actions">' +
        '<button type="button" class="btn btn--outline btn--sm" data-act="widen">Search the whole district</button>' +
        '<button type="button" class="btn btn--outline btn--sm" data-act="clear">Clear all filters</button>' +
        '</div></div>';
      $('[data-act="widen"]', el).addEventListener('click', function () {
        state.donorFilter.district = 'Chattogram';
        state.donorFilter.upazila = 'All';
        state.donorFilter.area = 'All';
        syncDonorFilterUI(); renderDonors();
      });
      $('[data-act="clear"]', el).addEventListener('click', function () { $('#f-reset').click(); });
      return;
    }

    /* available donors first — the useful order under time pressure */
    list.sort(function (a, b) { return (availability(b).available ? 1 : 0) - (availability(a).available ? 1 : 0); });
    el.innerHTML = list.map(donorRow).join('');
  }

  /* ==========================================================================
     DONOR PROFILE modal
     ========================================================================== */
  var modal = null, revealed = false;

  function openDonor(id) {
    var x = state.donors.filter(function (d) { return d.id === id; })[0];
    if (!x) { go('donors'); return; }
    var av = availability(x);
    revealed = false;

    $('#modal-group').innerHTML = icon('drop') + '<span>' + esc(x.group) + '</span>';
    $('#modal-name').textContent = x.name;
    $('#modal-loc').innerHTML = icon('pin', 'ico--sm') + esc(x.area + ', ' + x.upazila + ', ' + x.district);
    $('#modal-status').className = 'badge badge--' + (av.available ? 'available' : 'unavailable');
    $('#modal-status').textContent = av.available ? 'AVAILABLE' : 'UNAVAILABLE';

    $('#modal-body').innerHTML =
      '<dl class="dl">' +
      field('Mobile number', x.mobile, true) +
      field('Email address', x.email, true) +
      field('Emergency contact', x.emergency, true) +
      field('Donor ID', x.id, false) +
      field('Last donation date', x.lastDonation ? fmtDate(x.lastDonation) : 'No donation recorded', false) +
      field('Next possible availability', av.next ? fmtDate(av.next) : 'Available now', false) +
      '</dl>' +
      '<div class="consent" id="consent-note">' +
      (av.available
        ? '<b>Availability</b> is calculated from the last donation date using the proposed three-month cooldown. This is project logic, not medical clearance — final eligibility must be confirmed by qualified healthcare staff.'
        : '<b>This donor is inside the cooldown period</b> until ' + fmtDate(av.next) + '. Contact details stay hidden until then so recipients do not lose time on unavailable donors.') +
      '</div>';

    var cta = $('#modal-cta');
    cta.disabled = !av.available;
    cta.textContent = av.available ? 'Contact donor' : 'Unavailable until ' + fmtDate(av.next);
    cta.onclick = function () { revealContact(x); };

    state.lastFocus = document.activeElement;
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    $('#modal-close').focus();
  }

  function field(label, value, masked) {
    return '<div><dt>' + esc(label) + '</dt><dd' + (masked ? ' class="is-masked"' : '') + '>' +
      (masked ? icon('lock', 'ico--sm') : '') + esc(value) + '</dd></div>';
  }

  function revealContact(x) {
    if (revealed) { toast('Sample contact details only — no real donor is reachable.'); return; }
    revealed = true;
    $$('#modal-body .dl dd.is-masked').forEach(function (dd) {
      dd.classList.remove('is-masked');
      var t = dd.textContent.trim();
      dd.innerHTML = esc(t);
    });
    $('#consent-note').innerHTML =
      '<b>Contact details released for this session.</b> In the live system this step would check that the viewer is signed in and that the donor has consented to sharing, and the release would be logged. The values shown here are fictional placeholders.';
    $('#modal-cta').textContent = 'Call ' + x.mobile;
    toast('Contact details shown — sample data only.');
  }

  function closeModal(silent) {
    if (!modal || !modal.classList.contains('is-open')) return;
    modal.classList.remove('is-open');
    document.body.style.overflow = '';
    if (state.lastFocus && state.lastFocus.isConnected) state.lastFocus.focus();
    if (!silent && location.hash.indexOf('#/donor/') === 0) location.hash = '#/donors';
  }

  function initModal() {
    modal = $('#donor-modal');
    $('#modal-close').addEventListener('click', function () { closeModal(); });
    $('.modal__backdrop', modal).addEventListener('click', function () { closeModal(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
      if (e.key !== 'Tab' || !modal.classList.contains('is-open')) return;
      var f = $$('button:not([disabled]), a[href]', modal);
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* ==========================================================================
     HOSPITAL BLOOD BANK
     ========================================================================== */
  function initHospitals() {
    fillSelect($('#h-district'), Object.keys(D.locations), 'All districts', 'Chattogram');
    fillSelect($('#h-group'), GROUPS, 'All groups', 'All');
    ['#h-district', '#h-group', '#h-status'].forEach(function (s) {
      $(s).addEventListener('change', function () {
        state.stockFilter.district = $('#h-district').value;
        state.stockFilter.group = $('#h-group').value;
        state.stockFilter.status = $('#h-status').value;
        renderStock();
      });
    });
    $('#h-q').addEventListener('input', function () { state.stockFilter.q = this.value; renderStock(); });
    $('#h-reset').addEventListener('click', function () {
      state.stockFilter = { q: '', district: 'All', group: 'All', status: 'All' };
      $('#h-q').value = ''; $('#h-district').value = 'All'; $('#h-group').value = 'All'; $('#h-status').value = 'All';
      renderStock();
    });

    $('#stock-body').addEventListener('click', function (e) {
      var row = e.target.closest('.stock-row');
      if (row) openHospital(row.dataset.id);
    });
    $('#stock-cards').addEventListener('click', function (e) {
      var row = e.target.closest('.stock-row');
      if (row) openHospital(row.dataset.id);
    });

    renderStock();
  }

  function stockRows() {
    var f = state.stockFilter, q = f.q.trim().toLowerCase();
    var rows = [];
    D.hospitals.forEach(function (h) {
      if (f.district !== 'All' && h.district !== f.district) return;
      if (q && (h.name + ' ' + h.area).toLowerCase().indexOf(q) === -1) return;
      GROUPS.forEach(function (g, i) {
        if (f.group !== 'All' && g !== f.group) return;
        var st = stockStatus(h.units[i]);
        if (f.status !== 'All' && st.key !== f.status) return;
        rows.push({ hospital: h, group: g, units: h.units[i], status: st });
      });
    });
    return rows;
  }

  var lastStockGroups = {};

  function groupedStockRows() {
    var rows = stockRows();
    var order = [], byId = {};
    rows.forEach(function (r) {
      if (!byId[r.hospital.id]) {
        byId[r.hospital.id] = { hospital: r.hospital, entries: [] };
        order.push(r.hospital.id);
      }
      byId[r.hospital.id].entries.push(r);
    });
    return order.map(function (id) { return byId[id]; });
  }

  function hospitalOverallStatus(entries) {
    if (entries.every(function (e) { return e.status.key === 'out'; })) return { key: 'out', label: 'OUT' };
    var hasLow = entries.some(function (e) { return e.status.key === 'low' || e.status.key === 'out'; });
    return hasLow ? { key: 'low', label: 'LOW' } : { key: 'instock', label: 'IN STOCK' };
  }

  function renderStock() {
    var groups = groupedStockRows();
    lastStockGroups = {};
    groups.forEach(function (g) { lastStockGroups[g.hospital.id] = g; });

    $('#stock-count').innerHTML = '<b>' + groups.length + '</b> hospital' + (groups.length === 1 ? '' : 's') +
      ' matching these filters';

    var tbody = $('#stock-body'), cards = $('#stock-cards');

    if (!groups.length) {
      var html = '<div class="empty">' +
        '<div class="empty__mark">' + icon('hospital') + '</div>' +
        '<h3>No stock records match</h3>' +
        '<p>The Segment 1 sample set covers five fictional Chattogram facilities. Clear a filter to see them again.</p>' +
        '<div class="empty__actions"><button type="button" class="btn btn--outline btn--sm" id="stock-empty-reset">Clear filters</button></div></div>';
      $('#stock-empty').innerHTML = html;
      $('#stock-empty').hidden = false;
      $('#stock-table-wrap').hidden = true;
      cards.hidden = true;
      $('#stock-empty-reset').addEventListener('click', function () { $('#h-reset').click(); });
      return;
    }
    $('#stock-empty').hidden = true;
    $('#stock-table-wrap').hidden = false;
    cards.hidden = false;

    tbody.innerHTML = groups.map(function (g) {
      var st = hospitalOverallStatus(g.entries);
      var total = g.entries.reduce(function (sum, e) { return sum + e.units; }, 0);
      return '<tr class="stock-row" data-id="' + g.hospital.id + '" tabindex="0">' +
        '<td class="cell-hospital">' + esc(g.hospital.name) + '</td>' +
        '<td>' + esc(g.hospital.area) + '</td>' +
        '<td class="cell-mono">' + g.entries.length + '</td>' +
        '<td class="cell-mono">' + total + '</td>' +
        '<td><span class="badge badge--' + st.key + '">' + st.label + '</span></td>' +
        '<td><span class="verified"><span class="verified__date">' + fmtDate(g.hospital.verified) + '</span>' +
        '<span class="verified__ago">' + relative(g.hospital.verified) + '</span></span></td>' +
        '</tr>';
    }).join('');

    cards.innerHTML = groups.map(function (g) {
      var st = hospitalOverallStatus(g.entries);
      var total = g.entries.reduce(function (sum, e) { return sum + e.units; }, 0);
      return '<article class="stock-card stock-row" data-id="' + g.hospital.id + '" tabindex="0">' +
        '<div class="stock-card__top"><div><div class="stock-card__name">' + esc(g.hospital.name) + '</div>' +
        '<div class="stock-card__area">' + icon('pin', 'ico--sm') + ' ' + esc(g.hospital.area) + '</div></div>' +
        '<span class="badge badge--' + st.key + '">' + st.label + '</span></div>' +
        '<dl class="stock-card__grid">' +
        '<div><dt>GROUPS</dt><dd class="cell-mono">' + g.entries.length + '</dd></div>' +
        '<div><dt>TOTAL UNITS</dt><dd class="cell-mono">' + total + '</dd></div>' +
        '<div><dt>LAST VERIFIED</dt><dd class="cell-mono">' + fmtDate(g.hospital.verified) + '</dd></div>' +
        '<div><dt>FRESHNESS</dt><dd>' + relative(g.hospital.verified) + '</dd></div>' +
        '</dl></article>';
    }).join('');
  }

  var hospitalModal = null, hospitalLastFocus = null;

  function openHospital(id) {
    var g = lastStockGroups[id];
    if (!g) return;
    var h = g.hospital;

    $('#hmodal-name').textContent = h.name;
    $('#hmodal-loc').innerHTML = icon('pin', 'ico--sm') + esc(h.area + ', ' + h.district);
    $('#hmodal-verified').innerHTML = 'Verified ' + fmtDate(h.verified) + ' · ' + relative(h.verified);

    $('#hmodal-body').innerHTML = g.entries.map(function (e) {
      return '<div class="hstock-row">' +
        '<span class="bg-mark">' + icon('drop') + '<span>' + esc(e.group) + '</span></span>' +
        '<span class="units"><span class="units__num">' + e.units + '</span>' +
        '<span class="units__bar"><span class="units__fill ' + (e.status.key === 'low' ? 'is-low' : e.status.key === 'out' ? 'is-out' : '') +
        '" style="width:' + Math.max(e.units ? 6 : 0, Math.round(e.units / 14 * 100)) + '%"></span></span></span>' +
        '<span class="badge badge--' + e.status.key + '">' + e.status.label + '</span>' +
        '</div>';
    }).join('');

    hospitalLastFocus = document.activeElement;
    hospitalModal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
    $('#hmodal-close').focus();
  }

  function closeHospitalModal() {
    if (!hospitalModal || !hospitalModal.classList.contains('is-open')) return;
    hospitalModal.classList.remove('is-open');
    document.body.style.overflow = '';
    if (hospitalLastFocus && hospitalLastFocus.isConnected) hospitalLastFocus.focus();
  }

  function initHospitalModal() {
    hospitalModal = $('#hospital-modal');
    $('#hmodal-close').addEventListener('click', closeHospitalModal);
    $('.modal__backdrop', hospitalModal).addEventListener('click', closeHospitalModal);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeHospitalModal();
    });
  }

  /* ==========================================================================
     EMERGENCY REQUESTS
     ========================================================================== */
  function urgencyMeta(u) {
    if (u === 'Critical') return { cls: 'critical', label: 'CRITICAL' };
    if (u === 'Urgent') return { cls: 'urgent', label: 'URGENT' };
    return { cls: 'active', label: 'ACTIVE' };
  }

  function requestCard(r, isNew) {
    var m = urgencyMeta(r.urgency);
    return '<article class="req req--' + m.cls + (isNew ? ' req__new' : '') + '">' +
      '<div class="req__top"><div class="req__group">' +
      '<span class="bg-mark">' + icon('drop') + '<span>' + esc(r.group) + '</span></span>' +
      '<span class="req__units">' + r.units + ' unit' + (r.units > 1 ? 's' : '') +
      '<small>' + esc(r.id) + '</small></span></div>' +
      '<span class="badge badge--' + m.cls + '">' + m.label + '</span></div>' +
      '<div class="req__meta">' +
      '<div>' + icon('hospital', 'ico--sm') + '<span><strong>' + esc(r.hospital) + '</strong><br>' + esc(r.area) + '</span></div>' +
      '<div>' + icon('calendar', 'ico--sm') + '<span>Required <strong>' + fmtDate(r.needed) + '</strong> · ' + relative(r.needed) + '</span></div>' +
      '<div>' + icon('phone', 'ico--sm') + '<span><strong>' + esc(r.contact) + '</strong> · ' + esc(r.requester) + '</span></div>' +
      '</div>' +
      '<div class="req__foot"><span class="donor-row__meta">posted ' + relative(r.posted) + '</span>' +
      '<a class="btn btn--outline btn--sm" href="#/donors" data-group="' + esc(r.group) + '" data-find="1">Find ' + esc(r.group) + ' donors</a></div>' +
      '</article>';
  }

  function renderRequests(newId) {
    var sorted = state.requests.slice().sort(function (a, b) {
      var rank = { Critical: 0, Urgent: 1, Planned: 2 };
      return rank[a.urgency] - rank[b.urgency] || parseISO(a.needed) - parseISO(b.needed);
    });
    var html = sorted.map(function (r) { return requestCard(r, r.id === newId); }).join('');
    $('#request-list').innerHTML = html;
    $('#home-requests').innerHTML = sorted.slice(0, 2).map(function (r) { return requestCard(r); }).join('');
    $('#request-count').innerHTML = '<b>' + sorted.length + '</b> active sample requests';
    renderTicker(sorted);
  }

  function renderTicker(list) {
    var items = list.map(function (r) {
      return '<span class="ticker__item"><b>' + esc(r.group) + '</b> · ' + r.units + ' unit' + (r.units > 1 ? 's' : '') +
        ' · ' + esc(r.hospital) + ', ' + esc(r.area) + ' · needed ' + fmtDate(r.needed) + '</span>';
    }).join('');
    $('#ticker-track').innerHTML = items + items; // duplicated for a seamless loop
  }

  /* group-shortcut links inside request cards */
  document.addEventListener('click', function (e) {
    var link = e.target.closest('[data-find]');
    if (!link) return;
    state.donorFilter = { q: '', district: 'Chattogram', upazila: 'All', area: 'All', group: link.dataset.group, avail: 'Available' };
    setTimeout(function () { syncDonorFilterUI(); renderDonors(); }, 0);
  });

  /* ==========================================================================
     Form validation
     ========================================================================== */
  var RULES = {
    required: function (v) { return v.trim() !== '' || 'This field is required.'; },
    name: function (v) { return v.trim().length >= 3 || 'Enter the full name (at least 3 characters).'; },
    phone: function (v) {
      var t = v.trim();
      if (t === '') return 'A contact number is required.';
      if (t.toUpperCase() === '01XXX-XXXXXX') return true; // demo placeholder
      return /^01[3-9]\d{8}$/.test(t.replace(/[\s-]/g, '')) || 'Use an 11-digit number starting 01, or the demo value 01XXX-XXXXXX.';
    },
    email: function (v) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Enter a valid email address.';
    },
    units: function (v) {
      var n = Number(v);
      if (v.trim() === '') return 'Enter how many units are needed.';
      return (Number.isInteger(n) && n >= 1 && n <= 10) || 'Enter a whole number between 1 and 10.';
    },
    futureDate: function (v) {
      if (!v) return 'Choose the date the blood is needed.';
      return parseISO(v) >= TODAY || 'The required date cannot be before the prototype date, ' + fmtDate(TODAY) + '.';
    },
    pastDate: function (v) {
      if (!v) return true; // optional
      return parseISO(v) <= TODAY || 'A donation date cannot be in the future.';
    },
    choice: function (v) { return (v && v !== 'All') || 'Choose an option.'; }
  };

  function setFieldError(input, message) {
    var field = input.closest('.field');
    var err = $('.field__error', field);
    if (message) {
      field.classList.add('field--invalid');
      input.setAttribute('aria-invalid', 'true');
      err.innerHTML = icon('alert', 'ico--sm') + '<span>' + esc(message) + '</span>';
    } else {
      field.classList.remove('field--invalid');
      input.removeAttribute('aria-invalid');
      err.textContent = '';
    }
  }

  /* `spec` maps input ids to rule names. Returns null when valid. */
  function validate(form, spec) {
    var firstBad = null;
    Object.keys(spec).forEach(function (id) {
      var input = $('#' + id, form);
      var result = RULES[spec[id]](input.value);
      var msg = result === true ? null : result;
      setFieldError(input, msg);
      if (msg && !firstBad) firstBad = input;
    });
    return firstBad;
  }

  function liveClear(form, spec) {
    Object.keys(spec).forEach(function (id) {
      var input = $('#' + id, form);
      var ev = input.tagName === 'SELECT' ? 'change' : 'input';
      input.addEventListener(ev, function () {
        if (input.closest('.field').classList.contains('field--invalid')) {
          var r = RULES[spec[id]](input.value);
          setFieldError(input, r === true ? null : r);
        }
      });
    });
  }

  function showFormError(box, count) {
    box.className = 'form-status is-error';
    box.innerHTML = icon('alert') + '<span>' + count + ' field' + (count > 1 ? 's need' : ' needs') +
      ' attention before this can be submitted. The first one is highlighted below.</span>';
  }
  function countInvalid(form) { return $$('.field--invalid', form).length; }

  /* ==========================================================================
     EMERGENCY REQUEST FORM
     ========================================================================== */
  var EMERGENCY_SPEC = {
    'e-requester': 'name', 'e-group': 'choice', 'e-units': 'units', 'e-date': 'futureDate',
    'e-urgency': 'choice', 'e-hospital': 'choice', 'e-area': 'required', 'e-contact': 'phone'
  };

  function initEmergency() {
    var form = $('#emergency-form');
    fillSelect($('#e-group'), GROUPS, 'Select group', '');
    fillSelect($('#e-hospital'), D.hospitals.map(function (h) { return h.name; }), 'Select hospital', '');
    fillSelect($('#e-urgency'), ['Critical', 'Urgent', 'Planned'], 'Select urgency', '');
    $('#e-group').value = 'All'; $('#e-hospital').value = 'All'; $('#e-urgency').value = 'All';
    $('#e-date').min = D.meta.today;
    liveClear(form, EMERGENCY_SPEC);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var box = $('#emergency-status');
      var bad = validate(form, EMERGENCY_SPEC);
      if (bad) {
        showFormError(box, countInvalid(form));
        box.scrollIntoView({ block: 'center', behavior: 'smooth' });
        bad.focus();
        return;
      }
      box.className = 'form-status';
      box.innerHTML = '';

      var btn = $('#emergency-submit');
      btn.setAttribute('aria-busy', 'true');
      btn.disabled = true;

      setTimeout(function () {
        var id = 'BN-R-' + String(nextRequestNo++).padStart(4, '0');
        var req = {
          id: id,
          requester: $('#e-requester').value.trim(),
          group: $('#e-group').value,
          units: Number($('#e-units').value),
          needed: $('#e-date').value,
          urgency: $('#e-urgency').value,
          hospital: $('#e-hospital').value,
          area: $('#e-area').value.trim(),
          contact: $('#e-contact').value.trim(),
          posted: D.meta.today
        };
        state.requests.unshift(req);
        renderRequests(id);

        btn.removeAttribute('aria-busy');
        btn.disabled = false;
        form.reset();
        $('#e-group').value = 'All'; $('#e-hospital').value = 'All'; $('#e-urgency').value = 'All';

        $('#emergency-form-card').hidden = true;
        var s = $('#emergency-success');
        s.hidden = false;
        $('#emergency-success-card').innerHTML =
          '<dl class="dl">' +
          '<div><dt>REQUEST ID</dt><dd class="cell-mono">' + esc(req.id) + '</dd></div>' +
          '<div><dt>BLOOD GROUP</dt><dd class="cell-group">' + esc(req.group) + ' · ' + req.units + ' unit' + (req.units > 1 ? 's' : '') + '</dd></div>' +
          '<div><dt>HOSPITAL</dt><dd>' + esc(req.hospital) + '</dd></div>' +
          '<div><dt>REQUIRED BY</dt><dd>' + fmtDate(req.needed) + '</dd></div>' +
          '</dl>';
        s.scrollIntoView({ block: 'start', behavior: 'smooth' });
        toast('Request posted to the sample board.');
      }, 700);
    });

    $('#emergency-another').addEventListener('click', function () {
      $('#emergency-success').hidden = true;
      $('#emergency-form-card').hidden = false;
      $('#e-requester').focus();
    });
  }

  /* ==========================================================================
     DONOR REGISTRATION
     ========================================================================== */
  var REGISTER_SPEC = {
    'r-name': 'name', 'r-group': 'choice', 'r-district': 'choice', 'r-upazila': 'choice',
    'r-area': 'choice', 'r-mobile': 'phone', 'r-email': 'email', 'r-emergency': 'phone', 'r-last': 'pastDate'
  };

  function initRegister() {
    var form = $('#register-form');
    fillSelect($('#r-group'), GROUPS, 'Select group', '');
    $('#r-group').value = 'All';
    state.registerCascade = wireCascade($('#r-district'), $('#r-upazila'), $('#r-area'),
      ['Select district', 'Select upazila', 'Select area'], null,
      { district: 'All', upazila: 'All', area: 'All' });
    $('#r-last').max = D.meta.today;
    liveClear(form, REGISTER_SPEC);

    $('#r-last').addEventListener('change', updateCooldown);
    updateCooldown();

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var box = $('#register-status');
      var bad = validate(form, REGISTER_SPEC);
      if (bad) {
        showFormError(box, countInvalid(form));
        box.scrollIntoView({ block: 'center', behavior: 'smooth' });
        bad.focus();
        return;
      }
      box.className = 'form-status'; box.innerHTML = '';

      var btn = $('#register-submit');
      btn.setAttribute('aria-busy', 'true');
      btn.disabled = true;

      setTimeout(function () {
        var donor = {
          id: 'BN-D-' + (nextDonorNo++),
          name: $('#r-name').value.trim(),
          group: $('#r-group').value,
          district: $('#r-district').value,
          upazila: $('#r-upazila').value,
          area: $('#r-area').value,
          mobile: $('#r-mobile').value.trim(),
          email: $('#r-email').value.trim(),
          emergency: $('#r-emergency').value.trim(),
          lastDonation: $('#r-last').value || null
        };
        state.donors.push(donor);
        renderDonors();

        var av = availability(donor);
        btn.removeAttribute('aria-busy');
        btn.disabled = false;

        $('#register-form-card').hidden = true;
        var s = $('#register-success');
        s.hidden = false;
        $('#register-success-card').innerHTML =
          '<dl class="dl">' +
          '<div><dt>DONOR ID</dt><dd class="cell-mono">' + esc(donor.id) + '</dd></div>' +
          '<div><dt>BLOOD GROUP</dt><dd class="cell-group">' + esc(donor.group) + '</dd></div>' +
          '<div><dt>REGISTERED AREA</dt><dd>' + esc(donor.area + ', ' + donor.upazila) + '</dd></div>' +
          '<div><dt>STATUS SHOWN TO USERS</dt><dd>' +
          '<span class="badge badge--' + (av.available ? 'available">AVAILABLE' : 'unavailable">UNAVAILABLE') + '</span></dd></div>' +
          (av.next ? '<div class="span-2"><dt>NEXT POSSIBLE AVAILABILITY</dt><dd>' + fmtDate(av.next) + '</dd></div>' : '') +
          '</dl>';
        $('#register-success-note').textContent = av.available
          ? donor.name.split(' ')[0] + ' will appear in the directory as available straight away.'
          : donor.name.split(' ')[0] + ' stays hidden from availability searches until ' + fmtDate(av.next) + ', under the proposed three-month cooldown.';
        s.scrollIntoView({ block: 'start', behavior: 'smooth' });
        toast('Sample donor added to the prototype directory.');
        form.reset();
        $('#r-group').value = 'All';
        state.registerCascade.apply({ district: 'All', upazila: 'All', area: 'All' });
        updateCooldown();
      }, 700);
    });

    $('#register-again').addEventListener('click', function () {
      $('#register-success').hidden = true;
      $('#register-form-card').hidden = false;
      $('#r-name').focus();
    });
  }

  function updateCooldown() {
    var v = $('#r-last').value;
    var out = $('#cooldown-rows');
    if (!v) {
      out.innerHTML = '<div class="cooldown__row"><span>Last donation</span><b>Not recorded</b></div>' +
        '<div class="cooldown__row"><span>Status on registration</span><b>Available</b></div>';
      return;
    }
    var av = availability({ lastDonation: v });
    out.innerHTML =
      '<div class="cooldown__row"><span>Last donation</span><b>' + fmtDate(v) + '</b></div>' +
      '<div class="cooldown__row"><span>Next possible</span><b>' + fmtDate(av.next) + '</b></div>' +
      '<div class="cooldown__row"><span>Status on registration</span><b>' + (av.available ? 'Available' : 'Unavailable') + '</b></div>';
  }

  /* ==========================================================================
     Toast
     ========================================================================== */
  var toastTimer;
  function toast(message) {
    var t = $('#toast');
    t.innerHTML = icon('check', 'ico--sm') + '<span>' + esc(message) + '</span>';
    t.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('is-visible'); }, 3600);
  }

  /* ==========================================================================
     Boot
     ========================================================================== */
  function init() {
    if (state.booted) return;
    state.booted = true;
    $$('[data-today]').forEach(function (el) { el.textContent = fmtDate(TODAY); });
    initNav();
    initModal();
    initHospitalModal();
    initHome();
    initDonors();
    initHospitals();
    initEmergency();
    initRegister();
    renderRequests();
    window.addEventListener('hashchange', route);
    route();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
