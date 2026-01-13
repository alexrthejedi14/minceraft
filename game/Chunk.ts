
import * as THREE from 'three';
import { createNoise2D, createNoise3D } from 'simplex-noise';
import { BlockType } from '../types';
import { CHUNK_SIZE, CHUNK_HEIGHT, SEA_LEVEL, BLOCK_PROPS } from '../constants';

export class ChunkManager {
    private noise2D: (x: number, y: number) => number;
    private noise3D: (x: number, y: number, z: number) => number;
    private seedOffset: number;
    
    constructor(seed: number) {
        const rng = this.createRNG(seed);
        this.noise2D = createNoise2D(rng);
        this.noise3D = createNoise3D(rng);
        this.seedOffset = seed * 10000;
    }

    private createRNG(seed: number) {
        let a = seed;
        return function() {
          var t = a += 0x6D2B79F5;
          t = Math.imul(t ^ t >>> 15, t | 1);
          t ^= t + Math.imul(t ^ t >>> 7, t | 61);
          return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }
    }

    private rand(x: number, z: number, seed: number) {
        return Math.abs(Math.sin(x * 12.9898 + z * 78.233 + seed) * 43758.5453) % 1;
    }

    public getBiomeAt(wx: number, wz: number): string {
        const wxOff = wx + this.seedOffset;
        const wzOff = wz + this.seedOffset;
        const cont = this.noise2D(wxOff*0.0006, wzOff*0.0006); 
        const temp = this.noise2D(wxOff*0.0008+100, wzOff*0.0008+100);
        const moisture = this.noise2D(wxOff*0.0008+500, wzOff*0.0008+500);
        
        let terrainHeight = SEA_LEVEL + 8 + (cont * 20);
        // Estimate mountain height for biome label
        // Matched to generation logic: Threshold 0.3
        if (cont > 0.3) {
             const t = (cont - 0.3) / 0.7;
             const smoothT = t * t * (3 - 2 * t);
             terrainHeight += smoothT * 120;
        }

        if (terrainHeight < SEA_LEVEL) return "Ocean";
        
        if (terrainHeight > 130) return "Mountain Peaks";

        if (temp > 0.5) { 
            if(moisture < -0.3) return "Desert";
            if(moisture > 0.4) return "Jungle";
            return "Savanna"; 
        } 
        if (temp < -0.4) {
            return "Tundra";
        } 
        if (moisture > 0.3) return "Dark Forest";
        if (moisture < -0.3) return "Plains";
        return "Forest"; 
    }

    generateChunkData(cx: number, cz: number, seed: number, worldType: 'Default' | 'Flat' | 'Mountains', modifiedBlocks: Map<string, BlockType>): Uint8Array {
        const data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_HEIGHT);
        
        if (worldType === 'Flat') {
            for(let x=0;x<CHUNK_SIZE;x++) for(let z=0;z<CHUNK_SIZE;z++) for(let y=0;y<CHUNK_HEIGHT;y++) {
                const idx = x+z*CHUNK_SIZE+y*256;
                if(y===0) data[idx]=BlockType.BEDROCK; else if(y<4) data[idx]=BlockType.DIRT; else if(y===4) data[idx]=BlockType.GRASS; else data[idx]=BlockType.AIR;
            }
            this.applyModifications(cx, cz, data, modifiedBlocks);
            return data;
        }

        const heights = new Int32Array(CHUNK_SIZE*CHUNK_SIZE);
        const biomeMap = new Uint8Array(CHUNK_SIZE*CHUNK_SIZE); 
        const offset = this.seedOffset;

