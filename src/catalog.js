// catalog.js — builds the whole store catalogue from the procedural generators.
// Everything is deterministic: the same seed always produces the same model, so nothing
// needs to be downloaded or stored. Each set records its own structured data
// (id, name, category, price, difficulty, rarity, palette, dimensions, parts list,
// brick positions/rotations, steps and unlock requirements).
import { ModelBuilder, makeRng, makeSteps, partsList, shapeSignature } from './models.js';
import { genCar, genMotorcycle, genTruck, genTrain } from './generators/vehicles.js';
import { genAircraft, genSpacecraft } from './generators/air.js';
import { genAnimal, genMini, ANIMALS } from './generators/creatures.js';
import { genDinosaurDetailed } from './generators/dinos.js';
import { genHouse, genCastle, genArchitecture } from './generators/buildings.js';
import { genRobot, genBoat } from './generators/misc.js';
import { genFantasy, genUnderwater, genFarm, genCity, genRacing, genThemePark } from './generators/extra.js';
import { CAR_STYLES } from './generators/vehicles.js';
import { genBigCity, BIG_CITY } from './generators/city.js';
import { COLOR_BY_ID } from './parts.js';

export const CATEGORIES = [
  { id: 'cars', name: 'Cars & Supercars', icon: '🏎️' },
  { id: 'motorcycles', name: 'Motorcycles', icon: '🏍️' },
  { id: 'trucks', name: 'Trucks & Construction', icon: '🏗️' },
  { id: 'aircraft', name: 'Aircraft & Helicopters', icon: '✈️' },
  { id: 'space', name: 'Spacecraft & Rockets', icon: '🚀' },
  { id: 'dinosaurs', name: 'Dinosaurs & Prehistoric', icon: '🦖' },
  { id: 'houses', name: 'Houses & Buildings', icon: '🏡' },
  { id: 'castles', name: 'Castles & Medieval', icon: '🏰' },
  { id: 'robots', name: 'Robots & Mechs', icon: '🤖' },
  { id: 'trains', name: 'Trains', icon: '🚂' },
  { id: 'boats', name: 'Boats & Ships', icon: '⛵' },
  { id: 'animals', name: 'Animals', icon: '🐘' },
  { id: 'architecture', name: 'Architecture', icon: '🗼' },
  { id: 'fantasy', name: 'Dragons & Fantasy', icon: '🐉' },
  { id: 'underwater', name: 'Underwater World', icon: '🐙' },
  { id: 'bigcity', name: 'Big City', icon: '🏙️' },
  { id: 'city', name: 'City & Emergency', icon: '🚓' },
  { id: 'farm', name: 'Farm & Countryside', icon: '🚜' },
  { id: 'racing', name: 'Racing & Sports', icon: '🏁' },
  { id: 'themepark', name: 'Theme Park', icon: '🎡' },
  { id: 'beginner', name: 'Beginner Sets', icon: '🌱' },
  { id: 'collector', name: 'Advanced Collector', icon: '💎' },
  { id: 'premium', name: 'Massive Premium', icon: '👑' },
];
export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
export const RARITIES = [
  { id: 'common', name: 'Common', color: '#8a94a6', level: 1 },
  { id: 'uncommon', name: 'Uncommon', color: '#3fae5a', level: 1 },
  { id: 'rare', name: 'Rare', color: '#2f7bf5', level: 2 },
  { id: 'epic', name: 'Epic', color: '#9b4dff', level: 4 },
  { id: 'legendary', name: 'Legendary', color: '#f5a623', level: 7 },
];
export const RARITY_BY_ID = Object.fromEntries(RARITIES.map(r => [r.id, r]));

const GEN = { car: genCar, moto: genMotorcycle, truck: genTruck, train: genTrain, air: genAircraft, space: genSpacecraft, dino: genDinosaurDetailed, animal: genAnimal, mini: genMini, house: genHouse, castle: genCastle, arch: genArchitecture, robot: genRobot, boat: genBoat, fantasy: genFantasy, sea: genUnderwater, farm: genFarm, city: genCity, racing: genRacing, park: genThemePark, bigcity: genBigCity };

