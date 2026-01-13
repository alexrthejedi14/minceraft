
import { BlockType, BlockProp } from './types';

export const CHUNK_SIZE = 16;
export const CHUNK_HEIGHT = 256;
export const SEA_LEVEL = 63;
export const GRAVITY = 25.0;
export const JUMP_FORCE = 9.0;
export const MOVE_SPEED = 6.0;

// Hardness: Time in seconds to break by hand
export const BLOCK_PROPS: Record<number, BlockProp> = {
    [BlockType.GRASS]: { name: 'Grass', color: 0x55902a, hardness: 0.6, toolType: 'shovel' },
    [BlockType.DIRT]: { name: 'Dirt', color: 0x795548, hardness: 0.5, toolType: 'shovel' },
    [BlockType.STONE]: { name: 'Stone', color: 0x9e9e9e, hardness: 1.5, toolType: 'pickaxe' },
    [BlockType.WOOD]: { name: 'Oak Wood', color: 0x5d4037, hardness: 2.0, toolType: 'axe' },
    [BlockType.LEAVES]: { name: 'Leaves', color: 0x2e7d32, transparent: true, hardness: 0.2 },
    [BlockType.SAND]: { name: 'Sand', color: 0xd4c4a8, hardness: 0.5, toolType: 'shovel' },
    [BlockType.BRICK]: { name: 'Bricks', color: 0x8d6e63, hardness: 2.0, toolType: 'pickaxe' },
    [BlockType.SNOW]: { name: 'Snow', color: 0xffffff, hardness: 0.3, toolType: 'shovel' },
    [BlockType.ICE]: { name: 'Ice', color: 0xa5d6f1, transparent: true, hardness: 0.5 },
    [BlockType.CACTUS]: { name: 'Cactus', color: 0x558b2f, hardness: 0.4 },
    [BlockType.TALL_GRASS]: { name: 'Tall Grass', color: 0x55902a, cross: true, transparent: true, hardness: 0.0 },
    [BlockType.WATER]: { name: 'Water', color: 0x244b7f, transparent: true, fluid: true, hardness: -1 },
    [BlockType.FLOWING_WATER]: { name: 'Flowing Water', color: 0x244b7f, transparent: true, fluid: true, hardness: -1 },
    [BlockType.SANDSTONE]: { name: 'Sandstone', color: 0xD6C296, hardness: 0.8, toolType: 'pickaxe' },
    [BlockType.GRAVEL]: { name: 'Gravel', color: 0x707070, hardness: 0.6, toolType: 'shovel' },
    [BlockType.RED_SAND]: { name: 'Red Sand', color: 0xD2691E, hardness: 0.5, toolType: 'shovel' },
    [BlockType.CLAY]: { name: 'Clay', color: 0xA2A6B5, hardness: 0.6, toolType: 'shovel' },
    [BlockType.PODZOL]: { name: 'Podzol', color: 0x4E342E, hardness: 0.6, toolType: 'shovel' },
    [BlockType.PLANKS]: { name: 'Planks', color: 0xA0784B, hardness: 1.5, toolType: 'axe' },
    [BlockType.BEDROCK]: { name: 'Bedrock', color: 0x222222, hardness: -1 }, // Unbreakable
    [BlockType.BIRCH_LOG]: { name: 'Birch Log', color: 0xE0E0E0, hardness: 2.0, toolType: 'axe' },
    [BlockType.BIRCH_LEAVES]: { name: 'Birch Leaves', color: 0x80A755, transparent: true, hardness: 0.2 },
    [BlockType.SPRUCE_LOG]: { name: 'Spruce Log', color: 0x3E2723, hardness: 2.0, toolType: 'axe' },
    [BlockType.SPRUCE_LEAVES]: { name: 'Spruce Leaves', color: 0x385942, transparent: true, hardness: 0.2 },
    [BlockType.JUNGLE_LOG]: { name: 'Jungle Log', color: 0x554433, hardness: 2.0, toolType: 'axe' },
    [BlockType.JUNGLE_LEAVES]: { name: 'Jungle Leaves', color: 0x228B22, transparent: true, hardness: 0.2 },
    [BlockType.ACACIA_LOG]: { name: 'Acacia Log', color: 0x6D6965, hardness: 2.0, toolType: 'axe' },
    [BlockType.ACACIA_LEAVES]: { name: 'Acacia Leaves', color: 0x667530, transparent: true, hardness: 0.2 },
    [BlockType.CRAFTING_TABLE]: { name: 'Crafting Table', color: 0xA0784B, hardness: 2.5, toolType: 'axe' },
    [BlockType.COBBLESTONE]: { name: 'Cobblestone', color: 0x606060, hardness: 2.0, toolType: 'pickaxe' },
    [BlockType.STICK]: { name: 'Stick', color: 0x8D6E63, hardness: 0.1, isItem: true },
    [BlockType.DIAMOND_BLOCK]: { name: 'Diamond Block', color: 0x00FFFF, hardness: 5.0, toolType: 'pickaxe' },

    // Ores & Items
    [BlockType.COAL_ORE]: { name: 'Coal Ore', color: 0x333333, hardness: 3.0, toolType: 'pickaxe' },
    [BlockType.COAL]: { name: 'Coal', color: 0x111111, isItem: true, hardness: 0 },
    [BlockType.TORCH]: { name: 'Torch', color: 0xFFD700, transparent: true, hardness: 0.0, emissive: true },

    // Food
    [BlockType.RAW_BEEF]: { name: 'Raw Beef', color: 0xD32F2F, isItem: true, healAmount: 3 },
    [BlockType.PORKCHOP]: { name: 'Raw Porkchop', color: 0xF48FB1, isItem: true, healAmount: 3 },
    [BlockType.MUTTON]: { name: 'Raw Mutton', color: 0xEF5350, isItem: true, healAmount: 3 },
    [BlockType.ROTTEN_FLESH]: { name: 'Rotten Flesh', color: 0x6D4C41, isItem: true, healAmount: 1 },

    // Tools
    [BlockType.WOODEN_PICKAXE]: { name: 'Wooden Pickaxe', color: 0x8D6E63, isItem: true, hardness: 0, toolType: 'pickaxe', efficiency: 2.0 },
    [BlockType.WOODEN_AXE]: { name: 'Wooden Axe', color: 0x8D6E63, isItem: true, hardness: 0, toolType: 'axe', efficiency: 2.0 },
    [BlockType.WOODEN_SHOVEL]: { name: 'Wooden Shovel', color: 0x8D6E63, isItem: true, hardness: 0, toolType: 'shovel', efficiency: 2.0 },
    [BlockType.WOODEN_SWORD]: { name: 'Wooden Sword', color: 0x8D6E63, isItem: true, hardness: 0, toolType: 'sword', damage: 4.0 },

    [BlockType.STONE_PICKAXE]: { name: 'Stone Pickaxe', color: 0x9e9e9e, isItem: true, hardness: 0, toolType: 'pickaxe', efficiency: 4.0 },
    [BlockType.STONE_AXE]: { name: 'Stone Axe', color: 0x9e9e9e, isItem: true, hardness: 0, toolType: 'axe', efficiency: 4.0 },
    [BlockType.STONE_SHOVEL]: { name: 'Stone Shovel', color: 0x9e9e9e, isItem: true, hardness: 0, toolType: 'shovel', efficiency: 4.0 },
    [BlockType.STONE_SWORD]: { name: 'Stone Sword', color: 0x9e9e9e, isItem: true, hardness: 0, toolType: 'sword', damage: 5.0 },
};

export const INITIAL_SETTINGS = {
    fov: 75,
    renderDistance: 6,
    sensitivity: 0.003,
    smoothLighting: true,
    shadows: true
};
