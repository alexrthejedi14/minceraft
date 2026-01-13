
import * as THREE from 'three';
import { EntityType, BlockType, ItemStack } from '../types';
import { GRAVITY, BLOCK_PROPS, CHUNK_HEIGHT } from '../constants';
import { getMobTexture } from '../utils/textures';

// Helper for collision checking
const isSolid = (id: BlockType) => {
    return id !== BlockType.AIR && id !== BlockType.WATER && !BLOCK_PROPS[id]?.cross && id !== BlockType.TORCH;
};

export class Mob {
    public id: string;
    public type: EntityType;
    public mesh: THREE.Group;
    public position: THREE.Vector3;
    public velocity: THREE.Vector3;
    public rotation: number = 0;
    public health: number = 10;
    public dead: boolean = false;
    
    // Animation
    private legGroup: THREE.Group[] = [];
    private armGroup: THREE.Group[] = [];
    private walkTime: number = 0;
    
    // AI
    private state: 'IDLE' | 'WANDER' | 'CHASE' | 'FLEE' = 'IDLE';
    private stateTimer: number = 0;
    private target: THREE.Vector3 | null = null;
    private moveSpeed: number = 2.0;
    private jumpTimer: number = 0;
    
    // Logic
    private isHostile: boolean;
    private burnTimer: number = 0;
    private attackCooldown: number = 0;

    constructor(type: EntityType, x: number, y: number, z: number) {
        this.id = Math.random().toString(36).substr(2, 9);
        this.type = type;
        this.position = new THREE.Vector3(x, y, z);
        this.velocity = new THREE.Vector3(0, 0, 0);
        
        this.mesh = new THREE.Group();
        this.mesh.position.copy(this.position);
        
        this.isHostile = type === EntityType.ZOMBIE;
        
        // Stats
        if (type === EntityType.ZOMBIE) {
            this.health = 20;
            this.moveSpeed = 3.5;
        } else {
            this.health = 10; 
        }

        this.buildModel();
    }

    private buildModel() {
        // Base color materials
        let skinColor = 0xFFFFFF;
        if (this.type === EntityType.COW) skinColor = 0x444444; // Dark gray body
        if (this.type === EntityType.PIG) skinColor = 0xF0A0A0;
        if (this.type === EntityType.SHEEP) skinColor = 0xFFFFFF;
        if (this.type === EntityType.ZOMBIE) skinColor = 0x3333AA; // Shirt color

        const bodyMat = new THREE.MeshLambertMaterial({ color: skinColor });
        const faceTex = getMobTexture(this.type);
        // Multi-material for head: Right, Left, Top, Bottom, Front, Back
        const skinMat = new THREE.MeshLambertMaterial({ color: this.type===EntityType.ZOMBIE ? 0x467240 : (this.type===EntityType.COW ? 0x6d4c41 : skinColor) });
        const faceMat = new THREE.MeshLambertMaterial({ map: faceTex });
        
        const headMaterials = [
            skinMat, // Right
            skinMat, // Left
            skinMat, // Top
            skinMat, // Bottom
            faceMat, // Front
            skinMat  // Back
        ];

        // Quadruped vs Biped
        if (this.type === EntityType.COW || this.type === EntityType.PIG || this.type === EntityType.SHEEP) {
            const bodyGeo = new THREE.BoxGeometry(0.9, 0.6, 1.3);
            const headGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
            const legGeo = new THREE.BoxGeometry(0.25, 0.8, 0.25);

            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.position.y = 0.8;
            body.castShadow = true;
            this.mesh.add(body);

            const head = new THREE.Mesh(headGeo, headMaterials);
            head.position.set(0, 1.4, 0.8);
            head.castShadow = true;
            this.mesh.add(head);

            // Legs
            const legMat = new THREE.MeshLambertMaterial({ color: this.type===EntityType.SHEEP ? 0xE0C0A0 : skinColor });
            const legPos = [
                [-0.3, 0.4, 0.5], [0.3, 0.4, 0.5], // Front
                [-0.3, 0.4, -0.5], [0.3, 0.4, -0.5] // Back
            ];

            legPos.forEach(p => {
                const leg = new THREE.Mesh(legGeo, legMat);
                const g = new THREE.Group();
                leg.position.y = -0.4; 
                g.add(leg);
                g.position.set(p[0], p[1] + 0.4, p[2]);
                this.mesh.add(g);
                this.legGroup.push(g);
            });

        } else if (this.type === EntityType.ZOMBIE) {
            const bodyGeo = new THREE.BoxGeometry(0.6, 0.9, 0.3);
            const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
            const limbGeo = new THREE.BoxGeometry(0.25, 0.9, 0.25);

            const body = new THREE.Mesh(bodyGeo, bodyMat);
            body.position.y = 0.95;
            body.castShadow = true;
            this.mesh.add(body);

            const head = new THREE.Mesh(headGeo, headMaterials);
            head.position.set(0, 1.65, 0);
            head.castShadow = true;
            this.mesh.add(head);

            const limbMat = new THREE.MeshLambertMaterial({ color: 0x467240 }); // Green skin

            // Arms 
            const armOffsets = [[-0.45, 1.2], [0.45, 1.2]];
            armOffsets.forEach(p => {
                const arm = new THREE.Mesh(limbGeo, limbMat);
                const g = new THREE.Group();
                arm.position.y = -0.3;
                g.add(arm);
                g.position.set(p[0], p[1], 0);
                g.rotation.x = -Math.PI / 2;
                this.mesh.add(g);
                this.armGroup.push(g);
            });

            // Legs (pants color)
            const pantMat = new THREE.MeshLambertMaterial({ color: 0x442288 });
            const legOffsets = [[-0.2, 0.5], [0.2, 0.5]];
            legOffsets.forEach(p => {
                const leg = new THREE.Mesh(limbGeo, pantMat);
                const g = new THREE.Group();
                leg.position.y = -0.45;
                g.add(leg);
                g.position.set(p[0], p[1], 0);
                this.mesh.add(g);
                this.legGroup.push(g);
            });
        }
    }

