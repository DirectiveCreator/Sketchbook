import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { SkeletonUtils } from 'three-stdlib';

export interface MMLCharacterData {
    bodySrc: string;
    traits: { type: string; src: string }[];
}

export class MMLAvatarLoader {
    private loader: GLTFLoader;
    private dracoLoader: DRACOLoader;

    constructor() {
        this.dracoLoader = new DRACOLoader();
        this.dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
        
        this.loader = new GLTFLoader();
        this.loader.setDRACOLoader(this.dracoLoader);
    }

    /**
     * Load an MML avatar from a URL (can be .mml, .html, or direct .glb)
     * @param url The URL to load the avatar from
     * @returns Promise resolving to a THREE.Group containing the avatar
     */
    public async loadFromUrl(url: string): Promise<THREE.Group> {
        try {
            // Determine if this is an MML file, HTML file, or direct GLB
            if (url.endsWith('.mml') || url.endsWith('.html')) {
                const characterData = await this.extractCharacterData(url);
                return this.loadCharacterWithTraits(characterData);
            } else {
                // Direct GLB file
                return this.loadDirectModel(url);
            }
        } catch (error) {
            console.error(`Error loading MML avatar from ${url}:`, error);
            throw error;
        }
    }

    /**
     * Extract character data from an MML or HTML file
     * @param url The URL to load the character data from
     * @returns Promise resolving to MMLCharacterData
     */
    private async extractCharacterData(url: string): Promise<MMLCharacterData> {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch MML file: ${response.status}`);
            }
            
            const text = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, "text/html");
            const character = doc.querySelector("m-character");

            if (!character) {
                throw new Error('No character element found in MML/HTML');
            }

            const bodySrc = character.getAttribute("src");
            if (!bodySrc) {
                throw new Error('No body source found in MML/HTML');
            }

            const traits = Array.from(character.querySelectorAll("m-model")).map(model => ({
                type: model.getAttribute("type") || '',
                src: model.getAttribute("src") || '',
            }));

            return { bodySrc, traits };
        } catch (error) {
            console.error('Error parsing MML/HTML:', error);
            throw error;
        }
    }

    /**
     * Load a character model with its traits
     * @param characterData The character data containing body and traits
     * @returns Promise resolving to a THREE.Group containing the character
     */
    private async loadCharacterWithTraits(characterData: MMLCharacterData): Promise<THREE.Group> {
        try {
            // Load body model with retry mechanism
            const bodyScene = await this.loadModelWithRetry(characterData.bodySrc);

            // Load trait models
            const traitScenes = await Promise.all(
                characterData.traits.map(async trait => {
                    try {
                        return await this.loadModelWithRetry(trait.src);
                    } catch (error) {
                        console.error(`Failed to load trait: ${trait.src}`, error);
                        return null;
                    }
                })
            );

            // Merge traits into body
            traitScenes.forEach(traitScene => {
                if (traitScene) {
                    bodyScene.add(traitScene);
                }
            });

            return bodyScene;
        } catch (error) {
            console.error('Error loading character with traits:', error);
            throw error;
        }
    }

    /**
     * Load a direct model from a URL
     * @param url The URL to load the model from
     * @returns Promise resolving to a THREE.Group containing the model
     */
    private async loadDirectModel(url: string): Promise<THREE.Group> {
        try {
            const gltf = await this.loadGLTF(url);
            const scene = SkeletonUtils.clone(gltf.scene);
            
            // Enable shadows for the entire scene
            scene.traverse((child) => {
                if ('isMesh' in child) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });

            return scene;
        } catch (error) {
            console.error(`Error loading direct model from ${url}:`, error);
            throw error;
        }
    }

    /**
     * Load a model with retry mechanism
     * @param url The URL to load the model from
     * @param retries Number of retries (default: 3)
     * @returns Promise resolving to a THREE.Group containing the model
     */
    private async loadModelWithRetry(url: string, retries = 3): Promise<THREE.Group> {
        try {
            const gltf = await this.loadGLTF(url);
            const scene = SkeletonUtils.clone(gltf.scene);
            
            // Enable shadows for the model
            scene.traverse((child) => {
                if ('isMesh' in child) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            
            return scene;
        } catch (error) {
            if (retries > 0) {
                console.warn(`Retry loading model from ${url}, attempts left: ${retries}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                return this.loadModelWithRetry(url, retries - 1);
            }
            throw error;
        }
    }

    /**
     * Load a GLTF model from a URL
     * @param url The URL to load the model from
     * @returns Promise resolving to the loaded GLTF
     */
    private loadGLTF(url: string): Promise<THREE.GLTF> {
        return new Promise((resolve, reject) => {
            this.loader.load(
                url,
                (gltf) => resolve(gltf),
                undefined,
                (error) => reject(error)
            );
        });
    }

    /**
     * Dispose of resources
     */
    public dispose(): void {
        this.dracoLoader.dispose();
    }
}