// ---------------------------------------------------------------- naming
const WORDS = {
  cars: ['Velocity', 'Comet', 'Harbor', 'Sunset', 'Thunder', 'Metro', 'Volt', 'Rally', 'Midnight', 'Coastal', 'Turbo', 'Nova', 'Apex', 'Summit', 'Dune', 'Orbit', 'Falcon', 'Blaze'],
  motorcycles: ['Street', 'Desert', 'Canyon', 'Neon', 'Ridge', 'Storm', 'Highway', 'Gravel', 'Urban', 'Eclipse', 'Cobalt', 'Flare'],
  trucks: ['Heavy', 'Quarry', 'Titan', 'Bedrock', 'Iron', 'Prairie', 'Granite', 'Summit', 'Forge', 'Harbor', 'Mesa', 'Atlas'],
  aircraft: ['Sky', 'Cloud', 'Jet', 'Horizon', 'Aero', 'Swift', 'Polar', 'Island', 'Zephyr', 'Kestrel', 'Breeze', 'Condor'],
  space: ['Stellar', 'Lunar', 'Galactic', 'Nebula', 'Quasar', 'Orion', 'Astro', 'Cosmic', 'Pulsar', 'Zenith', 'Comet', 'Vega'],
  dinosaurs: ['Jungle', 'Volcano', 'Fossil', 'Swamp', 'Canyon', 'Thunder', 'Ancient', 'Primal', 'Emerald', 'Ember', 'Glacier', 'Amber'],
  houses: ['Maple', 'Willow', 'Seaside', 'Hilltop', 'Sunny', 'Brook', 'Oak', 'Harbour', 'Meadow', 'Cedar', 'Lantern', 'Pebble'],
  castles: ['Stone', 'Raven', 'Silver', 'Thorn', 'Lion', 'Dragon', 'Frost', 'Golden', 'Shadow', 'Ember', 'Crown', 'Mist'],
  fantasy: ['Ancient', 'Mystic', 'Enchanted', 'Moonlit', 'Elder', 'Crystal', 'Starfall', 'Whispering', 'Rune', 'Twilight'],
  underwater: ['Deep Sea', 'Coral', 'Abyss', 'Lagoon', 'Tidal', 'Reef', 'Pearl', 'Kelp', 'Ocean', 'Blue'],
  bigcity: ['Metropolis', 'Brickton', 'Grand City', 'Harbour City', 'Central', 'Capital'],
  city: ['Downtown', 'Metro', 'Main Street', 'Uptown', 'Harbour', 'Central', 'Riverside', 'Westside'],
  farm: ['Sunny Acres', 'Meadow', 'Green Valley', 'Hillside', 'Orchard', 'Willow Creek', 'Golden Field', 'Clover'],
  racing: ['Grand Prix', 'Turbo', 'Checkered', 'Speedway', 'Pit Lane', 'Podium', 'Velocity', 'Nitro'],
  themepark: ['Funland', 'Starlight', 'Carnival', 'Wonder', 'Sunshine', 'Jubilee', 'Twister', 'Midway'],
  robots: ['Mega', 'Ultra', 'Servo', 'Gear', 'Titan', 'Bolt', 'Circuit', 'Atom', 'Pixel', 'Laser', 'Rivet', 'Nano'],
  trains: ['Express', 'Valley', 'Northern', 'Coastline', 'Mountain', 'Royal', 'Midland', 'Sunrise', 'Capital', 'Pine'],
  boats: ['Ocean', 'Coral', 'Tide', 'Reef', 'Harbor', 'Gull', 'Lagoon', 'Anchor', 'Marlin', 'Wave', 'Breeze', 'Atoll'],
  animals: ['Little', 'Happy', 'Curious', 'Brave', 'Sleepy', 'Jolly', 'Gentle', 'Clever', 'Sunny', 'Lucky'],
  architecture: ['Grand', 'Old Town', 'Harbour', 'Skyline', 'Royal', 'Riverside', 'Northern', 'Golden', 'Imperial', 'Central'],
};
const STYLE_NAMES = {
  sedan: 'Sedan', coupe: 'Coupé', supercar: 'GT', convertible: 'Roadster', suv: 'Trailblazer', racer: 'Formula Racer', van: 'Camper Van', classic: 'Classic', hatch: 'Hatchback',
  sport: 'Sport Bike', chopper: 'Chopper', dirt: 'Dirt Bike', scooter: 'Scooter', cruiser: 'Cruiser', trike: 'Trike', sidecar: 'Sidecar Bike',
  dump: 'Dump Truck', tanker: 'Tanker', flatbed: 'Flatbed Hauler', fire: 'Fire Engine', excavator: 'Excavator', bulldozer: 'Bulldozer', crane: 'Crane Truck', mixer: 'Cement Mixer', forklift: 'Forklift', tow: 'Tow Truck', garbage: 'Recycling Truck', roller: 'Road Roller',
  airliner: 'Airliner', jet: 'Jet Fighter', biplane: 'Biplane', helicopter: 'Helicopter', cargo: 'Cargo Lifter', seaplane: 'Seaplane', glider: 'Glider', prop: 'Prop Plane',
  rocket: 'Rocket', shuttle: 'Shuttle', starfighter: 'Starfighter', station: 'Space Station', lander: 'Lunar Lander', satellite: 'Satellite', saucer: 'Saucer', rover: 'Planet Rover', cruiser_s: 'Star Cruiser',
  sauropod: 'Longneck', trex: 'Tyrant Rex', triceratops: 'Three-Horn', stegosaurus: 'Plate-Back', raptor: 'Raptor', pterosaur: 'Sky Glider', ankylosaur: 'Armour-Tail', spinosaurus: 'Sail-Back', crested: 'Crest-Head', pachy: 'Dome-Head', dimetrodon: 'Fin-Back', mosasaur: 'Sea Serpent', mammoth: 'Woolly Mammoth', sabretooth: 'Sabre Cat',
  cottage: 'Cottage', modern: 'Modern House', townhouse: 'Townhouse', barn: 'Farm Barn', beachhut: 'Beach Hut', shop: 'Corner Shop', apartment: 'Apartments', cabin: 'Log Cabin', villa: 'Villa', firestation: 'Fire Station',
  fortress: 'Fortress', palace: 'Fairy Palace', ruin: 'Ruins', desertfort: 'Desert Fort', darkkeep: 'Dark Keep', watchtower: 'Watchtower', outpost: 'Outpost', gatehouse: 'Gatehouse',
  humanoid: 'Robot', mech: 'Battle Mech', walker: 'Walker', treadbot: 'Tread Bot', droid: 'Droid', tank: 'Tank Bot',
  steam: 'Steam Engine', diesel: 'Diesel Loco', bullet: 'Bullet Train',
  sailboat: 'Sailboat', speedboat: 'Speedboat', tugboat: 'Tugboat', ferry: 'Ferry', galleon: 'Galleon', submarine: 'Submarine', fishing: 'Fishing Boat', yacht: 'Yacht', canoe: 'Canoe',
  skyscraper: 'Skyscraper', lighthouse: 'Lighthouse', pyramid: 'Pyramid', bridge: 'Bridge', temple: 'Temple', windmill: 'Windmill', pagoda: 'Pagoda', dome: 'Domed Hall', tvtower: 'TV Tower', stadium: 'Stadium', clocktower: 'Clock Tower', arch: 'Triumphal Arch',
  muscle: 'Muscle Car', police: 'Police Cruiser', taxi: 'Taxi Cab', ambulance: 'Ambulance', pickup: 'Pickup Truck', limo: 'Limousine', monster: 'Monster Truck', buggy: 'Dune Buggy', rally: 'Rally Car', hyper: 'Hypercar', drag: 'Dragster',
  dragon: 'Dragon', wizardtower: 'Wizard Tower', treehouse: 'Treehouse', unicorn: 'Unicorn', crystalcave: 'Crystal Cave', mushroomhouse: 'Mushroom House', phoenix: 'Phoenix',
  shark: 'Shark', octopus: 'Octopus', jellyfish: 'Jellyfish', seaturtle: 'Sea Turtle', angler: 'Anglerfish', reef: 'Coral Reef', sunkenship: 'Sunken Ship', seahorse: 'Seahorse', clownfish: 'Clownfish Pair', manta: 'Manta Ray',
  firestation: 'Fire Station', hospital: 'City Hospital', policehq: 'Police Headquarters', townhall: 'Town Hall', trainstation: 'Train Station', mall: 'Shopping Mall', school: 'School', corner: 'Corner Café & Apartments',
  policestation: 'Police Station', hospital: 'Hospital', gasstation: 'Gas Station', bus: 'City Bus', schoolbus: 'School Bus', busstop: 'Bus Stop', trafficlights: 'Crossroads',
  tractor: 'Tractor', combine: 'Combine Harvester', haywagon: 'Hay Wagon', silo: 'Grain Silo', coop: 'Chicken Coop', vegpatch: 'Veggie Patch', pigpen: 'Pig Pen', farmstand: 'Farm Stand', scarecrow: 'Scarecrow',
  pitgarage: 'Pit Garage', trophy: 'Champion Trophy', podium: 'Winners Podium', startgantry: 'Start Gantry', skateramp: 'Skate Ramp', kart: 'Racing Kart',
  ferriswheel: 'Ferris Wheel', carousel: 'Carousel', coaster: 'Roller Coaster', bumpercars: 'Bumper Cars', ticketbooth: 'Ticket Booth', icecream: 'Ice Cream Stand', balloon: 'Hot Air Balloon', swingride: 'Swing Ride', hauntedhouse: 'Haunted House', teacups: 'Teacup Ride', droptower: 'Drop Tower',
  tree: 'Oak Tree', birdhouse: 'Birdhouse', well: 'Wishing Well', tent: 'Camping Tent', signpost: 'Signpost', pumpkin: 'Pumpkin Patch', gokart: 'Go-Kart', flowerbed: 'Flower Bed', snowman: 'Snowman', mushroom: 'Mushroom', cactus: 'Cactus', lamp: 'Street Lamp', bench: 'Park Bench', mailbox: 'Mailbox', campfire: 'Campfire', palm: 'Palm Tree',
};
const DESCS = {
  cars: s => `A ${s} with a working-looking stud chassis, real wheels and a glass cabin.`,
  motorcycles: s => `A two-wheeled ${s} built along a single stud line — small but fiddly.`,
  trucks: s => `A hard-working ${s} with chunky wheels or tracks and a detailed cab.`,
  aircraft: s => `A ${s} with wings, tail fin and landing gear.`,
  space: s => `A ${s} ready for the stars, with glowing engines and space-age details.`,
  dinosaurs: s => `A sculpted ${s}, built layer by layer from a brick skeleton.`,
  houses: s => `A ${s} with real windows, a door and a garden plot.`,
  castles: s => `A medieval ${s} with battlements, towers and a mighty gate.`,
  robots: s => `A posable-looking ${s} with glowing eyes and mechanical detailing.`,
  trains: s => `A ${s} on proper train wheel sets.`,
  boats: s => `A ${s} with a tapered hull and deck fittings.`,
  animals: s => `A cute brick-built ${s}.`,
  architecture: s => `A landmark-style ${s} inspired by great buildings around the world.`,
  fantasy: s => `A magical ${s} with sculpted details and glowing accents.`,
  underwater: s => `A ${s} from the deep, displayed on a coral seabed.`,
  bigcity: s => `A huge, detailed ${s} with furnished rooms inside, little figures and street details.`,
  city: s => `A busy-town ${s} for your brick city.`,
  farm: s => `A countryside ${s} for your farm.`,
  racing: s => `A high-speed ${s} — ready, set, build!`,
  themepark: s => `A colourful ${s} — the star of any theme park.`,
  beginner: s => `A quick, friendly ${s} — perfect for your first build.`,
  collector: s => `A large collector edition ${s} on a display stand.`,
  premium: s => `A massive premium build: ${s}. Clear your table!`,
};