    public update(dt: number, getBlock: (x:number, y:number, z:number) => BlockType, playerPos: THREE.Vector3, timeOfDay: number, onAttack?: () => void) {
        if (this.dead) return;

        const isDay = timeOfDay > 0.0 && timeOfDay < 0.5;
        if (this.type === EntityType.ZOMBIE && isDay) {
            this.burnTimer += dt;
            if (this.burnTimer > 1.0) {
                const bx = Math.floor(this.position.x);
                const bz = Math.floor(this.position.z);
                const by = Math.floor(this.position.y + 2);
                let exposed = true;
                for (let y = by; y < CHUNK_HEIGHT; y++) {
                    if (isSolid(getBlock(bx, y, bz))) {
                        exposed = false;
                        break;
                    }
                }
                
                if (exposed) {
                    this.takeDamage(2);
                    // No red flash for now to keep materials simple
                }
                this.burnTimer = 0;
            }
        }

        // AI Logic
        this.stateTimer -= dt;
        this.attackCooldown -= dt;
        const distToPlayer = this.position.distanceTo(playerPos);

        if (this.isHostile) {
            if (distToPlayer < 15 && distToPlayer > 0.5) {
                this.state = 'CHASE';
            } else if (distToPlayer <= 1.0 && this.attackCooldown <= 0) {
                if (onAttack) onAttack();
                this.attackCooldown = 1.0; 
            } else if (this.state === 'CHASE' && distToPlayer >= 15) {
                this.state = 'IDLE';
                this.stateTimer = 2;
            }
        } else {
            if (this.state === 'FLEE') {
                if (this.stateTimer <= 0) {
                    this.state = 'IDLE';
                }
            }
        }

        if (this.stateTimer <= 0 && this.state !== 'FLEE') {
            if (this.state === 'IDLE') {
                if (Math.random() < 0.7) {
                    this.state = 'WANDER';
                    this.stateTimer = 1 + Math.random() * 3;
                    this.rotation = Math.random() * Math.PI * 2;
                } else {
                    this.stateTimer = 2 + Math.random() * 2;
                }
            } else if (this.state === 'WANDER') {
                this.state = 'IDLE';
                this.stateTimer = 2 + Math.random() * 2;
                this.velocity.x = 0;
                this.velocity.z = 0;
            }
        }

        let targetVx = 0;
        let targetVz = 0;
        let speed = this.moveSpeed;

        if (this.state === 'FLEE') speed *= 2.0;

        if (this.state === 'WANDER') {
            targetVx = Math.sin(this.rotation) * speed;
            targetVz = Math.cos(this.rotation) * speed;
        } else if (this.state === 'CHASE') {
            const dx = playerPos.x - this.position.x;
            const dz = playerPos.z - this.position.z;
            const angle = Math.atan2(dx, dz);
            this.rotation = angle;
            targetVx = Math.sin(angle) * speed;
            targetVz = Math.cos(angle) * speed;
        } else if (this.state === 'FLEE') {
            const dx = this.position.x - playerPos.x;
            const dz = this.position.z - playerPos.z;
            const angle = Math.atan2(dx, dz);
            this.rotation = angle;
            targetVx = Math.sin(angle) * speed;
            targetVz = Math.cos(angle) * speed;
        }

        this.velocity.x += (targetVx - this.velocity.x) * 5 * dt;
        this.velocity.z += (targetVz - this.velocity.z) * 5 * dt;
        this.velocity.y -= GRAVITY * dt;

        this.move(dt, getBlock);

        this.mesh.position.copy(this.position);
        this.mesh.rotation.y = this.rotation;

        const isMoving = this.velocity.lengthSq() > 0.1;
        if (isMoving) {
            this.walkTime += dt * 10;
            this.legGroup.forEach((leg, i) => {
                leg.rotation.x = Math.sin(this.walkTime + (i % 2 === 0 ? 0 : Math.PI)) * 0.4;
            });
            if (this.type !== EntityType.ZOMBIE) {
                this.armGroup.forEach((arm, i) => {
                     arm.rotation.x = Math.sin(this.walkTime + (i % 2 !== 0 ? 0 : Math.PI)) * 0.4;
                });
            } else {
                 this.armGroup.forEach((arm, i) => {
                     arm.rotation.x = -Math.PI/2 + Math.sin(this.walkTime * 0.5 + i) * 0.1;
                });
            }
        } else {
            this.legGroup.forEach(l => l.rotation.x = 0);
            if(this.type === EntityType.ZOMBIE) {
                 this.armGroup.forEach((arm, i) => {
                     arm.rotation.x = -Math.PI/2 + Math.sin(Date.now()/500 + i) * 0.1;
                });
            }
        }

        if (this.position.y < -50) this.dead = true;
    }

