/* ============================================================================
 * game.js — The Monopoly rules engine.
 *
 * Pure-ish state machine. It owns all game state and enforces every rule, but
 * does no DOM work. The UI layer subscribes through a handful of hooks:
 *   hooks.render()            re-draw everything from current state
 *   hooks.log(msg, type)      append a line to the activity log
 *   hooks.showCard(card,deck) surface a drawn Chance / Community Chest card
 *   hooks.animateMove(id,from,to,cb)  optional token animation, must call cb()
 *   hooks.gameOver(winner)    a single player remains
 *
 * The UI / AI controller drives turns by calling public methods and reading
 * `game.pending` to know which decision is currently open.
 * ==========================================================================*/

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

class MonopolyGame {
  constructor(playerConfigs, hooks) {
    this.hooks = Object.assign({
      render() {}, log() {}, showCard() {}, gameOver() {},
      animateMove(id, from, to, cb) { cb(); },
    }, hooks || {});

    this.players = playerConfigs.map((cfg, i) => ({
      id: i,
      name: cfg.name,
      isAI: cfg.isAI,
      token: cfg.token,
      cash: STARTING_CASH,
      position: 0,
      inJail: false,
      jailTurns: 0,
      getOutCards: 0,
      bankrupt: false,
    }));

    // index -> owning player id, or null for the bank.
    this.owner = BOARD.map(() => null);
    // index -> houses (0-4) or 5 for a hotel.
    this.houses = BOARD.map(() => 0);
    this.mortgaged = BOARD.map(() => false);

    this.housesLeft = MAX_HOUSES;
    this.hotelsLeft = MAX_HOTELS;

    this.current = 0;
    this.dice = [0, 0];
    this.doubles = 0;
    this.phase = 'preroll';          // preroll | postroll | gameover
    this.pending = null;             // { type, ... } decision blocking endTurn
    this.lastRollWasDoubles = false;

    this.chanceDeck = shuffle([...Array(CHANCE.length).keys()]);
    this.chestDeck = shuffle([...Array(CHEST.length).keys()]);
    this.chancePtr = 0;
    this.chestPtr = 0;

    this.log(`🎲 بازی جدید — ${this.players.map(p => p.name).join('، ')}.`);
    this.log(`${this.player.name} اول شروع می‌کند.`);
  }

  /* ---- convenience accessors ------------------------------------------- */
  get player() { return this.players[this.current]; }
  livePlayers() { return this.players.filter(p => !p.bankrupt); }

  log(msg, type) { this.hooks.log(msg, type); }
  render() { this.hooks.render(); }

  /* ---- ownership / valuation helpers ----------------------------------- */
  ownedByGroup(playerId, group) {
    return BOARD.reduce((n, sp, i) =>
      n + (sp.group === group && this.owner[i] === playerId ? 1 : 0), 0);
  }
  hasMonopoly(playerId, group) {
    return this.ownedByGroup(playerId, group) === GROUP_SIZE[group];
  }
  // Houses must be built/sold evenly across a color group.
  groupIndices(group) {
    return BOARD.map((sp, i) => (sp.group === group ? i : -1)).filter(i => i >= 0);
  }
  netWorth(player) {
    let w = player.cash;
    BOARD.forEach((sp, i) => {
      if (this.owner[i] !== player.id) return;
      w += this.mortgaged[i] ? 0 : Math.floor(sp.price / 2);
      if (this.houses[i] > 0) w += this.houses[i] * (sp.houseCost / 2);
    });
    return w;
  }

  /* ---- rent calculation ------------------------------------------------ */
  rentFor(index, diceTotal) {
    const sp = BOARD[index];
    const ownerId = this.owner[index];
    if (ownerId === null || this.mortgaged[index]) return 0;

    if (sp.type === 'railroad') {
      const cnt = this.ownedByGroup(ownerId, 'railroad');
      return [0, 25, 50, 100, 200][cnt];
    }
    if (sp.type === 'utility') {
      const cnt = this.ownedByGroup(ownerId, 'utility');
      return (cnt === 2 ? 10 : 4) * diceTotal;
    }
    // standard property
    const h = this.houses[index];
    if (h === 0) {
      const base = sp.rent[0];
      return this.hasMonopoly(ownerId, sp.group) ? base * 2 : base;
    }
    return sp.rent[h];
  }

