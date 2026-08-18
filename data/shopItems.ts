export interface ShopItem {
  id: string;
  name: string;
  category: "animal" | "building" | "decoration";
  cost: number;
  // Sprite sheet path and which of the 3 horizontal positions (0=left, 1=middle, 2=right)
  sprite: { sheet: string; pos: 0 | 1 | 2 };
  description: string;
  // Was a free-text `unlockCondition: string` ("Requires 60 focus minutes")
  // that was purely decorative — nothing ever actually gated the purchase
  // on it, so buying an item shown as "requiring" 200 focus minutes worked
  // fine with 0. A number ShopItemCard/purchaseItem can both check against
  // profile.totalFocusMinutes closes that gap and removes the risk of the
  // display text and the real gate silently drifting apart.
  unlockMinFocusMinutes?: number;
}

export const SHOP_ITEMS: ShopItem[] = [
  // ── sheet7: Chicken · Bat · Bee ──────────────────────────────────────
  {
    id: "animal_chicken",
    name: "Chicken",
    category: "animal",
    cost: 50,
    sprite: { sheet: "/assets/sprites/sheet7.png", pos: 0 },
    description: "A happy clucking chicken for your farm.",
  },
  {
    id: "animal_bat",
    name: "Bat",
    category: "animal",
    cost: 80,
    sprite: { sheet: "/assets/sprites/sheet7.png", pos: 1 },
    description: "A spooky little bat that loves the night.",
  },
  {
    id: "animal_bee",
    name: "Bee",
    category: "animal",
    cost: 60,
    sprite: { sheet: "/assets/sprites/sheet7.png", pos: 2 },
    description: "A busy bee that pollinates your farm.",
  },

  // ── sheet5: Sheep · Cow · Shiba Dog ──────────────────────────────────
  {
    id: "animal_sheep",
    name: "Sheep",
    category: "animal",
    cost: 75,
    sprite: { sheet: "/assets/sprites/sheet5.png", pos: 0 },
    description: "A fluffy sheep that loves grazing.",
  },
  {
    id: "animal_cow",
    name: "Cow",
    category: "animal",
    cost: 150,
    sprite: { sheet: "/assets/sprites/sheet5.png", pos: 1 },
    description: "A gentle cow — the pride of any farm.",
  },
  {
    id: "animal_shiba",
    name: "Shiba Dog",
    category: "animal",
    cost: 120,
    sprite: { sheet: "/assets/sprites/sheet5.png", pos: 2 },
    description: "Much wow. Very focus. Such farm.",
  },

  // ── sheet6: Squirrel · Duck (pos 0, Cat, removed — no atlas art, was
  // silently rendering as a raccoon both in the shop and on the farm) ──
  {
    id: "animal_squirrel",
    name: "Squirrel",
    category: "animal",
    cost: 70,
    sprite: { sheet: "/assets/sprites/sheet6.png", pos: 1 },
    description: "A speedy squirrel collecting acorns.",
  },
  {
    id: "animal_duck",
    name: "Duck",
    category: "animal",
    cost: 65,
    sprite: { sheet: "/assets/sprites/sheet6.png", pos: 2 },
    description: "A waddling mallard duck.",
  },

  // ── sheet4: Panda · Koala · Pig ──────────────────────────────────────
  {
    id: "animal_panda",
    name: "Panda",
    category: "animal",
    cost: 200,
    sprite: { sheet: "/assets/sprites/sheet4.png", pos: 0 },
    description: "A rare giant panda. Very distinguished.",
    unlockMinFocusMinutes: 120,
  },
  {
    id: "animal_koala",
    name: "Koala",
    category: "animal",
    cost: 175,
    sprite: { sheet: "/assets/sprites/sheet4.png", pos: 1 },
    description: "A sleepy koala chilling in your farm.",
    unlockMinFocusMinutes: 90,
  },
  {
    id: "animal_pig",
    name: "Pig",
    category: "animal",
    cost: 85,
    sprite: { sheet: "/assets/sprites/sheet4.png", pos: 2 },
    description: "A round and happy pink pig.",
  },

  // ── sheet1: Fox · Owl · Penguin ──────────────────────────────────────
  {
    id: "animal_fox",
    name: "Fox",
    category: "animal",
    cost: 110,
    sprite: { sheet: "/assets/sprites/sheet1.png", pos: 0 },
    description: "A clever fox with a bushy tail.",
  },
  {
    id: "animal_owl",
    name: "Owl",
    category: "animal",
    cost: 130,
    sprite: { sheet: "/assets/sprites/sheet1.png", pos: 1 },
    description: "A wise owl to guard your farm at night.",
  },
  {
    id: "animal_penguin",
    name: "Penguin",
    category: "animal",
    cost: 140,
    sprite: { sheet: "/assets/sprites/sheet1.png", pos: 2 },
    description: "A tuxedoed penguin waddling around.",
  },

  // ── sheet2: Raccoon · Deer · Frog ────────────────────────────────────
  {
    id: "animal_raccoon",
    name: "Raccoon",
    category: "animal",
    cost: 95,
    sprite: { sheet: "/assets/sprites/sheet2.png", pos: 0 },
    description: "A masked raccoon — mischievous but cute.",
  },
  {
    id: "animal_deer",
    name: "Deer",
    category: "animal",
    cost: 160,
    sprite: { sheet: "/assets/sprites/sheet2.png", pos: 1 },
    description: "A graceful deer with elegant antlers.",
  },
  {
    id: "animal_frog",
    name: "Frog",
    category: "animal",
    cost: 45,
    sprite: { sheet: "/assets/sprites/sheet2.png", pos: 2 },
    description: "A cheerful green frog by the pond.",
  },

  // ── sheet3: Elephant · Lion · Monkey ─────────────────────────────────
  {
    id: "animal_elephant",
    name: "Elephant",
    category: "animal",
    cost: 220,
    sprite: { sheet: "/assets/sprites/sheet3.png", pos: 0 },
    description: "A gentle giant elephant.",
    unlockMinFocusMinutes: 150,
  },
  {
    id: "animal_lion",
    name: "Lion",
    category: "animal",
    cost: 250,
    sprite: { sheet: "/assets/sprites/sheet3.png", pos: 1 },
    description: "The king of the farm.",
    unlockMinFocusMinutes: 200,
  },
  {
    id: "animal_monkey",
    name: "Monkey",
    category: "animal",
    cost: 180,
    sprite: { sheet: "/assets/sprites/sheet3.png", pos: 2 },
    description: "A playful monkey swinging around.",
    unlockMinFocusMinutes: 100,
  },

];

export function getItemById(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((item) => item.id === id);
}