    private move(dt: number, getBlock: (x:number, y:number, z:number) => BlockType) {
        this.position.x += this.velocity.x * dt;
        if (this.checkCollision(getBlock)) {
            this.position.x -= this.velocity.x * dt;
            if (this.onGround && this.jumpTimer <= 0) {
                 this.velocity.y = 7;
                 this.jumpTimer = 0.5;
            }
        }

        this.position.z += this.velocity.z * dt;
        if (this.checkCollision(getBlock)) {
            this.position.z -= this.velocity.z * dt;
            if (this.onGround && this.jumpTimer <= 0) {
                 this.velocity.y = 7;
                 this.jumpTimer = 0.5;
            }
        }

        this.position.y += this.velocity.y * dt;
        this.onGround = false;
        if (this.checkCollision(getBlock)) {
            this.position.y -= this.velocity.y * dt;
            if (this.velocity.y < 0) this.onGround = true;
            this.velocity.y = 0;
        }

        this.jumpTimer -= dt;
    }

    private onGround = false;
    private checkCollision(getBlock: (x:number, y:number, z:number) => BlockType): boolean {
        const w = 0.3; 
        const h = (this.type === EntityType.ZOMBIE) ? 1.8 : 1.0; 

        const minX = Math.floor(this.position.x - w);
        const maxX = Math.floor(this.position.x + w);
        const minY = Math.floor(this.position.y);
        const maxY = Math.floor(this.position.y + h);
        const minZ = Math.floor(this.position.z - w);
        const maxZ = Math.floor(this.position.z + w);

        for(let x=minX; x<=maxX; x++) {
            for(let y=minY; y<=maxY; y++) {
                for(let z=minZ; z<=maxZ; z++) {
                    const b = getBlock(x,y,z);
                    if (isSolid(b)) return true;
                }
            }
        }
        return false;
    }