  /* ====================================================================== *
   *  TURN START — jail handling + rolling
   * ====================================================================== */

  // For a jailed player at the start of their turn.
  jailPay() {
    const p = this.player;
    if (!p.inJail) return;
    if (!this.charge(p, JAIL_FINE, null)) return;     // can't afford -> debt flow
    p.inJail = false; p.jailTurns = 0;
    this.log(`${p.name} مبلغ ${JAIL_FINE} دلار وثیقه داد و آزاد شد.`);
    this.render();
  }

  jailUseCard() {
    const p = this.player;
    if (!p.inJail || p.getOutCards <= 0) return;
    p.getOutCards--; p.inJail = false; p.jailTurns = 0;
    this.log(`${p.name} از کارت «آزادی از زندان» استفاده کرد.`);
    this.render();
  }

  rollDice() {
    if (this.phase !== 'preroll' || this.pending) return;
    const p = this.player;
    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    this.dice = [d1, d2];
    const isDouble = d1 === d2;
    this.lastRollWasDoubles = isDouble;
    this.log(`${p.name} تاس انداخت: ${d1} + ${d2} = ${d1 + d2}${isDouble ? ' (جفت!)' : ''}.`);

    if (p.inJail) return this._jailRoll(isDouble, d1 + d2);

    if (isDouble) {
      this.doubles++;
      if (this.doubles === 3) {
        this.log(`${p.name} سه بار پشت‌سرهم جفت آورد — به زندان!`);
        this.sendToJail(p);
        this.phase = 'postroll';
        this.render();
        return;
      }
    } else {
      this.doubles = 0;
    }
    this._advance(p, d1 + d2);
  }

  _jailRoll(isDouble, total) {
    const p = this.player;
    if (isDouble) {
      p.inJail = false; p.jailTurns = 0;
      this.log(`${p.name} جفت آورد و آزاد شد!`);
      this.doubles = 0;                 // does NOT grant another roll from jail
      this._advance(p, total, /*fromJail*/ true);
    } else {
      p.jailTurns++;
      if (p.jailTurns >= 3) {
        this.log(`${p.name} سه بار ناموفق بود — باید ${JAIL_FINE} دلار بپردازد.`);
        if (this.charge(p, JAIL_FINE, null)) {
          p.inJail = false; p.jailTurns = 0;
          this._advance(p, total, true);
        }
      } else {
        this.log(`${p.name} در زندان می‌ماند (تلاش ${p.jailTurns}/۳).`);
        this.phase = 'postroll';
        this.render();
      }
    }
  }

  /* ====================================================================== *
   *  MOVEMENT + LANDING
   * ====================================================================== */
  _advance(p, steps, fromJail = false) {
    const from = p.position;
    let to = (from + steps) % BOARD.length;
    if (!fromJail && from + steps >= BOARD.length) {
      p.cash += GO_SALARY;
      this.log(`${p.name} از «شروع» عبور کرد و ${GO_SALARY} دلار گرفت.`);
    }
    this.hooks.animateMove(p.id, from, to, () => {
      p.position = to;
      this.render();
      this._land(p, to, steps);
    });
  }

  // Teleport (cards). Awards GO salary if passing it forward, unless silent.
  _moveTo(p, target, { goBonus = true } = {}) {
    const from = p.position;
    if (goBonus && target <= from && target !== from) {
      // wrapped around the board
      p.cash += GO_SALARY;
      this.log(`${p.name} از «شروع» عبور کرد و ${GO_SALARY} دلار گرفت.`);
    } else if (goBonus && target === 0 && from !== 0) {
      // handled above for wrap; direct landing on GO gives salary via _advance normally
    }
    this.hooks.animateMove(p.id, from, target, () => {
      p.position = target;
      this.render();
      this._land(p, target, this.dice[0] + this.dice[1]);
    });
  }

