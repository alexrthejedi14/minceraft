
import * as THREE from 'three';
import { ChunkManager } from './Chunk.ts';
import { Sky } from './Sky.ts';
import { EntityManager } from './Entities.ts';
import { BlockType, WorldData, GameSettings, InventorySlots, ItemStack, BlockProp } from '../types';
import { CHUNK_SIZE, CHUNK_HEIGHT, GRAVITY, JUMP_FORCE, MOVE_SPEED, BLOCK_PROPS } from '../constants';
import { generateMaterialMap, getBreakingTexture, getBlockTexture } from '../utils/textures';

class DroppedItem {
    public mesh: THREE.Mesh;
    public velocity: THREE.Vector3;
    public type: BlockType;
    public spawnTime: number;
    public pickupDelay: number;

    constructor(type: BlockType, pos: THREE.Vector3, material: THREE.Material) {
        this.type = type;
        const geom = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        this.mesh = new THREE.Mesh(geom, material);
        this.mesh.position.copy(pos);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        // Random upward velocity + spread
        this.velocity = new THREE.Vector3((Math.random()-0.5)*3, 4, (Math.random()-0.5)*3);
        this.spawnTime = Date.now();
        this.pickupDelay = Date.now() + 500; // 0.5s delay
    }
}

class Hand {
    public group: THREE.Group;
    public mesh: THREE.Mesh | null = null;
    private swingProgress = 0;
    private bobTime = 0;
    private isSwinging = false;
    private currentType: BlockType | null = null;
    
    constructor(camera: THREE.Camera) {
        this.group = new THREE.Group();
        camera.add(this.group);
        // Default position relative to camera
        this.group.position.set(0.35, -0.4, -0.6);
        this.group.rotation.set(0, 0, 0);
    }

    public updateItem(type: BlockType | null) {
        if (type === this.currentType) return;
        this.currentType = type;
        
        if (this.mesh) {
            this.group.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh = null;
        }

        if (type !== null && type !== BlockType.AIR) {
            // Check if item or block
            const props = BLOCK_PROPS[type] || ({} as Partial<BlockProp>);
            const isItem = props.isItem || props.cross || type === BlockType.TORCH;
            
            let geometry;
            if (isItem) {
                // Flat plane for items
                geometry = new THREE.PlaneGeometry(0.5, 0.5);
            } else {
                // Cube for blocks
                geometry = new THREE.BoxGeometry(0.4, 0.4, 0.4);
            }
            
            // Re-use standard texture logic but we need a material instance 
            // We can create a basic material here since it doesn't need AO/World lighting
            const tex = getBlockTexture(type);
            const mat = new THREE.MeshBasicMaterial({ 
                map: tex, 
                transparent: true, 
                side: THREE.DoubleSide
            });

            this.mesh = new THREE.Mesh(geometry, mat);
            
            if (isItem) {
                this.mesh.rotation.y = Math.PI / 4;
                this.mesh.scale.set(0.8, 0.8, 0.8);
            } else {
                this.mesh.rotation.y = Math.PI / 8;
            }
            
            this.group.add(this.mesh);
        }
    }

    public swing() {
        if (!this.isSwinging) {
            this.isSwinging = true;
            this.swingProgress = 0;
        }
    }

    public update(dt: number, isMoving: boolean) {
        // Bobbing
        if (isMoving) {
            this.bobTime += dt * 10;
            this.group.position.y = -0.4 + Math.sin(this.bobTime) * 0.02;
            this.group.position.x = 0.35 + Math.cos(this.bobTime * 0.5) * 0.02;
        } else {
            // Return to rest
            this.bobTime = 0;
            this.group.position.y += (-0.4 - this.group.position.y) * 10 * dt;
            this.group.position.x += (0.35 - this.group.position.x) * 10 * dt;
        }

        // Swinging
        if (this.isSwinging) {
            this.swingProgress += dt * 5; // Swing speed
            if (this.swingProgress >= Math.PI) {
                this.isSwinging = false;
                this.swingProgress = 0;
                this.group.rotation.z = 0;
                this.group.rotation.x = 0;
            } else {
                // Simple swing arc
                const s = Math.sin(this.swingProgress);
                this.group.rotation.z = s * -0.5; // Tilt in
                this.group.rotation.x = s * -0.5; // Tilt down
            }
        } else {
             this.group.rotation.z = 0;
             this.group.rotation.x = 0;
        }
    }
}

export class GameEngine {
    public scene: THREE.Scene;
    public camera: THREE.PerspectiveCamera;
    public renderer: THREE.WebGLRenderer;
    public chunkManager: ChunkManager;
    public sky: Sky;
    public entityManager: EntityManager;
    
    private chunks = new Map<string, { data: Uint8Array, mesh: THREE.Group | null }>();
    private modifiedBlocks = new Map<string, BlockType>();
    private materials: Record<number, THREE.Material>;
    
    // Player
    public playerPos = new THREE.Vector3(0, 80, 0);
    public playerVel = new THREE.Vector3();
    public playerHealth = 10;
    private playerInputs = { forward: false, backward: false, left: false, right: false, jump: false, shift: false };
    private onGround = false;
    private isFlying = false;
    private lastSpace = 0;
    private speedMultiplier = 1.0;

    // Interaction / Mining
    private isMining = false;
    private miningBlock: THREE.Vector3 | null = null;
    private miningProgress = 0;
    private mouseButton = -1;
    private breakingMesh: THREE.Mesh; // The visual overlay