// ---------------------------------------------------------------- set recipes
// Each recipe: [generatorKey, options]. Styles are cycled so every category shows
// recognisably different designs, then colours/sizes/accessories vary per set.
function recipes() {
  const R = [];
  const push = (cat, gen, opts = {}, extra = {}) => R.push({ cat, gen, opts, ...extra });
  const cycle = (cat, gen, key, styles, n, more = () => ({})) => { for (let i = 0; i < n; i++) push(cat, gen, { [key]: styles[i % styles.length], ...more(i) }); };

  cycle('cars', 'car', 'style', CAR_STYLES, CAR_STYLES.length);
  cycle('cars', 'car', 'style', ['supercar', 'hyper', 'muscle', 'classic', 'convertible', 'sedan', 'coupe', 'suv', 'van', 'limo'], 10, i => ({ W: 6, stripe: i % 2 === 0, L: [15, 16, 13, 13, 12, 13, 12, 13, 13, 19][i] }));
  cycle('motorcycles', 'moto', 'style', ['sport', 'chopper', 'dirt', 'scooter', 'cruiser', 'trike', 'sidecar'], 12);
  cycle('trucks', 'truck', 'style', ['dump', 'excavator', 'fire', 'tanker', 'bulldozer', 'crane', 'mixer', 'forklift', 'flatbed', 'tow', 'garbage', 'roller'], 15);
  cycle('aircraft', 'air', 'style', ['airliner', 'jet', 'biplane', 'helicopter', 'cargo', 'seaplane', 'glider', 'prop'], 14, i => (i >= 8 && i % 8 === 3 ? { rescue: true } : {}));
  cycle('space', 'space', 'style', ['rocket', 'shuttle', 'starfighter', 'station', 'lander', 'satellite', 'saucer', 'rover', 'cruiser'], 15, i => (i % 9 === 0 ? { stages: 2 + (i % 3) } : {}));
  for (const sp of ['trex', 'raptor', 'sauropod', 'triceratops', 'stegosaurus', 'ankylosaur', 'spinosaurus', 'crested', 'pachy', 'dimetrodon', 'mosasaur', 'pterosaur', 'mammoth', 'sabretooth']) push('dinosaurs', 'dino', { species: sp, scale: sp === 'sauropod' || sp === 'mammoth' ? 1.35 : sp === 'raptor' || sp === 'pachy' || sp === 'pterosaur' ? 1.7 : 1.5 });
  push('dinosaurs', 'dino', { species: 'sauropod', tall: true, scale: 1.4, label: 'Tall-Neck' });
  push('dinosaurs', 'dino', { species: 'trex', slim: true, horns: true, scale: 1.6, label: 'Horned Hunter', pattern: 'spots' });
  push('dinosaurs', 'dino', { species: 'raptor', scale: 2.0, pattern: 'spots', label: 'Pack Raptor' });
  push('dinosaurs', 'dino', { species: 'triceratops', scale: 1.75, label: 'Great Three-Horn', baseStyle: 'desert' });
  push('dinosaurs', 'dino', { species: 'trex', scale: 1.8, spikes: true, label: 'Spiked Tyrant', baseStyle: 'volcano' });
  push('dinosaurs', 'dino', { species: 'spinosaurus', scale: 1.6, label: 'River Sail-Back', baseStyle: 'jungle' });
  cycle('houses', 'house', 'style', ['cottage', 'modern', 'townhouse', 'barn', 'beachhut', 'shop', 'apartment', 'cabin', 'villa', 'firestation'], 15);
  cycle('castles', 'castle', 'style', ['fortress', 'watchtower', 'palace', 'outpost', 'ruin', 'desertfort', 'darkkeep', 'gatehouse'], 13);
  cycle('robots', 'robot', 'style', ['humanoid', 'mech', 'walker', 'treadbot', 'droid', 'tank'], 13, i => (i >= 6 ? { scale: 1.3 } : {}));
  for (let i = 0; i < 12; i++) push('trains', 'train', { style: ['steam', 'diesel', 'bullet'][i % 3], cars: Math.floor(i / 3) % 3, track: i >= 6 });
  cycle('boats', 'boat', 'style', ['sailboat', 'speedboat', 'tugboat', 'cargo', 'ferry', 'galleon', 'submarine', 'fishing', 'yacht', 'canoe'], 14);
  for (let i = 0; i < 20; i++) push('animals', 'animal', { kind: ANIMALS[i % ANIMALS.length], scale: i >= 16 ? 1.7 : 1.35 });
  cycle('architecture', 'arch', 'style', ['skyscraper', 'lighthouse', 'pyramid', 'bridge', 'temple', 'windmill', 'pagoda', 'dome', 'tvtower', 'stadium', 'clocktower', 'arch'], 14);

  // New categories
  for (const [breed, pose, scale] of [['fire', 'standing', 1.4], ['forest', 'rearing', 1.4], ['ice', 'standing', 1.5], ['shadow', 'rearing', 1.6], ['gold', 'standing', 1.3], ['storm', 'rearing', 1.5]]) push('fantasy', 'fantasy', { kind: 'dragon', breed, pose, scale, label: breed[0].toUpperCase() + breed.slice(1) + ' Dragon' });
  for (const k of ['wizardtower', 'treehouse', 'unicorn', 'crystalcave', 'mushroomhouse', 'phoenix']) push('fantasy', 'fantasy', { kind: k });
  for (const k of ['shark', 'octopus', 'jellyfish', 'seaturtle', 'whale', 'angler', 'reef', 'sunkenship', 'seahorse', 'clownfish', 'manta']) push('underwater', 'sea', { kind: k });
  push('underwater', 'boat', { style: 'submarine' });
  for (const k of ['policestation', 'hospital', 'gasstation', 'bus', 'schoolbus', 'busstop', 'trafficlights']) push('city', 'city', { kind: k });
  for (const st of ['police', 'ambulance', 'taxi']) push('city', 'car', { style: st });
  push('city', 'truck', { style: 'garbage' }); push('city', 'house', { style: 'firestation' }); push('city', 'truck', { style: 'fire' });
  for (const k of ['tractor', 'combine', 'haywagon', 'silo', 'coop', 'vegpatch', 'pigpen', 'farmstand']) push('farm', 'farm', { kind: k });
  push('farm', 'farm', { kind: 'tractor', color: 'red', label: 'Classic Tractor' });
  push('farm', 'house', { style: 'barn' }); push('farm', 'animal', { kind: 'cow', scale: 1.5 }); push('farm', 'arch', { style: 'windmill' });
  for (const k of ['pitgarage', 'trophy', 'podium', 'startgantry', 'skateramp', 'kart']) push('racing', 'racing', { kind: k });
  for (const st of ['racer', 'rally', 'drag', 'buggy', 'monster']) push('racing', 'car', { style: st, W: st === 'racer' ? 4 : undefined });
  for (const k of ['ferriswheel', 'carousel', 'coaster', 'bumpercars', 'ticketbooth', 'icecream', 'balloon', 'swingride', 'hauntedhouse', 'teacups', 'droptower']) push('themepark', 'park', { kind: k });

  for (const k of BIG_CITY) push('bigcity', 'bigcity', { kind: k });

  // Beginner: tiny builds and simplified versions
  for (const k of ['tree', 'flowerbed', 'snowman', 'mushroom', 'cactus', 'lamp', 'bench', 'mailbox', 'campfire', 'palm', 'birdhouse', 'well', 'tent', 'signpost', 'pumpkin', 'gokart']) push('beginner', 'mini', { kind: k });
  push('beginner', 'dino', { species: 'raptor', scale: 0.9, label: 'Baby Raptor' });
  push('beginner', 'dino', { species: 'triceratops', scale: 0.8, label: 'Baby Three-Horn' });
  push('beginner', 'animal', { kind: 'duck', scale: 1 });
  push('beginner', 'animal', { kind: 'frog', scale: 1 });

  // Advanced collector editions: bigger, on display stands
  const col = (gen, opts) => push('collector', gen, opts, { display: true });
  col('car', { style: 'supercar', L: 16, W: 6, stripe: true, spoiler: true });
  col('car', { style: 'classic', L: 14, W: 6 });
  col('dino', { species: 'trex', scale: 2.3 });
  col('dino', { species: 'stegosaurus', scale: 2.1 });
  col('castle', { style: 'palace', S: 22 });
  col('robot', { style: 'mech', scale: 1.4 });
  col('train', { style: 'steam', cars: 1, track: true });
  col('boat', { style: 'galleon', L: 28 });
  col('air', { style: 'airliner', L: 28 });
  col('space', { style: 'shuttle' });
  col('arch', { style: 'clocktower' });
  col('house', { style: 'villa', W: 18, D: 11 });
  col('animal', { kind: 'elephant', scale: 1.8 });
  col('truck', { style: 'excavator' });

  // Massive premium builds: composites of several models
  const prem = (name, parts, extra = {}) => push('premium', 'compose', { parts }, { fixedName: name, ...extra });
  prem('Harbour Town Block', [['house', { style: 'shop' }, 0, 0], ['house', { style: 'townhouse' }, 14, 0], ['house', { style: 'apartment' }, 24, 0], ['car', { style: 'van' }, 4, 18], ['car', { style: 'sedan' }, 20, 18]], { road: true });
  prem('Grand Citadel', [['castle', { style: 'fortress', S: 26 }, 0, 0], ['castle', { style: 'watchtower' }, 32, 4]]);
  prem('Dinosaur Valley', [['dino', { species: 'sauropod', scale: 1.5 }, 0, 0], ['dino', { species: 'trex', scale: 1.25 }, 2, 16], ['dino', { species: 'triceratops' }, 26, 18], ['mini', { kind: 'palm' }, 30, 2]]);
  prem('Galaxy Spaceport', [['space', { style: 'rocket', stages: 4 }, 0, 0], ['space', { style: 'shuttle' }, 12, 0], ['space', { style: 'rover' }, 14, 16], ['space', { style: 'station' }, 34, 4]]);
  prem('Grand Express Line', [['train', { style: 'steam', cars: 4, track: true }, 0, 0]]);
  prem('Titan Battle Mech', [['robot', { style: 'mech', scale: 1.6 }, 0, 0], ['robot', { style: 'walker' }, 16, 0]]);
  prem('Skyline District', [['arch', { style: 'skyscraper', W: 8 }, 0, 0], ['arch', { style: 'skyscraper', W: 7 }, 12, 2], ['arch', { style: 'tvtower' }, 24, 2]]);
  prem('Royal Armada', [['boat', { style: 'galleon', L: 30 }, 0, 0], ['boat', { style: 'sailboat' }, 4, 14], ['boat', { style: 'tugboat' }, 20, 14]]);
  prem('Mega Construction Site', [['truck', { style: 'excavator' }, 0, 0], ['truck', { style: 'dump', L: 19 }, 14, 0], ['truck', { style: 'crane' }, 0, 14], ['truck', { style: 'mixer' }, 20, 14]]);
  prem('Wildlife Safari Park', [['animal', { kind: 'elephant', scale: 1.5 }, 0, 0], ['animal', { kind: 'giraffe', scale: 1.3 }, 18, 0], ['animal', { kind: 'lion' }, 4, 16], ['animal', { kind: 'flamingo' }, 20, 16], ['car', { style: 'suv' }, 28, 14]]);
  prem('Olympic Arena', [['arch', { style: 'stadium' }, 0, 0], ['arch', { style: 'arch' }, 26, 4]]);
  prem('Airport Terminal', [['air', { style: 'airliner', L: 26 }, 0, 0], ['air', { style: 'helicopter' }, 34, 0], ['house', { style: 'modern', W: 14, D: 8 }, 30, 18]]);
  return R;
}