        for(let x=0;x<CHUNK_SIZE;x++) for(let z=0;z<CHUNK_SIZE;z++) {
            const wx=cx*CHUNK_SIZE+x+offset;
            const wz=cz*CHUNK_SIZE+z+offset;
            
            // Noise params
            const cont = this.noise2D(wx*0.0006, wz*0.0006); 
            const temp = this.noise2D(wx*0.0008+100, wz*0.0008+100);
            const moisture = this.noise2D(wx*0.0008+500, wz*0.0008+500);
            
            // Warp coordinates for rivers and natural variation
            const warpStrength = 20;
            const warpX = this.noise2D(wx * 0.004, wz * 0.004) * warpStrength;
            const warpZ = this.noise2D(wx * 0.004 + 1000, wz * 0.004 + 1000) * warpStrength;
            const riverNoise = Math.abs(this.noise2D((wx + warpX) * 0.0008, (wz + warpZ) * 0.0008));
            
            let noise = this.noise2D(wx*0.005, wz*0.005) + this.noise2D(wx*0.01, wz*0.01)*0.5;

            let terrainHeight = SEA_LEVEL + 5;
            
            if (worldType === 'Mountains') {
                 // Extreme mountains mode
                 terrainHeight = SEA_LEVEL + 40 + (cont * 80) + (noise * 30);
                 if (cont > 0) terrainHeight += Math.pow(cont, 2) * 150;
            } else {
                if (cont < -0.4) {
                    // Deep Ocean / Ocean
                    terrainHeight = SEA_LEVEL - 5 - (Math.abs(cont + 0.4) * 30);
                } else {
                    // Base Land height variation
                    terrainHeight = SEA_LEVEL + 8 + (cont * 20) + (noise * 10);

                    // Mountains Logic
                    // Higher threshold (0.3) makes mountains more spread out (rarer)
                    if (cont > 0.3) {
                         const t = (cont - 0.3) / 0.7; // 0 to 1
                         // Smoothstep-like curve for natural, rolling but large mountains
                         const smoothT = t * t * (3 - 2 * t);
                         
                         // Add height
                         terrainHeight += smoothT * 100;
                         
                         // Rigid/Bumpy detail
                         // We mix multiple frequencies to create a rigid, bumpy surface on the mountains
                         const n1 = this.noise2D(wx * 0.03, wz * 0.03);
                         const n2 = this.noise2D(wx * 0.06, wz * 0.06);
                         const n3 = this.noise2D(wx * 0.12, wz * 0.12); // High freq bumps

                         // Combine frequencies to add jaggedness/bumps to the mountain slopes
                         const bumps = (n1 + n2 * 0.5 + n3 * 0.25);
                         
                         terrainHeight += bumps * 25 * smoothT;
                    }
                }
            }
            
            // Rivers
            if (riverNoise < 0.08 && cont > -0.3 && cont < 0.2) {
                // Smooth river carving
                const riverDepth = (0.08 - riverNoise) / 0.08;
                const riverBed = SEA_LEVEL - 2;
                terrainHeight = terrainHeight * (1 - riverDepth) + riverBed * riverDepth;
            }

            let h = Math.floor(terrainHeight);
            if(h<1) h=1; if(h>=CHUNK_HEIGHT-5) h=CHUNK_HEIGHT-6;
            heights[x+z*CHUNK_SIZE] = h;

            let surface = BlockType.GRASS, sub = BlockType.DIRT, biomeId = 0;
            // Biome IDs: 0=Plain, 1=Desert, 2=Savanna, 3=Jungle, 4=Forest, 5=Snow, 6=Birch, 10=Ocean
            if (h < SEA_LEVEL) { biomeId=10; surface=BlockType.SAND; sub=BlockType.GRAVEL; }
            else {
                // High altitude biomes
                if (h > 130) {
                    biomeId = 5; surface = BlockType.SNOW; sub = BlockType.STONE;
                } 
                else if (h > 110 && temp < 0.3) {
                    biomeId = 5; surface = BlockType.SNOW; sub = BlockType.STONE;
                }
                else {
                    const d = (Math.random()-0.5)*0.1;
                    if (temp+d > 0.5) { 
                        if(moisture+d < -0.3) { biomeId=1; surface=BlockType.SAND; sub=BlockType.SANDSTONE; }
                        else if(moisture+d > 0.4) { biomeId=3; surface=BlockType.GRASS; sub=BlockType.DIRT; }
                        else { biomeId=2; surface=BlockType.GRASS; sub=BlockType.DIRT; }
                    } else if (temp+d < -0.4) { biomeId=5; surface=BlockType.SNOW; sub=BlockType.DIRT; }
                    else { 
                        if(moisture+d > 0.3) { biomeId=7; surface=BlockType.PODZOL; sub=BlockType.DIRT; } // Dark Forest
                        else if(moisture+d < -0.3) { biomeId=0; surface=BlockType.GRASS; sub=BlockType.DIRT; } // Plains
                        else if(moisture+d > 0.1) { biomeId=4; surface=BlockType.GRASS; sub=BlockType.DIRT; } // Forest
                        else { biomeId=6; surface=BlockType.GRASS; sub=BlockType.DIRT; } // Birch
                    }
                }
            }
            biomeMap[x+z*CHUNK_SIZE] = biomeId;

            for (let y=0;y<CHUNK_HEIGHT;y++) {
                const idx = x+z*CHUNK_SIZE+y*256;
                let blockID = BlockType.AIR;

                if(y===0) blockID = BlockType.BEDROCK;
                else if(y<h-3) {
                    blockID = BlockType.STONE;
                    // Ores
                    if (this.noise3D(wx*0.08, y*0.08, wz*0.08) > 0.6) blockID = BlockType.COAL_ORE;
                }
                else if(y<h) blockID = sub;
                else if(y===h) {
                    if(y<=SEA_LEVEL+1 && biomeId!==1 && biomeId!==2 && biomeId!==10 && biomeId!==5) blockID = BlockType.SAND;
                    else if(biomeId===1 && y>h-3) blockID = BlockType.SAND;
                    else blockID = surface;
                } else {
                    if(y<=SEA_LEVEL) blockID = BlockType.WATER;
                }

                // Caves - kept deep
                if (y > 0 && y <= h && blockID !== BlockType.WATER && blockID !== BlockType.BEDROCK && biomeId !== 10) {
                    const depth = h - y;
                    if (depth > 5) {
                        const caveRegion = this.noise2D(wx * 0.002 + 5000, wz * 0.002 + 5000);
                        if (caveRegion > 0.2) {
                            const caveNoise = this.noise3D(wx * 0.05, y * 0.05, wz * 0.05);
                            if (caveNoise > 0.6) blockID = BlockType.AIR;
                        }
                    }
                }
                data[idx] = blockID;
            }
        }

