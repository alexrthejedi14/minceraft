
import * as THREE from 'three';

export class Sky {
    private scene: THREE.Scene;
    public sun: THREE.Mesh;
    public moon: THREE.Mesh;
    private stars: THREE.Points;
    private clouds: THREE.InstancedMesh;
    
    private sunLight: THREE.DirectionalLight;
    private moonLight: THREE.DirectionalLight;
    private hemiLight: THREE.HemisphereLight;

    private time: number = 0; // 0 = Sunrise, 0.25 = Noon, 0.5 = Sunset, 0.75 = Midnight
    private dayDuration = 600; // 10 minutes per day

    // Cloud management
    private cloudData: { x: number, z: number, scale: number }[] = [];
    private cloudCount = 50;
    private cloudRange = 400; // Area size around player

    constructor(scene: THREE.Scene) {
        this.scene = scene;

        // Ambient / Hemisphere Light
        this.hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.6);
        this.hemiLight.color.setHSL(0.6, 1, 0.6);
        this.hemiLight.groundColor.setHSL(0.095, 1, 0.75);
        this.hemiLight.position.set(0, 50, 0);
        this.scene.add(this.hemiLight);

        // Sun Light
        this.sunLight = new THREE.DirectionalLight(0xffffff, 1);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 4096;
        this.sunLight.shadow.mapSize.height = 4096;
        const d = 120;
        this.sunLight.shadow.camera.left = -d;
        this.sunLight.shadow.camera.right = d;
        this.sunLight.shadow.camera.top = d;
        this.sunLight.shadow.camera.bottom = -d;
        // Adjusted bias to prevent "floating" shadows or light leaks
        this.sunLight.shadow.bias = -0.00001; 
        this.scene.add(this.sunLight);
        this.scene.add(this.sunLight.target); // Important for moving target

        // Moon Light
        this.moonLight = new THREE.DirectionalLight(0x4444ff, 0.2);
        this.scene.add(this.moonLight);

        // Sun Body (Fog disabled)
        const sunGeo = new THREE.BoxGeometry(20, 20, 20);
        const sunMat = new THREE.MeshBasicMaterial({ color: 0xffff00, fog: false });
        this.sun = new THREE.Mesh(sunGeo, sunMat);
        this.scene.add(this.sun);

        // Moon Body (Fog disabled)
        const moonGeo = new THREE.BoxGeometry(15, 15, 15);
        const moonMat = new THREE.MeshBasicMaterial({ color: 0xdddddd, fog: false });
        this.moon = new THREE.Mesh(moonGeo, moonMat);
        this.scene.add(this.moon);