// ---------------------------------------------------------------- build one set
function runGen(gen, opts, seed) {
  const b = new ModelBuilder();
  const rng = makeRng(seed);
  const info = GEN[gen](b, rng, opts) || {};
  return { b, info };
}

function compose(parts, seed, road) {
  const out = new ModelBuilder();
  let i = 0;
  for (const [gen, opts, dx, dz] of parts) {
    const { b } = runGen(gen, opts, seed + '/' + i++);
    b.repair();
    const m = b.finish();
    const y0 = road ? 1 : 0;
    // keep the models apart: slide this one along until it doesn't touch the others
    let sx = dx;
    const clear = ox => m.bricks.every(br => out.fits(br.t, br.x + ox, br.y + y0, br.z + dz, br.r));
    while (!clear(sx) && sx < dx + 60) sx++;
    for (const br of m.bricks) out.add(br.t, br.x + sx, br.y + y0, br.z + dz, br.r, br.c);
  }
  if (road) {
    // a street under everything, with lane markings
    const m = out.finish().dims;
    const base = new ModelBuilder();
    base.fill(0, -2, -2, m.w + 4, m.d + 4, 'dgray', 'plate');
    for (const br of out.bricks) base.add(br.t, br.x, br.y, br.z, br.r, br.c);
    base.fillMask(1, -2, 15, m.w + 4, 1, x => x % 3 === 0, 'white', 'tile');
    return base;
  }
  return out;
}