        // --- Surface Decoration (Vegetation) ---
        // Low probability for cleaner look
        for(let x=0;x<CHUNK_SIZE;x++) for(let z=0;z<CHUNK_SIZE;z++) {
            const h = heights[x+z*CHUNK_SIZE];
            const groundIdx = x+z*CHUNK_SIZE+h*256;
            const ground = data[groundIdx];
            if (ground === BlockType.AIR) continue;

            const bid = biomeMap[x+z*CHUNK_SIZE];
            const top = h+1;
            
            if(top<CHUNK_HEIGHT && top>SEA_LEVEL) {
                const idx = x+z*CHUNK_SIZE+top*256;
                const r = this.rand(cx*16+x, cz*16+z, seed);
                const isSand = (ground === BlockType.SAND || ground === BlockType.RED_SAND);

                if(bid===1 && r<0.005 && isSand) data[idx]=BlockType.CACTUS; // Desert
                else if(!isSand) {
                    if(bid===3) { // Jungle
                        if(r<0.06) this.makeTree(data,x,z,top,BlockType.JUNGLE_LOG,BlockType.JUNGLE_LEAVES,12); 
                        else if(r<0.25) data[idx]=BlockType.TALL_GRASS; 
                    }
                    else if(bid===2) { // Savanna
                        if(r<0.005) this.makeAcaciaTree(data,x,z,top); 
                        else if(r<0.15) data[idx]=BlockType.TALL_GRASS; 
                    }
                    else if(bid===6) { // Birch
                        if(r<0.015) this.makeTree(data,x,z,top,BlockType.BIRCH_LOG,BlockType.BIRCH_LEAVES,5); 
                        else if(r<0.05) data[idx]=BlockType.TALL_GRASS; 
                    }
                    else if(bid===4) { // Forest
                        if(r<0.015) this.makeTree(data,x,z,top,BlockType.WOOD,BlockType.LEAVES,5); 
                        else if(r<0.08) data[idx]=BlockType.TALL_GRASS; 
                    }
                    else if(bid===7) { // Dark Forest
                        if(r<0.04) this.makeTree(data,x,z,top,BlockType.SPRUCE_LOG,BlockType.LEAVES,6); 
                    }
                    else if(bid===5 && r<0.005) this.makeSpruceTree(data,x,z,top); // Snow
                    else if(bid===0 && r<0.001) this.makeTree(data,x,z,top,BlockType.WOOD,BlockType.LEAVES,5); // Plains
                }
            }
        }

