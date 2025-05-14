import * as THREE from 'three';
import * as Utils from '../core/FunctionLibrary';
import { IWorldEntity } from '../interfaces/IWorldEntity';
import { IInputReceiver } from '../interfaces/IInputReceiver';
import { ICharacterAI } from '../interfaces/ICharacterAI';
import { EntityType } from '../enums/EntityType';
import { World } from '../world/World';
import { KeyBinding } from '../core/KeyBinding';

export class Character implements IWorldEntity, IInputReceiver {
    public entityType: EntityType = EntityType.Character;
    public updateOrder: number = 1;
    public raycastBox: THREE.Mesh;
    public behaviour: ICharacterAI;
    public actions: { [action: string]: KeyBinding };
    private materials: THREE.Material[] = [];
    private world: World;

    constructor(gltf: any) {
        this.readCharacterData(gltf);
        this.actions = {};
        this.raycastBox = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshBasicMaterial({ visible: false })
        );
    }

    public readCharacterData(gltf: THREE.Object3D): void {
        const isMMLCharacter = gltf.userData?.isMMLCharacter;

        gltf.traverse((child) => {
            if (child.isMesh) {
                Utils.setupMeshProperties(child);

                if (child.material !== undefined) {
                    this.materials.push(child.material);
                }
            }
        });

        if (isMMLCharacter) {
            console.log('MML character loaded');
        }
    }

    public addToWorld(world: World): void {
        this.world = world;
        world.characters.push(this);
    }

    public removeFromWorld(world: World): void {
        const index = world.characters.indexOf(this);
        if (index !== -1) {
            world.characters.splice(index, 1);
        }
    }

    public update(timeStep: number): void {
        // Character update logic here
    }

    public setBehaviour(behaviour: ICharacterAI): void {
        this.behaviour = behaviour;
    }

    public takeControl(): void {
        if (this.world) {
            this.world.inputManager.setInputReceiver(this);
        }
    }

    // IInputReceiver implementation
    public handleKeyboardEvent(event: KeyboardEvent, code: string, pressed: boolean): void {
        // Handle keyboard input
    }

    public handleMouseButton(event: MouseEvent, code: string, pressed: boolean): void {
        // Handle mouse buttons
    }

    public handleMouseMove(event: MouseEvent, deltaX: number, deltaY: number): void {
        // Handle mouse movement
    }

    public handleMouseWheel(event: WheelEvent, value: number): void {
        // Handle mouse wheel
    }

    public inputReceiverInit(): void {
        // Initialize input receiver
    }

    public inputReceiverUpdate(timeStep: number): void {
        // Update input receiver state
    }
}