    // Items / Hand
    private droppedItems: DroppedItem[] = [];
    private hand: Hand;
    private handLight: THREE.PointLight; // Light for holding torch

    // Game State
    private running = false;
    private paused = true;
    private lastTime = 0;
    private tickAccumulator = 0; // For random ticks
    
    // Fluids
    private fluidQueue: {x:number, y:number, z:number}[] = [];
    private fluidQueueSet: Set<string> = new Set();
    
    // Data
    private seed: number;
    private worldType: 'Default' | 'Flat' | 'Mountains';
    private settings: GameSettings;
    public inventory: InventorySlots = new Array(36).fill(null);
    public selectedSlot = 0;
    public gameMode: 'Survival' | 'Creative';

    // Callbacks
    public onHealthChange?: (h: number) => void;
    public onInventoryChange?: (inv: InventorySlots, sel: number) => void;
    public onPauseChange?: (paused: boolean) => void;
    public onSystemMessage?: (msg: string) => void;
    public onOpenCrafting?: (isTable: boolean) => void;
    public onGameModeChange?: (mode: 'Survival' | 'Creative') => void;
    public onPlayerDeath?: () => void;

    constructor(container: HTMLElement, worldData: WorldData, settings: GameSettings) {
        this.seed = worldData.seed;
        this.worldType = worldData.type;
        this.gameMode = worldData.mode;
        this.settings = settings;

        if (worldData.inventory) {
            this.inventory = worldData.inventory;
        } else if (this.gameMode === 'Creative') {
            let slotIdx = 0;
            Object.values(BlockType).forEach(val => {
                if (typeof val === 'number' && val !== BlockType.AIR && slotIdx < 36) {
                    this.inventory[slotIdx] = { id: val, count: 64 };
                    slotIdx++;
                }
            });
        }
        if (worldData.modified) {
            this.modifiedBlocks = new Map(worldData.modified);
        }

        this.playerPos.set(worldData.player.x, worldData.player.y, worldData.player.z);
        this.playerHealth = worldData.player.h;

        this.scene = new THREE.Scene();
        // Background color is now handled by Sky
        this.scene.fog = new THREE.Fog(0x87CEEB, 20, settings.renderDistance * CHUNK_SIZE - 10);

        this.camera = new THREE.PerspectiveCamera(settings.fov, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: false });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = settings.shadows; // Enable shadows based on settings
        this.renderer.shadowMap.type = THREE.BasicShadowMap; // Minecraft-style hard shadows
        container.appendChild(this.renderer.domElement);

        // Remove static lights, initialize Sky
        this.sky = new Sky(this.scene);
        
        this.materials = generateMaterialMap();
        
        // Initialize Entities
        this.entityManager = new EntityManager(this.scene);
        this.entityManager.onPlayerDamage = (amt) => this.takeDamage(amt);
        this.entityManager.onMobDeath = (pos, drops) => {
            drops.forEach(stack => {
                // Drop items in a slight spread
                const spreadPos = pos.clone().add(new THREE.Vector3((Math.random()-0.5), 0.5, (Math.random()-0.5)));
                const drop = new DroppedItem(stack.id, spreadPos, this.materials[stack.id]);
                this.droppedItems.push(drop);
                this.scene.add(drop.mesh);
                for (let i = 1; i < stack.count; i++) {
                     const extraSpread = pos.clone().add(new THREE.Vector3((Math.random()-0.5), 0.5, (Math.random()-0.5)));
                     const extraDrop = new DroppedItem(stack.id, extraSpread, this.materials[stack.id]);
                     this.droppedItems.push(extraDrop);
                     this.scene.add(extraDrop.mesh);
                }
            });
        };

        this.chunkManager = new ChunkManager(this.seed);

        // Breaking Overlay
        const breakGeom = new THREE.BoxGeometry(1.01, 1.01, 1.01);
        const breakMat = new THREE.MeshBasicMaterial({ 
            map: getBreakingTexture(0), 
            transparent: true, 
            depthTest: true, 
            depthWrite: false,
            opacity: 0.8
        });
        this.breakingMesh = new THREE.Mesh(breakGeom, breakMat);
        this.breakingMesh.visible = false;
        this.scene.add(this.breakingMesh);

        // Init Hand
        this.hand = new Hand(this.camera);
        // Hand Light (for torches)
        this.handLight = new THREE.PointLight(0xFFCC00, 0, 15);
        this.camera.add(this.handLight);

        this.scene.add(this.camera); // Ensure camera is in scene so children render

