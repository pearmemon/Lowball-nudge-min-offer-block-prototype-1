// ─── State ────────────────────────────────────────────────────────────────────
let lastConflictField = null;
let lowballFloor      = null;
let submitted         = false;

// ─── Input handlers ───────────────────────────────────────────────────────────
function onSaleInput()  { lastConflictField = 'sale'; render(); }
function onMinInput()   { lastConflictField = 'min';  render(); }
function onOfferInput() { submitted = false; lowballFloor = null; render(); }

// ─── Derive all values from DOM ───────────────────────────────────────────────
function getState() {
  const list     = parseFloat(document.getElementById('listPrice').value)  || 100;
  const hasSale  = document.getElementById('hasSale').checked;
  const saleRaw  = parseFloat(document.getElementById('salePrice').value)  || list;
  const sale     = (hasSale && saleRaw < list) ? saleRaw : null;
  const effPrice = sale || list;
  const hasMin   = document.getElementById('hasMin').checked;
  const minPct   = parseFloat(document.getElementById('minPct').value)     || 40;
  const minDollar = hasMin ? Math.round(list * (1 - minPct / 100)) : null;

  // Platform raw thresholds
  const platRecRaw   = Math.round(effPrice * 0.95); // 5% off effective
  const platNudgeRaw = Math.round(effPrice * 0.90); // 10% off effective
  const platBlock    = Math.round(list    * 0.70); // 30% off list (hard)

  // Option C: floor rec/nudge at minOffer so buyer never sees the conflict
  const recPrice   = (hasMin && minDollar !== null) ? Math.max(platRecRaw,   minDollar) : platRecRaw;
  const nudgePrice = (hasMin && minDollar !== null) ? Math.max(platNudgeRaw, minDollar) : platNudgeRaw;
  const recFloored   = hasMin && minDollar !== null && platRecRaw   < minDollar;
  const nudgeFloored = hasMin && minDollar !== null && platNudgeRaw < minDollar;

  const offer = parseFloat(document.getElementById('buyerOffer').value) || 0;

  // ── Seller-side validations ──────────────────────────────────────────────────
  // 1. Min offer must be at least 40% off list (minDollar ≤ 60% of list)
  const minTooHigh = hasMin && minPct < 40;

  // 2. Sale and min offer must stay ≥ 20% of list apart
  const gap20 = list * 0.20;
  const saleConflict  = hasMin && sale !== null && (sale - minDollar) < gap20;
  // Soft warning: sale is >20% off list while min offer is active (tight, not yet conflicting)
  const saleTooDeep   = hasMin && !saleConflict && sale !== null && (list - sale) > (list * 0.20);

  const maxAllowedMinDollar = sale !== null ? Math.round(sale - gap20) : null;
  const maxSaleForMin       = hasMin        ? Math.round(list * 0.80)  : null;

  // ── Buyer-side validations ───────────────────────────────────────────────────
  const overList = offer > 0 && offer > list;
  const overSale = offer > 0 && sale !== null && offer > sale && !overList;

  let buyerState = 'ok';
  if (overList || overSale) {
    buyerState = 'over';
  } else if (offer > 0 && offer < recPrice) {
    if (hasMin && minDollar !== null && offer < minDollar) {
      buyerState = 'blocked';
    } else if (offer < nudgePrice) {
      buyerState = submitted ? 'lowball' : 'presubmit';
    }
  }

  const lowballBelowFloor = buyerState === 'lowball' && lowballFloor !== null && offer < lowballFloor;

  let overMsg = '';
  if (overList) overMsg = `Offer can't be higher than the list price ($${list})`;
  else if (overSale) overMsg = `Offer can't be higher than the sale price ($${sale})`;

  return {
    list, sale, effPrice, hasMin, minPct, minDollar,
    recPrice, nudgePrice, platBlock, platRecRaw, platNudgeRaw,
    recFloored, nudgeFloored,
    offer, buyerState,
    saleConflict, saleTooDeep, minTooHigh,
    maxAllowedMinDollar, maxSaleForMin, gap20,
    lowballBelowFloor, overList, overSale, overMsg
  };
}

// ─── Simulate buyer tapping "Continue to Shipping" ────────────────────────────
function simulateContinue() {
  const s = getState();
  if (s.saleConflict || s.minTooHigh || s.buyerState === 'over') return;
  if (s.buyerState === 'presubmit') {
    submitted    = true;
    lowballFloor = s.offer;
  }
  render();
}