        // Stars (Fog disabled)
        const starGeo = new THREE.BufferGeometry();
        const starCount = 1000;
        const starPos = [];
        for(let i=0; i<starCount; i++) {
            const r = 300 + Math.random() * 50;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const x = r * Math.sin(phi) * Math.cos(theta);
            const y = r * Math.sin(phi) * Math.sin(theta);
            const z = r * Math.cos(phi);
            starPos.push(x, y, z);
        }
        starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
        const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 2, transparent: true, opacity: 0, fog: false });
        this.stars = new THREE.Points(starGeo, starMat);
        this.scene.add(this.stars);

        // Clouds (Instanced, Fog disabled)
        const cloudGeo = new THREE.BoxGeometry(16, 4, 12);
        const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.8, transparent: true, fog: false });
        this.clouds = new THREE.InstancedMesh(cloudGeo, cloudMat, this.cloudCount);
        this.clouds.frustumCulled = false; // Always render, we handle positioning
        
        // Init cloud data
        for(let i=0; i<this.cloudCount; i++) {
            this.cloudData.push({
                x: (Math.random() - 0.5) * this.cloudRange,
                z: (Math.random() - 0.5) * this.cloudRange,
                scale: 1 + Math.random()
            });
        }
        this.scene.add(this.clouds);
    }

    public setTime(t: number) {
        this.time = t;
    }

    public getTime(): number {
        return this.time;
    }

    public update(dt: number, playerPos: THREE.Vector3) {
        this.time += dt / this.dayDuration;
        if (this.time >= 1) this.time -= 1;

        // Calculate Angle (0..2PI)
        const angle = this.time * Math.PI * 2;
        const radius = 300; // Distance of sun/moon

        // Rotate Sun/Moon around Z axis relative to player
        // We add player position so they move with player (skybox effect)
        const sunX = Math.cos(angle) * radius;
        const sunY = Math.sin(angle) * radius;

        this.sun.position.set(playerPos.x + sunX, playerPos.y + sunY, playerPos.z);
        this.sun.lookAt(playerPos);
        // Ensure rotation is correct to face player squarely or just simple cube look
        this.sun.rotation.z = angle; 

        this.moon.position.set(playerPos.x - sunX, playerPos.y - sunY, playerPos.z);
        this.moon.lookAt(playerPos);
        this.moon.rotation.z = angle;

        // Update Directional Lights
        this.sunLight.position.copy(this.sun.position);
        this.sunLight.target.position.copy(playerPos); // Target follows player
        
        this.moonLight.position.copy(this.moon.position);

        // Day/Night Cycle Colors
        const sunHeight = Math.sin(angle); 
        const dayColor = new THREE.Color(0x87CEEB);
        const nightColor = new THREE.Color(0x050510);
        const sunsetColor = new THREE.Color(0xFFA500);

        let skyColor = new THREE.Color();
        let starsOpacity = 0;

        if (sunHeight > 0.2) {
            skyColor.copy(dayColor);
            this.sunLight.intensity = 1.0;
            this.moonLight.intensity = 0;
            this.hemiLight.intensity = 0.6;
            starsOpacity = 0;
        } else if (sunHeight < -0.2) {
            skyColor.copy(nightColor);
            this.sunLight.intensity = 0;
            this.moonLight.intensity = 0.3; 
            this.hemiLight.intensity = 0.1;
            starsOpacity = 1;
        } else {
            const t = (sunHeight + 0.2) / 0.4;
            if (sunHeight > 0) skyColor.lerpColors(sunsetColor, dayColor, sunHeight / 0.2);
            else skyColor.lerpColors(nightColor, sunsetColor, (sunHeight + 0.2) / 0.2);
            
            this.sunLight.intensity = t;
            this.moonLight.intensity = (1-t) * 0.3;
            this.hemiLight.intensity = 0.1 + t * 0.5;
            starsOpacity = 1 - t;
        }

        this.scene.background = skyColor;
        if (this.scene.fog) this.scene.fog.color = skyColor;
        
        // Stars
        (this.stars.material as THREE.PointsMaterial).opacity = starsOpacity;
        this.stars.position.copy(playerPos);
        this.stars.rotation.z = angle;

        // Clouds Logic
        const dummy = new THREE.Object3D();
        const windSpeed = 5.0; // Units per second
        const windOffset = this.time * this.dayDuration * windSpeed;
        const cloudHeight = 180;

        for (let i = 0; i < this.cloudCount; i++) {
            const data = this.cloudData[i];
            
            // Calculate absolute world position with wind
            let worldX = data.x + windOffset;
            let worldZ = data.z;

            // Wrap around player to create infinite field
            // The cloud should appear within +/- cloudRange/2 of the player
            const relativeX = (worldX - playerPos.x) % this.cloudRange;
            const finalX = playerPos.x + (relativeX < -this.cloudRange/2 ? relativeX + this.cloudRange : (relativeX > this.cloudRange/2 ? relativeX - this.cloudRange : relativeX));
            
            const relativeZ = (worldZ - playerPos.z) % this.cloudRange;
            const finalZ = playerPos.z + (relativeZ < -this.cloudRange/2 ? relativeZ + this.cloudRange : (relativeZ > this.cloudRange/2 ? relativeZ - this.cloudRange : relativeZ));

            dummy.position.set(finalX, cloudHeight, finalZ);
            dummy.scale.set(data.scale, 1, data.scale);
            dummy.updateMatrix();
            this.clouds.setMatrixAt(i, dummy.matrix);
        }
        this.clouds.instanceMatrix.needsUpdate = true;
    }
}