        this.setupEvents();
        this.updateWorldChunks();
    }

    public updateSettings(settings: GameSettings) {
        const oldSmooth = this.settings.smoothLighting;
        this.settings = settings;
        if (this.camera) {
            this.camera.fov = settings.fov;
            this.camera.updateProjectionMatrix();
        }
        if (this.scene) {
            this.scene.fog = new THREE.Fog(0x87CEEB, 20, settings.renderDistance * CHUNK_SIZE - 10);
        }
        
        // Update shadows
        this.renderer.shadowMap.enabled = settings.shadows;
        
        // Regenerate chunks if smooth lighting changed
        if (oldSmooth !== settings.smoothLighting) {
             this.chunks.forEach(c => {
                 if (c.mesh) {
                     this.scene.remove(c.mesh);
                     c.mesh.children.forEach((child: any) => child.geometry.dispose());
                 }
             });
             this.chunks.clear();
        }

        this.updateWorldChunks();
    }

    public setGameMode(mode: 'Survival' | 'Creative') {
        this.gameMode = mode;
        if (mode === 'Survival') this.isFlying = false;
        this.onSystemMessage?.(`Gamemode set to ${mode}`);
        this.onGameModeChange?.(mode);
        if (mode === 'Survival' && this.playerHealth <= 0) {
            this.respawn();
        }
    }

    public teleport(x: number, y: number, z: number) {
        this.playerPos.set(x, y, z);
        this.playerVel.set(0, 0, 0);
        this.updateWorldChunks();
        this.onSystemMessage?.(`Teleported to ${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}`);
    }

    public setSpeed(multiplier: number) {
        this.speedMultiplier = multiplier;
        this.onSystemMessage?.(`Speed multiplier set to ${multiplier}`);
    }

    public locateBiome(biomeName: string) {
        const cx = Math.floor(this.playerPos.x / CHUNK_SIZE);
        const cz = Math.floor(this.playerPos.z / CHUNK_SIZE);
        const searchRadius = 100;
        for (let r = 0; r < searchRadius; r++) {
            for (let x = -r; x <= r; x++) {
                for (let z = -r; z <= r; z++) {
                    if (Math.abs(x) !== r && Math.abs(z) !== r) continue;
                    const wx = (cx + x) * CHUNK_SIZE + CHUNK_SIZE/2;
                    const wz = (cz + z) * CHUNK_SIZE + CHUNK_SIZE/2;
                    const biome = this.chunkManager.getBiomeAt(wx, wz);
                    if (biome.toLowerCase().includes(biomeName.toLowerCase())) {
                        this.onSystemMessage?.(`Located ${biome} at [${wx}, ~, ${wz}]`);
                        return;
                    }
                }
            }
        }
        this.onSystemMessage?.(`Could not find biome "${biomeName}" nearby.`);
    }

    // Public API methods for Commands
    public setTime(t: number) {
        this.sky.setTime(t);
        this.onSystemMessage?.(`Time set to ${t.toFixed(2)}`);
    }

    public give(id: BlockType, count: number) {
        this.addToInventory(id, count);
        this.updateHandItem();
        this.onSystemMessage?.(`Given ${count}x ${BLOCK_PROPS[id].name}`);
    }

    public clearInventory() {
        this.inventory.fill(null);
        this.onInventoryChange?.(this.inventory, this.selectedSlot);
        this.updateHandItem();
        this.onSystemMessage?.(`Inventory cleared`);
    }

    public getCurrentBiome(): string {
        const cx = Math.floor(this.playerPos.x / CHUNK_SIZE) * CHUNK_SIZE + CHUNK_SIZE/2;
        const cz = Math.floor(this.playerPos.z / CHUNK_SIZE) * CHUNK_SIZE + CHUNK_SIZE/2;
        return this.chunkManager.getBiomeAt(cx, cz);
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.lastTime = performance.now();
        this.animate(this.lastTime);
        
        // Broadcast initial state
        this.onHealthChange?.(this.playerHealth);
        this.onInventoryChange?.(this.inventory, this.selectedSlot);
        this.updateHandItem();
    }

    stop() {
        this.running = false;
        this.renderer.dispose();
    }

    setPaused(p: boolean) {
        this.paused = p;
        this.onPauseChange?.(p);
        this.isMining = false;
        this.breakingMesh.visible = false;
        this.mouseButton = -1;
    }

    public respawn() {
        this.playerPos.set(0, 100, 0); // High up to prevent spawning in blocks
        this.playerVel.set(0, 0, 0);
        this.playerHealth = 10;
        this.onHealthChange?.(10);
        this.updateWorldChunks();
    }

    public takeDamage(amount: number) {
        if (this.gameMode === 'Creative') return;
        this.playerHealth = Math.max(0, this.playerHealth - amount);
        this.onHealthChange?.(this.playerHealth);
        if (this.playerHealth <= 0) {
            this.onPlayerDeath?.();
        }
    }

    private setupEvents() {
        window.addEventListener('resize', () => {
            if (this.camera) {
                this.camera.aspect = window.innerWidth / window.innerHeight;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(window.innerWidth, window.innerHeight);
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.repeat) return;
            switch(e.code) {
                case 'KeyW': this.playerInputs.forward = true; break;
                case 'KeyS': this.playerInputs.backward = true; break;
                case 'KeyA': this.playerInputs.left = true; break;
                case 'KeyD': this.playerInputs.right = true; break;
                case 'Space': 
                    if (this.gameMode === 'Creative' && Date.now() - this.lastSpace < 300) {
                        this.isFlying = !this.isFlying;
                    }
                    this.lastSpace = Date.now();
                    this.playerInputs.jump = true; 
                    break;
                case 'ShiftLeft': this.playerInputs.shift = true; break;
            }
            if (e.code.startsWith('Digit')) {
                const i = parseInt(e.code[5]) - 1;
                if (i >= 0 && i < 9) {
                    this.selectedSlot = i;
                    this.onInventoryChange?.(this.inventory, this.selectedSlot);
                    this.updateHandItem();
                }
            }
        });

        document.addEventListener('keyup', (e) => {
            switch(e.code) {
                case 'KeyW': this.playerInputs.forward = false; break;
                case 'KeyS': this.playerInputs.backward = false; break;
                case 'KeyA': this.playerInputs.left = false; break;
                case 'KeyD': this.playerInputs.right = false; break;
                case 'Space': this.playerInputs.jump = false; break;
                case 'ShiftLeft': this.playerInputs.shift = false; break;
            }
        });

        document.addEventListener('mousedown', (e) => {
            if (this.paused) return;
            this.mouseButton = e.button;
            this.hand.swing(); // Animate hand
            if (e.button === 0) {
                // Check entity hit first
                const hitEntity = this.entityManager.checkAttack(this.playerPos, this.camera.getWorldDirection(new THREE.Vector3()));
                if (!hitEntity) {
                    this.startMining();
                } else {
                    this.hand.swing();
                }
            } else if (e.button === 2) {
                this.handleInteraction();
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (e.button === 0) {
                this.isMining = false;
                this.breakingMesh.visible = false;
                this.miningBlock = null;
                this.miningProgress = 0;
            }
            this.mouseButton = -1;
        });

        document.addEventListener('mousemove', (e) => {
            if (!this.paused) {
                const sensitivity = this.settings.sensitivity;
                const eu = new THREE.Euler(0, 0, 0, 'YXZ');
                eu.setFromQuaternion(this.camera.quaternion);
                eu.y -= e.movementX * sensitivity;
                eu.x -= e.movementY * sensitivity;
                eu.x = Math.max(-1.57, Math.min(1.57, eu.x));
                this.camera.quaternion.setFromEuler(eu);
            }
        });

        document.addEventListener('pointerlockchange', () => {
            if (document.pointerLockElement === this.renderer.domElement) {
                this.setPaused(false);
            } else {
                 this.setPaused(true);
            }
        });
    }

    private updateHandItem() {
        const item = this.inventory[this.selectedSlot];
        const type = item ? item.id : null;
        this.hand.updateItem(type);

        // Update Hand Light for torches
        if (type === BlockType.TORCH) {
            this.handLight.intensity = 1.0;
        } else {
            this.handLight.intensity = 0;
        }
    }

    private raycast(): THREE.Intersection | null {
        const rc = new THREE.Raycaster();
        rc.setFromCamera(new THREE.Vector2(0, 0), this.camera);
        rc.far = 6;
        const meshes: THREE.Object3D[] = [];
        this.chunks.forEach(c => { if(c.mesh) meshes.push(c.mesh); });
        const hits = rc.intersectObjects(meshes, true);
        return hits.length > 0 ? hits[0] : null;
    }

    private startMining() {
        const hit = this.raycast();
        if (hit) {
            const p = hit.point;
            const n = hit.face!.normal;
            const bx = Math.floor(p.x - n.x * 0.5);
            const by = Math.floor(p.y - n.y * 0.5);
            const bz = Math.floor(p.z - n.z * 0.5);
            
            const b = this.getBlock(bx, by, bz);
            if (b !== BlockType.AIR && b !== BlockType.BEDROCK) {
                // Indestructible check (Water, Bedrock)
                const props = BLOCK_PROPS[b] || ({} as BlockProp);
                if (props.hardness === -1 && this.gameMode !== 'Creative') return;

                this.isMining = true;
                this.miningBlock = new THREE.Vector3(bx, by, bz);
                this.miningProgress = 0;
                
                this.breakingMesh.position.set(bx + 0.5, by + 0.5, bz + 0.5);
                this.breakingMesh.visible = true;

                if (this.gameMode === 'Creative') {
                    this.breakBlock(bx, by, bz);
                    this.isMining = false;
                    this.breakingMesh.visible = false;
                }
            }
        }
    }

    private updateMining(dt: number) {
        if (!this.isMining || !this.miningBlock) return;
        
        const hit = this.raycast();
        if (!hit) {
            this.isMining = false; 
            this.breakingMesh.visible = false;
            return;
        }

        const p = hit.point;
        const n = hit.face!.normal;
        const bx = Math.floor(p.x - n.x * 0.5);
        const by = Math.floor(p.y - n.y * 0.5);
        const bz = Math.floor(p.z - n.z * 0.5);

        if (bx !== this.miningBlock.x || by !== this.miningBlock.y || bz !== this.miningBlock.z) {
            this.miningBlock.set(bx, by, bz);
            this.miningProgress = 0;
            this.breakingMesh.position.set(bx + 0.5, by + 0.5, bz + 0.5);
        }

        const blockType = this.getBlock(bx, by, bz);
        if (blockType === BlockType.AIR) {
            this.isMining = false;
            this.breakingMesh.visible = false;
            return;
        }

        // Efficiency Logic
        const blockProps = BLOCK_PROPS[blockType] || ({} as BlockProp);
        const hardness = blockProps.hardness ?? 1;

        if (hardness < 0 && this.gameMode !== 'Creative') {
            this.isMining = false;
            this.breakingMesh.visible = false;
            return;
        }

        let speed = 1.0;

        const heldItem = this.inventory[this.selectedSlot];
        if (heldItem) {
            const toolProps = BLOCK_PROPS[heldItem.id] || ({} as BlockProp);
            // If the block requires a tool and we have the right one
            if (blockProps.toolType && toolProps.toolType === blockProps.toolType) {
                speed = toolProps.efficiency || 1.0;
            }
        }
        
        this.miningProgress += dt * speed;
        
        // Update breaking texture
        const stage = Math.floor((this.miningProgress / hardness) * 9);
        const tex = getBreakingTexture(Math.min(9, Math.max(0, stage)));
        if (this.breakingMesh.material instanceof THREE.MeshBasicMaterial) {
            this.breakingMesh.material.map = tex;
            this.breakingMesh.material.needsUpdate = true;
        }

        if (this.miningProgress >= hardness) {
            this.breakBlock(bx, by, bz);
            this.miningProgress = 0;
            this.breakingMesh.visible = false;
            this.startMining(); // Instantly start mining next block if holding
        }
    }

    private breakBlock(x: number, y: number, z: number) {
        const type = this.getBlock(x, y, z);
        
        // Remove from world
        this.setBlock(x, y, z, BlockType.AIR);

        // Fluid Update Triggers
        this.scheduleFluidUpdate(x, y + 1, z);
        this.scheduleFluidUpdate(x + 1, y, z);
        this.scheduleFluidUpdate(x - 1, y, z);
        this.scheduleFluidUpdate(x, y, z + 1);
        this.scheduleFluidUpdate(x, y, z - 1);

        if (this.gameMode === 'Survival' && type !== BlockType.AIR) {
            // Drop specific logic: Stone -> Cobblestone
            let dropType = type;
            if (type === BlockType.STONE) dropType = BlockType.COBBLESTONE;
            if (type === BlockType.COAL_ORE) dropType = BlockType.COAL;
            if (type === BlockType.GRASS) dropType = BlockType.DIRT;

            // Don't drop liquids
            if (type !== BlockType.WATER && type !== BlockType.FLOWING_WATER) {
                const drop = new DroppedItem(dropType, new THREE.Vector3(x+0.5, y+0.5, z+0.5), this.materials[dropType]);
                this.droppedItems.push(drop);
                this.scene.add(drop.mesh);
            }
        }
    }

    private handleInteraction() {
        // First check if holding a consumable item to eat
        const item = this.inventory[this.selectedSlot];
        if (item && this.gameMode === 'Survival') {
            const props = BLOCK_PROPS[item.id] || ({} as BlockProp);
            if (props.healAmount && this.playerHealth < 10) {
                this.playerHealth = Math.min(10, this.playerHealth + props.healAmount);
                this.onHealthChange?.(this.playerHealth);
                item.count--;
                if (item.count <= 0) this.inventory[this.selectedSlot] = null;
                this.onInventoryChange?.(this.inventory, this.selectedSlot);
                this.updateHandItem();
                this.hand.swing(); // Visual feedback
                return; // Consumed, don't place block
            }
        }

        const hit = this.raycast();
        if (hit) {
            const p = hit.point;
            const n = hit.face!.normal;
            
            // Determine targeted block
            const tx = Math.floor(p.x - n.x * 0.5);
            const ty = Math.floor(p.y - n.y * 0.5);
            const tz = Math.floor(p.z - n.z * 0.5);
            const targetBlock = this.getBlock(tx, ty, tz);

            // Special Interactions
            if (targetBlock === BlockType.CRAFTING_TABLE) {
                this.exitPointerLock();
                this.onOpenCrafting?.(true);
                return;
            }

            // Placement
            let bx = Math.floor(p.x + n.x * 0.5);
            let by = Math.floor(p.y + n.y * 0.5);
            let bz = Math.floor(p.z + n.z * 0.5);

            if (!item) return; 
            
            // Allow placing IN water (replacing it)
            if (targetBlock === BlockType.WATER || targetBlock === BlockType.FLOWING_WATER) {
                bx = tx; by = ty; bz = tz;
            }

            // Don't place tools or raw coal (unless specific items that can place)
            const props = BLOCK_PROPS[item.id] || ({} as BlockProp);
            if (props.isItem && item.id !== BlockType.TORCH) return; // Allow Torch placement

            const dx = Math.abs(bx + 0.5 - this.playerPos.x);
            const dy = Math.abs(by + 0.5 - (this.playerPos.y + 0.9));
            const dz = Math.abs(bz + 0.5 - this.playerPos.z);
            
            // If block is solid, check collision
            if (!props.cross && item.id !== BlockType.TORCH && targetBlock !== BlockType.WATER && targetBlock !== BlockType.FLOWING_WATER) {
                if (dx < 0.8 && dy < 1.4 && dz < 0.8) return;
            }

            this.setBlock(bx, by, bz, item.id);
            // Trigger fluid updates
            if (item.id === BlockType.WATER) {
                 this.scheduleFluidUpdate(bx, by, bz);
            } else {
                 // Placed solid block might stop water
                 this.scheduleFluidUpdate(bx, by + 1, bz);
                 this.scheduleFluidUpdate(bx + 1, by, bz);
                 this.scheduleFluidUpdate(bx - 1, by, bz);
                 this.scheduleFluidUpdate(bx, by, bz + 1);
                 this.scheduleFluidUpdate(bx, by, bz - 1);
            }

            if (this.gameMode === 'Survival') {
                item.count--;
                if (item.count <= 0) this.inventory[this.selectedSlot] = null;
                this.onInventoryChange?.(this.inventory, this.selectedSlot);
                this.updateHandItem();
            }
        }
    }

    private getBlock(x: number, y: number, z: number): BlockType {
        const cx = Math.floor(x / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        const key = `${cx},${cz}`;
        const chunk = this.chunks.get(key);
        if (!chunk) return BlockType.AIR;
        if (y < 0 || y >= CHUNK_HEIGHT) return BlockType.AIR;
        const lx = (x % CHUNK_SIZE + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = (z % CHUNK_SIZE + CHUNK_SIZE) % CHUNK_SIZE;
        return chunk.data[lx + lz * CHUNK_SIZE + y * 256];
    }

    private setBlock(x: number, y: number, z: number, id: BlockType) {
        const cx = Math.floor(x / CHUNK_SIZE);
        const cz = Math.floor(z / CHUNK_SIZE);
        const key = `${cx},${cz}`;
        const chunk = this.chunks.get(key);
        if (!chunk) return;
        const lx = (x % CHUNK_SIZE + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = (z % CHUNK_SIZE + CHUNK_SIZE) % CHUNK_SIZE;
        chunk.data[lx + lz * CHUNK_SIZE + y * 256] = id;
        this.modifiedBlocks.set(`${x},${y},${z}`, id);
        this.regenerateChunk(cx, cz);
        if (lx === 0) this.regenerateChunk(cx - 1, cz);
        if (lx === CHUNK_SIZE - 1) this.regenerateChunk(cx + 1, cz);
        if (lz === 0) this.regenerateChunk(cx, cz - 1);
        if (lz === CHUNK_SIZE - 1) this.regenerateChunk(cx, cz + 1);
    }

    private regenerateChunk(cx: number, cz: number) {
        const key = `${cx},${cz}`;
        const chunk = this.chunks.get(key);
        if (!chunk) return;
        if (chunk.mesh) {
            this.scene.remove(chunk.mesh);
            chunk.mesh.children.forEach((c: any) => c.geometry.dispose());
        }
        chunk.mesh = this.chunkManager.generateChunkMesh(
            chunk.data, 
            this.materials, 
            this.settings.smoothLighting, 
            this.getBlock.bind(this),
            cx, cz
        );
        chunk.mesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
        this.scene.add(chunk.mesh);
    }

    private updateWorldChunks() {
        const pcx = Math.floor(this.playerPos.x / CHUNK_SIZE);
        const pcz = Math.floor(this.playerPos.z / CHUNK_SIZE);
        const dist = this.settings.renderDistance;
        for (let x = -dist; x <= dist; x++) {
            for (let z = -dist; z <= dist; z++) {
                const cx = pcx + x;
                const cz = pcz + z;
                const key = `${cx},${cz}`;
                if (!this.chunks.has(key)) {
                    const data = this.chunkManager.generateChunkData(cx, cz, this.seed, this.worldType, this.modifiedBlocks);
                    const mesh = this.chunkManager.generateChunkMesh(
                        data, 
                        this.materials, 
                        this.settings.smoothLighting,
                        this.getBlock.bind(this), 
                        cx, cz
                    );
                    mesh.position.set(cx * CHUNK_SIZE, 0, cz * CHUNK_SIZE);
                    this.scene.add(mesh);
                    this.chunks.set(key, { data, mesh });
                }
            }
        }
        for (const [key, val] of this.chunks) {
            const [cx, cz] = key.split(',').map(Number);
            if (Math.abs(cx - pcx) > dist + 2 || Math.abs(cz - pcz) > dist + 2) {
                if (val.mesh) {
                    this.scene.remove(val.mesh);
                    val.mesh.children.forEach((c: any) => c.geometry.dispose());
                }
                this.chunks.delete(key);
            }
        }
    }

    // --- Fluid Logic ---

    private scheduleFluidUpdate(x: number, y: number, z: number) {
        const key = `${x},${y},${z}`;
        if (!this.fluidQueueSet.has(key)) {
            this.fluidQueueSet.add(key);
            this.fluidQueue.push({x, y, z});
        }
    }

    private processFluids() {
        if (this.fluidQueue.length === 0) return;

        // Process a batch (e.g. 500) to avoid lag spikes
        const batchSize = 500;
        let processed = 0;
        
        while (this.fluidQueue.length > 0 && processed < batchSize) {
            const {x, y, z} = this.fluidQueue.shift()!;
            const key = `${x},${y},${z}`;
            this.fluidQueueSet.delete(key);
            processed++;

            const block = this.getBlock(x, y, z);
            
            if (block === BlockType.WATER || block === BlockType.FLOWING_WATER) {
                // Try flow down
                if (y > 0) {
                    const bBelow = this.getBlock(x, y - 1, z);
                    if (bBelow === BlockType.AIR || (bBelow !== BlockType.WATER && bBelow !== BlockType.FLOWING_WATER && !BLOCK_PROPS[bBelow]?.cross && bBelow !== BlockType.TORCH && bBelow !== BlockType.BEDROCK)) {
                        // Replace air/plants with flowing water
                        // Check if solid first?
                        if (bBelow === BlockType.AIR || BLOCK_PROPS[bBelow]?.fluid === undefined) {
                            this.setBlock(x, y - 1, z, BlockType.FLOWING_WATER);
                            this.scheduleFluidUpdate(x, y - 1, z);
                        }
                    }
                }

                // Try flow sideways if source
                if (block === BlockType.WATER) {
                    const neighbors = [
                        {dx: 1, dz: 0}, {dx: -1, dz: 0}, 
                        {dx: 0, dz: 1}, {dx: 0, dz: -1}
                    ];
                    // Also check below: if below is solid, flow sideways
                    const bBelow = this.getBlock(x, y - 1, z);
                    const isSolidBelow = bBelow !== BlockType.AIR && bBelow !== BlockType.WATER && bBelow !== BlockType.FLOWING_WATER && !BLOCK_PROPS[bBelow]?.fluid;

                    if (isSolidBelow) {
                         for (const n of neighbors) {
                             const nx = x + n.dx;
                             const nz = z + n.dz;
                             const nb = this.getBlock(nx, y, nz);
                             if (nb === BlockType.AIR || (BLOCK_PROPS[nb]?.cross)) {
                                 this.setBlock(nx, y, nz, BlockType.FLOWING_WATER);
                                 this.scheduleFluidUpdate(nx, y, nz);
                             }
                         }
                    }
                }
            }
        }
    }

    private randomTick() {
        // Random tick for active chunks to simulate decay/dry up
        this.chunks.forEach((chunk, key) => {
            const [cx, cz] = key.split(',').map(Number);
            const pcx = Math.floor(this.playerPos.x / CHUNK_SIZE);
            const pcz = Math.floor(this.playerPos.z / CHUNK_SIZE);
            if (Math.abs(cx - pcx) > 2 || Math.abs(cz - pcz) > 2) return;

            for(let i=0; i<10; i++) {
                const lx = Math.floor(Math.random() * CHUNK_SIZE);
                const lz = Math.floor(Math.random() * CHUNK_SIZE);
                const y = Math.floor(Math.random() * CHUNK_HEIGHT);
                const idx = lx + lz * CHUNK_SIZE + y * 256;
                const block = chunk.data[idx];
                
                if (block === BlockType.FLOWING_WATER) {
                    const wx = cx * CHUNK_SIZE + lx;
                    const wz = cz * CHUNK_SIZE + lz;
                    
                    // Check if supported
                    let supported = false;
                    
                    // 1. Is there water above?
                    const bAbove = this.getBlock(wx, y + 1, wz);
                    if (bAbove === BlockType.WATER || bAbove === BlockType.FLOWING_WATER) supported = true;
                    
                    // 2. Is there SOURCE water adjacent? (Simple spread model)
                    if (!supported) {
                        const neighbors = [
                            this.getBlock(wx+1, y, wz), this.getBlock(wx-1, y, wz),
                            this.getBlock(wx, y, wz+1), this.getBlock(wx, y, wz-1)
                        ];
                        if (neighbors.includes(BlockType.WATER)) supported = true;
                    }

                    if (!supported) {
                        this.setBlock(wx, y, wz, BlockType.AIR);
                        // Trigger update below so it can dry up too
                        this.scheduleFluidUpdate(wx, y - 1, wz);
                    } else {
                        // If supported, maybe we should trigger flow?
                        this.scheduleFluidUpdate(wx, y, wz);
                    }
                }
                else if (block === BlockType.WATER) {
                     // Ensure source spreads
                     const wx = cx * CHUNK_SIZE + lx;
                     const wz = cz * CHUNK_SIZE + lz;
                     this.scheduleFluidUpdate(wx, y, wz);
                }
            }
        });
    }

    private updateDroppedItems(dt: number) {
        for (let i = this.droppedItems.length - 1; i >= 0; i--) {
            const item = this.droppedItems[i];
            
            // Physics
            item.velocity.y -= GRAVITY * dt;
            const newPos = item.mesh.position.clone().addScaledVector(item.velocity, dt);

            // Robust Ground Collision
            const bx = Math.floor(newPos.x);
            const by = Math.floor(newPos.y);
            const bz = Math.floor(newPos.z);
            const b = this.getBlock(bx, by, bz);
            
            // If going into a block, snap up
            // Check if liquid
            const inLiquid = b === BlockType.WATER || b === BlockType.FLOWING_WATER;

            if (b !== BlockType.AIR && !inLiquid && !BLOCK_PROPS[b]?.cross && b !== BlockType.TORCH) {
                // If we were above, stay above
                if (item.mesh.position.y >= by + 1) {
                    item.velocity.y = 0;
                    item.velocity.x *= 0.8; // Friction
                    item.velocity.z *= 0.8;
                    newPos.y = by + 1.15; // float slightly above
                }
            } else if (inLiquid) {
                // Float in water
                item.velocity.y *= 0.8; // Water resistance
                item.velocity.y += 0.5 * dt; // Buoyancy
                item.velocity.x *= 0.8;
                item.velocity.z *= 0.8;
            }

            item.mesh.position.copy(newPos);
            item.mesh.rotation.y += dt;
            
            // Pickup
            if (Date.now() > item.pickupDelay) {
                const dist = item.mesh.position.distanceTo(this.playerPos);
                if (dist < 1.5) {
                    this.addToInventory(item.type, 1);
                    this.scene.remove(item.mesh);
                    this.droppedItems.splice(i, 1);
                    this.updateHandItem();
                }
            }
        }
    }

    private addToInventory(id: BlockType, count: number) {
        // Try stack first
        for (let i = 0; i < 36; i++) {
            if (this.inventory[i] && this.inventory[i]!.id === id && this.inventory[i]!.count < 64) {
                const space = 64 - this.inventory[i]!.count;
                const add = Math.min(space, count);
                this.inventory[i]!.count += add;
                count -= add;
                if (count <= 0) break;
            }
        }
        // Then empty slot
        if (count > 0) {
            for (let i = 0; i < 36; i++) {
                if (!this.inventory[i]) {
                    this.inventory[i] = { id, count };
                    count = 0;
                    break;
                }
            }
        }
        this.onInventoryChange?.(this.inventory, this.selectedSlot);
    }

    private updatePlayer(dt: number) {
        const f = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        f.y = 0; f.normalize();
        const r = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
        r.y = 0; r.normalize();
        
        const d = new THREE.Vector3();
        if (this.playerInputs.forward) d.add(f);
        if (this.playerInputs.backward) d.sub(f);
        if (this.playerInputs.right) d.add(r);
        if (this.playerInputs.left) d.sub(r);
        if (d.length() > 0) d.normalize();

        const isMoving = d.length() > 0;

        let speed = MOVE_SPEED * this.speedMultiplier;
        if (this.isFlying) speed *= 2.5;

        const targetX = d.x * speed;
        const targetZ = d.z * speed;
        const lerpFactor = 15.0 * dt;
        
        this.playerVel.x += (targetX - this.playerVel.x) * lerpFactor;
        this.playerVel.z += (targetZ - this.playerVel.z) * lerpFactor;

        if (this.isFlying) {
            this.playerVel.y = 0;
            if (this.playerInputs.jump) this.playerVel.y = 10;
            if (this.playerInputs.shift) this.playerVel.y = -10;
        } else {
             const bx = Math.floor(this.playerPos.x);
             const by = Math.floor(this.playerPos.y);
             const bz = Math.floor(this.playerPos.z);
             const bHead = this.getBlock(bx, by, bz);
             
             if (bHead === BlockType.WATER || bHead === BlockType.FLOWING_WATER) {
                 this.playerVel.y -= GRAVITY * 0.2 * dt;
                 if (this.playerInputs.jump) this.playerVel.y = 3;
             } else {
                 this.playerVel.y -= GRAVITY * dt;
                 if (this.playerInputs.jump && this.onGround) {
                     this.playerVel.y = JUMP_FORCE;
                     this.onGround = false;
                 }
             }
        }

        this.movePlayer(this.playerVel.x * dt, 0, 0);
        this.movePlayer(0, 0, this.playerVel.z * dt);
        this.movePlayer(0, this.playerVel.y * dt, 0);

        this.camera.position.copy(this.playerPos);
        this.camera.position.y += 1.6;

        this.hand.update(dt, isMoving);
        this.sky.update(dt, this.playerPos);
        
        // Update entities
        this.entityManager.update(dt, this.getBlock.bind(this), this.playerPos, this.sky.getTime());

        if (this.playerPos.y < -30 && this.gameMode === 'Survival') {
            this.takeDamage(1000); // kill
        }
    }

    private movePlayer(dx: number, dy: number, dz: number) {
        this.playerPos.x += dx;
        if (this.checkCollision()) this.playerPos.x -= dx;
        this.playerPos.z += dz;
        if (this.checkCollision()) this.playerPos.z -= dz;
        
        this.playerPos.y += dy;
        this.onGround = false;
        
        if (this.checkCollision()) {
            this.playerPos.y -= dy;
            if (dy < 0) {
                this.onGround = true;
                // Fall Damage Logic
                if (this.gameMode === 'Survival' && this.playerVel.y < -13) {
                     // -13 roughly corresponds to 3-4 blocks fall
                     const damage = Math.floor((Math.abs(this.playerVel.y) - 13) / 2);
                     if (damage > 0) this.takeDamage(damage);
                }
            }
            this.playerVel.y = 0;
        }
    }

    private checkCollision(): boolean {
        if (this.isFlying) return false;
        const w = 0.3;
        const h = 1.8;
        const minX = Math.floor(this.playerPos.x - w);
        const maxX = Math.floor(this.playerPos.x + w);
        const minY = Math.floor(this.playerPos.y);
        const maxY = Math.floor(this.playerPos.y + h);
        const minZ = Math.floor(this.playerPos.z - w);
        const maxZ = Math.floor(this.playerPos.z + w);

        for(let x=minX; x<=maxX; x++) {
            for(let y=minY; y<=maxY; y++) {
                for(let z=minZ; z<=maxZ; z++) {
                    const b = this.getBlock(x,y,z);
                    // Added optional chain here for safety although b should be valid
                    if (b !== BlockType.AIR && b !== BlockType.WATER && b !== BlockType.FLOWING_WATER && !BLOCK_PROPS[b]?.cross && b !== BlockType.TORCH) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private animate = (time: number) => {
        if (!this.running) return;
        requestAnimationFrame(this.animate);
        
        const dt = Math.min((time - this.lastTime) / 1000, 0.1);
        this.lastTime = time;
        
        // Accumulate ticks for random block updates (approx 10 times per second)
        this.tickAccumulator += dt;
        if (this.tickAccumulator > 0.1) {
            this.randomTick();
            this.tickAccumulator = 0;
        }

        if (!this.paused) {
            this.processFluids();
            this.updatePlayer(dt);
            this.updateMining(dt);
            this.updateDroppedItems(dt);
            this.updateWorldChunks();
        }
        
        this.renderer.render(this.scene, this.camera);
    }

    public requestPointerLock() {
        this.renderer.domElement.requestPointerLock();
    }
    
    public exitPointerLock() {
        document.exitPointerLock();
    }

    public getWorldData(): Partial<WorldData> {
        return {
            player: { x: this.playerPos.x, y: this.playerPos.y, z: this.playerPos.z, h: this.playerHealth },
            inventory: this.inventory,
            modified: Array.from(this.modifiedBlocks.entries())
        };
    }
}