function withDisplay(b, reserved = new Set()) {
  const m = b.finish();
  const d = m.dims;
  const out = new ModelBuilder();
  out.fill(0, -1, -1, d.w + 2, d.d + 2, 'black', 'plate');
  for (const br of m.bricks) out.add(br.t, br.x, br.y + 1, br.z, br.r, br.c);
  // a gold name plate centred on the front edge, smooth dark tiles round the rest
  const gx = Math.floor(d.w / 2) - 2;
  out.fillMask(1, gx, d.d, 4, 1, (x, z) => !reserved.has(x + ',' + z), 'gold', 'tile');
  out.fillMask(1, -1, -1, d.w + 2, d.d + 2, (x, z) => (x === -1 || z === -1 || x === d.w || z === d.d) && !reserved.has(x + ',' + z), 'dgray', 'tile');
  return out;
}

function rarityFor(cat, n) {
  if (cat === 'premium') return 'legendary';
  if (cat === 'collector') return n > 450 ? 'legendary' : 'epic';
  if (n < 70) return 'common';
  if (n < 150) return 'uncommon';
  if (n < 300) return 'rare';
  if (n < 520) return 'epic';
  return 'legendary';
}

const PRICE_MULT = { common: 1, uncommon: 1.05, rare: 1.15, epic: 1.3, legendary: 1.5 };

