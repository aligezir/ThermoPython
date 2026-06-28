/* ============================================================================
 * data.js — Static game data: the board, the cards, the tokens.
 * Classic US Monopoly edition. All prices, rents and card effects follow the
 * standard Hasbro rule set.
 * ==========================================================================*/

// Color groups -> hex used for the property bars.
const GROUP_COLORS = {
  brown:     '#955436',
  lightblue: '#aae0fa',
  pink:      '#d93a96',
  orange:    '#f7941d',
  red:       '#ed1b24',
  yellow:    '#fef200',
  green:     '#1fb25a',
  darkblue:  '#0072bb',
  railroad:  '#2b2b2b',
  utility:   '#c8c8c8',
};

// Human-readable group names (for the UI).
const GROUP_NAMES = {
  brown: 'قهوه‌ای', lightblue: 'آبی روشن', pink: 'صورتی', orange: 'نارنجی',
  red: 'قرمز', yellow: 'زرد', green: 'سبز', darkblue: 'آبی تیره',
  railroad: 'راه‌آهن', utility: 'خدمات شهری',
};

// How many properties form a full monopoly for each group.
const GROUP_SIZE = {
  brown: 2, lightblue: 3, pink: 3, orange: 3, red: 3, yellow: 3,
  green: 3, darkblue: 2, railroad: 4, utility: 2,
};

/* The 40 board spaces, in order from GO (0) clockwise.
 * type: go | property | railroad | utility | tax | chance | chest | jail |
 *       freeparking | gotojail
 * For buyable spaces:
 *   price       purchase price
 *   rent        array [base, 1h, 2h, 3h, 4h, hotel]  (property)
 *   houseCost   cost to add one house / the hotel
 *   mortgage    mortgage value
 *   group       color group key
 */