// ─── Main render ──────────────────────────────────────────────────────────────
function render() {
  const s = getState();

  // Toggle visibility of conditional seller fields
  document.getElementById('saleGrp').style.display = s.hasSale ? 'block' : 'none';
  document.getElementById('minGrp').style.display  = s.hasMin  ? 'block' : 'none';

  // ── Seller validation UI ───────────────────────────────────────────────────
  const saleEl    = document.getElementById('salePrice');
  const minEl     = document.getElementById('minPct');
  const saleErrEl = document.getElementById('saleErr');
  const minErrEl  = document.getElementById('minErr');
  const saleWarnEl= document.getElementById('saleWarn');

  saleEl.classList.remove('err');
  minEl.classList.remove('err');
  saleErrEl.style.display  = 'none';
  minErrEl.style.display   = 'none';
  saleWarnEl.style.display = 'none';

  if (s.minTooHigh) {
    minEl.classList.add('err');
    minErrEl.textContent = `Min offer must be at least 40% off list. Max allowed value is $${Math.round(s.list * 0.60)}.`;
    minErrEl.style.display = 'block';
  } else if (s.saleConflict) {
    const msg = lastConflictField === 'sale'
      ? `Sale price must stay at least 20% above min offer ($${s.minDollar}). Raise sale to $${s.maxSaleForMin}+ or lower min offer.`
      : `Min offer must be at least 20% below sale price ($${s.sale}). Lower min offer to $${s.maxAllowedMinDollar} or below.`;
    if (lastConflictField === 'sale') {
      saleEl.classList.add('err');
      saleErrEl.textContent = msg;
      saleErrEl.style.display = 'block';
    } else {
      minEl.classList.add('err');
      minErrEl.textContent = msg;
      minErrEl.style.display = 'block';
    }
  } else if (s.saleTooDeep) {
    saleWarnEl.textContent = `Sale is over 20% off list. Buyers won't be able to offer below $${s.minDollar}, which may reduce negotiation room.`;
    saleWarnEl.style.display = 'block';
  }

  if (s.hasMin && s.minDollar !== null) {
    document.getElementById('minDollar').textContent = `= $${s.minDollar}`;
  }

  // ── Thresholds panel ──────────────────────────────────────────────────────
  const basis = s.sale ? 'sale' : 'list';
  document.getElementById('platInfo').innerHTML = `
    <div class="threshold-row">
      <span class="threshold-label">Recommended</span>
      <span class="threshold-value">$${s.recPrice} <span style="font-weight:400;color:var(--text-sec)">(5% off ${basis})</span></span>
    </div>
    ${s.recFloored ? `<div class="threshold-note">↑ floored at min offer (platform wanted $${s.platRecRaw})</div>` : ''}
    <div class="threshold-row">
      <span class="threshold-label">Nudge threshold</span>
      <span class="threshold-value">$${s.nudgePrice} <span style="font-weight:400;color:var(--text-sec)">(10% off ${basis})</span></span>
    </div>
    ${s.nudgeFloored ? `<div class="threshold-note">↑ floored at min offer (platform wanted $${s.platNudgeRaw})</div>` : ''}
    <div class="threshold-row">
      <span class="threshold-label">Platform block</span>
      <span class="threshold-value">$${s.platBlock} <span style="font-weight:400;color:var(--text-sec)">(30% off list)</span></span>
    </div>
    ${s.hasMin && s.minDollar ? `
    <div class="threshold-row" style="margin-top:4px;padding-top:8px;border-top:1px solid var(--border)">
      <span class="threshold-label">Seller min offer</span>
      <span class="threshold-value">$${s.minDollar}</span>
    </div>` : ''}
  `;

  // ── Buyer state badge ──────────────────────────────────────────────────────
  const stateMap = {
    ok:        ['ok',   'ti-circle-check', '✓ Within range'],
    presubmit: ['warn', 'ti-clock',        'Below nudge — tap Continue'],
    lowball:   ['warn', 'ti-alert-triangle','Lowball nudge shown'],
    blocked:   ['err',  'ti-ban',          'Min offer block'],
    over:      ['err',  'ti-arrow-up',     'Above price ceiling'],
  };
  const [cls, ico, label] = stateMap[s.buyerState] || ['ok','',''];
  document.getElementById('stateInfo').innerHTML =
    `<span class="state-badge ${cls}"><i class="ti ${ico}"></i> ${label}</span>`;

  renderModal(s);
}

