
import React, { useState, useEffect } from 'react';
import { WorldData, GameSettings } from '../../types';
import { SettingsMenu } from './SettingsMenu';

interface MainMenuProps {
    onStartGame: (world: WorldData) => void;
    savedWorlds: Record<string, WorldData>;
    onDeleteWorld: (id: string) => void;
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

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
    <input 
        {...props}
        className="bg-black border-2 border-[#555] text-white text-2xl p-2 w-[380px] my-2 outline-none font-inherit"
    />
);

const DirtBackground = () => (
    <div className="absolute inset-0 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAIklEQVQIW2NkQAKrVq36zwjjgzjIHFBmAApgMakCURy9ABvzE+u/jX7OAAAAAElFTkSuQmCC')] bg-repeat bg-[length:64px_64px] pixelated z-[-1]">
        <div className="absolute inset-0 bg-black/40"></div>
    </div>
);

export const MainMenu: React.FC<MainMenuProps> = ({ onStartGame, savedWorlds, onDeleteWorld, settings, onSettingsChange }) => {
    const [view, setView] = useState<'MAIN' | 'SELECT' | 'CREATE' | 'OPTIONS'>('MAIN');
    const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null);
    
    // Create Form State
    const [newWorldName, setNewWorldName] = useState("New World");
    const [newWorldSeed, setNewWorldSeed] = useState("");
    const [newWorldType, setNewWorldType] = useState<'Default' | 'Flat' | 'Mountains'>('Default');
    const [newGameMode, setNewGameMode] = useState<'Survival' | 'Creative'>('Survival');

    const handleCreate = () => {
        let seed = Math.random();
        if (newWorldSeed) {
            let h = 0;
            for (let i = 0; i < newWorldSeed.length; i++) h = Math.imul(31, h) + newWorldSeed.charCodeAt(i) | 0;
            seed = h / 2147483647;
        }
        
        const newWorld: WorldData = {
            id: Date.now().toString(),
            name: newWorldName,
            seed: seed,
            type: newWorldType,
            mode: newGameMode,
            player: { x: 0, y: newWorldType === 'Flat' ? 10 : 80, z: 0, h: 10 },
            inventory: null,
            modified: [],
            timestamp: Date.now()
        };
        onStartGame(newWorld);
    };

    if (view === 'OPTIONS') {
        return (
            <SettingsMenu 
                settings={settings}
                onSave={(s) => { onSettingsChange(s); setView('MAIN'); }}
                onCancel={() => setView('MAIN')}
            />
        );
    }

    if (view === 'SELECT') {
        return (
            <div className="flex flex-col items-center justify-center h-full w-full relative text-white">
                <DirtBackground />
                <h2 className="text-4xl mb-4 text-[#aaa] shadow-black drop-shadow-md">Select World</h2>
                <div className="w-[500px] h-[300px] bg-black/50 border-2 border-[#555] mb-5 overflow-y-auto p-2">
                    {Object.values(savedWorlds).map((w: WorldData) => (
                        <div 
                            key={w.id}
                            onClick={() => setSelectedWorldId(w.id)}
                            className={`
                                p-2 mb-1 cursor-pointer flex justify-between border-2
                                ${selectedWorldId === w.id ? 'border-white bg-black/80' : 'border-transparent bg-white/10 hover:bg-white/20'}
                            `}
                        >
                            <div>
                                <div className="text-xl">{w.name}</div>
                                <div className="text-gray-400 text-sm">{w.type} - {w.mode}</div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex gap-2">
                    <Button className="w-[190px]" onClick={() => selectedWorldId && onStartGame(savedWorlds[selectedWorldId])}>Play Selected</Button>
                    <Button className="w-[190px]" onClick={() => setView('CREATE')}>Create New</Button>
                </div>
                <div className="flex gap-2">
                    <Button className="w-[190px]" onClick={() => { if(selectedWorldId) onDeleteWorld(selectedWorldId); }}>Delete</Button>
                    <Button className="w-[190px]" onClick={() => setView('MAIN')}>Cancel</Button>
                </div>
            </div>
        );
    }

    if (view === 'CREATE') {
        return (
            <div className="flex flex-col items-center justify-center h-full w-full relative text-white">
                <DirtBackground />
                <h2 className="text-4xl mb-4 text-[#aaa] shadow-black drop-shadow-md">Create New World</h2>
                
                <div className="text-left w-[400px] text-[#aaa]">World Name</div>
                <Input value={newWorldName} onChange={e => setNewWorldName(e.target.value)} maxLength={20} />
                
                <div className="text-left w-[400px] text-[#aaa]">Seed (Optional)</div>
                <Input value={newWorldSeed} onChange={e => setNewWorldSeed(e.target.value)} placeholder="Leave blank for random" />

                <Button onClick={() => setNewGameMode(m => m === 'Survival' ? 'Creative' : 'Survival')}>
                    Game Mode: {newGameMode}
                </Button>
                <Button onClick={() => setNewWorldType(t => {
                    const types: ('Default' | 'Flat' | 'Mountains')[] = ['Default', 'Flat', 'Mountains'];
                    return types[(types.indexOf(t) + 1) % 3];
                })}>
                    World Type: {newWorldType}
                </Button>

                <div className="mt-5">
                    <Button onClick={handleCreate}>Create World</Button>
                    <Button onClick={() => setView('SELECT')}>Cancel</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center h-full w-full relative">
            <DirtBackground />
            <h1 className="text-[72px] text-[#ccc] mb-5 drop-shadow-[4px_4px_0_#3f3f3f]">MINECRAFT JS</h1>
            <Button onClick={() => setView('SELECT')}>Singleplayer</Button>
            <Button onClick={() => setView('OPTIONS')}>Options...</Button>
            <div className="text-[#555] mt-5">React Version 1.0</div>
        </div>
    );
};
