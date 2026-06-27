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
  brown: 'Brown', lightblue: 'Light Blue', pink: 'Pink', orange: 'Orange',
  red: 'Red', yellow: 'Yellow', green: 'Green', darkblue: 'Dark Blue',
  railroad: 'Railroad', utility: 'Utility',
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
  { name: 'GO', type: 'go' },
  { name: 'Mediterranean Avenue', type: 'property', group: 'brown', price: 60, mortgage: 30, houseCost: 50, rent: [2, 10, 30, 90, 160, 250] },
  { name: 'Community Chest', type: 'chest' },
  { name: 'Baltic Avenue', type: 'property', group: 'brown', price: 60, mortgage: 30, houseCost: 50, rent: [4, 20, 60, 180, 320, 450] },
  { name: 'Income Tax', type: 'tax', amount: 200 },
  { name: 'Reading Railroad', type: 'railroad', group: 'railroad', price: 200, mortgage: 100 },
  { name: 'Oriental Avenue', type: 'property', group: 'lightblue', price: 100, mortgage: 50, houseCost: 50, rent: [6, 30, 90, 270, 400, 550] },
  { name: 'Chance', type: 'chance' },
  { name: 'Vermont Avenue', type: 'property', group: 'lightblue', price: 100, mortgage: 50, houseCost: 50, rent: [6, 30, 90, 270, 400, 550] },
  { name: 'Connecticut Avenue', type: 'property', group: 'lightblue', price: 120, mortgage: 60, houseCost: 50, rent: [8, 40, 100, 300, 450, 600] },
  { name: 'Jail / Just Visiting', type: 'jail' },
  { name: 'St. Charles Place', type: 'property', group: 'pink', price: 140, mortgage: 70, houseCost: 100, rent: [10, 50, 150, 450, 625, 750] },
  { name: 'Electric Company', type: 'utility', group: 'utility', price: 150, mortgage: 75 },
  { name: 'States Avenue', type: 'property', group: 'pink', price: 140, mortgage: 70, houseCost: 100, rent: [10, 50, 150, 450, 625, 750] },
  { name: 'Virginia Avenue', type: 'property', group: 'pink', price: 160, mortgage: 80, houseCost: 100, rent: [12, 60, 180, 500, 700, 900] },
  { name: 'Pennsylvania Railroad', type: 'railroad', group: 'railroad', price: 200, mortgage: 100 },
  { name: 'St. James Place', type: 'property', group: 'orange', price: 180, mortgage: 90, houseCost: 100, rent: [14, 70, 200, 550, 750, 950] },
  { name: 'Community Chest', type: 'chest' },
  { name: 'Tennessee Avenue', type: 'property', group: 'orange', price: 180, mortgage: 90, houseCost: 100, rent: [14, 70, 200, 550, 750, 950] },
  { name: 'New York Avenue', type: 'property', group: 'orange', price: 200, mortgage: 100, houseCost: 100, rent: [16, 80, 220, 600, 800, 1000] },
  { name: 'Free Parking', type: 'freeparking' },
  { name: 'Kentucky Avenue', type: 'property', group: 'red', price: 220, mortgage: 110, houseCost: 150, rent: [18, 90, 250, 700, 875, 1050] },
  { name: 'Chance', type: 'chance' },
  { name: 'Indiana Avenue', type: 'property', group: 'red', price: 220, mortgage: 110, houseCost: 150, rent: [18, 90, 250, 700, 875, 1050] },
  { name: 'Illinois Avenue', type: 'property', group: 'red', price: 240, mortgage: 120, houseCost: 150, rent: [20, 100, 300, 750, 925, 1100] },
  { name: 'B&O Railroad', type: 'railroad', group: 'railroad', price: 200, mortgage: 100 },
  { name: 'Atlantic Avenue', type: 'property', group: 'yellow', price: 260, mortgage: 130, houseCost: 150, rent: [22, 110, 330, 800, 975, 1150] },
  { name: 'Ventnor Avenue', type: 'property', group: 'yellow', price: 260, mortgage: 130, houseCost: 150, rent: [22, 110, 330, 800, 975, 1150] },
  { name: 'Water Works', type: 'utility', group: 'utility', price: 150, mortgage: 75 },
  { name: 'Marvin Gardens', type: 'property', group: 'yellow', price: 280, mortgage: 140, houseCost: 150, rent: [24, 120, 360, 850, 1025, 1200] },
  { name: 'Go To Jail', type: 'gotojail' },
  { name: 'Pacific Avenue', type: 'property', group: 'green', price: 300, mortgage: 150, houseCost: 200, rent: [26, 130, 390, 900, 1100, 1275] },
  { name: 'North Carolina Avenue', type: 'property', group: 'green', price: 300, mortgage: 150, houseCost: 200, rent: [26, 130, 390, 900, 1100, 1275] },
  { name: 'Community Chest', type: 'chest' },
  { name: 'Pennsylvania Avenue', type: 'property', group: 'green', price: 320, mortgage: 160, houseCost: 200, rent: [28, 150, 450, 1000, 1200, 1400] },
  { name: 'Short Line', type: 'railroad', group: 'railroad', price: 200, mortgage: 100 },
  { name: 'Chance', type: 'chance' },
  { name: 'Park Place', type: 'property', group: 'darkblue', price: 350, mortgage: 175, houseCost: 200, rent: [35, 175, 500, 1100, 1300, 1500] },
  { name: 'Luxury Tax', type: 'tax', amount: 100 },
  { name: 'Boardwalk', type: 'property', group: 'darkblue', price: 400, mortgage: 200, houseCost: 200, rent: [50, 200, 600, 1400, 1700, 2000] },
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
  { text: 'Advance to GO. Collect $200.', action: 'move:0' },
  { text: 'Advance to Illinois Avenue.', action: 'move:24' },
  { text: 'Advance to St. Charles Place.', action: 'move:11' },
  { text: 'Advance to the nearest Utility. Pay 10× the dice.', action: 'nearest:utility' },
  { text: 'Advance to the nearest Railroad. Pay double rent.', action: 'nearest:railroad' },
  { text: 'Advance to the nearest Railroad. Pay double rent.', action: 'nearest:railroad' },
  { text: 'Bank pays you a dividend of $50.', action: 'money:50' },
  { text: 'Get out of Jail Free. Keep this card.', action: 'getOutFree' },
  { text: 'Go back 3 spaces.', action: 'moveBack:3' },
  { text: 'Go to Jail. Do not pass GO.', action: 'jail' },
  { text: 'Make general repairs: $25 per house, $100 per hotel.', action: 'repairs:25,100' },
  { text: 'Speeding fine. Pay $15.', action: 'money:-15' },
  { text: 'Take a trip to Reading Railroad.', action: 'move:5' },
  { text: 'Advance to Boardwalk.', action: 'move:39' },
  { text: 'You have been elected Chairman. Pay each player $50.', action: 'eachPlayer:-50' },
  { text: 'Your building loan matures. Collect $150.', action: 'money:150' },
];

