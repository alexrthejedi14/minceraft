
export enum BlockType {
    AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, WOOD = 4, LEAVES = 5, SAND = 6,
    BRICK = 7, SNOW = 8, ICE = 9, CACTUS = 10, TALL_GRASS = 11, WATER = 12, SANDSTONE = 13,
    GRAVEL = 14, RED_SAND = 15, CLAY = 16, PODZOL = 17, PLANKS = 18, BEDROCK = 19,
    BIRCH_LOG = 20, BIRCH_LEAVES = 21, SPRUCE_LOG = 22, SPRUCE_LEAVES = 23,
    JUNGLE_LOG = 24, JUNGLE_LEAVES = 25, ACACIA_LOG = 26, ACACIA_LEAVES = 27,
    CRAFTING_TABLE = 28, COBBLESTONE = 29, STICK = 30, DIAMOND_BLOCK = 31,
    // Ores & Tools
    COAL_ORE = 32, COAL = 33, TORCH = 34,
    WOODEN_PICKAXE = 35, WOODEN_AXE = 36, WOODEN_SHOVEL = 37, WOODEN_SWORD = 38,
    STONE_PICKAXE = 39, STONE_AXE = 40, STONE_SHOVEL = 41, STONE_SWORD = 42,
    // Food
    RAW_BEEF = 43, PORKCHOP = 44, MUTTON = 45, ROTTEN_FLESH = 46,
    // Fluid
    FLOWING_WATER = 47
}

export enum EntityType {
    COW = 'cow',
    PIG = 'pig',
    SHEEP = 'sheep',
    ZOMBIE = 'zombie'
}

export type ToolType = 'pickaxe' | 'axe' | 'shovel' | 'sword' | 'none';

export interface BlockProp {
    name: string;
    color: number;
    transparent?: boolean;
    cross?: boolean; // For X-shaped models like grass
    fluid?: boolean;
    hardness?: number; // Time in seconds to break
    isItem?: boolean; // If true, cannot be placed as a block
    toolType?: ToolType; // Tool required to speed up mining
    efficiency?: number; // Speed multiplier if tool matches
    damage?: number; // For swords
    emissive?: boolean; // For torches
    healAmount?: number; // For food
}

export interface ItemStack {
    id: BlockType;
    count: number;
}

export type InventorySlots = (ItemStack | null)[];

export interface PlayerData {
    x: number;
    y: number;
    z: number;
    h: number; // Health
    yaw?: number;
    pitch?: number;
}

export interface WorldData {
    id: string;
    name: string;
    seed: number;
    type: 'Default' | 'Flat' | 'Mountains';
    mode: 'Survival' | 'Creative';
    player: PlayerData;
    inventory: InventorySlots | null;
    modified: [string, BlockType][]; // Key value pairs of "x,y,z" -> BlockType
    timestamp: number;
}

export interface GameSettings {
    fov: number;
    renderDistance: number;
    sensitivity: number;
    smoothLighting: boolean;
    shadows: boolean;
}