  _land(p, index, diceTotal) {
    const sp = BOARD[index];
    if (this.hooks.onLand) this.hooks.onLand(p, index);   // space-name + owner popup
    switch (sp.type) {
      case 'go':
        this.log(`${p.name} روی «شروع» فرود آمد.`);
        this._afterLanding(); break;
      case 'jail':
        this.log(`${p.name} فقط به زندان سر می‌زند.`);
        this._afterLanding(); break;
      case 'freeparking':
        this.log(`${p.name} در پارکینگ رایگان استراحت می‌کند.`);
        this._afterLanding(); break;
      case 'gotojail':
        this.sendToJail(p);
        this._afterLanding(); break;
      case 'tax':
        this.log(`${p.name} باید ${sp.amount} دلار «${sp.name}» بپردازد.`);
        this.charge(p, sp.amount, null);
        this._afterLanding(); break;
      case 'chance':
        this._drawCard('chance'); break;
      case 'chest':
        this._drawCard('chest'); break;
      default: // property / railroad / utility
        this._landBuyable(p, index, diceTotal); break;
    }
  }

  _landBuyable(p, index, diceTotal) {
    const sp = BOARD[index];
    const ownerId = this.owner[index];
    if (ownerId === null) {
      // open for purchase
      this.pending = { type: 'buy', index };
      this.log(`«${sp.name}» بدون مالک است (${sp.price} دلار).`);
      this.render();
      return;                       // wait for buy / auction decision
    }
    if (ownerId === p.id) {
      this.log(`${p.name} از قبل مالک «${sp.name}» است.`);
      this._afterLanding(); return;
    }
    if (this.mortgaged[index]) {
      this.log(`«${sp.name}» در رهن است — اجاره‌ای ندارد.`);
      this._afterLanding(); return;
    }
    const rent = this.rentFor(index, diceTotal);
    const owner = this.players[ownerId];
    this.log(`${p.name} مبلغ ${rent} دلار اجارهٔ «${sp.name}» را به ${owner.name} داد.`);
    this.charge(p, rent, owner);
    this._afterLanding();
  }

  _drawCard(deck) {
    let cardIdx, card;
    if (deck === 'chance') {
      cardIdx = this.chanceDeck[this.chancePtr];
      this.chancePtr = (this.chancePtr + 1) % this.chanceDeck.length;
      card = CHANCE[cardIdx];
    } else {
      cardIdx = this.chestDeck[this.chestPtr];
      this.chestPtr = (this.chestPtr + 1) % this.chestDeck.length;
      card = CHEST[cardIdx];
    }
    this.log(`${this.player.name} کارت ${deck === 'chance' ? 'شانس' : 'صندوق مشترک'} کشید: «${card.text}»`);
    this.hooks.showCard(card, deck);
    this._applyCard(card);
  }

  _applyCard(card) {
    const p = this.player;
    const [verb, raw] = card.action.split(':');
    switch (verb) {
      case 'move': {
        const target = parseInt(raw, 10);
        // teleport, award GO salary if we wrap forward
        return this._cardMove(p, target);
      }
      case 'moveBack': {
        const n = parseInt(raw, 10);
        const target = (p.position - n + BOARD.length) % BOARD.length;
        return this._cardMove(p, target, /*goBonus*/ false);
      }
      case 'nearest': {
        const type = raw;
        let i = p.position;
        do { i = (i + 1) % BOARD.length; } while (BOARD[i].type !== type);
        this.pendingCardMultiplier = (type === 'utility') ? 'util10' : 'railx2';
        return this._cardMove(p, i);
      }
      case 'jail':
        this.sendToJail(p);
        return this._afterLanding();
      case 'getOutFree':
        p.getOutCards++;
        return this._afterLanding();
      case 'money': {
        const amt = parseInt(raw, 10);
        if (amt >= 0) { p.cash += amt; this.log(`${p.name} مبلغ ${amt} دلار گرفت.`); this.render(); }
        else this.charge(p, -amt, null);
        return this._afterLanding();
      }
      case 'eachPlayer': {
        const amt = parseInt(raw, 10);
        this.livePlayers().forEach(o => {
          if (o.id === p.id) return;
          if (amt >= 0) { this.charge(o, amt, p); }
          else { this.charge(p, -amt, o); }
        });
        return this._afterLanding();
      }
      case 'repairs': {
        const [perHouse, perHotel] = raw.split(',').map(Number);
        let houses = 0, hotels = 0;
        BOARD.forEach((sp, i) => {
          if (this.owner[i] === p.id) {
            if (this.houses[i] === 5) hotels++;
            else houses += this.houses[i];
          }
        });
        const bill = houses * perHouse + hotels * perHotel;
        this.log(`${p.name} باید ${bill} دلار بابت تعمیرات بپردازد (${houses} خانه، ${hotels} هتل).`);
        this.charge(p, bill, null);
        return this._afterLanding();
      }
    }
  }

