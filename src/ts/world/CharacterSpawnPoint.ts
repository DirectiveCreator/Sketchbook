import { ISpawnPoint } from '../interfaces/ISpawnPoint';
import * as THREE from 'three';
import { World } from './World';
import { Character } from '../characters/Character';
import { LoadingManager } from '../core/LoadingManager';
import * as Utils from '../core/FunctionLibrary';
import { MMLCharacterLoader } from '../characters/MMLCharacterLoader';

export class CharacterSpawnPoint implements ISpawnPoint {
    private object: THREE.Object3D;
    private mmlLoader: MMLCharacterLoader;

    constructor(object: THREE.Object3D) {
        this.object = object;
        this.mmlLoader = new MMLCharacterLoader();
    }
    
    public async spawn(loadingManager: LoadingManager, world: World): Promise<void> {
        const characterPath = this.object.userData?.characterPath || 'build/assets/boxman.glb';
        const isMML = characterPath.endsWith('.mml') || characterPath.endsWith('.html');

        if (isMML) {
            try {
                const characterScene = await this.mmlLoader.loadCharacter(characterPath);
                characterScene.userData.isMMLCharacter = true;

                let player = new Character({ scene: characterScene });
                
                let worldPos = new THREE.Vector3();
                this.object.getWorldPosition(worldPos);
                player.setPosition(worldPos.x, worldPos.y, worldPos.z);
                
                let forward = Utils.getForward(this.object);
                player.setOrientation(forward, true);
                
                world.add(player);
                player.takeControl();
            } catch (error) {
                console.error('Failed to load MML character:', error);
            }
        } else {
            loadingManager.loadGLTF(characterPath, (model) => {
                let player = new Character(model);
                
                let worldPos = new THREE.Vector3();
                this.object.getWorldPosition(worldPos);
                player.setPosition(worldPos.x, worldPos.y, worldPos.z);
                
                let forward = Utils.getForward(this.object);
                player.setOrientation(forward, true);
                
                world.add(player);
                player.takeControl();
            });
        }
    }
}