
import React, { useState } from 'react';
import { GameSettings } from '../../types';

interface Props {
    settings: GameSettings;
    onSave: (s: GameSettings) => void;
    onCancel: () => void;
}

export const SettingsMenu: React.FC<Props> = ({ settings, onSave, onCancel }) => {
    const [temp, setTemp] = useState({ ...settings });

    const handleChange = (key: keyof GameSettings, value: number | boolean) => {
        setTemp(prev => ({ ...prev, [key]: value }));
    };

    return (
        <div className="flex flex-col items-center justify-center w-full h-full text-white relative z-50">
             <div className="absolute inset-0 bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAIklEQVQIW2NkQAKrVq36zwjjgzjIHFBmAApgMakCURy9ABvzE+u/jX7OAAAAAElFTkSuQmCC')] bg-repeat bg-[length:64px_64px] pixelated z-[-1]">
                <div className="absolute inset-0 bg-black/70"></div>
            </div>
            
            <h2 className="text-4xl mb-6 text-[#aaa] shadow-black drop-shadow-md">OPTIONS</h2>

            <div className="flex flex-col gap-4 bg-black/50 p-6 border-2 border-[#555]">
                <div className="flex flex-col gap-1">
                    <div className="flex justify-between w-[400px]">
                        <span>Field of View</span>
                        <span>{temp.fov}</span>
                    </div>
                    <input 
                        type="range" min="50" max="110" value={temp.fov} 
                        onChange={(e) => handleChange('fov', parseInt(e.target.value))}
                        className="w-full accent-[#787878]"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <div className="flex justify-between w-[400px]">
                        <span>Render Distance (Chunks)</span>
                        <span>{temp.renderDistance}</span>
                    </div>
                    <input 
                        type="range" min="2" max="32" value={temp.renderDistance} 
                        onChange={(e) => handleChange('renderDistance', parseInt(e.target.value))}
                        className="w-full accent-[#787878]"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <div className="flex justify-between w-[400px]">
                        <span>Sensitivity</span>
                        <span>{temp.sensitivity}</span>
                    </div>
                    <input 
                        type="range" min="1" max="10" step="1" 
                        value={temp.sensitivity * 1000} 
                        onChange={(e) => handleChange('sensitivity', parseInt(e.target.value) / 1000)}
                        className="w-full accent-[#787878]"
                    />
                </div>
                
                <div className="flex items-center justify-between w-[400px]">
                    <span>Smooth Lighting</span>
                    <button 
                        onClick={() => handleChange('smoothLighting', !temp.smoothLighting)}
                        className={`
                            border-2 px-4 py-1 text-lg w-[100px]
                            ${temp.smoothLighting ? 'bg-[#787878] text-[#ffffa0] border-[#b0b0b0]' : 'bg-[#333] text-[#888] border-[#555]'}
                        `}
                    >
                        {temp.smoothLighting ? "ON" : "OFF"}
                    </button>
                </div>

                <div className="flex items-center justify-between w-[400px]">
                    <span>Shadows</span>
                    <button 
                        onClick={() => handleChange('shadows', !temp.shadows)}
                        className={`
                            border-2 px-4 py-1 text-lg w-[100px]
                            ${temp.shadows ? 'bg-[#787878] text-[#ffffa0] border-[#b0b0b0]' : 'bg-[#333] text-[#888] border-[#555]'}
                        `}
                    >
                        {temp.shadows ? "ON" : "OFF"}
                    </button>
                </div>
            </div>

            <div className="mt-6 flex gap-4">
                 <button 
                    onClick={() => onSave(temp)}
                    className="bg-[#787878] border-2 border-black border-t-[#b0b0b0] border-l-[#b0b0b0] border-b-[#555] border-r-[#555] text-[#ddd] text-xl py-2 px-6 w-[190px] hover:bg-[#8b8b8b] hover:text-[#ffffa0] active:translate-y-[2px]"
                >
                    Done
                </button>
                <button 
                    onClick={onCancel}
                    className="bg-[#787878] border-2 border-black border-t-[#b0b0b0] border-l-[#b0b0b0] border-b-[#555] border-r-[#555] text-[#ddd] text-xl py-2 px-6 w-[190px] hover:bg-[#8b8b8b] hover:text-[#ffffa0] active:translate-y-[2px]"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
};