  _cardMove(p, target, goBonus = true) {
    const from = p.position;
    if (goBonus && target < from) {
      p.cash += GO_SALARY;
      this.log(`${p.name} از «شروع» عبور کرد و ${GO_SALARY} دلار گرفت.`);
    }
    this.hooks.animateMove(p.id, from, target, () => {
      p.position = target;
      this.render();
      // Special card rents: nearest railroad pays double, nearest utility 10x.
      const mult = this.pendingCardMultiplier;
      this.pendingCardMultiplier = null;
      const sp = BOARD[target];
      const ownerId = this.owner[target];
      if (mult && ownerId !== null && ownerId !== p.id && !this.mortgaged[target]) {
        let rent;
        if (mult === 'railx2') rent = this.rentFor(target, 0) * 2;
        else rent = (this.dice[0] + this.dice[1]) * 10;
        this.log(`${p.name} مبلغ ${rent} دلار بابت «${sp.name}» به ${this.players[ownerId].name} داد.`);
        this.charge(p, rent, this.players[ownerId]);
        return this._afterLanding();
      }
      this._land(p, target, this.dice[0] + this.dice[1]);
    });
  }

  // Called after a landing fully resolves (no purchase pending).
  _afterLanding() {
    if (this.pending) return;        // buy decision still open
    this.phase = 'postroll';
    this.render();
  }

  /* ====================================================================== *
   *  BUY / AUCTION
   * ====================================================================== */
  buyCurrent() {
    if (!this.pending || this.pending.type !== 'buy') return;
    const index = this.pending.index;
    const sp = BOARD[index];
    const p = this.player;
    if (p.cash < sp.price) { this.log(`${p.name} توان خرید «${sp.name}» را ندارد.`); return; }
    p.cash -= sp.price;
    this.owner[index] = p.id;
    this.log(`${p.name} «${sp.name}» را به ${sp.price} دلار خرید.`, 'buy');
    this.pending = null;
    this._afterLanding();
  }

  // Decline -> property goes to a simple ascending auction among solvent players.
  declineCurrent() {
    if (!this.pending || this.pending.type !== 'buy') return;
    const index = this.pending.index;
    this.pending = null;
    this.startAuction(index);
  }

  startAuction(index) {
    const sp = BOARD[index];
    const contenders = this.livePlayers().map(p => p.id);
    this.pending = {
      type: 'auction', index,
      bid: 0, highBidder: null,
      contenders, turn: 0, passed: new Set(),
    };
    this.log(`حراج «${sp.name}» شروع شد (حداقل پیشنهاد ۱۰ دلار).`, 'auction');
    this.render();
    this._auctionMaybeAI();
  }

  auctionBid(playerId, amount) {
    const a = this.pending;
    if (!a || a.type !== 'auction') return;
    const p = this.players[playerId];
    if (a.passed.has(playerId) || p.bankrupt) return;
    if (amount <= a.bid || amount > p.cash) return;
    a.bid = amount; a.highBidder = playerId;
    this.log(`${p.name} پیشنهاد ${amount} دلار داد.`, 'auction');
    this._auctionNext();
  }

  auctionPass(playerId) {
    const a = this.pending;
    if (!a || a.type !== 'auction') return;
    a.passed.add(playerId);
    this.log(`${this.players[playerId].name} انصراف داد.`, 'auction');
    this._auctionNext();
  }

  _auctionNext() {
    const a = this.pending;
    const active = a.contenders.filter(id => !a.passed.has(id));
    if (active.length <= 1) return this._auctionEnd();
    // advance to next active bidder
    do { a.turn = (a.turn + 1) % a.contenders.length; }
    while (a.passed.has(a.contenders[a.turn]));
    this.render();
    this._auctionMaybeAI();
  }

