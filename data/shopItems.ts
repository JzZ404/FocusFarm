export interface ShopItem {
  id: string;
  name: string;
  category: "animal" | "building" | "decoration";
  cost: number;
  // Sprite sheet path and which of the 3 horizontal positions (0=left, 1=middle, 2=right)
  sprite: { sheet: string; pos: 0 | 1 | 2 };
  // Fallback emoji for small displays / accessibility
  emoji: string;
  description: string;
  unlockCondition?: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  // ── sheet7: Chicken · Bat · Bee ──────────────────────────────────────
  {
    id: "animal_chicken",
    name: "Chicken",
    category: "animal",
    cost: 50,
    sprite: { sheet: "/assets/sprites/sheet7.png", pos: 0 },
    emoji: "🐔",
    description: "A happy clucking chicken for your farm.",
  },
  {
    id: "animal_bat",
    name: "Bat",
    category: "animal",
    cost: 80,
    sprite: { sheet: "/assets/sprites/sheet7.png", pos: 1 },
    emoji: "🦇",
    description: "A spooky little bat that loves the night.",
  },
  {
    id: "animal_bee",
    name: "Bee",
    category: "animal",
    cost: 60,
    sprite: { sheet: "/assets/sprites/sheet7.png", pos: 2 },
    emoji: "🐝",
    description: "A busy bee that pollinates your farm.",
  },

  // ── sheet5: Sheep · Cow · Shiba Dog ──────────────────────────────────
  {
    id: "animal_sheep",
    name: "Sheep",
    category: "animal",
    cost: 75,
    sprite: { sheet: "/assets/sprites/sheet5.png", pos: 0 },
    emoji: "🐑",
    description: "A fluffy sheep that loves grazing.",
  },
  {
    id: "animal_cow",
    name: "Cow",
    category: "animal",
    cost: 150,
    sprite: { sheet: "/assets/sprites/sheet5.png", pos: 1 },
    emoji: "🐄",
    description: "A gentle cow — the pride of any farm.",
    unlockCondition: "Requires 60 focus minutes",
  },
  {
    id: "animal_shiba",
    name: "Shiba Dog",
    category: "animal",
    cost: 120,
    sprite: { sheet: "/assets/sprites/sheet5.png", pos: 2 },
    emoji: "🐕",
    description: "Much wow. Very focus. Such farm.",
  },

  // ── sheet6: Cat · Squirrel · Duck ────────────────────────────────────
  {
    id: "animal_cat",
    name: "Cat",
    category: "animal",
    cost: 90,
    sprite: { sheet: "/assets/sprites/sheet6.png", pos: 0 },
    emoji: "🐱",
    description: "A curious cat that roams the farm.",
  },
  {
    id: "animal_squirrel",
    name: "Squirrel",
    category: "animal",
    cost: 70,
    sprite: { sheet: "/assets/sprites/sheet6.png", pos: 1 },
    emoji: "🐿️",
    description: "A speedy squirrel collecting acorns.",
  },
  {
    id: "animal_duck",
    name: "Duck",
    category: "animal",
    cost: 65,
    sprite: { sheet: "/assets/sprites/sheet6.png", pos: 2 },
    emoji: "🦆",
    description: "A waddling mallard duck.",
  },

  // ── sheet4: Panda · Koala · Pig ──────────────────────────────────────
  {
    id: "animal_panda",
    name: "Panda",
    category: "animal",
    cost: 200,
    sprite: { sheet: "/assets/sprites/sheet4.png", pos: 0 },
    emoji: "🐼",
    description: "A rare giant panda. Very distinguished.",
    unlockCondition: "Requires 120 focus minutes",
  },
  {
    id: "animal_koala",
    name: "Koala",
    category: "animal",
    cost: 175,
    sprite: { sheet: "/assets/sprites/sheet4.png", pos: 1 },
    emoji: "🐨",
    description: "A sleepy koala chilling in your farm.",
    unlockCondition: "Requires 90 focus minutes",
  },
  {
    id: "animal_pig",
    name: "Pig",
    category: "animal",
    cost: 85,
    sprite: { sheet: "/assets/sprites/sheet4.png", pos: 2 },
    emoji: "🐷",
    description: "A round and happy pink pig.",
  },

  // ── sheet1: Fox · Owl · Penguin ──────────────────────────────────────
  {
    id: "animal_fox",
    name: "Fox",
    category: "animal",
    cost: 110,
    sprite: { sheet: "/assets/sprites/sheet1.png", pos: 0 },
    emoji: "🦊",
    description: "A clever fox with a bushy tail.",
  },
  {
    id: "animal_owl",
    name: "Owl",
    category: "animal",
    cost: 130,
    sprite: { sheet: "/assets/sprites/sheet1.png", pos: 1 },
    emoji: "🦉",
    description: "A wise owl to guard your farm at night.",
  },
  {
    id: "animal_penguin",
    name: "Penguin",
    category: "animal",
    cost: 140,
    sprite: { sheet: "/assets/sprites/sheet1.png", pos: 2 },
    emoji: "🐧",
    description: "A tuxedoed penguin waddling around.",
  },

  // ── sheet2: Raccoon · Deer · Frog ────────────────────────────────────
  {
    id: "animal_raccoon",
    name: "Raccoon",
    category: "animal",
    cost: 95,
    sprite: { sheet: "/assets/sprites/sheet2.png", pos: 0 },
    emoji: "🦝",
    description: "A masked raccoon — mischievous but cute.",
  },
  {
    id: "animal_deer",
    name: "Deer",
    category: "animal",
    cost: 160,
    sprite: { sheet: "/assets/sprites/sheet2.png", pos: 1 },
    emoji: "🦌",
    description: "A graceful deer with elegant antlers.",
    unlockCondition: "Requires 80 focus minutes",
  },
  {
    id: "animal_frog",
    name: "Frog",
    category: "animal",
    cost: 45,
    sprite: { sheet: "/assets/sprites/sheet2.png", pos: 2 },
    emoji: "🐸",
    description: "A cheerful green frog by the pond.",
  },

  // ── sheet3: Elephant · Lion · Monkey ─────────────────────────────────
  {
    id: "animal_elephant",
    name: "Elephant",
    category: "animal",
    cost: 220,
    sprite: { sheet: "/assets/sprites/sheet3.png", pos: 0 },
    emoji: "🐘",
    description: "A gentle giant elephant.",
    unlockCondition: "Requires 150 focus minutes",
  },
  {
    id: "animal_lion",
    name: "Lion",
    category: "animal",
    cost: 250,
    sprite: { sheet: "/assets/sprites/sheet3.png", pos: 1 },
    emoji: "🦁",
    description: "The king of the farm.",
    unlockCondition: "Requires 200 focus minutes",
  },
  {
    id: "animal_monkey",
    name: "Monkey",
    category: "animal",
    cost: 180,
    sprite: { sheet: "/assets/sprites/sheet3.png", pos: 2 },
    emoji: "🐒",
    description: "A playful monkey swinging around.",
    unlockCondition: "Requires 100 focus minutes",
  },

];

export function getItemById(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((item) => item.id === id);
}