    public takeDamage(amt: number) {
        this.health -= amt;
        if (this.health <= 0) {
            this.dead = true;
        } else {
            this.velocity.y = 5;
            this.velocity.x = -this.velocity.x * 2;
            this.velocity.z = -this.velocity.z * 2;
            
            if (!this.isHostile) {
                this.state = 'FLEE';
                this.stateTimer = 5.0; 
            } else {
                this.state = 'CHASE'; 
            }
        }
    }

    public getDrops(): ItemStack[] {
        const drops: ItemStack[] = [];
        if (this.type === EntityType.COW) {
            drops.push({ id: BlockType.RAW_BEEF, count: 1 + Math.floor(Math.random() * 3) });
        } else if (this.type === EntityType.PIG) {
            drops.push({ id: BlockType.PORKCHOP, count: 1 + Math.floor(Math.random() * 3) });
        } else if (this.type === EntityType.SHEEP) {
            drops.push({ id: BlockType.MUTTON, count: 1 + Math.floor(Math.random() * 3) });
        } else if (this.type === EntityType.ZOMBIE) {
            drops.push({ id: BlockType.ROTTEN_FLESH, count: 1 + Math.floor(Math.random() * 2) });
        }
        return drops;
    }
}

export class EntityManager {
    public mobs: Mob[] = [];
    private scene: THREE.Scene;
    public onMobDeath?: (pos: THREE.Vector3, drops: ItemStack[]) => void;
    public onPlayerDamage?: (amount: number) => void;
    
    constructor(scene: THREE.Scene) {
        this.scene = scene;
    }

    public spawnMob(type: EntityType, x: number, y: number, z: number) {
        const mob = new Mob(type, x, y, z);
        this.mobs.push(mob);
        this.scene.add(mob.mesh);
    }

    public update(dt: number, getBlock: (x:number, y:number, z:number) => BlockType, playerPos: THREE.Vector3, timeOfDay: number) {
        const isNight = timeOfDay >= 0.5;
        const maxMobs = 20;

        if (this.mobs.length < maxMobs && Math.random() < 0.01) {
            const r = 20 + Math.random() * 20;
            const theta = Math.random() * Math.PI * 2;
            const sx = playerPos.x + Math.sin(theta) * r;
            const sz = playerPos.z + Math.cos(theta) * r;
            
            let sy = 80;
            for(let y=100; y>0; y--) {
                if (isSolid(getBlock(Math.floor(sx), y, Math.floor(sz)))) {
                    sy = y + 2;
                    break;
                }
            }

            if (sy > 0) {
                let availableTypes = [EntityType.COW, EntityType.PIG, EntityType.SHEEP];
                if (isNight) {
                    availableTypes.push(EntityType.ZOMBIE);
                    availableTypes.push(EntityType.ZOMBIE); 
                }
                
                const t = availableTypes[Math.floor(Math.random() * availableTypes.length)];
                this.spawnMob(t, sx, sy, sz);
            }
        }

        for (let i = this.mobs.length - 1; i >= 0; i--) {
            const m = this.mobs[i];
            m.update(dt, getBlock, playerPos, timeOfDay, () => {
                if (this.onPlayerDamage) this.onPlayerDamage(3);
            });
            
            if (m.dead) {
                if (this.onMobDeath) {
                    this.onMobDeath(m.position, m.getDrops());
                }
                this.scene.remove(m.mesh);
                this.mobs.splice(i, 1);
            } else if (m.position.distanceTo(playerPos) > 80) {
                this.scene.remove(m.mesh);
                this.mobs.splice(i, 1);
            }
        }
    }

    public checkAttack(playerPos: THREE.Vector3, playerDir: THREE.Vector3, range: number = 3): boolean {
        for (const mob of this.mobs) {
            const toMob = new THREE.Vector3().subVectors(mob.position, playerPos);
            const dist = toMob.length();
            if (dist < range) {
                toMob.normalize();
                const dot = toMob.dot(playerDir);
                if (dot > 0.8) { 
                    mob.takeDamage(5); 
                    return true;
                }
            }
        }
        return false;
    }
}
