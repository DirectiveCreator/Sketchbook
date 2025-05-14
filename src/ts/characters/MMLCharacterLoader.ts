import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { SkeletonUtils } from 'three-stdlib';

export class MMLCharacterLoader {
    private loader: GLTFLoader;

    constructor() {
        this.loader = new GLTFLoader();
    }

    private async extractCharacterUrl(url: string): Promise<{ bodySrc: string; traits: { type: string; src: string; }[] }> {
        if (url.endsWith('.html')) {
            try {
                const response = await fetch(url);
                const html = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const characterElement = doc.querySelector('m-character');
                if (!characterElement) throw new Error('No character element found in HTML');

                const bodySrc = characterElement.getAttribute('src');
                if (!bodySrc) throw new Error('No body source found in HTML');

                const traits = Array.from(characterElement.querySelectorAll('m-model')).map(model => ({
                    type: model.getAttribute('type') || '',
                    src: model.getAttribute('src') || '',
                }));

                return { bodySrc, traits };
            } catch (error) {
                console.error('Error parsing HTML MML:', error);
                throw error;
            }
        }
        return { bodySrc: url, traits: [] };
    }

    public async loadCharacter(url: string): Promise<THREE.Group> {
        try {
            let characterData: { bodySrc: string; traits: { type: string; src: string; }[] };

            if (url.endsWith('.html') || url.endsWith('.mml')) {
                characterData = await this.extractCharacterUrl(url);
            } else {
                const gltf = await this.loader.loadAsync(url);
                return SkeletonUtils.clone(gltf.scene);
            }

            // Load body model
            const bodyGltf = await this.loader.loadAsync(characterData.bodySrc);
            const bodyScene = SkeletonUtils.clone(bodyGltf.scene);

            // Load and merge trait models
            const traitScenes = await Promise.all(
                characterData.traits.map(async trait => {
                    try {
                        const traitGltf = await this.loader.loadAsync(trait.src);
                        return SkeletonUtils.clone(traitGltf.scene);
                    } catch (error) {
                        console.error(`Failed to load trait: ${trait.src}`, error);
                        return null;
                    }
                })
            );

            // Merge traits into body
            traitScenes.forEach(traitScene => {
                if (traitScene) {
                    traitScene.traverse(child => {
                        if ('material' in child) {
                            child.castShadow = true;
                            child.receiveShadow = true;
                        }
                    });
                    bodyScene.add(traitScene);
                }
            });

            return bodyScene;
        } catch (error) {
            console.error('Error loading character:', error);
            throw error;
        }
    }
}