/** Accessory props scattered around a display stand, so variants look different. */
function addProps(b, rng) {
  const d = b.finish().dims;
  // props stand straight on the stand's studs, in mirrored pairs along the back and front edges
  const kinds = [['round_1x1', ['orange', 'yellow', 'red']], ['flower_1x1', ['red', 'yellow', 'pink']], ['cone_1x1', ['orange', 'white']], ['light_1x1', ['tyellow', 'tblue']]];
  const spots = [];
  const n = Math.min(3, Math.max(1, Math.floor((d.w + 2) / 6)));
  for (let i = 0; i < n; i++) spots.push([-1 + i * 2, -1], [d.w - i * 2, -1]);
  const front = [[-1, d.d], [d.w, d.d]];
  const reserved = new Set([...spots, ...front].map(([x, z]) => x + ',' + z));
  const out = withDisplay(b, reserved);
  const put = ([x, z], [t, cs], c) => {
    if (t === 'flower_1x1') { out.add('round_1x1', x, 1, z, 0, 'brown'); out.add(t, x, 4, z, 0, c); }
    else out.add(t, x, 1, z, 0, c);
  };
  const k1 = rng.pick(kinds), c1 = rng.pick(k1[1]);
  const k2 = rng.pick(kinds), c2 = rng.pick(k2[1]);
  for (const sp of spots) put(sp, k1, c1);
  for (const sp of front) put(sp, k2, c2);
  return out;
}

