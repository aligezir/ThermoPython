/* ============================================================================
 * ui.js — All DOM rendering and human interaction for the game.
 * Builds the board once, then re-renders dynamic layers (tokens, panels,
 * dice, action bar, modals) from game state on every `render()`.
 * ==========================================================================*/

const UI = {
  game: null,
  el: {},
  tileEls: [],
  tileCenters: [],
  tokenEls: {},

  /* ---- board grid geometry -------------------------------------------- */
  cellOf(i) {
    if (i === 0)  return { r: 11, c: 11, edge: 'br' };
    if (i === 10) return { r: 11, c: 1,  edge: 'bl' };
    if (i === 20) return { r: 1,  c: 1,  edge: 'tl' };
    if (i === 30) return { r: 1,  c: 11, edge: 'tr' };
    if (i < 10)  return { r: 11, c: 11 - i,  edge: 'bottom' };
    if (i < 20)  return { r: 21 - i, c: 1,   edge: 'left' };
    if (i < 30)  return { r: 1,  c: i - 19,   edge: 'top' };
    return { r: i - 29, c: 11, edge: 'right' };
  },

  // Grab DOM references. Safe to call before the game exists so that the
  // game constructor's log lines have somewhere to go.
  grabRefs() {
    this.el.board = document.getElementById('board');
    this.el.tokenLayer = document.getElementById('token-layer');
    this.el.players = document.getElementById('players');
    this.el.log = document.getElementById('log');
    this.el.actions = document.getElementById('actions');
    this.el.center = document.getElementById('center');
    this.el.modal = document.getElementById('modal');
  },

  init(game) {
    this.game = game;
    this.grabRefs();
    this.buildBoard();
    this.buildTokens();
    window.addEventListener('resize', () => { this.measure(); this.renderTokens(); });
    requestAnimationFrame(() => { this.measure(); this.renderTokens(); });
  },

  buildBoard() {
    // Detach (not destroy) the center + token layers, rebuild tiles, re-attach.
    this.el.board.innerHTML = '';
    BOARD.forEach((sp, i) => {
      const { r, c, edge } = this.cellOf(i);
      const tile = document.createElement('div');
      tile.className = `tile edge-${edge} type-${sp.type}`;
      tile.style.gridRow = r;
      tile.style.gridColumn = c;
      tile.dataset.idx = i;

      if (sp.group && (sp.type === 'property')) {
        const bar = document.createElement('div');
        bar.className = 'tile-color';
        bar.style.background = GROUP_COLORS[sp.group];
        tile.appendChild(bar);
      }

      const body = document.createElement('div');
      body.className = 'tile-body';
      body.innerHTML = this.tileInner(sp, i);
      tile.appendChild(body);

      const owner = document.createElement('div');
      owner.className = 'tile-owner';
      tile.appendChild(owner);

      const builds = document.createElement('div');
      builds.className = 'tile-builds';
      tile.appendChild(builds);

      tile.addEventListener('click', () => this.onTileClick(i));
      this.el.board.appendChild(tile);
      this.tileEls[i] = tile;
    });

    // re-attach the center play area + token overlay (they were children of
    // #board in the markup and got cleared above)
    this.el.board.appendChild(this.el.center);
    this.el.board.appendChild(this.el.tokenLayer);
    this.el.center.style.gridRow = '2 / 11';
    this.el.center.style.gridColumn = '2 / 11';
  },

  tileInner(sp, i) {
    const icons = {
      go: '⬇️ GO', jail: '🔒', freeparking: '🅿️', gotojail: '🚓',
      chance: '❓', chest: '🎁', tax: '💸',
      railroad: '🚂', utility: sp.name === 'Water Works' ? '🚰' : '💡',
    };
    if (sp.type === 'go') return `<div class="corner-label">COLLECT<br>$200<br><span class="big">GO</span></div>`;
    if (sp.type === 'jail') return `<div class="corner-label"><span class="big">🔒</span><br>JUST<br>VISITING</div>`;
    if (sp.type === 'freeparking') return `<div class="corner-label">FREE<br><span class="big">🅿️</span><br>PARKING</div>`;
    if (sp.type === 'gotojail') return `<div class="corner-label">GO TO<br><span class="big">🚓</span><br>JAIL</div>`;
    if (sp.type === 'tax') return `<div class="t-name">${sp.name}</div><div class="t-ic">💸</div><div class="t-price">Pay $${sp.amount}</div>`;
    if (sp.type === 'chance') return `<div class="t-name">Chance</div><div class="t-ic">❓</div>`;
    if (sp.type === 'chest') return `<div class="t-name">Community Chest</div><div class="t-ic">🎁</div>`;
    if (sp.type === 'railroad') return `<div class="t-name">${sp.name}</div><div class="t-ic">🚂</div><div class="t-price">$${sp.price}</div>`;
    if (sp.type === 'utility') return `<div class="t-name">${sp.name}</div><div class="t-ic">${icons.utility}</div><div class="t-price">$${sp.price}</div>`;
    return `<div class="t-name">${sp.name}</div><div class="t-price">$${sp.price}</div>`;
  },

  buildTokens() {
    this.el.tokenLayer.innerHTML = '';
    this.game.players.forEach(p => {
      const t = document.createElement('div');
      t.className = 'token';
      t.style.background = TOKENS.find(tk => tk.id === p.token)?.color || '#333';
      t.textContent = TOKENS.find(tk => tk.id === p.token)?.emoji || '⬤';
      this.el.tokenLayer.appendChild(t);
      this.tokenEls[p.id] = t;
    });
  },

  measure() {
    const boardRect = this.el.board.getBoundingClientRect();
    this.tileCenters = BOARD.map((_, i) => {
      const rect = this.tileEls[i].getBoundingClientRect();
      return {
        x: rect.left - boardRect.left + rect.width / 2,
        y: rect.top - boardRect.top + rect.height / 2,
      };
    });
  },

  // small offsets so multiple tokens on one tile don't fully overlap
  tokenOffset(idx) {
    const grid = [[-10,-10],[10,-10],[-10,10],[10,10],[0,0],[0,-16]];
    return grid[idx % grid.length];
  },

  renderTokens() {
    if (!this.tileCenters.length) return;
    // group players by position to compute offsets
    const here = {};
    this.game.players.forEach(p => {
      if (p.bankrupt) { this.tokenEls[p.id].style.display = 'none'; return; }
      this.tokenEls[p.id].style.display = 'flex';
      here[p.position] = here[p.position] || [];
      const slot = here[p.position].length;
      here[p.position].push(p.id);
      const c = this.tileCenters[p.position];
      const [ox, oy] = this.tokenOffset(slot);
      this.tokenEls[p.id].style.left = (c.x + ox) + 'px';
      this.tokenEls[p.id].style.top = (c.y + oy) + 'px';
    });
  },

  /* ---- animation: walk a token tile-by-tile --------------------------- */
  animateMove(playerId, from, to, cb) {
    const forward = (to - from + BOARD.length) % BOARD.length;
    if (forward === 0 || forward > 12) {     // teleport / backward -> glide direct
      this.game.players[playerId].position = to;  // temp for render
      // restore handled by engine cb; just glide
      this._glide(playerId, to, () => cb());
      // engine sets position in cb again (idempotent)
      this.game.players[playerId].position = from;
      return;
    }
    let step = from;
    const walk = () => {
      step = (step + 1) % BOARD.length;
      this._glide(playerId, step, () => {
        if (step === to) cb();
        else setTimeout(walk, 90);
      });
    };
    walk();
  },

  _glide(playerId, idx, done) {
    const c = this.tileCenters[idx];
    if (!c) { done(); return; }
    const t = this.tokenEls[playerId];
    const slot = 0;
    t.style.left = c.x + 'px';
    t.style.top = c.y + 'px';
    t.classList.add('hop');
    setTimeout(() => { t.classList.remove('hop'); done(); }, 150);
  },

  /* ---- full render ----------------------------------------------------- */
  render() {
    this.renderTiles();
    this.renderTokens();
    this.renderPlayers();
    this.renderCenter();
    this.renderActions();
    this.renderPending();
  },

  renderTiles() {
    const g = this.game;
    BOARD.forEach((sp, i) => {
      const tile = this.tileEls[i];
      const ownerEl = tile.querySelector('.tile-owner');
      const buildsEl = tile.querySelector('.tile-builds');
      // ownership stripe
      if (g.owner[i] !== null) {
        const col = TOKENS.find(t => t.id === g.players[g.owner[i]].token)?.color;
        ownerEl.style.background = col;
        ownerEl.style.opacity = '1';
        tile.classList.toggle('mortgaged', g.mortgaged[i]);
      } else {
        ownerEl.style.opacity = '0';
        tile.classList.remove('mortgaged');
      }
      // houses / hotel
      buildsEl.innerHTML = '';
      if (g.houses[i] === 5) {
        buildsEl.innerHTML = '<span class="hotel">🏨</span>';
      } else if (g.houses[i] > 0) {
        buildsEl.innerHTML = '<span class="house">🏠</span>'.repeat(g.houses[i]);
      }
      tile.classList.toggle('active', g.player.position === i);
    });
  },

  renderPlayers() {
    const g = this.game;
    this.el.players.innerHTML = '';
    g.players.forEach(p => {
      const tk = TOKENS.find(t => t.id === p.token);
      const card = document.createElement('div');
      card.className = 'pcard' + (p.id === g.current ? ' current' : '') + (p.bankrupt ? ' dead' : '');
      card.style.borderColor = tk.color;
      const props = BOARD.map((sp, i) => (g.owner[i] === p.id ? i : -1)).filter(i => i >= 0);
      const groups = {};
      props.forEach(i => {
        const grp = BOARD[i].group;
        (groups[grp] = groups[grp] || []).push(i);
      });
      const chips = Object.keys(groups).map(grp => {
        const full = g.hasMonopoly(p.id, grp);
        return `<span class="chip ${full ? 'full' : ''}" style="background:${GROUP_COLORS[grp]}"
                 title="${GROUP_NAMES[grp]}">${groups[grp].length}</span>`;
      }).join('');
      card.innerHTML = `
        <div class="pc-top">
          <span class="pc-token" style="background:${tk.color}">${tk.emoji}</span>
          <span class="pc-name">${p.name}${p.isAI ? ' 🤖' : ''}</span>
          <span class="pc-cash">$${p.cash}</span>
        </div>
        <div class="pc-meta">
          ${p.inJail ? '<span class="jail-tag">🔒 In Jail</span>' : ''}
          ${p.getOutCards ? `<span class="goj">🎟️×${p.getOutCards}</span>` : ''}
          <span class="worth">net $${g.netWorth(p)}</span>
        </div>
        <div class="pc-chips">${chips || '<span class="muted">no properties</span>'}</div>`;
      this.el.players.appendChild(card);
    });
  },

  renderCenter() {
    const g = this.game;
    const [d1, d2] = g.dice;
    const tk = TOKENS.find(t => t.id === g.player.token);
    this.el.center.innerHTML = `
      <div class="brand">MONOPOLY</div>
      <div class="turn-banner" style="--accent:${tk.color}">
        <span class="tb-token">${tk.emoji}</span>
        <span>${g.player.name}'s turn</span>
      </div>
      <div class="dice">
        ${this.dieFace(d1)} ${this.dieFace(d2)}
      </div>
      <div class="bank-note">🏦 Houses left: ${g.housesLeft} · Hotels left: ${g.hotelsLeft}</div>
      <div id="action-bar"></div>`;
    this.el.actions = document.getElementById('action-bar');
  },

  dieFace(n) {
    if (!n) return `<div class="die empty"></div>`;
    const pips = { 1:[4], 2:[0,8], 3:[0,4,8], 4:[0,2,6,8], 5:[0,2,4,6,8], 6:[0,2,3,5,6,8] }[n];
    let cells = '';
    for (let k = 0; k < 9; k++) cells += `<i class="${pips.includes(k) ? 'on' : ''}"></i>`;
    return `<div class="die">${cells}</div>`;
  },

  /* ---- action bar (depends on phase / pending) ------------------------- */
  renderActions() {
    const g = this.game;
    const bar = this.el.actions;
    if (!bar) return;
    bar.innerHTML = '';
    if (g.phase === 'gameover') return;
    const p = g.player;
    if (p.isAI) {
      bar.innerHTML = `<div class="ai-thinking">🤖 ${p.name} is thinking…</div>`;
      return;
    }
    if (g.pending) return; // pending modal/inline takes over below

    if (g.phase === 'preroll') {
      if (p.inJail) {
        bar.appendChild(this.btn('🎲 Roll for doubles', () => Controller.humanRoll()));
        bar.appendChild(this.btn(`💵 Pay $${JAIL_FINE} bail`, () => { g.jailPay(); this.render(); }, p.cash < JAIL_FINE));
        if (p.getOutCards > 0)
          bar.appendChild(this.btn('🎟️ Use card', () => { g.jailUseCard(); this.render(); }));
      } else {
        bar.appendChild(this.btn('🎲 Roll dice', () => Controller.humanRoll(), false, 'primary'));
      }
      bar.appendChild(this.btn('🏗️ Manage', () => this.openManage()));
      bar.appendChild(this.btn('🤝 Trade', () => this.openTrade()));
    } else if (g.phase === 'postroll') {
      bar.appendChild(this.btn('🏗️ Manage', () => this.openManage()));
      bar.appendChild(this.btn('🤝 Trade', () => this.openTrade()));
      const dbl = g.lastRollWasDoubles && !p.inJail && g.doubles > 0 && g.doubles < 3;
      bar.appendChild(this.btn(dbl ? '🎲 Roll again (doubles)' : '✅ End turn',
        () => { g.endTurn(); this.render(); }, false, 'primary'));
    }
  },

  btn(label, fn, disabled = false, cls = '') {
    const b = document.createElement('button');
    b.className = 'act ' + cls;
    b.innerHTML = label;
    b.disabled = disabled;
    b.onclick = fn;
    return b;
  },

  /* ---- pending decisions: buy, auction, debt, trade ------------------- */
  renderPending() {
    const g = this.game;
    if (!g.pending) { this.closeModal(); return; }
    const t = g.pending.type;
    if (t === 'buy' && !g.player.isAI) this.showBuy();
    else if (t === 'auction' && !g.players[g.pending.contenders[g.pending.turn]].isAI) this.showAuction();
    else if (t === 'auction') this.closeModal();       // AI's bid turn -> no modal
    else if (t === 'debt' && !g.player.isAI) this.showDebt();
    else if (t === 'trade') this.showTradeConfirm();
  },

  showBuy() {
    const g = this.game;
    const i = g.pending.index;
    const sp = BOARD[i];
    this.modal(`
      <h2>Buy ${sp.name}?</h2>
      <div class="buy-card" style="--c:${GROUP_COLORS[sp.group] || '#888'}">
        <div class="bc-bar"></div>
        <div class="bc-price">Price $${sp.price}</div>
        ${this.rentTable(i)}
      </div>
      <div class="modal-actions">
        <button class="act primary" id="m-buy" ${g.player.cash < sp.price ? 'disabled' : ''}>💰 Buy for $${sp.price}</button>
        <button class="act" id="m-auction">🔨 Auction</button>
      </div>`);
    document.getElementById('m-buy').onclick = () => { g.buyCurrent(); this.render(); };
    document.getElementById('m-auction').onclick = () => { g.declineCurrent(); this.render(); };
  },

  rentTable(i) {
    const sp = BOARD[i];
    if (sp.type === 'railroad')
      return `<div class="rent-rows"><div>1 RR <b>$25</b></div><div>2 RR <b>$50</b></div><div>3 RR <b>$100</b></div><div>4 RR <b>$200</b></div></div>`;
    if (sp.type === 'utility')
      return `<div class="rent-rows"><div>1 owned <b>4× dice</b></div><div>both <b>10× dice</b></div></div>`;
    const labels = ['Rent', '1 house', '2 houses', '3 houses', '4 houses', 'HOTEL'];
    return `<div class="rent-rows">${sp.rent.map((r, k) => `<div>${labels[k]} <b>$${r}</b></div>`).join('')}
            <div class="muted">House cost $${sp.houseCost} · Mortgage $${sp.mortgage}</div></div>`;
  },

  showAuction() {
    const g = this.game;
    const a = g.pending;
    const sp = BOARD[a.index];
    const bidder = g.players[a.contenders[a.turn]];
    const minNext = a.bid + 10;
    this.modal(`
      <h2>🔨 Auction — ${sp.name}</h2>
      <p class="auc-state">High bid: <b>$${a.bid}</b> ${a.highBidder !== null ? 'by ' + g.players[a.highBidder].name : '(none)'} </p>
      <p><b>${bidder.name}</b>, your move. (cash $${bidder.cash})</p>
      <div class="auc-input">
        <input type="number" id="auc-amt" value="${Math.min(minNext, bidder.cash)}" min="${minNext}" max="${bidder.cash}" step="10">
        <button class="act primary" id="auc-bid">Bid</button>
        <button class="act" id="auc-pass">Pass</button>
      </div>`);
    document.getElementById('auc-bid').onclick = () => {
      const v = parseInt(document.getElementById('auc-amt').value, 10);
      g.auctionBid(bidder.id, v); this.render();
    };
    document.getElementById('auc-pass').onclick = () => { g.auctionPass(bidder.id); this.render(); };
  },

  showDebt() {
    const g = this.game;
    const d = g.pending;
    const p = g.player;
    this.modal(`
      <h2 class="warn">⚠️ You owe $${d.amount}</h2>
      <p>Cash on hand: <b>$${p.cash}</b>. Sell houses or mortgage property to raise the difference, then pay.</p>
      <div id="debt-assets">${this.assetManager(true)}</div>
      <div class="modal-actions">
        <button class="act primary" id="debt-pay" ${p.cash < d.amount ? 'disabled' : ''}>Pay $${d.amount}</button>
        <button class="act danger" id="debt-bk">💀 Declare Bankruptcy</button>
      </div>`);
    document.getElementById('debt-pay').onclick = () => { g.settleDebt(); this.render(); };
    document.getElementById('debt-bk').onclick = () => { g.declareBankruptcy(); this.render(); };
  },

  /* ---- management modal (build / mortgage) ----------------------------- */
  openManage() {
    this.modal(`<h2>🏗️ Manage Properties</h2>
      <p class="muted">Build evenly across a full color set. Mortgage to raise cash.</p>
      <div id="manage-list">${this.assetManager(false)}</div>
      <div class="modal-actions"><button class="act primary" id="m-close">Done</button></div>`);
    document.getElementById('m-close').onclick = () => this.closeModal();
  },

  assetManager(debtMode) {
    const g = this.game;
    const p = g.player;
    const props = BOARD.map((sp, i) => (g.owner[i] === p.id ? i : -1)).filter(i => i >= 0);
    if (!props.length) return '<p class="muted">You own no properties.</p>';
    // order by group
    props.sort((a, b) => BOARD[a].group.localeCompare(BOARD[b].group) || a - b);
    return `<div class="asset-grid">` + props.map(i => {
      const sp = BOARD[i];
      const canB = g.canBuild(i), canS = g.canSell(i);
      const canM = g.canMortgage(i), canU = g.canUnmortgage(i);
      const houseLabel = g.houses[i] === 5 ? '🏨 Hotel' : '🏠'.repeat(g.houses[i]) || '—';
      return `<div class="asset ${g.mortgaged[i] ? 'mort' : ''}">
        <div class="as-bar" style="background:${GROUP_COLORS[sp.group]}"></div>
        <div class="as-name">${sp.name}</div>
        <div class="as-state">${g.mortgaged[i] ? 'MORTGAGED' : houseLabel}</div>
        <div class="as-btns">
          ${sp.type === 'property' ? `
            <button class="mini" data-act="build" data-i="${i}" ${canB ? '' : 'disabled'}>＋🏠 $${sp.houseCost}</button>
            <button class="mini" data-act="sell" data-i="${i}" ${canS ? '' : 'disabled'}>－🏠</button>` : ''}
          <button class="mini" data-act="mort" data-i="${i}" ${canM ? '' : 'disabled'}>Mortgage +$${sp.mortgage}</button>
          <button class="mini" data-act="unmort" data-i="${i}" ${canU ? '' : 'disabled'}>Redeem -$${Math.ceil(sp.mortgage*1.1)}</button>
        </div>
      </div>`;
    }).join('') + `</div>`;
  },

  // delegate clicks inside any asset manager
  bindAssetClicks(rootId, debtMode) {
    const root = document.getElementById(rootId);
    if (!root) return;
    root.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]');
      if (!b) return;
      const i = parseInt(b.dataset.i, 10);
      const g = this.game;
      ({ build: () => g.buildHouse(i), sell: () => g.sellHouse(i),
         mort: () => g.mortgage(i), unmort: () => g.unmortgage(i) })[b.dataset.act]();
      // re-render the manager list in place
      const listId = document.getElementById('manage-list') ? 'manage-list'
                   : document.getElementById('debt-assets') ? 'debt-assets' : null;
      if (listId) document.getElementById(listId).innerHTML = this.assetManager(debtMode);
      // refresh debt pay button + board
      this.render();
      if (g.pending && g.pending.type === 'debt') this.showDebt();
    });
  },

  /* ---- trade builder --------------------------------------------------- */
  openTrade() {
    const g = this.game;
    const me = g.player;
    const others = g.livePlayers().filter(p => p.id !== me.id);
    if (!others.length) { this.toast('No one to trade with.'); return; }
    let partnerId = others[0].id;
    const render = () => {
      const partner = g.players[partnerId];
      const myProps = BOARD.map((sp, i) => (g.owner[i] === me.id ? i : -1)).filter(i => i >= 0);
      const thProps = BOARD.map((sp, i) => (g.owner[i] === partnerId ? i : -1)).filter(i => i >= 0);
      const propChecks = (arr) => arr.map(i => `
        <label class="trade-prop"><input type="checkbox" data-i="${i}">
          <span class="tp-bar" style="background:${GROUP_COLORS[BOARD[i].group]}"></span>${BOARD[i].name}</label>`).join('') || '<span class="muted">none</span>';
      this.modal(`<h2>🤝 Propose Trade</h2>
        <div class="trade-head">With:
          <select id="trade-partner">${others.map(o => `<option value="${o.id}" ${o.id===partnerId?'selected':''}>${o.name}</option>`).join('')}</select>
        </div>
        <div class="trade-cols">
          <div class="trade-col">
            <h3>You give</h3>
            <div id="give-props">${propChecks(myProps)}</div>
            <label>Cash $<input type="number" id="give-cash" value="0" min="0" max="${me.cash}" step="10"></label>
          </div>
          <div class="trade-col">
            <h3>You get</h3>
            <div id="get-props">${propChecks(thProps)}</div>
            <label>Cash $<input type="number" id="get-cash" value="0" min="0" max="${partner.cash}" step="10"></label>
          </div>
        </div>
        <div class="modal-actions">
          <button class="act primary" id="trade-send">Send offer</button>
          <button class="act" id="trade-cancel">Cancel</button>
        </div>`);
      document.getElementById('trade-partner').onchange = (e) => { partnerId = +e.target.value; render(); };
      document.getElementById('trade-cancel').onclick = () => this.closeModal();
      document.getElementById('trade-send').onclick = () => {
        const give = { cash: +document.getElementById('give-cash').value || 0,
          props: [...document.querySelectorAll('#give-props input:checked')].map(c => +c.dataset.i) };
        const get = { cash: +document.getElementById('get-cash').value || 0,
          props: [...document.querySelectorAll('#get-props input:checked')].map(c => +c.dataset.i) };
        const offer = { fromId: me.id, toId: partnerId, give, get };
        if (!g.tradeValid(offer)) { this.toast('Invalid trade (check buildings / funds).'); return; }
        this.closeModal();
        Controller.submitTrade(offer);
      };
    };
    render();
  },

  showTradeConfirm() {
    // Only used when a human partner must accept (AI auto-handled in Controller).
    const g = this.game;
    const o = g.pending.offer;
    const partner = g.players[o.toId];
    if (partner.isAI) return;
    const list = (arr, cash) => {
      const props = arr.map(i => BOARD[i].name).join(', ') || '—';
      return `properties: ${props}${cash ? ` · $${cash}` : ''}`;
    };
    this.modal(`<h2>🤝 Trade offer to ${partner.name}</h2>
      <p><b>${g.players[o.fromId].name} gives:</b> ${list(o.give.props, o.give.cash)}</p>
      <p><b>and receives:</b> ${list(o.get.props, o.get.cash)}</p>
      <div class="modal-actions">
        <button class="act primary" id="tc-accept">Accept</button>
        <button class="act danger" id="tc-reject">Reject</button>
      </div>`);
    document.getElementById('tc-accept').onclick = () => { g.executeTrade(o); this.render(); };
    document.getElementById('tc-reject').onclick = () => { g.cancelTrade(); this.toast('Trade rejected.'); this.render(); };
  },

  /* ---- card popup ------------------------------------------------------ */
  showCard(card, deck) {
    const wrap = document.createElement('div');
    wrap.className = 'card-pop ' + (deck === 'chance' ? 'chance' : 'chest');
    wrap.innerHTML = `<div class="cp-inner">
      <div class="cp-title">${deck === 'chance' ? '❓ CHANCE' : '🎁 COMMUNITY CHEST'}</div>
      <div class="cp-text">${card.text}</div></div>`;
    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add('show'));
    setTimeout(() => { wrap.classList.remove('show'); setTimeout(() => wrap.remove(), 400); }, 2200);
  },

  /* ---- log ------------------------------------------------------------- */
  log(msg, type = '') {
    const line = document.createElement('div');
    line.className = 'log-line ' + type;
    line.textContent = msg;
    this.el.log.appendChild(line);
    this.el.log.scrollTop = this.el.log.scrollHeight;
    while (this.el.log.children.length > 200) this.el.log.removeChild(this.el.log.firstChild);
  },

  /* ---- modal plumbing -------------------------------------------------- */
  modal(html) {
    this.el.modal.innerHTML = `<div class="modal-box">${html}</div>`;
    this.el.modal.classList.add('open');
    // wire any embedded asset managers
    if (document.getElementById('manage-list')) this.bindAssetClicks('manage-list', false);
    if (document.getElementById('debt-assets')) this.bindAssetClicks('debt-assets', true);
  },
  closeModal() {
    this.el.modal.classList.remove('open');
    this.el.modal.innerHTML = '';
  },

  toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 1800);
  },

  onTileClick(i) {
    const g = this.game;
    if (g.owner[i] === null && BOARD[i].price) {
      this.toast(`${BOARD[i].name} — $${BOARD[i].price} (unowned)`);
    } else if (g.owner[i] !== null) {
      this.toast(`${BOARD[i].name} — owned by ${g.players[g.owner[i]].name}`);
    }
  },

  gameOver(winner) {
    this.closeModal();
    const tk = TOKENS.find(t => t.id === winner.token);
    this.el.modal.innerHTML = `<div class="modal-box win">
      <div class="confetti">🎉</div>
      <h1>${tk.emoji} ${winner.name} wins!</h1>
      <p>Last tycoon standing with $${winner.cash} in cash.</p>
      <button class="act primary" onclick="location.reload()">🔄 New Game</button>
    </div>`;
    this.el.modal.classList.add('open');
  },
};