const BOARD = [
  { name: 'شروع', type: 'go' },
  { name: 'نازی‌آباد', type: 'property', group: 'brown', price: 60, mortgage: 30, houseCost: 50, rent: [2, 10, 30, 90, 160, 250] },
  { name: 'صندوق مشترک', type: 'chest' },
  { name: 'شوش', type: 'property', group: 'brown', price: 60, mortgage: 30, houseCost: 50, rent: [4, 20, 60, 180, 320, 450] },
  { name: 'مالیات بر درآمد', type: 'tax', amount: 200 },
  { name: 'راه‌آهن تهران', type: 'railroad', group: 'railroad', price: 200, mortgage: 100 },
  { name: 'مولوی', type: 'property', group: 'lightblue', price: 100, mortgage: 50, houseCost: 50, rent: [6, 30, 90, 270, 400, 550] },
  { name: 'شانس', type: 'chance' },
  { name: 'پیروزی', type: 'property', group: 'lightblue', price: 100, mortgage: 50, houseCost: 50, rent: [6, 30, 90, 270, 400, 550] },
  { name: 'نارمک', type: 'property', group: 'lightblue', price: 120, mortgage: 60, houseCost: 50, rent: [8, 40, 100, 300, 450, 600] },
  { name: 'زندان / بازدید', type: 'jail' },
  { name: 'تهرانپارس', type: 'property', group: 'pink', price: 140, mortgage: 70, houseCost: 100, rent: [10, 50, 150, 450, 625, 750] },
  { name: 'شرکت برق تهران', type: 'utility', group: 'utility', price: 150, mortgage: 75 },
  { name: 'رسالت', type: 'property', group: 'pink', price: 140, mortgage: 70, houseCost: 100, rent: [10, 50, 150, 450, 625, 750] },
  { name: 'مجیدیه', type: 'property', group: 'pink', price: 160, mortgage: 80, houseCost: 100, rent: [12, 60, 180, 500, 700, 900] },
  { name: 'ترمینال جنوب', type: 'railroad', group: 'railroad', price: 200, mortgage: 100 },
  { name: 'گیشا', type: 'property', group: 'orange', price: 180, mortgage: 90, houseCost: 100, rent: [14, 70, 200, 550, 750, 950] },
  { name: 'صندوق مشترک', type: 'chest' },
  { name: 'یوسف‌آباد', type: 'property', group: 'orange', price: 180, mortgage: 90, houseCost: 100, rent: [14, 70, 200, 550, 750, 950] },
  { name: 'امیرآباد', type: 'property', group: 'orange', price: 200, mortgage: 100, houseCost: 100, rent: [16, 80, 220, 600, 800, 1000] },
  { name: 'پارکینگ رایگان', type: 'freeparking' },
  { name: 'انقلاب', type: 'property', group: 'red', price: 220, mortgage: 110, houseCost: 150, rent: [18, 90, 250, 700, 875, 1050] },
  { name: 'شانس', type: 'chance' },
  { name: 'ولیعصر', type: 'property', group: 'red', price: 220, mortgage: 110, houseCost: 150, rent: [18, 90, 250, 700, 875, 1050] },
  { name: 'هفت‌تیر', type: 'property', group: 'red', price: 240, mortgage: 120, houseCost: 150, rent: [20, 100, 300, 750, 925, 1100] },
  { name: 'ترمینال غرب', type: 'railroad', group: 'railroad', price: 200, mortgage: 100 },
  { name: 'ونک', type: 'property', group: 'yellow', price: 260, mortgage: 130, houseCost: 150, rent: [22, 110, 330, 800, 975, 1150] },
  { name: 'پاسداران', type: 'property', group: 'yellow', price: 260, mortgage: 130, houseCost: 150, rent: [22, 110, 330, 800, 975, 1150] },
  { name: 'آبفای تهران', type: 'utility', group: 'utility', price: 150, mortgage: 75 },
  { name: 'سعادت‌آباد', type: 'property', group: 'yellow', price: 280, mortgage: 140, houseCost: 150, rent: [24, 120, 360, 850, 1025, 1200] },
  { name: 'برو به زندان', type: 'gotojail' },
  { name: 'شهرک غرب', type: 'property', group: 'green', price: 300, mortgage: 150, houseCost: 200, rent: [26, 130, 390, 900, 1100, 1275] },
  { name: 'فرشته', type: 'property', group: 'green', price: 300, mortgage: 150, houseCost: 200, rent: [26, 130, 390, 900, 1100, 1275] },
  { name: 'صندوق مشترک', type: 'chest' },
  { name: 'الهیه', type: 'property', group: 'green', price: 320, mortgage: 160, houseCost: 200, rent: [28, 150, 450, 1000, 1200, 1400] },
  { name: 'فرودگاه مهرآباد', type: 'railroad', group: 'railroad', price: 200, mortgage: 100 },
  { name: 'شانس', type: 'chance' },
  { name: 'زعفرانیه', type: 'property', group: 'darkblue', price: 350, mortgage: 175, houseCost: 200, rent: [35, 175, 500, 1100, 1300, 1500] },
  { name: 'مالیات تجملات', type: 'tax', amount: 100 },
  { name: 'نیاوران', type: 'property', group: 'darkblue', price: 400, mortgage: 200, houseCost: 200, rent: [50, 200, 600, 1400, 1700, 2000] },
];

/* Card actions are encoded so game.js can interpret them generically:
 *   move:n          go to absolute board index n (collect $200 if passing GO)
 *   moveBack:n      move back n spaces (no GO bonus)
 *   nearest:type    advance to nearest 'railroad' or 'utility'
 *   jail            go directly to jail
 *   getOutFree      keep a Get-Out-Of-Jail card
 *   money:n         gain (n>0) or pay (n<0) to/from the bank
 *   eachPlayer:n    collect n from every other player (n>0) or pay (n<0)
 *   repairs:[h,t]   pay h per house and t per hotel
 */
