import React, { useState, useEffect } from 'react';
import { MainMenu } from './components/UI/MainMenu';
import { Game } from './components/Game';
import { WorldData, GameSettings } from './types';
import { INITIAL_SETTINGS } from './constants';

const STORAGE_KEY = 'mc_clone_saves_vreact';

const App: React.FC = () => {
    const [gameState, setGameState] = useState<'MENU' | 'PLAYING'>('MENU');
    const [currentWorld, setCurrentWorld] = useState<WorldData | null>(null);
    const [savedWorlds, setSavedWorlds] = useState<Record<string, WorldData>>({});
    const [settings, setSettings] = useState<GameSettings>(INITIAL_SETTINGS);

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                setSavedWorlds(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to load saves", e);
            }
        }
    }, []);

    const saveWorld = (world: WorldData) => {
        const newSaves = { ...savedWorlds, [world.id]: world };
        setSavedWorlds(newSaves);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newSaves));
    };

    const deleteWorld = (id: string) => {
        const newSaves = { ...savedWorlds };
        delete newSaves[id];
        setSavedWorlds(newSaves);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newSaves));
    };

    const handleStartGame = (world: WorldData) => {
        setCurrentWorld(world);
        setGameState('PLAYING');
    };

    const handleSaveAndQuit = (data: WorldData) => {
        saveWorld(data);
        setGameState('MENU');
        setCurrentWorld(null);
    };

    return (
        <div className="w-full h-full relative">
            {gameState === 'MENU' && (
                <MainMenu 
                    onStartGame={handleStartGame}
                    savedWorlds={savedWorlds}
                    onDeleteWorld={deleteWorld}
                    settings={settings}
                    onSettingsChange={setSettings}
                />
            )}
            {gameState === 'PLAYING' && currentWorld && (
                <Game 
                    worldData={currentWorld}
                    onSaveAndQuit={handleSaveAndQuit}
                    settings={settings}
                    onSettingsChange={setSettings}
                />
            )}
        </div>
    );
};

export default App;