  _auctionEnd() {
    const a = this.pending;
    const index = a.index;
    if (a.highBidder !== null) {
      const p = this.players[a.highBidder];
      p.cash -= a.bid;
      this.owner[index] = p.id;
      this.log(`${p.name} «${BOARD[index].name}» را با ${a.bid} دلار برد.`, 'auction');
    } else {
      this.log(`پیشنهادی نبود — «${BOARD[index].name}» نزد بانک ماند.`, 'auction');
    }
    this.pending = null;
    this._afterLanding();
  }

  // Drive AI bidders automatically.
  _auctionMaybeAI() {
    const a = this.pending;
    if (!a || a.type !== 'auction') return;
    const id = a.contenders[a.turn];
    const p = this.players[id];
    if (!p.isAI || a.passed.has(id)) return;
    setTimeout(() => {
      if (this.pending !== a) return;
      const sp = BOARD[a.index];
      const cap = Math.min(p.cash, Math.floor(sp.price * 1.25));
      const next = a.bid + 10;
      if (next <= cap && Math.random() < 0.85) this.auctionBid(id, next);
      else this.auctionPass(id);
    }, 600);
  }

  /* ====================================================================== *
   *  BUILDING / MORTGAGING (management actions, allowed in either phase)
   * ====================================================================== */
  canBuild(index) {
    const sp = BOARD[index];
    const p = this.player;
    if (sp.type !== 'property') return false;
    if (this.owner[index] !== p.id) return false;
    if (!this.hasMonopoly(p.id, sp.group)) return false;
    if (this.houses[index] >= 5) return false;
    if (this.mortgaged[index]) return false;
    // even building: can't exceed the group minimum by more than 1
    const min = Math.min(...this.groupIndices(sp.group).map(i => this.houses[i]));
    if (this.houses[index] > min) return false;
    // no mortgaged lots in the group
    if (this.groupIndices(sp.group).some(i => this.mortgaged[i])) return false;
    const needHotel = this.houses[index] === 4;
    if (needHotel && this.hotelsLeft <= 0) return false;
    if (!needHotel && this.housesLeft <= 0) return false;
    return p.cash >= sp.houseCost;
  }

  buildHouse(index) {
    if (!this.canBuild(index)) return;
    const sp = BOARD[index];
    const p = this.player;
    p.cash -= sp.houseCost;
    if (this.houses[index] === 4) {
      this.houses[index] = 5;
      this.housesLeft += 4;          // 4 houses return to the bank
      this.hotelsLeft -= 1;
      this.log(`${p.name} روی «${sp.name}» هتل ساخت.`, 'build');
    } else {
      this.houses[index]++;
      this.housesLeft -= 1;
      this.log(`${p.name} روی «${sp.name}» خانه ساخت (اکنون ${this.houses[index]}).`, 'build');
    }
    this.render();
  }

  canSell(index) {
    const sp = BOARD[index];
    const p = this.player;
    if (sp.type !== 'property' || this.owner[index] !== p.id) return false;
    if (this.houses[index] <= 0) return false;
    // even selling
    const max = Math.max(...this.groupIndices(sp.group).map(i => this.houses[i]));
    if (this.houses[index] < max) return false;
    if (this.houses[index] === 5 && this.housesLeft < 4) return false; // need 4 houses to break a hotel
    return true;
  }

  sellHouse(index) {
    if (!this.canSell(index)) return;
    const sp = BOARD[index];
    const p = this.player;
    const refund = Math.floor(sp.houseCost / 2);
    p.cash += refund;
    if (this.houses[index] === 5) {
      this.houses[index] = 4;
      this.hotelsLeft += 1;
      this.housesLeft -= 4;
      this.log(`${p.name} هتل «${sp.name}» را به ${refund} دلار فروخت.`, 'build');
    } else {
      this.houses[index]--;
      this.housesLeft += 1;
      this.log(`${p.name} یک خانه از «${sp.name}» را به ${refund} دلار فروخت.`, 'build');
    }
    this.render();
  }