        this.applyModifications(cx, cz, data, modifiedBlocks);
        return data;
    }

    private applyModifications(cx: number, cz: number, data: Uint8Array, modifiedBlocks: Map<string, BlockType>) {
        const minX = cx * CHUNK_SIZE;
        const maxX = (cx + 1) * CHUNK_SIZE;
        const minZ = cz * CHUNK_SIZE;
        const maxZ = (cz + 1) * CHUNK_SIZE;

        for (const [key, val] of modifiedBlocks) {
            const parts = key.split(',');
            const gx = parseInt(parts[0]);
            const gy = parseInt(parts[1]);
            const gz = parseInt(parts[2]);

            if (gx >= minX && gx < maxX && gz >= minZ && gz < maxZ && gy >= 0 && gy < CHUNK_HEIGHT) {
                const lx = (gx % CHUNK_SIZE + CHUNK_SIZE) % CHUNK_SIZE;
                const lz = (gz % CHUNK_SIZE + CHUNK_SIZE) % CHUNK_SIZE;
                data[lx + lz * CHUNK_SIZE + gy * 256] = val;
            }
        }
    }

    private makeTree(d: Uint8Array, x: number, z: number, y: number, t: number, l: number, h: number) {
        if(y+h+2>=CHUNK_HEIGHT || x<2 || x>13 || z<2 || z>13) return;
        for(let i=0;i<h;i++) d[x+z*16+(y+i)*256]=t;
        for(let ly=y+h-2; ly<=y+h+1; ly++) {
            const r = (ly > y+h-1) ? 1 : 2;
            for(let lx=x-r; lx<=x+r; lx++) for(let lz=z-r; lz<=z+r; lz++) {
                if(Math.abs(lx-x)===r && Math.abs(lz-z)===r && (ly!==y+h-2 || Math.random()>0.5)) continue;
                const idx = lx+lz*16+ly*256; if(d[idx]===BlockType.AIR) d[idx]=l;
            }
        }
    }
    private makeSpruceTree(d: Uint8Array, x: number, z: number, y: number) {
        if(y+8>=256 || x<3 || x>12 || z<3 || z>12) return;
        for(let i=0;i<6;i++) d[x+z*16+(y+i)*256]=BlockType.SPRUCE_LOG;
        d[x+z*16+(y+6)*256]=BlockType.SPRUCE_LEAVES;
        for(let i=2; i<6; i++) {
            const r = (i%2===0)?2:1;
            for(let lx=x-r; lx<=x+r; lx++) for(let lz=z-r; lz<=z+r; lz++) {
                if(Math.abs(lx-x)===r && Math.abs(lz-z)===r) continue;
                const idx = lx+lz*16+(y+i)*256; if(d[idx]===BlockType.AIR) d[idx]=BlockType.SPRUCE_LEAVES;
            }
        }
    }
    private makeAcaciaTree(d: Uint8Array, x: number, z: number, y: number) {
        if(y+6>=256 || x<3 || x>12 || z<3 || z>12) return;
        for(let i=0;i<4;i++) d[x+z*16+(y+i)*256]=BlockType.ACACIA_LOG;
        for(let lx=x-2;lx<=x+2;lx++) for(let lz=z-2;lz<=z+2;lz++) {
            if(Math.abs(lx-x)===2 && Math.abs(lz-z)===2) continue;
            d[lx+lz*16+(y+4)*256]=BlockType.ACACIA_LEAVES;
        }
    }

    generateChunkMesh(
        chunkData: Uint8Array, 
        materials: Record<number, THREE.Material>, 
        smoothLighting: boolean, 
        getBlock: (x: number, y: number, z: number) => BlockType,
        cx: number, 
        cz: number
    ): THREE.Group {
        const grp = new THREE.Group();
        const geometries: Record<number, { pos: number[], norm: number[], uv: number[], color: number[] }> = {};

        const isTransparent = (id: number) => {
            return id === BlockType.AIR || (BLOCK_PROPS[id] && BLOCK_PROPS[id].transparent);
        };
        const isWater = (id: number) => id === BlockType.WATER || id === BlockType.FLOWING_WATER;

        const getAO = (x: number, y: number, z: number) => {
             const b = getBlock(cx * CHUNK_SIZE + x, y, cz * CHUNK_SIZE + z);
             return !isTransparent(b);
        };

        const addFace = (bID: number, x: number, y: number, z: number, dx: number, dy: number, dz: number, customScale: number = 1.0, height: number = 1.0) => {
            if (!geometries[bID]) geometries[bID] = { pos: [], norm: [], uv: [], color: [] };
            const geo = geometries[bID];

            const nx = dx, ny = dy, nz = dz;
            let v0: number[] = [], v1: number[] = [], v2: number[] = [], v3: number[] = [];
            
            const s = customScale;
            const off = (1-s)/2;
            const min = off;
            // X and Z dimensions use customScale for torches etc, but Y should check water height
            const xMax = off + s;
            const zMax = off + s;
            const yMax = height;

            // Simple cube mapping logic with variable height
            if (dx !== 0) { 
                const xi = dx > 0 ? xMax : min;
                v0 = [xi, min, zMax]; v1 = [xi, min, min]; v2 = [xi, yMax, min]; v3 = [xi, yMax, zMax];
            } else if (dy !== 0) { 
                const yi = dy > 0 ? yMax : min;
                v0 = [min, yi, zMax]; v1 = [xMax, yi, zMax]; v2 = [xMax, yi, min]; v3 = [min, yi, min];
            } else { 
                const zi = dz > 0 ? zMax : min;
                v0 = [min, min, zi]; v1 = [xMax, min, zi]; v2 = [xMax, yMax, zi]; v3 = [min, yMax, zi];
            }

            for(let i=0; i<6; i++) geo.norm.push(nx, ny, nz);

            let ao0 = 1, ao1 = 1, ao2 = 1, ao3 = 1;
            if (smoothLighting && customScale === 1.0 && !isWater(bID)) { 
                const calcVertAO = (vx: number, vy: number, vz: number) => {
                    let sx1=0, sy1=0, sz1=0;
                    let sx2=0, sy2=0, sz2=0;
                    
                    const eps = 0.1;
                    if (dx !== 0) { 
                        if (Math.abs(vx-v0[0])<eps && Math.abs(vy-v0[1])<eps && Math.abs(vz-v0[2])<eps) { sy1=-1; sz2=1; }
                        if (Math.abs(vx-v1[0])<eps && Math.abs(vy-v1[1])<eps && Math.abs(vz-v1[2])<eps) { sy1=-1; sz2=-1; }
                        if (Math.abs(vx-v2[0])<eps && Math.abs(vy-v2[1])<eps && Math.abs(vz-v2[2])<eps) { sy1=1; sz2=-1; }
                        if (Math.abs(vx-v3[0])<eps && Math.abs(vy-v3[1])<eps && Math.abs(vz-v3[2])<eps) { sy1=1; sz2=1; }
                        sx1=dx; sx2=dx;
                    } else if (dy !== 0) { 
                        if (Math.abs(vx-v0[0])<eps && Math.abs(vy-v0[1])<eps && Math.abs(vz-v0[2])<eps) { sx1=-1; sz2=1; }
                        if (Math.abs(vx-v1[0])<eps && Math.abs(vy-v1[1])<eps && Math.abs(vz-v1[2])<eps) { sx1=1; sz2=1; }
                        if (Math.abs(vx-v2[0])<eps && Math.abs(vy-v2[1])<eps && Math.abs(vz-v2[2])<eps) { sx1=1; sz2=-1; }
                        if (Math.abs(vx-v3[0])<eps && Math.abs(vy-v3[1])<eps && Math.abs(vz-v3[2])<eps) { sx1=-1; sz2=-1; }
                        sy1=dy; sy2=dy;
                    } else { 
                        if (Math.abs(vx-v0[0])<eps && Math.abs(vy-v0[1])<eps && Math.abs(vz-v0[2])<eps) { sx1=-1; sy2=-1; }
                        if (Math.abs(vx-v1[0])<eps && Math.abs(vy-v1[1])<eps && Math.abs(vz-v1[2])<eps) { sx1=-1; sy2=-1; }
                        if (Math.abs(vx-v2[0])<eps && Math.abs(vy-v2[1])<eps && Math.abs(vz-v2[2])<eps) { sx1=1; sy2=1; }
                        if (Math.abs(vx-v3[0])<eps && Math.abs(vy-v3[1])<eps && Math.abs(vz-v3[2])<eps) { sx1=-1; sy2=1; }
                        sz1=dz; sz2=dz;
                    }
                    
                    const side1 = getAO(x + sx1, y + sy1, z + sz1);
                    const side2 = getAO(x + sx2, y + sy2, z + sz2);
                    const corner = getAO(x + sx1 + sx2 - (dx||0 + dy||0 + dz||0), y + sy1 + sy2 - (dx||0 + dy||0 + dz||0), z + sz1 + sz2 - (dx||0 + dy||0 + dz||0)); 
                    
                    if (side1 && side2) return 0;
                    const count = (side1?1:0) + (side2?1:0) + (corner?1:0);
                    return 1.0 - (count * 0.2);
                };
                ao0 = calcVertAO(v0[0], v0[1], v0[2]);
                ao1 = calcVertAO(v1[0], v1[1], v1[2]);
                ao2 = calcVertAO(v2[0], v2[1], v2[2]);
                ao3 = calcVertAO(v3[0], v3[1], v3[2]);
            }

            if (dx < 0 || dy < 0 || dz < 0) {
                 geo.pos.push(x+v0[0], y+v0[1], z+v0[2],  x+v2[0], y+v2[1], z+v2[2],  x+v1[0], y+v1[1], z+v1[2]);
                 geo.pos.push(x+v0[0], y+v0[1], z+v0[2],  x+v3[0], y+v3[1], z+v3[2],  x+v2[0], y+v2[1], z+v2[2]);
                 geo.uv.push(0,0, 1,1, 1,0);
                 geo.uv.push(0,0, 0,1, 1,1);
                 
                 if(smoothLighting) {
                    geo.color.push(ao0, ao0, ao0, ao2, ao2, ao2, ao1, ao1, ao1);
                    geo.color.push(ao0, ao0, ao0, ao3, ao3, ao3, ao2, ao2, ao2);
                 } else {
                     for(let k=0;k<6;k++) geo.color.push(1,1,1);
                 }
            } else {
                geo.pos.push(x+v0[0], y+v0[1], z+v0[2],  x+v1[0], y+v1[1], z+v1[2],  x+v2[0], y+v2[1], z+v2[2]);
                geo.pos.push(x+v0[0], y+v0[1], z+v0[2],  x+v2[0], y+v2[1], z+v2[2],  x+v3[0], y+v3[1], z+v3[2]);
                geo.uv.push(0,0, 1,0, 1,1);
                geo.uv.push(0,0, 1,1, 0,1);

                if(smoothLighting) {
                    geo.color.push(ao0, ao0, ao0, ao1, ao1, ao1, ao2, ao2, ao2);
                    geo.color.push(ao0, ao0, ao0, ao2, ao2, ao2, ao3, ao3, ao3);
                } else {
                    for(let k=0;k<6;k++) geo.color.push(1,1,1);
                }
            }
        };

        for (const bIDStr in BLOCK_PROPS) {
            const bID = parseInt(bIDStr);
            if (bID === BlockType.AIR) continue;
            const props = BLOCK_PROPS[bID];
            
            for (let x = 0; x < CHUNK_SIZE; x++) for (let z = 0; z < CHUNK_SIZE; z++) for (let y = 0; y < CHUNK_HEIGHT; y++) {
                if (chunkData[x + z * CHUNK_SIZE + y * 256] !== bID) continue;
                
                const check = (dx: number, dy: number, dz: number) => {
                    const nx = x + dx, ny = y + dy, nz = z + dz;
                    if (nx >= 0 && nx < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE && ny >= 0 && ny < CHUNK_HEIGHT) {
                        const nb = chunkData[nx + nz * 16 + ny * 256];
                        return isTransparent(nb) && (!isWater(bID) || !isWater(nb)); // Don't show water face if next to water
                    }
                    const gb = getBlock(cx * CHUNK_SIZE + nx, ny, cz * CHUNK_SIZE + nz);
                    return isTransparent(gb) && (!isWater(bID) || !isWater(gb));
                };

                // Water height logic
                let waterHeight = 1.0;
                if (isWater(bID)) {
                    const blockAbove = getBlock(cx*CHUNK_SIZE+x, y+1, cz*CHUNK_SIZE+z);
                    if (!isWater(blockAbove)) waterHeight = 0.9;
                }

                if (props.cross) {
                     if (!geometries[bID]) geometries[bID] = { pos: [], norm: [], uv: [], color: [] };
                     const g = geometries[bID];
                     const x0=x, x1=x+1, y0=y, y1=y+1, z0=z, z1=z+1;
                     g.pos.push(x0,y0,z0, x1,y0,z1, x1,y1,z1, x0,y0,z0, x1,y1,z1, x0,y1,z0);
                     for(let k=0;k<6;k++) { g.norm.push(0,1,0); g.color.push(1,1,1); }
                     g.uv.push(0,0, 1,0, 1,1, 0,0, 1,1, 0,1);
                     
                     g.pos.push(x0,y0,z1, x1,y0,z0, x1,y1,z0, x0,y0,z1, x1,y1,z0, x0,y1,z1);
                     for(let k=0;k<6;k++) { g.norm.push(0,1,0); g.color.push(1,1,1); }
                     g.uv.push(0,0, 1,0, 1,1, 0,0, 1,1, 0,1);
                } else if (bID === BlockType.TORCH) {
                    addFace(bID, x, y, z, 1, 0, 0, 0.2);
                    addFace(bID, x, y, z, -1, 0, 0, 0.2);
                    addFace(bID, x, y, z, 0, 1, 0, 0.2);
                    addFace(bID, x, y, z, 0, -1, 0, 0.2);
                    addFace(bID, x, y, z, 0, 0, 1, 0.2);
                    addFace(bID, x, y, z, 0, 0, -1, 0.2);
                } else {
                    if(check(1,0,0)) addFace(bID, x,y,z, 1,0,0, 1.0, waterHeight);
                    if(check(-1,0,0)) addFace(bID, x,y,z, -1,0,0, 1.0, waterHeight);
                    if(check(0,1,0)) addFace(bID, x,y,z, 0,1,0, 1.0, waterHeight);
                    if(check(0,-1,0)) addFace(bID, x,y,z, 0,-1,0, 1.0, waterHeight);
                    if(check(0,0,1)) addFace(bID, x,y,z, 0,0,1, 1.0, waterHeight);
                    if(check(0,0,-1)) addFace(bID, x,y,z, 0,0,-1, 1.0, waterHeight);
                }
            }
        }

        for (const bID in geometries) {
            const geo = geometries[bID];
            if (geo.pos.length > 0) {
                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.Float32BufferAttribute(geo.pos, 3));
                geometry.setAttribute('normal', new THREE.Float32BufferAttribute(geo.norm, 3));
                geometry.setAttribute('uv', new THREE.Float32BufferAttribute(geo.uv, 2));
                geometry.setAttribute('color', new THREE.Float32BufferAttribute(geo.color, 3));
                
                const mesh = new THREE.Mesh(geometry, materials[bID]);
                if (isWater(parseInt(bID))) {
                    mesh.renderOrder = 1;
                    mesh.receiveShadow = true;
                    mesh.castShadow = false;
                } else if (parseInt(bID) === BlockType.TORCH || parseInt(bID) === BlockType.TALL_GRASS) {
                     mesh.castShadow = false;
                     mesh.receiveShadow = false;
                } else {
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                }
                grp.add(mesh);
            }
        }

        return grp;
    }
}