/** Build one set from its recipe. Pure function of (recipe, index). */
export function buildSet(rec, index, usedNames, usedSigs = new Set()) {
  const baseSeed = `bv-${rec.cat}-${index}`;
  const rng = makeRng(baseSeed + '-meta');
  let b, info = {}, sig, attempt = 0;
  // Re-roll variations until this set's shape is unique in the catalogue.
  for (; attempt < 8; attempt++) {
    const seed = attempt ? `${baseSeed}-v${attempt}` : baseSeed;
    if (rec.gen === 'compose') { b = compose(rec.opts.parts, seed, rec.road); info = {}; }
    else ({ b, info } = runGen(rec.gen, rec.opts, seed));
    if (rec.display) b = withDisplay(b);
    if (attempt >= 4) b = addProps(b, makeRng(seed + '-props'));
    b.repair();
    sig = shapeSignature(b.bricks);
    if (!usedSigs.has(sig)) break;
  }
  usedSigs.add(sig);
  const model = b.finish();
  const bricks = model.bricks;
  const style = info.style || rec.opts.style || rec.opts.kind || rec.opts.species || 'set';
  const styleKey = rec.gen === 'space' && style === 'cruiser' ? 'cruiser_s' : style;
  let base = rec.opts.label || STYLE_NAMES[styleKey] || (style[0].toUpperCase() + style.slice(1));
  if (rec.gen === 'animal' && !STYLE_NAMES[style]) base = style[0].toUpperCase() + style.slice(1);
  let name;
  if (rec.fixedName) name = rec.fixedName;
  else {
    const pool = WORDS[rec.cat] || WORDS[{ beginner: 'animals', collector: 'architecture' }[rec.cat]] || ['Classic'];
    const pre = rec.cat === 'collector' ? 'Collector' : rec.cat === 'beginner' ? 'Mini' : rng.pick(pool);
    name = `${pre} ${base}`;
    let tries = 0;
    while (usedNames.has(name) && tries++ < 30) name = `${rng.pick(pool)} ${base}`;
    if (usedNames.has(name)) name = `${name} ${['II', 'III', 'IV', 'V'][index % 4]}`;
  }
  usedNames.add(name);
  const n = bricks.length;
  const rarity = rarityFor(rec.cat, n);
  const price = Math.max(15, Math.round((n * 0.95 * PRICE_MULT[rarity] + (rec.cat === 'premium' ? 400 : 0)) / 5) * 5);
  const difficulty = Math.min(5, 1 + (n > 60) + (n > 150) + (n > 300) + (n > 550));
  // palette: most-used colours
  const counts = {};
  for (const br of bricks) counts[br.c] = (counts[br.c] || 0) + 1;
  const palette = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c).filter(c => COLOR_BY_ID[c]);
  const unlockLevel = rec.cat === 'beginner' ? 1 : RARITY_BY_ID[rarity].level;
  return {
    id: `${rec.cat}-${String(index).padStart(3, '0')}`,
    name,
    desc: DESCS[rec.cat](rec.cat === 'premium' ? name : base.toLowerCase()),
    category: rec.cat,
    style,
    price,
    difficulty,
    rarity,
    unlock: { level: unlockLevel, completedSets: rec.cat === 'premium' ? 3 : 0 },
    palette,
    dims: model.dims,
    brickCount: n,
    parts: partsList(bricks),
    bricks,
    steps: makeSteps(bricks),
  };
}

/**
 * Build the whole catalogue. Runs in small chunks and yields to the browser between
 * them so the page never freezes. onProgress(done, total) is optional.
 */
export async function buildCatalog(onProgress, yieldFn = () => new Promise(r => setTimeout(r, 0))) {
  const recs = recipes();
  const counters = {};
  const used = new Set();
  const sigs = new Set();
  const sets = [];
  for (let i = 0; i < recs.length; i++) {
    const rec = recs[i];
    counters[rec.cat] = (counters[rec.cat] || 0) + 1;
    sets.push(buildSet(rec, counters[rec.cat], used, sigs));
    if (i % 8 === 7) { onProgress && onProgress(i + 1, recs.length); await yieldFn(); }
  }
  onProgress && onProgress(recs.length, recs.length);
  return sets;
}

export function recipeCount() { return recipes().length; }
