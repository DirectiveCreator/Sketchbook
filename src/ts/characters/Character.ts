import * as THREE from 'three';
import * as CANNON from 'cannon';
import * as _ from 'lodash';
import * as Utils from '../core/FunctionLibrary';

import { KeyBinding } from '../core/KeyBinding';
import { VectorSpringSimulator } from '../physics/spring_simulation/VectorSpringSimulator';
import { RelativeSpringSimulator } from '../physics/spring_simulation/RelativeSpringSimulator';
import { ICharacterAI } from '../interfaces/ICharacterAI';
import { World } from '../world/World';
import { IControllable } from '../interfaces/IControllable';
import { ICharacterState } from '../interfaces/ICharacterState';
import { IWorldEntity } from '../interfaces/IWorldEntity';
import { VehicleSeat } from '../vehicles/VehicleSeat';
import { Vehicle } from '../vehicles/Vehicle';
import { CapsuleCollider } from '../physics/colliders/CapsuleCollider';
import { VehicleEntryInstance } from './VehicleEntryInstance';
import { GroundImpactData } from './GroundImpactData';
import { EntityType } from '../enums/EntityType';
import { Idle } from './character_states/Idle';

export class Character extends THREE.Object3D implements IWorldEntity {
    public updateOrder: number = 1;
    public entityType: EntityType = EntityType.Character;

    public height: number = 0;
    public tiltContainer: THREE.Group;
    public modelContainer: THREE.Group;
    public materials: THREE.Material[] = [];
    public mixer: THREE.AnimationMixer;
    public animations: any[];

    // Movement
    public acceleration: THREE.Vector3 = new THREE.Vector3();
    public velocity: THREE.Vector3 = new THREE.Vector3();
    public arcadeVelocityInfluence: THREE.Vector3 = new THREE.Vector3();
    public velocityTarget: THREE.Vector3 = new THREE.Vector3();
    public arcadeVelocityIsAdditive: boolean = false;

    public defaultVelocitySimulatorDamping: number = 0.8;
    public defaultVelocitySimulatorMass: number = 50;
    public velocitySimulator: VectorSpringSimulator;
    public moveSpeed: number = 4;
    public angularVelocity: number = 0;
    public orientation: THREE.Vector3 = new THREE.Vector3(0, 0, 1);
    public orientationTarget: THREE.Vector3 = new THREE.Vector3(0, 0, 1);
    public defaultRotationSimulatorDamping: number = 0.5;
    public defaultRotationSimulatorMass: number = 10;
    public rotationSimulator: RelativeSpringSimulator;
    public viewVector: THREE.Vector3;
    public actions: { [action: string]: KeyBinding };
    public characterCapsule: CapsuleCollider;
    
    // Ray casting
    public rayResult: CANNON.RaycastResult = new CANNON.RaycastResult();
    public rayHasHit: boolean = false;
    public rayCastLength: number = 0.57;
    public raySafeOffset: number = 0.03;
    public wantsToJump: boolean = false;
    public initJumpSpeed: number = -1;
    public groundImpactData: GroundImpactData = new GroundImpactData();
    public raycastBox: THREE.Mesh;
    
    public world: World;
    public charState: ICharacterState;
    public behaviour: ICharacterAI;
    
    // Vehicles
    public controlledObject: IControllable;
    public occupyingSeat: VehicleSeat = null;
    public vehicleEntryInstance: VehicleEntryInstance = null;
    
    private physicsEnabled: boolean = true;
    private isMMLCharacter: boolean = false;

    constructor(gltf: any) {
        super();

        // Check if this is an MML character
        this.isMMLCharacter = gltf.scene?.userData?.isMMLCharacter || false;

        this.readCharacterData(gltf);
        this.setAnimations(gltf.animations);

        // The visuals group is centered for easy character tilting
        this.tiltContainer = new THREE.Group();
        this.add(this.tiltContainer);

        // Model container is used to reliably ground the character
        this.modelContainer = new THREE.Group();
        this.modelContainer.position.y = -0.57;
        this.tiltContainer.add(this.modelContainer);
        this.modelContainer.add(gltf.scene);

        this.mixer = new THREE.AnimationMixer(gltf.scene);

        this.velocitySimulator = new VectorSpringSimulator(60, this.defaultVelocitySimulatorMass, this.defaultVelocitySimulatorDamping);
        this.rotationSimulator = new RelativeSpringSimulator(60, this.defaultRotationSimulatorMass, this.defaultRotationSimulatorDamping);

        this.viewVector = new THREE.Vector3();

        // Actions
        this.actions = {
            'up': new KeyBinding('KeyW'),
            'down': new KeyBinding('KeyS'),
            'left': new KeyBinding('KeyA'),
            'right': new KeyBinding('KeyD'),
            'run': new KeyBinding('ShiftLeft'),
            'jump': new KeyBinding('Space'),
            'use': new KeyBinding('KeyE'),
            'enter': new KeyBinding('KeyF'),
            'enter_passenger': new KeyBinding('KeyG'),
            'seat_switch': new KeyBinding('KeyX'),
            'primary': new KeyBinding('Mouse0'),
            'secondary': new KeyBinding('Mouse1'),
        };

        // Physics
        // Player Capsule
        this.characterCapsule = new CapsuleCollider({
            mass: 1,
            position: new CANNON.Vec3(),
            height: 0.5,
            radius: 0.25,
            segments: 8,
            friction: 0.0
        });

        this.characterCapsule.body.shapes.forEach((shape) => {
            shape.collisionFilterMask = ~CollisionGroups.TrimeshColliders;
        });
        this.characterCapsule.body.allowSleep = false;

        // Move character to different collision group for raycasting
        this.characterCapsule.body.collisionFilterGroup = 2;

        // Disable character rotation
        this.characterCapsule.body.fixedRotation = true;
        this.characterCapsule.body.updateMassProperties();

        // Ray cast debug
        const boxGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const boxMat = new THREE.MeshLambertMaterial({
            color: 0xff0000
        });
        this.raycastBox = new THREE.Mesh(boxGeo, boxMat);
        this.raycastBox.visible = false;

        // Physics pre/post step callback bindings
        this.characterCapsule.body.preStep = (body: CANNON.Body) => { this.physicsPreStep(body, this); };
        this.characterCapsule.body.postStep = (body: CANNON.Body) => { this.physicsPostStep(body, this); };

        // States
        this.setState(new Idle(this));
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