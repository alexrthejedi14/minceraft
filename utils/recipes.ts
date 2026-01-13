
import { BlockType, ItemStack } from '../types';

export interface Recipe {
    result: ItemStack;
    pattern: (BlockType | null)[][];
}

export const RECIPES: Recipe[] = [
    // 1 Log -> 4 Planks
    {
        result: { id: BlockType.PLANKS, count: 4 },
        pattern: [[BlockType.WOOD]]
    },
    {
        result: { id: BlockType.PLANKS, count: 4 },
        pattern: [[BlockType.BIRCH_LOG]]
    },
    {
        result: { id: BlockType.PLANKS, count: 4 },
        pattern: [[BlockType.SPRUCE_LOG]]
    },
    {
        result: { id: BlockType.PLANKS, count: 4 },
        pattern: [[BlockType.JUNGLE_LOG]]
    },
    {
        result: { id: BlockType.PLANKS, count: 4 },
        pattern: [[BlockType.ACACIA_LOG]]
    },
    // 2 Planks -> 4 Sticks
    {
        result: { id: BlockType.STICK, count: 4 },
        pattern: [
            [BlockType.PLANKS],
            [BlockType.PLANKS]
        ]
    },
    // 4 Planks -> Crafting Table
    {
        result: { id: BlockType.CRAFTING_TABLE, count: 1 },
        pattern: [
            [BlockType.PLANKS, BlockType.PLANKS],
            [BlockType.PLANKS, BlockType.PLANKS]
        ]
    },
    // Torch: Coal over Stick
    {
        result: { id: BlockType.TORCH, count: 4 },
        pattern: [
            [BlockType.COAL],
            [BlockType.STICK]
        ]
    },
    // --- Wooden Tools ---
    {
        result: { id: BlockType.WOODEN_PICKAXE, count: 1 },
        pattern: [
            [BlockType.PLANKS, BlockType.PLANKS, BlockType.PLANKS],
            [null, BlockType.STICK, null],
            [null, BlockType.STICK, null]
        ]
    },
    {
        result: { id: BlockType.WOODEN_AXE, count: 1 },
        pattern: [
            [BlockType.PLANKS, BlockType.PLANKS],
            [BlockType.PLANKS, BlockType.STICK],
            [null, BlockType.STICK]
        ]
    },
    {
        result: { id: BlockType.WOODEN_AXE, count: 1 },
        pattern: [
            [BlockType.PLANKS, BlockType.PLANKS],
            [BlockType.STICK, BlockType.PLANKS],
            [BlockType.STICK, null]
        ]
    },
    {
        result: { id: BlockType.WOODEN_SHOVEL, count: 1 },
        pattern: [
            [BlockType.PLANKS],
            [BlockType.STICK],
            [BlockType.STICK]
        ]
    },
    {
        result: { id: BlockType.WOODEN_SWORD, count: 1 },
        pattern: [
            [BlockType.PLANKS],
            [BlockType.PLANKS],
            [BlockType.STICK]
        ]
    },

    // --- Stone Tools ---
    {
        result: { id: BlockType.STONE_PICKAXE, count: 1 },
        pattern: [
            [BlockType.COBBLESTONE, BlockType.COBBLESTONE, BlockType.COBBLESTONE],
            [null, BlockType.STICK, null],
            [null, BlockType.STICK, null]
        ]
    },
    {
        result: { id: BlockType.STONE_AXE, count: 1 },
        pattern: [
            [BlockType.COBBLESTONE, BlockType.COBBLESTONE],
            [BlockType.COBBLESTONE, BlockType.STICK],
            [null, BlockType.STICK]
        ]
    },
    {
        result: { id: BlockType.STONE_SHOVEL, count: 1 },
        pattern: [
            [BlockType.COBBLESTONE],
            [BlockType.STICK],
            [BlockType.STICK]
        ]
    },
    {
        result: { id: BlockType.STONE_SWORD, count: 1 },
        pattern: [
            [BlockType.COBBLESTONE],
            [BlockType.COBBLESTONE],
            [BlockType.STICK]
        ]
    }
];

export function findRecipe(grid: (BlockType | null)[], gridSize: number): ItemStack | null {
    // Helper to extract non-empty bounds
    let minX = gridSize, minY = gridSize, maxX = -1, maxY = -1;
    for (let i = 0; i < grid.length; i++) {
        if (grid[i] !== null) {
            const x = i % gridSize;
            const y = Math.floor(i / gridSize);
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
    }

    if (maxX === -1) return null; // Empty grid

    const width = maxX - minX + 1;
    const height = maxY - minY + 1;

    for (const recipe of RECIPES) {
        const rH = recipe.pattern.length;
        const rW = recipe.pattern[0].length;
        
        if (rW !== width || rH !== height) continue;

        let match = true;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const gridVal = grid[(minY + y) * gridSize + (minX + x)];
                const recipeVal = recipe.pattern[y][x];
                if (gridVal !== recipeVal) {
                    match = false;
                    break;
                }
            }
            if (!match) break;
        }

        if (match) return { ...recipe.result }; // Return copy
    }

    return null;
}