const CHANCE = [
  { text: 'به «شروع» برو. ۲۰۰ دلار بگیر.', action: 'move:0' },
  { text: 'به میدان هفت‌تیر برو.', action: 'move:24' },
  { text: 'به تهرانپارس برو.', action: 'move:11' },
  { text: 'به نزدیک‌ترین شرکت خدماتی برو. ۱۰ برابر تاس بپرداز.', action: 'nearest:utility' },
  { text: 'به نزدیک‌ترین راه‌آهن برو. دو برابر اجاره بپرداز.', action: 'nearest:railroad' },
  { text: 'به نزدیک‌ترین راه‌آهن برو. دو برابر اجاره بپرداز.', action: 'nearest:railroad' },
  { text: 'بانک ۵۰ دلار سود سهام به تو می‌دهد.', action: 'money:50' },
  { text: 'کارت «آزادی از زندان». آن را نگه دار.', action: 'getOutFree' },
  { text: 'سه خانه به عقب برو.', action: 'moveBack:3' },
  { text: 'به زندان برو. از «شروع» عبور نکن.', action: 'jail' },
  { text: 'تعمیرات عمومی: هر خانه ۲۵ دلار، هر هتل ۱۰۰ دلار بپرداز.', action: 'repairs:25,100' },
  { text: 'جریمهٔ سرعت. ۱۵ دلار بپرداز.', action: 'money:-15' },
  { text: 'سفری به راه‌آهن تهران برو.', action: 'move:5' },
  { text: 'به نیاوران برو.', action: 'move:39' },
  { text: 'به ریاست هیئت‌مدیره انتخاب شدی. به هر بازیکن ۵۰ دلار بپرداز.', action: 'eachPlayer:-50' },
  { text: 'وام ساختمانی‌ات سررسید شد. ۱۵۰ دلار بگیر.', action: 'money:150' },
];

const CHEST = [
  { text: 'به «شروع» برو. ۲۰۰ دلار بگیر.', action: 'move:0' },
  { text: 'خطای بانک به نفع تو. ۲۰۰ دلار بگیر.', action: 'money:200' },
  { text: 'حق‌ویزیت پزشک. ۵۰ دلار بپرداز.', action: 'money:-50' },
  { text: 'از فروش سهام ۵۰ دلار می‌گیری.', action: 'money:50' },
  { text: 'کارت «آزادی از زندان». آن را نگه دار.', action: 'getOutFree' },
  { text: 'به زندان برو. از «شروع» عبور نکن.', action: 'jail' },
  { text: 'صندوق تعطیلات سررسید شد. ۱۰۰ دلار بگیر.', action: 'money:100' },
  { text: 'بازگشت مالیات بر درآمد. ۲۰ دلار بگیر.', action: 'money:20' },
  { text: 'تولدت است. از هر بازیکن ۱۰ دلار بگیر.', action: 'eachPlayer:10' },
  { text: 'بیمهٔ عمر سررسید شد. ۱۰۰ دلار بگیر.', action: 'money:100' },
  { text: 'هزینهٔ بیمارستان. ۱۰۰ دلار بپرداز.', action: 'money:-100' },
  { text: 'شهریهٔ مدرسه. ۵۰ دلار بپرداز.', action: 'money:-50' },
  { text: 'حق‌مشاورهٔ ۲۵ دلاری دریافت کن.', action: 'money:25' },
  { text: 'تعمیر خیابان: هر خانه ۴۰ دلار، هر هتل ۱۱۵ دلار.', action: 'repairs:40,115' },
  { text: 'در مسابقهٔ زیبایی دوم شدی. ۱۰ دلار بگیر.', action: 'money:10' },
  { text: 'ارثی به مبلغ ۱۰۰ دلار به تو رسید.', action: 'money:100' },
];

// Player tokens — emoji + a strong accent color for board pieces & panels.
const TOKENS = [
  { id: 'hat',  emoji: '🎩', color: '#e74c3c', name: 'کلاه‌شاپو' },
  { id: 'car',  emoji: '🚗', color: '#3498db', name: 'خودرو' },
  { id: 'dog',  emoji: '🐕', color: '#2ecc71', name: 'سگ' },
  { id: 'ship', emoji: '🚢', color: '#9b59b6', name: 'ناوجنگی' },
  { id: 'boot', emoji: '🥾', color: '#f39c12', name: 'چکمه' },
  { id: 'cat',  emoji: '🐈', color: '#1abc9c', name: 'گربه' },
];

const STARTING_CASH = 1500;
const GO_SALARY = 200;
const JAIL_INDEX = 10;
const JAIL_FINE = 50;
const MAX_HOUSES = 32;   // bank supply
const MAX_HOTELS = 12;   // bank supply
