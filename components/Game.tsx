
import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/Engine';
import { WorldData, InventorySlots, GameSettings, BlockType } from '../types';
import HUD from './UI/HUD';
import { InventoryMenu } from './UI/InventoryMenu';
import { SettingsMenu } from './UI/SettingsMenu';
import { BLOCK_PROPS } from '../constants';

interface GameProps {
    worldData: WorldData;
    onSaveAndQuit: (data: WorldData) => void;
    settings: GameSettings;
    onSettingsChange: (s: GameSettings) => void;
}

const Button: React.FC<{ children: React.ReactNode; onClick?: () => void; className?: string }> = ({ children, onClick, className }) => (
    <button 
        onClick={onClick}
        className={`
            bg-[#787878] border-2 border-black 
            border-t-[#b0b0b0] border-l-[#b0b0b0] border-b-[#555] border-r-[#555]
            text-[#ddd] text-2xl py-2 px-4 my-2 w-[400px] text-center
            shadow-[0_4px_0_rgba(0,0,0,0.5)] active:translate-y-[2px] active:shadow-[0_2px_0_rgba(0,0,0,0.5)]
            hover:bg-[#8b8b8b] hover:text-[#ffffa0]
            ${className}
        `}
    >
        {children}
    </button>
);

export const Game: React.FC<GameProps> = ({ worldData, onSaveAndQuit, settings, onSettingsChange }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<GameEngine | null>(null);
    
    // Use Ref for event listener access to avoid stale closure or re-binding
    const showInventoryRef = useRef(false);
    const showChatRef = useRef(false);

    const [isLoading, setIsLoading] = useState(true);
    const [paused, setPaused] = useState(true);
    const [showOptions, setShowOptions] = useState(false);
    const [showInventory, setShowInventory] = useState(false);
    // New state for 3x3 crafting
    const [isCraftingTable, setIsCraftingTable] = useState(false);
    
    const [showChat, setShowChat] = useState(false);
    
    // Game State that changes frequently or via Engine
    const [health, setHealth] = useState(worldData.player.h);
    const [isDead, setIsDead] = useState(false);
    const [inventory, setInventory] = useState<InventorySlots>([]);
    const [selectedSlot, setSelectedSlot] = useState(0);
    const [gameMode, setGameMode] = useState<'Survival' | 'Creative'>(worldData.mode);
    const [chatInput, setChatInput] = useState("");
    
    // Polled Stats for HUD
    const [playerPos, setPlayerPos] = useState({ x: 0, y: 0, z: 0 });
    const [currentBiome, setCurrentBiome] = useState("");

    // System message (toast)
    const [sysMsg, setSysMsg] = useState<string | null>(null);

    // Sync refs
    useEffect(() => { showInventoryRef.current = showInventory; }, [showInventory]);
    useEffect(() => { showChatRef.current = showChat; }, [showChat]);

    // Toast Timer
    useEffect(() => {
        if (sysMsg) {
            const t = setTimeout(() => setSysMsg(null), 3000);
            return () => clearTimeout(t);
        }
    }, [sysMsg]);

    // Polling Interval for HUD updates (Coordinates, Biome)
    useEffect(() => {
        const interval = setInterval(() => {
            if (engineRef.current && !paused) {
                const p = engineRef.current.playerPos;
                setPlayerPos({ x: p.x, y: p.y, z: p.z });
                setCurrentBiome(engineRef.current.getCurrentBiome());
            }
        }, 200); // 5 times a second
        return () => clearInterval(interval);
    }, [paused]);

    useEffect(() => {
        if (!containerRef.current) return;
        
        const initTimer = setTimeout(() => {
            const engine = new GameEngine(containerRef.current!, worldData, settings);
            engineRef.current = engine;
            
            setInventory(engine.inventory);
            setGameMode(engine.gameMode);

            engine.onHealthChange = (h) => setHealth(h);
            engine.onInventoryChange = (inv, sel) => {
                setInventory([...inv]);
                setSelectedSlot(sel);
            };
            engine.onPauseChange = (p) => {
                // If dead, ignore pause toggles to keep death screen active
                if (!showInventoryRef.current && !showChatRef.current && engine.playerHealth > 0) {
                    setPaused(p);
                }
            };
            engine.onSystemMessage = (msg) => {
                setSysMsg(msg);
            };
            engine.onOpenCrafting = (isTable) => {
                if (engine.playerHealth > 0) {
                    engine.setPaused(true);
                    setIsCraftingTable(isTable);
                    setShowInventory(true);
                }
            };
            engine.onGameModeChange = (mode) => {
                setGameMode(mode);
            };
            engine.onPlayerDeath = () => {
                setIsDead(true);
                setPaused(true);
                engine.exitPointerLock();
            };

            engine.start();
            setIsLoading(false);
        }, 100);

        const handleKeyDown = (e: KeyboardEvent) => {
            if (!engineRef.current) return;
            // Prevent actions if dead
            if (engineRef.current.playerHealth <= 0) return;

            if (showChatRef.current) {
                if (e.code === 'Escape') {
                    setShowChat(false);
                    setChatInput("");
                    engineRef.current.requestPointerLock();
                }
                return;
            }

            if ((e.code === 'Slash' || e.code === 'KeyT') && !showInventoryRef.current) {
                e.preventDefault();
                setShowChat(true);
                engineRef.current.exitPointerLock();
                engineRef.current.setPaused(true);
                setChatInput(e.code === 'Slash' ? "/" : "");
                setTimeout(() => document.getElementById('cmd-input')?.focus(), 10);
                return;
            }

            if (e.code === 'KeyE') {
                if (document.pointerLockElement) {
                    engineRef.current.exitPointerLock();
                    engineRef.current.setPaused(true);
                    setIsCraftingTable(false); // Default to inventory
                    setShowInventory(true);
                } else if (showInventoryRef.current) {
                    setShowInventory(false);
                    engineRef.current.requestPointerLock();
                }
            }
            if (e.code === 'Escape' && showInventoryRef.current) {
                 setShowInventory(false);
                 engineRef.current.requestPointerLock();
            }
        };
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            clearTimeout(initTimer);
            engineRef.current?.stop();
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []); 

    const handleResume = () => {
        engineRef.current?.requestPointerLock();
    };

    const handleRespawn = () => {
        setIsDead(false);
        setPaused(false);
        engineRef.current?.respawn();
        engineRef.current?.requestPointerLock();
    };

    const handleSaveQuit = () => {
        if (engineRef.current) {
            const currentData = engineRef.current.getWorldData();
            onSaveAndQuit({
                ...worldData,
                player: currentData.player as any,
                inventory: currentData.inventory as any,
                modified: currentData.modified as any,
                mode: gameMode, // Save current gamemode
                timestamp: Date.now()
            });
        }
    };

    const handleCommand = (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.startsWith('/')) {
            setShowChat(false);
            engineRef.current?.requestPointerLock();
            return;
        }

        const args = chatInput.substring(1).split(' ');
        const cmd = args[0].toLowerCase();
        const engine = engineRef.current;

        if (engine) {
            // /gamemode [c|s]
            if (cmd === 'gamemode' || cmd === 'gm') {
                const mode = args[1]?.toLowerCase();
                if (mode === 'c' || mode === 'creative') engine.setGameMode('Creative');
                if (mode === 's' || mode === 'survival') engine.setGameMode('Survival');
            }
            // /tp x y z
            else if (cmd === 'tp' && args.length >= 4) {
                const x = parseFloat(args[1]);
                const y = parseFloat(args[2]);
                const z = parseFloat(args[3]);
                if (!isNaN(x) && !isNaN(y) && !isNaN(z)) engine.teleport(x, y, z);
            }
            // /speed [val]
            else if (cmd === 'speed' && args[1]) {
                const s = parseFloat(args[1]);
                if (!isNaN(s)) engine.setSpeed(s);
            }
            // /locate [biome]
            else if (cmd === 'locate' && args[1]) {
                engine.locateBiome(args[1]);
            }
            // /kill
            else if (cmd === 'kill') {
                engine.takeDamage(1000);
            }
            // /clear
            else if (cmd === 'clear') {
                engine.clearInventory();
            }
            // /time set [day|night|number]
            else if (cmd === 'time' && args[1] === 'set' && args[2]) {
                const tStr = args[2].toLowerCase();
                let val = 0;
                if (tStr === 'day') val = 0.25;
                else if (tStr === 'noon') val = 0.25;
                else if (tStr === 'night') val = 0.75;
                else if (tStr === 'midnight') val = 0.75;
                else if (tStr === 'sunrise') val = 0;
                else if (tStr === 'sunset') val = 0.5;
                else {
                    const parsed = parseFloat(tStr);
                    if (!isNaN(parsed)) {
                        // If large number (like ticks), map 24000 ticks to 1.0
                        if (parsed > 1.0) val = (parsed % 24000) / 24000;
                        else val = parsed;
                    }
                }
                engine.setTime(val);
            }
            // /give [item] [count]
            else if (cmd === 'give' && args[1]) {
                const itemName = args[1].toUpperCase().replace('MINECRAFT:', '');
                const count = args[2] ? parseInt(args[2]) : 1;
                
                // Find BlockType ID
                let foundId: BlockType | null = null;
                // Try direct match in enum keys
                if (itemName in BlockType) {
                    foundId = BlockType[itemName as keyof typeof BlockType];
                }
                
                if (foundId !== null) {
                    engine.give(foundId, count);
                } else {
                    // Fallback search in BLOCK_PROPS names
                    let match = null;
                    const search = itemName.replace(/_/g, '').toLowerCase();
                    for (const k in BLOCK_PROPS) {
                        const prop = BLOCK_PROPS[k];
                        if (prop.name.toLowerCase().replace(/ /g, '') === search) {
                            match = parseInt(k);
                            break;
                        }
                    }
                    if (match !== null) engine.give(match, count);
                    else setSysMsg(`Unknown item: ${args[1]}`);
                }
            }
            else {
                setSysMsg(`Unknown command: ${cmd}`);
            }
        }

        setChatInput("");
        setShowChat(false);
        engine?.requestPointerLock();
    };

    const handleSettingsUpdate = (newSettings: GameSettings) => {
        onSettingsChange(newSettings);
        if (engineRef.current) {
            engineRef.current.updateSettings(newSettings);
        }
        setShowOptions(false);
    };

    return (
        <div className="absolute inset-0">
            <div ref={containerRef} className="absolute inset-0" />
            
            {isLoading && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center text-white bg-[#1a1a1a]">
                    <div className="absolute inset-0 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAIklEQVQIW2NkQAKrVq36zwjjgzjIHFBmAApgMakCURy9ABvzE+u/jX7OAAAAAElFTkSuQmCC')] bg-repeat bg-[length:64px_64px] pixelated z-[-1]">
                        <div className="absolute inset-0 bg-black/60"></div>
                    </div>
                    <h2 className="text-4xl text-[#ccc] mb-2 shadow-black drop-shadow-md">Generating World...</h2>
                    <div className="text-[#888]">This may take a moment.</div>
                </div>
            )}

            {!isLoading && (
                <>
                    <HUD 
                        health={health} 
                        inventory={inventory} 
                        selectedSlot={selectedSlot} 
                        gameMode={gameMode} 
                        position={playerPos}
                        biome={currentBiome}
                    />

                    {/* System Message / Toast */}
                    {sysMsg && (
                         <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-black/50 text-[#ffff55] px-4 py-2 border border-[#ffff55] pointer-events-none z-40 text-lg shadow-md animate-pulse">
                             {sysMsg}
                         </div>
                    )}

                    {showChat && (
                        <div className="absolute bottom-0 left-0 w-full p-2 bg-black/60 z-50">
                            <form onSubmit={handleCommand}>
                                <input 
                                    id="cmd-input"
                                    type="text" 
                                    className="w-full bg-transparent border-none text-white font-mono text-xl outline-none"
                                    value={chatInput}
                                    onChange={(e) => setChatInput(e.target.value)}
                                    autoComplete="off"
                                />
                            </form>
                        </div>
                    )}

                    {isDead && (
                        <div className="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-red-900/60">
                             <h1 className="text-6xl text-white mb-6 shadow-black drop-shadow-[4px_4px_0_rgba(0,0,0,0.8)]">YOU DIED!</h1>
                             <div className="text-xl text-[#ccc] mb-8">Score: 0</div>
                             <Button onClick={handleRespawn}>Respawn</Button>
                             <Button onClick={handleSaveQuit}>Title Screen</Button>
                        </div>
                    )}

                    {paused && !showInventory && !showChat && !isDead && (
                        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60">
                            <div className="absolute inset-0 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAIklEQVQIW2NkQAKrVq36zwjjgzjIHFBmAApgMakCURy9ABvzE+u/jX7OAAAAAElFTkSuQmCC')] bg-repeat bg-[length:64px_64px] pixelated opacity-50 pointer-events-none"></div>
                            
                            {!showOptions ? (
                                <>
                                    <h2 className="text-4xl text-[#aaa] mb-5 shadow-black drop-shadow-md">GAME MENU</h2>
                                    <Button onClick={handleResume}>Back to Game</Button>
                                    <Button onClick={() => setShowOptions(true)}>Options...</Button>
                                    <Button onClick={handleSaveQuit}>Save and Quit to Title</Button>
                                </>
                            ) : (
                                <div className="w-full h-full">
                                    <SettingsMenu 
                                        settings={settings}
                                        onSave={handleSettingsUpdate}
                                        onCancel={() => setShowOptions(false)}
                                    />
                                </div>
                            )}
                        </div>
                    )}

                    {showInventory && !isDead && (
                        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70">
                            <InventoryMenu 
                                inventory={inventory} 
                                gameMode={gameMode}
                                onInventoryUpdate={(newInv) => {
                                     setInventory([...newInv]);
                                     if(engineRef.current) engineRef.current.inventory = newInv;
                                }}
                                isCraftingTable={isCraftingTable}
                            />
                        </div>
                    )}
                </>
            )}
        </div>
    );
};