  canMortgage(index) {
    return this.owner[index] === this.player.id &&
           !this.mortgaged[index] &&
           this.houses[index] === 0 &&
           BOARD[index].mortgage > 0;
  }
  mortgage(index) {
    if (!this.canMortgage(index)) return;
    const p = this.player;
    p.cash += BOARD[index].mortgage;
    this.mortgaged[index] = true;
    this.log(`${p.name} «${BOARD[index].name}» را به ${BOARD[index].mortgage} دلار رهن گذاشت.`);
    this.render();
  }
  canUnmortgage(index) {
    if (this.owner[index] !== this.player.id || !this.mortgaged[index]) return false;
    return this.player.cash >= Math.ceil(BOARD[index].mortgage * 1.1);
  }
  unmortgage(index) {
    if (!this.canUnmortgage(index)) return;
    const p = this.player;
    const cost = Math.ceil(BOARD[index].mortgage * 1.1);
    p.cash -= cost;
    this.mortgaged[index] = false;
    this.log(`${p.name} رهن «${BOARD[index].name}» را با ${cost} دلار آزاد کرد.`);
    this.render();
  }

  /* ====================================================================== *
   *  PAYMENTS, DEBT & BANKRUPTCY
   * ====================================================================== */
  // Charge `amount` from player to creditor (player obj) or null=bank.
  // Returns true if paid in full. If not, opens a debt-resolution pending.
  charge(player, amount, creditor) {
    if (amount <= 0) return true;
    if (player.cash >= amount) {
      player.cash -= amount;
      if (creditor) creditor.cash += amount;
      this.render();
      return true;
    }
    // Not enough cash. Can they cover it by liquidating?
    if (player.isAI) {
      this._aiLiquidate(player, amount);
      if (player.cash >= amount) {
        player.cash -= amount;
        if (creditor) creditor.cash += amount;
        this.render();
        return true;
      }
      this._bankrupt(player, creditor);
      return false;
    }
    // Human: open debt panel.
    this.pending = { type: 'debt', amount, creditorId: creditor ? creditor.id : null };
    this.log(`${player.name} باید ${amount} دلار بپردازد اما فقط ${player.cash} دلار دارد. پول جمع کن یا ورشکست شو.`, 'warn');
    this.render();
    return false;
  }

  // Human clicks "Pay debt" once they've raised enough.
  settleDebt() {
    const d = this.pending;
    if (!d || d.type !== 'debt') return;
    const p = this.player;
    if (p.cash < d.amount) return;
    p.cash -= d.amount;
    if (d.creditorId !== null) this.players[d.creditorId].cash += d.amount;
    this.log(`${p.name} بدهی ${d.amount} دلاری را تسویه کرد.`);
    this.pending = null;
    this._afterLanding();
  }

  declareBankruptcy() {
    const d = this.pending;
    if (!d || d.type !== 'debt') return;
    const creditor = d.creditorId !== null ? this.players[d.creditorId] : null;
    this._bankrupt(this.player, creditor);
  }

  _bankrupt(player, creditor) {
    player.bankrupt = true;
    this.log(`💀 ${player.name} ورشکست شد!`, 'warn');
    // Hand assets to creditor, or auction back to the bank.
    BOARD.forEach((sp, i) => {
      if (this.owner[i] !== player.id) return;
      // return houses to the bank for cash value, paid to creditor
      while (this.houses[i] > 0) {
        if (this.houses[i] === 5) { this.houses[i] = 4; this.hotelsLeft++; this.housesLeft -= 4; }
        else { this.houses[i]--; this.housesLeft++; }
        const refund = Math.floor(sp.houseCost / 2);
        if (creditor) creditor.cash += refund;
      }
      this.owner[i] = creditor ? creditor.id : null;
      if (!creditor) this.mortgaged[i] = false;   // bank clears mortgage on resale pool
    });
    if (creditor) {
      creditor.cash += player.cash;
      player.getOutCards && (creditor.getOutCards += player.getOutCards);
    }
    player.cash = 0;
    player.getOutCards = 0;
    this.pending = null;

    if (this.livePlayers().length === 1) {
      this.phase = 'gameover';
      this.render();
      this.hooks.gameOver(this.livePlayers()[0]);
      return;
    }
    // If the bankrupt player was the current one, move on.
    if (player.id === this.current) {
      this.doubles = 0;
      this.endTurn(/*force*/ true);
    } else {
      this.render();
    }
  }

  /* ====================================================================== *
   *  JAIL
   * ====================================================================== */
  sendToJail(p) {
    p.position = JAIL_INDEX;
    p.inJail = true;
    p.jailTurns = 0;
    this.doubles = 0;
    this.log(`🚔 ${p.name} به زندان فرستاده شد.`, 'warn');
    this.render();
  }

