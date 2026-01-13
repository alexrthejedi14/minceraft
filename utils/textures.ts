
import * as THREE from 'three';
import { BlockType, BlockProp, EntityType } from '../types';
import { BLOCK_PROPS } from '../constants';

const textureCache: Record<string, THREE.Texture> = {};

function drawTool(ctx: CanvasRenderingContext2D, headColor: string, type: 'pick' | 'axe' | 'shovel' | 'sword') {
    ctx.clearRect(0,0,64,64);
    
    // Handle
    ctx.fillStyle = "#5D4037"; // Stick color
    ctx.save();
    ctx.translate(32, 32);
    ctx.rotate(Math.PI / 4); 
    ctx.fillRect(-3, -24, 6, 48); // Main handle stick

    ctx.fillStyle = headColor;
    
    if (type === 'pick') {
        // Pick head
        ctx.translate(0, -20);
        ctx.beginPath();
        ctx.arc(0, 0, 24, Math.PI, 0); // Top arc
        ctx.lineTo(5, 5);
        ctx.arc(0, 0, 14, 0, Math.PI, true); // Bottom arc
        ctx.lineTo(-24, 0);
        ctx.fill();
    } else if (type === 'axe') {
        ctx.translate(0, -20);
        ctx.fillRect(-4, -4, 16, 20); // Connector
        ctx.beginPath();
        ctx.moveTo(8, -8);
        ctx.quadraticCurveTo(28, 5, 8, 18);
        ctx.lineTo(8, -8);
        ctx.fill();
        ctx.fillRect(-12, -4, 8, 10); // Back bit
    } else if (type === 'shovel') {
        ctx.translate(0, -18);
        ctx.beginPath();
        ctx.ellipse(0, 0, 10, 14, 0, 0, Math.PI * 2);
        ctx.fill();
    } else if (type === 'sword') {
         ctx.translate(0, -10);
         ctx.fillRect(-8, 0, 16, 4); // Guard
         ctx.translate(0, -26);
         ctx.fillRect(-4, 0, 8, 28); // Blade
         ctx.beginPath();
         ctx.moveTo(-4, 0); ctx.lineTo(0, -6); ctx.lineTo(4, 0); // Tip
         ctx.fill();
    }

    ctx.restore();
}

