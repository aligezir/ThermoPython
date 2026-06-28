/* ============================================================================
 * main.js — Setup screen + game controller.
 * Wires the rules engine (game.js) to the renderer (ui.js), and drives the
 * computer players. Hot-seat: multiple humans share one screen.
 * ==========================================================================*/

const Controller = {
  game: null,
  aiTimer: null,

  /* ---- setup screen ---------------------------------------------------- */
  showSetup() {
    const root = document.getElementById('setup');
    const rows = [];
    for (let i = 0; i < 6; i++) {
      const on = i < 2;          // default 2 players
      rows.push(`
        <div class="setup-row ${on ? '' : 'off'}" data-i="${i}">
          <label class="sw"><input type="checkbox" class="p-on" ${on ? 'checked' : ''} ${i < 2 ? 'disabled' : ''}><span></span></label>
          <span class="p-token">${TOKENS[i].emoji}</span>
          <input class="p-name" type="text" value="بازیکن ${i + 1}" maxlength="14">
          <select class="p-type">
            <option value="human">🧑 انسان</option>
            <option value="ai" ${i >= 2 ? '' : ''}>🤖 کامپیوتر</option>
          </select>
        </div>`);
    }
    root.innerHTML = `
      <div class="setup-card">
        <div class="setup-brand">مونوپولی</div>
        <p class="setup-sub">بازی کلاسیک خرید و فروش املاک · با تمام قواعد</p>
        <div class="setup-city">
          <label>🏙️ در کدام شهر ایران بازی می‌کنی؟</label>
          <select id="city-select">
            ${Object.keys(CITIES).map(k => `<option value="${k}">${CITIES[k].label}</option>`).join('')}
          </select>
        </div>
        <div class="setup-players">${rows.join('')}</div>
        <button class="act primary big" id="start-btn">▶ شروع بازی</button>
        <details class="rules-peek"><summary>راهنما / قواعد گنجانده‌شده</summary>
          <ul>
            <li>تاس بینداز، حرکت کن، ملک بخر یا آن را به حراج بگذار.</li>
            <li>هر بار از «شروع» عبور کنی ۲۰۰ دلار بگیر.</li>
            <li>اجاره بپرداز — ست رنگی کامل اجارهٔ پایه را دو برابر می‌کند و امکان ساخت خانه و هتل می‌دهد.</li>
            <li>کارت‌های شانس و صندوق مشترک، مالیات درآمد/تجملات، زندان با وثیقه، جفت، رهن و معاملهٔ بین بازیکنان همگی هستند.</li>
            <li>رقیب را با ناتوان کردن در پرداخت، ورشکست کن. آخرین سرمایه‌دار باقی‌مانده برنده است.</li>
          </ul>
        </details>
      </div>`;

    root.querySelectorAll('.setup-row').forEach(row => {
      const cb = row.querySelector('.p-on');
      cb.addEventListener('change', () => row.classList.toggle('off', !cb.checked));
    });
    document.getElementById('start-btn').onclick = () => this.start();
  },

  start() {
    const cfgs = [];
    document.querySelectorAll('#setup .setup-row').forEach((row, i) => {
      const on = row.querySelector('.p-on').checked;
      if (!on) return;
      cfgs.push({
        name: row.querySelector('.p-name').value.trim() || `بازیکن ${i + 1}`,
        isAI: row.querySelector('.p-type').value === 'ai',
        token: TOKENS[i].id,
      });
    });
    if (cfgs.length < 2) { alert('حداقل به ۲ بازیکن نیاز است.'); return; }

    // apply the chosen city's neighbourhood names + landmarks
    const cityKey = document.getElementById('city-select').value;
    applyCity(cityKey);
    UI.cityKey = cityKey;

    document.getElementById('setup').style.display = 'none';
    document.getElementById('game').style.display = 'grid';
    UI.grabRefs();   // wire log target before the game constructor logs

    const hooks = {
      render: () => { UI.render(); this.scheduleAI(); },
      log: (m, t) => {
        UI.log(m, t);
        // mirror events as popups during the human player's own turn
        const g = this.game;
        if (g && !g.player.isAI && g.phase !== 'gameover'
            && !m.startsWith('—') && !m.startsWith('🎲 بازی')) {
          UI.pushEvent(m, t);
        }
      },
      showCard: (c, d) => UI.showCard(c, d),
      animateMove: (id, f, to, cb) => UI.animateMove(id, f, to, cb),
      onLand: (p, i) => UI.showLanding(p, i),
      gameOver: (w) => UI.gameOver(w),
    };
    this.game = new MonopolyGame(cfgs, hooks);
    UI.init(this.game);
    UI.render();
    this.scheduleAI();
  },

  /* ---- human actions --------------------------------------------------- */
  humanRoll() {
    this.game.rollDice();
    UI.render();
    UI.rollDiceAnimation();
  },

  submitTrade(offer) {
    const g = this.game;
    const partner = g.players[offer.toId];
    g.proposeTrade(offer);
    if (partner.isAI) {
      setTimeout(() => this.aiTradeDecision(offer), 700);
    } else {
      UI.render(); // shows accept/reject modal for the other human
    }
  },

  /* ---- AI driver ------------------------------------------------------- */
  scheduleAI() {
    clearTimeout(this.aiTimer);
    this.aiTimer = setTimeout(() => this.driveAI(), 650);
  },

  driveAI() {
    const g = this.game;
    if (!g || g.phase === 'gameover') return;
    const p = g.player;

    // pending decisions
    if (g.pending) {
      if (g.pending.type === 'buy' && p.isAI) return this.aiBuy();
      // auctions are driven inside the engine; trades handled on submit
      return;
    }
    if (!p.isAI) return;          // human's move — wait for clicks

    if (g.phase === 'preroll') {
      if (p.inJail) return this.aiJail();
      this.aiBuild();
      this.game.rollDice();
      UI.render();
      UI.rollDiceAnimation();
    } else if (g.phase === 'postroll') {
      this.aiBuild();
      this.game.endTurn();
      UI.render();
    }
  },

  aiJail() {
    const g = this.game, p = g.player;
    // pay if rich, else try to roll out
    if (p.getOutCards > 0) { g.jailUseCard(); }
    else if (p.cash > 150) { g.jailPay(); }
    UI.render();
    if (!p.inJail) { this.aiBuild(); }
    // roll (either to move after paying, or to try doubles)
    g.rollDice();
    UI.render();
    UI.rollDiceAnimation();
  },

  aiBuy() {
    const g = this.game, p = g.player;
    const i = g.pending.index, sp = BOARD[i];
    const completes = sp.group && g.ownedByGroup(p.id, sp.group) === GROUP_SIZE[sp.group] - 1;
    const wantsBuffer = sp.type === 'property' ? 50 : 25;
    if (p.cash - sp.price >= wantsBuffer || (completes && p.cash >= sp.price)) {
      g.buyCurrent();
    } else {
      g.declineCurrent();
    }
    UI.render();
  },

  aiBuild() {
    const g = this.game, p = g.player;
    // build evenly on monopolies while keeping a cash cushion
    let guard = 0;
    let built = true;
    while (built && guard++ < 40) {
      built = false;
      const buildable = BOARD
        .map((sp, i) => i)
        .filter(i => g.canBuild(i) && p.cash - BOARD[i].houseCost >= 150);
      if (!buildable.length) break;
      // prefer the lot with the fewest houses (even building) & higher group
      buildable.sort((a, b) => g.houses[a] - g.houses[b]);
      g.buildHouse(buildable[0]);
      built = true;
    }
  },

  aiTradeDecision(offer) {
    const g = this.game;
    if (!g.pending || g.pending.type !== 'trade') return;
    const valProps = (arr) => arr.reduce((s, i) => s + BOARD[i].price, 0);
    const giveVal = valProps(offer.give.props) + offer.give.cash; // what AI receives
    const getVal = valProps(offer.get.props) + offer.get.cash;     // what AI gives up
    // AI (partner) accepts if it nets at least 90% value and stays solvent
    const partner = g.players[offer.toId];
    const ok = giveVal >= getVal * 0.9 && partner.cash + offer.get.cash - offer.get.cash >= 0
               && partner.cash - offer.get.cash >= 0;
    if (ok && g.tradeValid(offer)) {
      g.executeTrade(offer);
      UI.toast(`${partner.name} معامله را پذیرفت.`);
    } else {
      g.cancelTrade();
      UI.toast(`${partner.name} معامله را رد کرد.`);
    }
    UI.render();
  },
};

window.addEventListener('DOMContentLoaded', () => Controller.showSetup());