const CHEST = [
  { text: 'Advance to GO. Collect $200.', action: 'move:0' },
  { text: 'Bank error in your favor. Collect $200.', action: 'money:200' },
  { text: "Doctor's fee. Pay $50.", action: 'money:-50' },
  { text: 'From sale of stock you get $50.', action: 'money:50' },
  { text: 'Get out of Jail Free. Keep this card.', action: 'getOutFree' },
  { text: 'Go to Jail. Do not pass GO.', action: 'jail' },
  { text: 'Holiday fund matures. Collect $100.', action: 'money:100' },
  { text: 'Income tax refund. Collect $20.', action: 'money:20' },
  { text: 'It is your birthday. Collect $10 from every player.', action: 'eachPlayer:10' },
  { text: 'Life insurance matures. Collect $100.', action: 'money:100' },
  { text: 'Hospital fees. Pay $100.', action: 'money:-100' },
  { text: 'School fees. Pay $50.', action: 'money:-50' },
  { text: 'Receive $25 consultancy fee.', action: 'money:25' },
  { text: 'Street repairs: $40 per house, $115 per hotel.', action: 'repairs:40,115' },
  { text: 'You won second prize in a beauty contest. Collect $10.', action: 'money:10' },
  { text: 'You inherit $100.', action: 'money:100' },
];

// Player tokens — emoji + a strong accent color for board pieces & panels.
const TOKENS = [
  { id: 'hat',  emoji: '🎩', color: '#e74c3c', name: 'Top Hat' },
  { id: 'car',  emoji: '🚗', color: '#3498db', name: 'Roadster' },
  { id: 'dog',  emoji: '🐕', color: '#2ecc71', name: 'Scottie' },
  { id: 'ship', emoji: '🚢', color: '#9b59b6', name: 'Battleship' },
  { id: 'boot', emoji: '🥾', color: '#f39c12', name: 'Boot' },
  { id: 'cat',  emoji: '🐈', color: '#1abc9c', name: 'Cat' },
];

const STARTING_CASH = 1500;
const GO_SALARY = 200;
const JAIL_INDEX = 10;
const JAIL_FINE = 50;
const MAX_HOUSES = 32;   // bank supply
const MAX_HOTELS = 12;   // bank supply