// ─── Modal renderer ───────────────────────────────────────────────────────────
function renderModal(s) {
  const nyp         = s.offer > 0;
  const nypPct      = nyp ? Math.round((1 - s.offer / s.list) * 100) : null;
  const isLowball   = s.buyerState === 'lowball';
  const isBlocked   = s.buyerState === 'blocked';
  const isOver      = s.buyerState === 'over';
  const nypSelected = nyp && (s.offer < s.recPrice || isOver);

  // Warning banner (lowball only)
  const warnBanner = isLowball
    ? `<div class="warn-banner">
         <i class="ti ti-alert-circle" style="margin-top:1px;flex-shrink:0"></i>
         <span>Your offer is significantly below what this seller is likely to accept.</span>
       </div>`
    : '';

  // Recommended card — in lowball state, shows nudge price instead
  const recAmt    = isLowball ? s.nudgePrice : s.recPrice;
  const recPct    = Math.round((1 - recAmt / s.list) * 100);
  const recSub    = isLowball ? 'This is the lowest offer likely to get a response' : 'Seller is likely to accept this offer';
  const recBadge  = isLowball ? 'Strongly Recommended' : 'Recommended';
  const recSelected = !nypSelected;

  const recCard = `
    <div class="o-card ${recSelected ? 'selected' : ''}" onclick="selectRec()">
      <div class="o-header">
        <div class="radio ${recSelected ? 'on' : ''}"></div>
        <div class="rec-meta">
          <span class="rec-price">$${recAmt}</span>
          <span class="rec-stk">$${s.list}</span>
          <span class="rec-pct">${recPct}% off</span>
          <span class="badge">${recBadge}</span>
        </div>
      </div>
      <div class="rec-sub">${recSub}</div>
    </div>`;

  // Name Your Price / Submit Your Offer card
  const nypLabel  = isLowball ? 'Submit your offer' : 'Name your price';
  const pctTag    = (nyp && nypSelected && !isOver)
    ? `<span class="pi-pct">${nypPct}% off</span>` : '';

  const belowFloorErr  = s.lowballBelowFloor;
  const inputHasDanger = isBlocked || belowFloorErr || isOver;

  let inlineErr = '';
  if      (isOver)        inlineErr = `<p class="inline-err">${s.overMsg}</p>`;
  else if (isBlocked)     inlineErr = `<p class="inline-err">The seller doesn't accept offers this low</p>`;
  else if (belowFloorErr) inlineErr = `<p class="inline-err">You've already been advised this offer is low — you can't go lower</p>`;

  const nypCard = `
    <div class="o-card ${nypSelected ? 'selected' : ''} ${inputHasDanger ? 'danger' : ''}" onclick="selectNYP()">
      <div class="nyp-row">
        <div class="radio ${nypSelected ? 'on' : ''}"></div>
        <span class="nyp-label">${nypLabel}</span>
        <div class="price-input ${inputHasDanger ? 'danger' : ''}">
          <span class="pi-sym">$</span>
          <input type="number" id="inlineOffer"
                 value="${nyp ? s.offer : ''}"
                 placeholder=""
                 oninput="onInlineInput(this.value)" />
          <span class="pi-cur">USD</span>
          ${pctTag}
        </div>
      </div>
      ${inlineErr}
    </div>`;

  const ctaDisabled = (isBlocked || belowFloorErr || isOver || s.saleConflict || s.minTooHigh)
    ? 'disabled' : '';
  const modalTitle = isLowball ? 'Your Offer is Low' : 'Suggest a Price';

  document.getElementById('modal').innerHTML = `
    <div class="modal-header">
      <h2 class="modal-title">${modalTitle}</h2>
      <button class="modal-close" aria-label="Close"><i class="ti ti-x"></i></button>
    </div>
    <div class="urgency-banner">
      <strong>Don't Miss Out!</strong> Someone is talking to the seller about this item.
    </div>
    ${warnBanner}
    <div class="modal-body">
      <div class="item-row">
        <div class="item-thumb"><i class="ti ti-armchair"></i></div>
        <div>
          <p class="item-name">Charles &amp; Ray Eames Early LCW Lounge Chair for Herman Miller, 1951</p>
          <div class="price-row">
            <span>List:</span>
            <span class="price-list">$${s.list}</span>
            ${s.sale ? `<span>&middot;</span><span>Sale:</span><span class="price-sale">$${s.sale}</span>` : ''}
          </div>
        </div>
      </div>
      ${recCard}
      ${nypCard}
      <div class="collapsible">
        Include a Message <i class="ti ti-chevron-down"></i>
      </div>
    </div>
    <div class="modal-footer">
      <button class="cta" ${ctaDisabled}>Continue to Shipping</button>
    </div>
    <p class="fine-print">
      You'll review all details in the final step before placing your offer,
      and only be charged if the seller accepts. The seller has 7 days to respond.
    </p>
  `;
}

// ─── Card interaction helpers ─────────────────────────────────────────────────
function selectRec() {
  submitted    = false;
  lowballFloor = null;
  document.getElementById('buyerOffer').value = '';
  render();
}

function selectNYP() {
  const s = getState();
  if (!s.offer) {
    document.getElementById('buyerOffer').value = s.recPrice - 2;
  }
  render();
}

function onInlineInput(val) {
  document.getElementById('buyerOffer').value = val;
  render();
}

// ─── Init ─────────────────────────────────────────────────────────────────────
render();