  /* ====================================================================== *
   *  TRADING (player <-> player)
   *  offer = { fromId, toId, give:{cash, props[]}, get:{cash, props[]} }
   * ====================================================================== */
  proposeTrade(offer) {
    this.pending = { type: 'trade', offer };
    this.render();
  }
  tradeValid(offer) {
    const from = this.players[offer.fromId];
    const to = this.players[offer.toId];
    if (from.cash < offer.give.cash || to.cash < offer.get.cash) return false;
    // no buildings on any traded property's group
    const all = [...offer.give.props, ...offer.get.props];
    for (const i of all) {
      const grp = BOARD[i].group;
      if (this.groupIndices(grp).some(j => this.houses[j] > 0)) return false;
    }
    if (offer.give.props.some(i => this.owner[i] !== from.id)) return false;
    if (offer.get.props.some(i => this.owner[i] !== to.id)) return false;
    return true;
  }
  executeTrade(offer) {
    if (!this.tradeValid(offer)) { this.log('معامله نامعتبر است.', 'warn'); this.pending = null; this.render(); return; }
    const from = this.players[offer.fromId];
    const to = this.players[offer.toId];
    from.cash -= offer.give.cash; to.cash += offer.give.cash;
    to.cash -= offer.get.cash; from.cash += offer.get.cash;
    offer.give.props.forEach(i => this.owner[i] = to.id);
    offer.get.props.forEach(i => this.owner[i] = from.id);
    this.log(`🤝 ${from.name} و ${to.name} معامله را انجام دادند.`, 'buy');
    this.pending = null;
    this.render();
  }
  cancelTrade() { this.pending = null; this.render(); }

  /* ====================================================================== *
   *  END TURN
   * ====================================================================== */
  canEndTurn() {
    return this.phase === 'postroll' && !this.pending;
  }
  endTurn(force = false) {
    if (!force && !this.canEndTurn()) return;
    // doubles -> same player rolls again (unless they were jailed this turn)
    const p = this.player;
    if (!force && this.lastRollWasDoubles && !p.inJail && this.doubles > 0 && this.doubles < 3) {
      this.phase = 'preroll';
      this.lastRollWasDoubles = false;
      this.log(`${p.name} جفت آورد — دوباره تاس می‌اندازد.`);
      this.render();
      return;
    }
    this.doubles = 0;
    this.lastRollWasDoubles = false;
    // advance to next non-bankrupt player
    do {
      this.current = (this.current + 1) % this.players.length;
    } while (this.players[this.current].bankrupt);
    this.phase = 'preroll';
    this.log(`— نوبت ${this.player.name} —`);
    this.render();
  }

  /* ====================================================================== *
   *  SIMPLE AI LIQUIDATION (sell houses then mortgage to raise cash)
   * ====================================================================== */
  _aiLiquidate(player, target) {
    // sell houses evenly
    let guard = 0;
    while (player.cash < target && guard++ < 200) {
      let sold = false;
      // find a property with the most houses in player's holdings
      let best = -1, bestH = 0;
      BOARD.forEach((sp, i) => {
        if (this.owner[i] === player.id && this.houses[i] > bestH) {
          const max = Math.max(...this.groupIndices(sp.group).map(j => this.houses[j]));
          if (this.houses[i] === max) { best = i; bestH = this.houses[i]; }
        }
      });
      if (best >= 0) {
        const sp = BOARD[best];
        const refund = Math.floor(sp.houseCost / 2);
        if (this.houses[best] === 5) { this.houses[best] = 4; this.hotelsLeft++; this.housesLeft -= 4; }
        else { this.houses[best]--; this.housesLeft++; }
        player.cash += refund;
        sold = true;
      }
      if (!sold) break;
    }
    // then mortgage
    guard = 0;
    while (player.cash < target && guard++ < 100) {
      let did = false;
      for (let i = 0; i < BOARD.length; i++) {
        if (this.owner[i] === player.id && !this.mortgaged[i] && this.houses[i] === 0 && BOARD[i].mortgage > 0) {
          player.cash += BOARD[i].mortgage;
          this.mortgaged[i] = true;
          did = true;
          if (player.cash >= target) break;
        }
      }
      if (!did) break;
    }
  }
}
