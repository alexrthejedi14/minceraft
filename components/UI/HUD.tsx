
import React from 'react';
import { InventorySlots, BlockType } from '../../types';
import { BLOCK_PROPS } from '../../constants';
import { getBlockTexture } from '../../utils/textures';

interface HUDProps {
    health: number;
    inventory: InventorySlots;
    selectedSlot: number;
    gameMode: 'Survival' | 'Creative';
    position?: { x: number, y: number, z: number };
    biome?: string;
}

// Pixel art heart SVG Data URIs
const HEART_FULL = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiBzaGFwZS1yZW5kZXJpbmc9ImNyaXNwRWRnZXMiPjxwYXRoIGQ9Ik00IDRIM0gydjJIMUMyaDFWNGgxVjNINnYxSDhWMyBoMXYxaDF2MmgxdjFoLTF2MmgtMXYyaC0xdjJoLTF2LTJIOHYtMkg2di0ySDV2LTJINHoiIGZpbGw9IiMwMDAiIG9wYWNpdHk9IjAuNSIvPjxwYXRoIGQ9Ik00IDRIM3YyaDF2MmgxdjJoMXYyaDF2MmgxdjFoMXYtMWgxdi0yaDF2LTJoMXYtMmgxdi0xaC0xdi0yaC0xdi0xaC0xdjFoLTF2MWgtMXYtMWgtMXYtMWgtMXYxaC0xeiIgZmlsbD0iI2YwMCIvPjwvc3ZnPg==";
const HEART_EMPTY = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiBzaGFwZS1yZW5kZXJpbmc9ImNyaXNwRWRnZXMiPjxwYXRoIGQ9Ik00IDRIM0gydjJIMUMyaDFWNGgxVjNINnYxSDhWMyBoMXYxaDF2MmgxdjFoLTF2MmgtMXYyaC0xdjJoLTF2LTJIOHYtMkg2di0ySDV2LTJINHoiIGZpbGw9IiMzMzMiLz48cGF0aCBkPSJNMCAwSDE2VjE2SDBaIiBmaWxsPSJub25lIi8+PC9zdmc+";

const HUD: React.FC<HUDProps> = ({ health, inventory, selectedSlot, gameMode, position, biome }) => {
    // Generate icons once or when needed
    const getIconUrl = (type: BlockType) => {
        const tex = getBlockTexture(type);
        return (tex.image as HTMLCanvasElement).toDataURL();
    };

    return (
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-center items-center font-bold">
            {/* Coordinates / Debug Info (Top Left) */}
            <div className="absolute top-2 left-2 flex flex-col items-start text-white text-lg drop-shadow-[2px_2px_0_#000]">
                {position && (
                    <div className="mb-1">
                        XYZ: {position.x.toFixed(1)} / {position.y.toFixed(1)} / {position.z.toFixed(1)}
                    </div>
                )}
                {biome && (
                    <div>Biome: {biome}</div>
                )}
            </div>

            {/* Crosshair */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-4 h-4 z-10 mix-blend-difference">
                <div className="absolute top-[7px] left-0 w-4 h-[2px] bg-white opacity-80"></div>
                <div className="absolute top-0 left-[7px] w-[2px] h-4 bg-white opacity-80"></div>
            </div>

            {/* Bottom HUD */}
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex flex-col items-center pointer-events-auto">
                
                {/* Hearts - Only show in Survival */}
                {gameMode === 'Survival' && (
                    <div className="w-full flex justify-start mb-1 px-1" style={{ minWidth: '430px' }}>
                        <div className="flex gap-1">
                            {Array.from({ length: 10 }).map((_, i) => (
                                <img
                                    key={i}
                                    src={health > i ? HEART_FULL : HEART_EMPTY}
                                    className="w-5 h-5 pixelated"
                                    alt={health > i ? "Heart" : "Empty Heart"}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {/* Hotbar */}
                <div className="flex bg-black/60 p-1 border-2 border-[#333]">
                    {inventory.slice(0, 9).map((item, i) => (
                        <div 
                            key={i}
                            className={`
                                relative w-10 h-10 sm:w-12 sm:h-12 border-2 
                                flex justify-center items-center 
                                bg-[rgba(50,50,50,0.5)] transition-transform duration-75
                                ${i === selectedSlot ? 'border-white scale-105 bg-[rgba(100,100,100,0.6)] z-10' : 'border-[#555] opacity-90'}
                            `}
                        >
                            {item && (
                                <>
                                    <img src={getIconUrl(item.id)} className="w-8 h-8 pixelated" alt={BLOCK_PROPS[item.id].name} />
                                    {gameMode === 'Survival' && (
                                        <span className="absolute bottom-[2px] right-[2px] text-white text-[10px] sm:text-xs font-bold drop-shadow-[1px_1px_0_#000]">
                                            {item.count}
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default HUD;
