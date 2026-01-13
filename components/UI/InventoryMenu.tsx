
import React, { useState, useEffect } from 'react';
import { InventorySlots, BlockType, ItemStack } from '../../types';
import { getBlockTexture } from '../../utils/textures';
import { findRecipe } from '../../utils/recipes';
import { BLOCK_PROPS } from '../../constants';

interface Props {
    inventory: InventorySlots;
    gameMode: 'Survival' | 'Creative';
    onInventoryUpdate: (inv: InventorySlots) => void;
    isCraftingTable?: boolean; // New prop
}

interface HoverState {
    section: 'INVENTORY' | 'CRAFT' | 'CREATIVE';
    index: number;
}

export const InventoryMenu: React.FC<Props> = ({ inventory, gameMode, onInventoryUpdate, isCraftingTable = false }) => {
    const [cursorItem, setCursorItem] = useState<ItemStack | null>(null);
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const [hoveredSlot, setHoveredSlot] = useState<HoverState | null>(null);
    const [activeTab, setActiveTab] = useState<'INVENTORY' | 'CREATIVE'>('INVENTORY');
    
    // Crafting State
    const craftSize = isCraftingTable ? 3 : 2;
    const [craftGrid, setCraftGrid] = useState<(ItemStack | null)[]>(new Array(craftSize * craftSize).fill(null));
    const [craftResult, setCraftResult] = useState<ItemStack | null>(null);

    const getIconUrl = (type: BlockType) => (getBlockTexture(type).image as HTMLCanvasElement).toDataURL();

    // Check recipes when grid changes
    useEffect(() => {
        const flatGrid = craftGrid.map(item => item ? item.id : null);
        const result = findRecipe(flatGrid, craftSize);
        setCraftResult(result);
    }, [craftGrid, craftSize]);

    // Keyboard listener for Item Spreading (KeyF)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'KeyF' && cursorItem && hoveredSlot) {
                let currentItemInSlot: ItemStack | null = null;
                
                if (hoveredSlot.section === 'INVENTORY') {
                    currentItemInSlot = inventory[hoveredSlot.index];
                } else if (hoveredSlot.section === 'CRAFT') {
                    currentItemInSlot = craftGrid[hoveredSlot.index];
                }

                if (hoveredSlot.section !== 'CREATIVE' && (!currentItemInSlot || (currentItemInSlot.id === cursorItem.id && currentItemInSlot.count < 64))) {
                    if (cursorItem.count > 0) {
                        const newCursor = { ...cursorItem, count: cursorItem.count - 1 };
                        if (newCursor.count <= 0) setCursorItem(null);
                        else setCursorItem(newCursor);

                        const newItem = currentItemInSlot 
                            ? { ...currentItemInSlot, count: currentItemInSlot.count + 1 }
                            : { id: cursorItem.id, count: 1 };

                        if (hoveredSlot.section === 'INVENTORY') {
                            const newInv = [...inventory];
                            newInv[hoveredSlot.index] = newItem;
                            onInventoryUpdate(newInv);
                        } else {
                            const newGrid = [...craftGrid];
                            newGrid[hoveredSlot.index] = newItem;
                            setCraftGrid(newGrid);
                        }
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [cursorItem, hoveredSlot, inventory, craftGrid, onInventoryUpdate]);

    const handleInventoryClick = (index: number) => {
        const newInv = [...inventory];
        const clickedItem = newInv[index];

        if (cursorItem) {
            if (clickedItem) {
                if (clickedItem.id === cursorItem.id && clickedItem.count < 64) {
                     const space = 64 - clickedItem.count;
                     const toAdd = Math.min(space, cursorItem.count);
                     clickedItem.count += toAdd;
                     cursorItem.count -= toAdd;
                     if (cursorItem.count <= 0) setCursorItem(null);
                     else setCursorItem({ ...cursorItem });
                     newInv[index] = clickedItem;
                } else {
                    newInv[index] = cursorItem;
                    setCursorItem(clickedItem);
                }
            } else {
                newInv[index] = cursorItem;
                setCursorItem(null);
            }
        } else if (clickedItem) {
            setCursorItem(clickedItem);
            newInv[index] = null;
        }
        onInventoryUpdate(newInv);
    };

    const handleCraftGridClick = (index: number) => {
        const newGrid = [...craftGrid];
        const clickedItem = newGrid[index];

        if (cursorItem) {
            if (clickedItem) {
                 if (clickedItem.id === cursorItem.id && clickedItem.count < 64) {
                     const space = 64 - clickedItem.count;
                     const toAdd = Math.min(space, cursorItem.count);
                     clickedItem.count += toAdd;
                     cursorItem.count -= toAdd;
                     if (cursorItem.count <= 0) setCursorItem(null);
                     else setCursorItem({ ...cursorItem });
                     newGrid[index] = clickedItem;
                } else {
                    newGrid[index] = cursorItem;
                    setCursorItem(clickedItem);
                }
            } else {
                newGrid[index] = cursorItem;
                setCursorItem(null);
            }
        } else if (clickedItem) {
            setCursorItem(clickedItem);
            newGrid[index] = null;
        }
        setCraftGrid(newGrid);
    };

    const handleCraftResultClick = () => {
        if (!craftResult) return;
        
        if (cursorItem) {
            if (cursorItem.id !== craftResult.id) return;
            if (cursorItem.count + craftResult.count > 64) return;
            
            const newCursor = { ...cursorItem, count: cursorItem.count + craftResult.count };
            setCursorItem(newCursor);
        } else {
            setCursorItem(craftResult);
        }

        const newGrid = craftGrid.map(item => {
            if (item) {
                const newItem = { ...item, count: item.count - 1 };
                return newItem.count > 0 ? newItem : null;
            }
            return null;
        });
        setCraftGrid(newGrid);
    };

    const handleCreativeClick = (id: BlockType) => {
        setCursorItem({ id, count: 64 });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        setMousePos({ x: e.clientX, y: e.clientY });
    };

    const Slot: React.FC<{ 
        item: ItemStack | null; 
        onClick: () => void; 
        onHover: () => void;
        transparent?: boolean 
    }> = ({ 
        item, 
        onClick, 
        onHover,
        transparent = false 
    }) => (
        <div 
            onMouseDown={onClick}
            onMouseEnter={onHover}
            onMouseLeave={() => setHoveredSlot(null)}
            className={`
                w-12 h-12 border-2 border-white border-r-[#373737] border-b-[#373737] 
                flex justify-center items-center hover:bg-[#a0a0a0] relative cursor-pointer
                ${transparent ? 'bg-transparent' : 'bg-[#8b8b8b]'}
            `}
        >
            {item && (
                <>
                    <img src={getIconUrl(item.id)} className="w-8 h-8 pixelated pointer-events-none" />
                    <span className="absolute bottom-[2px] right-[2px] text-white text-xs font-bold drop-shadow-[1px_1px_0_#000] pointer-events-none">
                        {item.count}
                    </span>
                </>
            )}
        </div>
    );

    return (
        <div className="w-full h-full" onMouseMove={handleMouseMove}>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-[#c6c6c6] border-2 border-black p-3 shadow-2xl flex flex-col gap-3 items-center">
                
                {/* Tabs */}
                {gameMode === 'Creative' && (
                    <div className="flex w-full gap-1 mb-[-14px] z-10 pl-2">
                        <button 
                            className={`px-4 py-1 border-t-2 border-l-2 border-r-2 border-black text-black ${activeTab==='INVENTORY' ? 'bg-[#c6c6c6] pb-2' : 'bg-[#8b8b8b]'}`}
                            onClick={() => setActiveTab('INVENTORY')}
                        >
                            Inventory
                        </button>
                        <button 
                            className={`px-4 py-1 border-t-2 border-l-2 border-r-2 border-black text-black ${activeTab==='CREATIVE' ? 'bg-[#c6c6c6] pb-2' : 'bg-[#8b8b8b]'}`}
                            onClick={() => setActiveTab('CREATIVE')}
                        >
                            Creative
                        </button>
                    </div>
                )}

                {activeTab === 'INVENTORY' && (
                    <>
                        <div className="text-[#404040] text-xl w-full text-left">{isCraftingTable ? 'Crafting Table' : 'Crafting'}</div>
                        <div className="flex gap-4 p-3 bg-[#c6c6c6] justify-center items-center">
                            <div 
                                className="grid gap-1"
                                style={{ gridTemplateColumns: `repeat(${craftSize}, 1fr)` }}
                            >
                                {craftGrid.map((item, i) => (
                                    <Slot 
                                        key={i} 
                                        item={item} 
                                        onClick={() => handleCraftGridClick(i)} 
                                        onHover={() => setHoveredSlot({ section: 'CRAFT', index: i })}
                                    />
                                ))}
                            </div>
                            <div className="text-2xl text-[#404040]">→</div>
                            <Slot 
                                item={craftResult} 
                                onClick={handleCraftResultClick} 
                                onHover={() => {}} 
                            />
                        </div>
                    </>
                )}

                {activeTab === 'CREATIVE' && (
                    <div className="w-[430px] h-[300px] overflow-y-auto bg-[#c6c6c6] p-1 border-2 border-[#555]">
                        <div className="grid grid-cols-9 gap-1">
                            {Object.keys(BLOCK_PROPS).map((key) => {
                                const id = parseInt(key) as BlockType;
                                if (id === BlockType.AIR) return null;
                                return (
                                    <div 
                                        key={id} 
                                        onMouseDown={() => handleCreativeClick(id)}
                                        className="w-10 h-10 border-2 border-[#555] bg-[#8b8b8b] hover:bg-[#a0a0a0] flex items-center justify-center cursor-pointer"
                                    >
                                        <img src={getIconUrl(id)} className="w-8 h-8 pixelated" />
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                <div className="w-full h-[2px] bg-[#888] my-1"></div>

                <div className="text-[#404040] text-xl w-full text-left">Inventory</div>
                <div className="flex flex-col gap-1">
                    {/* Main Grid (rows 1-3) */}
                    {Array.from({ length: 3 }).map((_, r) => (
                        <div key={r} className="flex gap-1">
                            {Array.from({ length: 9 }).map((_, c) => {
                                const idx = 9 + r * 9 + c;
                                return (
                                    <Slot 
                                        key={idx} 
                                        item={inventory[idx]} 
                                        onClick={() => handleInventoryClick(idx)} 
                                        onHover={() => setHoveredSlot({ section: 'INVENTORY', index: idx })}
                                    />
                                );
                            })}
                        </div>
                    ))}
                    <div className="h-2"></div>
                    {/* Hotbar (row 0) */}
                    <div className="flex gap-1">
                        {Array.from({ length: 9 }).map((_, c) => (
                            <Slot 
                                key={c} 
                                item={inventory[c]} 
                                onClick={() => handleInventoryClick(c)} 
                                onHover={() => setHoveredSlot({ section: 'INVENTORY', index: c })}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {/* Floating Cursor Item */}
            {cursorItem && (
                <div 
                    className="fixed pointer-events-none z-[1000]"
                    style={{ left: mousePos.x, top: mousePos.y, transform: 'translate(-50%, -50%)' }}
                >
                    <img src={getIconUrl(cursorItem.id)} className="w-8 h-8 pixelated drop-shadow-md" />
                    <span className="absolute bottom-0 right-0 text-white text-xs font-bold drop-shadow-[1px_1px_0_#000]">
                        {cursorItem.count}
                    </span>
                </div>
            )}
        </div>
    );
};
