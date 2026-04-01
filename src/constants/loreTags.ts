export const LORE_TAG_CATEGORIES = {
  SPECIES: [
    "Altan", "Elgem", "Human", "Khaured", "Lopati", "Onoros", "Robotron", "Augments", "Nordic"
  ],
  PLANETS_FRONTIER: [
    "Eyeke", "Kavian", "Magor", "Naron", "Neri", "Veles"
  ],
  PLANETS_FEDERATION: [
    "Alta Prime", "Khaur", "Velgemmis", "Elsewhere", "Lopat Asteroid/Debris Field"
  ],
  TECHNOLOGY: [
    "Triactor Technology", "Trilium", "Data core", "Triactor Jack"
  ],
  TOOLS: [
    "Standard Shovel", "Standard Drill", "Power Extractor", "Gasrigged Extractor", "Infused Extractor",
    "Basic Explosive", "Standard Capacitor", "Basic Trilium Detector", "ExoGloves", "Power Saw",
    "Bananominer", "Shiny Explosive", "Extreme Extractor", "Dusty Extractor", "Exo Claws",
    "Plasmatic Extractor", "Cymatic Saw", "Rookie Treasure Locator", "Certified Kol Digger",
    "Draxos Hammer", "Ether Converter", "Draxos Axe", "Large Capacitor", "Processing Ring",
    "Glavor Disc", "Artunian Shovel", "Large Explosive", "Barrel Digger", "Causian Attractor",
    "Quark Separator", "Advanced TD", "RD9000 Excavator", "Localised Attractor", "Nanominer",
    "Exlian Staff", "Quantum Drill", "Particle Beam Collider", "Lucky Drill", "AI Excavator",
    "Waxtural Processor", "Dacalizer"
  ],
  WEAPONS: [
    "Standard Sword", "Rock Cudgel", "Standard Issue Axe", "Standard Shield", "Rock Blade",
    "Stave of Deception", "Titanium Dagger", "Kite Axe", "Widow Maker", "Spike Hammer",
    "Confuser", "Lithium Dagger", "Infernal Axe", "Sky Shield", "Plasma Shield",
    "Jaggered Spear", "Emerald Dagger", "Equalizer Bow", "Storm Edge Sword", "Waxon Sword",
    "Moonshot Blade", "Dawn Sword", "Necromancers Hammer", "Green Axe", "Nordic Warhammer",
    "Reptiloid Blade", "Waxon Staff", "Star Fire Sword", "Sandmaster Spear", "Elite Dagger",
    "Randomizer Bow", "Dagger of Creation", "Toothed Dagger", "Waxon Shield", "Healing Blade",
    "Eternal Blade", "Galatic Fireblade", "Divine Blade", "AI Sword", "Moonkey Scepter",
    "Waxon Fire Sword", "Sungorger", "Leveller Bow"
  ],
  AVATARS: [
    "Female Human", "Male Human", "Female Grey", "Male Grey", "Female Reptiloid", "Male Reptiloid",
    "Female Little Green Person", "Male Little Green Person", "Female Nordic", "Male Nordic",
    "Robotron Soldier", "Commander Church", "Ted Shadewick", "Aioshi Holoform", "Kol, The Emancipator"
  ],
  MINIONS: [
    "Stealth Mercenary", "Grey Peacemaker", "LG Soldier", "Grey Scientist", "Nordic Warrior",
    "Terminator", "Wise Ancient One", "Explosives Specialist", "Robot Supersoldier",
    "Mysterious Hacker", "Enhanced Reptiloid", "Astronaut", "Storm Giant"
  ],
  LANDS: [
    "Small Island", "Tree Forest", "Mushroom Forest", "Plains", "Sandy Desert", "Dunes",
    "Rocky Desert", "Icy Desert", "Icy Mountains", "Rocky Coastline", "Sandy Coastline",
    "Grass Coastline", "Mountains", "Inland River", "Active Volcano", "Dormant Volcano",
    "Rocky Crater", "Methane Swampland", "Geothermal Springs", "Grassland"
  ]
};

export const ALL_LORE_TAGS = Object.values(LORE_TAG_CATEGORIES).flat();

export const getTagsFromText = (text: string): string[] => {
  if (!text) return [];
  const lowerText = text.toLowerCase();
  
  // Use a more robust matching strategy with word boundaries
  return ALL_LORE_TAGS.filter(tag => {
    const lowerTag = tag.toLowerCase();
    // Escape special characters for regex
    const escapedTag = lowerTag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Match the tag as a whole word or phrase
    const regex = new RegExp(`\\b${escapedTag}\\b`, 'i');
    return regex.test(lowerText);
  });
};