function drawFood(ctx: CanvasRenderingContext2D, type: BlockType) {
    ctx.clearRect(0,0,64,64);
    
    if (type === BlockType.RAW_BEEF) {
        ctx.fillStyle = "#B71C1C";
        ctx.beginPath();
        ctx.ellipse(32, 32, 20, 14, Math.PI/4, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = "#E57373";
        ctx.fillRect(24, 24, 8, 8);
        ctx.fillRect(36, 36, 6, 6);
    } else if (type === BlockType.PORKCHOP) {
        ctx.fillStyle = "#F48FB1";
        ctx.beginPath();
        ctx.ellipse(32, 32, 18, 12, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = "#F8BBD0";
        ctx.beginPath();
        ctx.arc(44, 32, 6, 0, Math.PI*2);
        ctx.fill();
    } else if (type === BlockType.MUTTON) {
        ctx.fillStyle = "#D32F2F";
        ctx.beginPath();
        ctx.moveTo(16, 32);
        ctx.lineTo(48, 16);
        ctx.lineTo(48, 48);
        ctx.fill();
    } else if (type === BlockType.ROTTEN_FLESH) {
        ctx.fillStyle = "#5D4037";
        ctx.beginPath();
        ctx.ellipse(32, 32, 16, 24, Math.PI/6, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = "#3E2723";
        ctx.fillRect(28, 20, 10, 24);
        ctx.fillStyle = "#4CAF50"; // Green bits
        ctx.fillRect(20, 30, 4, 4);
        ctx.fillRect(40, 40, 4, 4);
    }
}

export function getMobTexture(type: EntityType): THREE.Texture {
    const key = `mob_${type}`;
    if (textureCache[key]) return textureCache[key];

    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    if (!ctx) return new THREE.Texture();

    // Fill background with skin color first
    if (type === EntityType.COW) {
        ctx.fillStyle = "#DDDDDD";
        ctx.fillRect(0,0,64,64);
        // Face only
        ctx.fillStyle = "#888"; 
        ctx.fillRect(16, 32, 32, 16); // Nose
        ctx.fillStyle = "#000";
        ctx.fillRect(16, 20, 6, 6); // Eyes
        ctx.fillRect(42, 20, 6, 6);
    } else if (type === EntityType.PIG) {
        ctx.fillStyle = "#F0A0A0";
        ctx.fillRect(0,0,64,64);
        ctx.fillStyle = "#D07070"; // Snout
        ctx.fillRect(20, 32, 24, 12);
        ctx.fillStyle = "#FFF"; // Eyes
        ctx.fillRect(16, 20, 8, 8);
        ctx.fillRect(40, 20, 8, 8);
        ctx.fillStyle = "#000";
        ctx.fillRect(18, 22, 4, 4);
        ctx.fillRect(42, 22, 4, 4);
    } else if (type === EntityType.SHEEP) {
        ctx.fillStyle = "#E0C0A0"; // Skin face
        ctx.fillRect(0,0,64,64);
        ctx.fillStyle = "#FFF"; // Wool borders
        ctx.fillRect(0,0,64,16);
        ctx.fillRect(0,48,64,16);
        ctx.fillRect(0,0,16,64);
        ctx.fillRect(48,0,16,64);
        // Eyes
        ctx.fillStyle = "#FFF";
        ctx.fillRect(18, 24, 8, 8);
        ctx.fillRect(38, 24, 8, 8);
        ctx.fillStyle = "#000";
        ctx.fillRect(20, 26, 4, 4);
        ctx.fillRect(40, 26, 4, 4);
    } else if (type === EntityType.ZOMBIE) {
        ctx.fillStyle = "#467240";
        ctx.fillRect(0,0,64,64);
        ctx.fillStyle = "#000";
        ctx.fillRect(16, 20, 8, 8);
        ctx.fillRect(40, 20, 8, 8);
    }

    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    textureCache[key] = t;
    return t;
}

export function getBlockTexture(type: BlockType): THREE.Texture {
    const key = `block_${type}`;
    if (textureCache[key]) return textureCache[key];

    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d');
    if (!ctx) return new THREE.Texture();

    const p: Partial<BlockProp> & { color: number } = BLOCK_PROPS[type] || { color: 0xff00ff };
    
    if (p.isItem || type === BlockType.TORCH || type === BlockType.TALL_GRASS) {
        ctx.clearRect(0, 0, 64, 64);
    } else {
        const hexColor = '#' + p.color.toString(16).padStart(6, '0');
        ctx.fillStyle = hexColor;
        ctx.fillRect(0, 0, 64, 64);
        
        for (let i = 0; i < 400; i++) {
            ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`;
            ctx.fillRect(Math.random() * 64, Math.random() * 64, 4, 4);
        }
    }

    // Specific Block Patterns
    if ([BlockType.WOOD, BlockType.BIRCH_LOG, BlockType.SPRUCE_LOG, BlockType.JUNGLE_LOG, BlockType.ACACIA_LOG].includes(type)) {
        ctx.fillStyle = "rgba(0,0,0,0.2)";
        for (let i = 8; i < 64; i += 8) ctx.fillRect(i, 0, 2, 64);
        for(let i=0; i<10; i++) ctx.fillRect(0, Math.random()*64, 64, 1);
    }
    if (type === BlockType.COAL_ORE) {
         ctx.fillStyle = "#111";
         for(let i=0; i<6; i++) {
             const s = 8 + Math.random() * 8;
             ctx.fillRect(Math.random() * 50, Math.random() * 50, s, s);
         }
    }
    if (type === BlockType.COAL) {
        ctx.fillStyle = "#222";
        ctx.beginPath();
        ctx.arc(32, 32, 16, 0, Math.PI * 2);
        ctx.fill();
    }
    if (type === BlockType.TORCH) {
        ctx.fillStyle = "#5D4037";
        ctx.fillRect(28, 20, 8, 44);
        ctx.fillStyle = "#FFD700";
        ctx.fillRect(28, 10, 8, 10);
        ctx.fillStyle = "#FF4500";
        ctx.fillRect(30, 8, 4, 4);
    }
    if (type === BlockType.COBBLESTONE) {
         ctx.strokeStyle = "rgba(0,0,0,0.3)";
         ctx.lineWidth = 2;
         for(let i=0; i<8; i++) {
             ctx.strokeRect(Math.random()*50, Math.random()*50, 10+Math.random()*15, 10+Math.random()*15);
         }
    }
    if (type === BlockType.CRAFTING_TABLE) {
        ctx.fillStyle = "#5d4037"; 
        ctx.fillRect(0,0,64,4); ctx.fillRect(0,60,64,4);
        ctx.fillRect(0,0,4,64); ctx.fillRect(60,0,4,64);
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.fillRect(10, 20, 10, 30); 
        ctx.fillRect(5, 20, 20, 8);
        ctx.fillStyle = "rgba(100,100,100,0.8)";
        ctx.fillRect(40, 30, 15, 15);
    }
    if (type === BlockType.STICK) {
        ctx.fillStyle = "#5D4037";
        ctx.save();
        ctx.translate(32,32);
        ctx.rotate(Math.PI / 4);
        ctx.fillRect(-4, -28, 8, 56);
        ctx.restore();
    }
    if (type === BlockType.BRICK) {
        ctx.fillStyle = "rgba(200,200,200,0.5)";
        for (let y = 0; y < 64; y += 16) {
            ctx.fillRect(0, y, 64, 2);
            for (let x = (y % 32 === 0 ? 0 : 16); x < 64; x += 32) {
                ctx.fillRect(x, y, 2, 16);
            }
        }
    }
    if (type === BlockType.TALL_GRASS) {
        ctx.fillStyle = '#4caf50';
        for (let i = 0; i < 12; i++) {
            ctx.fillRect(Math.random() * 56, 32 + Math.random() * 32, 6, 32);
        }
    }
    if (type === BlockType.CACTUS) {
        ctx.fillStyle = "#1B5E20";
        for (let i = 8; i < 64; i += 16) ctx.fillRect(i, 0, 4, 64);
        ctx.fillStyle = "#000";
        for (let i = 0; i < 40; i++) ctx.fillRect(Math.random() * 64, Math.random() * 64, 2, 2);
    }

    // Tools & Food
    if (type === BlockType.WOODEN_PICKAXE) drawTool(ctx, "#A1887F", 'pick');
    if (type === BlockType.WOODEN_AXE) drawTool(ctx, "#A1887F", 'axe');
    if (type === BlockType.WOODEN_SHOVEL) drawTool(ctx, "#A1887F", 'shovel');
    if (type === BlockType.WOODEN_SWORD) drawTool(ctx, "#A1887F", 'sword');
    if (type === BlockType.STONE_PICKAXE) drawTool(ctx, "#9E9E9E", 'pick');
    if (type === BlockType.STONE_AXE) drawTool(ctx, "#9E9E9E", 'axe');
    if (type === BlockType.STONE_SHOVEL) drawTool(ctx, "#9E9E9E", 'shovel');
    if (type === BlockType.STONE_SWORD) drawTool(ctx, "#9E9E9E", 'sword');
    if ([BlockType.RAW_BEEF, BlockType.PORKCHOP, BlockType.MUTTON, BlockType.ROTTEN_FLESH].includes(type)) {
        drawFood(ctx, type);
    }

    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    
    textureCache[key] = t;
    return t;
}

export function generateMaterialMap(): Record<number, THREE.Material> {
    const materials: Record<number, THREE.Material> = {};
    for (const key in BLOCK_PROPS) {
        const type = parseInt(key) as BlockType;
        const texture = getBlockTexture(type);
        const props = BLOCK_PROPS[type];
        
        let transparent = props.transparent || false;
        let opacity = 1.0;
        let alphaTest = props.transparent ? 0.3 : 0;
        let depthWrite = true;

        if (type === BlockType.WATER || type === BlockType.FLOWING_WATER) {
            transparent = true;
            opacity = 0.6;
            alphaTest = 0;
            depthWrite = false; // Important for transparent sorting
        }

        const mat = new THREE.MeshLambertMaterial({
            map: texture,
            transparent: transparent,
            opacity: opacity,
            alphaTest: alphaTest,
            vertexColors: true,
            side: props.cross || type === BlockType.WATER || type === BlockType.FLOWING_WATER ? THREE.DoubleSide : THREE.FrontSide,
            depthWrite: depthWrite
        });
        
        if (props.emissive) {
             mat.emissive = new THREE.Color(0xFFFFFF);
             mat.emissiveMap = texture;
             mat.emissiveIntensity = 1.0;
        }

        materials[type] = mat;
    }
    return materials;
}

export function getBreakingTexture(stage: number): THREE.Texture {
    const key = `break_${stage}`;
    if (textureCache[key]) return textureCache[key];

    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const ctx = c.getContext('2d');
    if(!ctx) return new THREE.Texture();
    
    ctx.clearRect(0,0,64,64);
    
    const density = (stage + 1) * 2;
    
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    
    ctx.beginPath();
    const cx = 32;
    const cy = 32;

    for(let i=0; i<density; i++) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 5 + Math.random() * 25;
        const startR = Math.random() * 10;
        const startA = Math.random() * Math.PI * 2;
        
        ctx.moveTo(cx + Math.cos(startA)*startR, cy + Math.sin(startA)*startR);
        ctx.lineTo(cx + Math.cos(angle)*dist, cy + Math.sin(angle)*dist);
    }
    ctx.stroke();

    const t = new THREE.CanvasTexture(c);
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    textureCache[key] = t;
    return t;
}
