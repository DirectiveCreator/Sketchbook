// Update the readCharacterData method in the Character class
public readCharacterData(gltf: any): void {
    // Check if this is an MML character
    const isMMLCharacter = gltf.scene.userData?.isMMLCharacter;

    gltf.scene.traverse((child) => {
        if (child.isMesh) {
            Utils.setupMeshProperties(child);

            if (child.material !== undefined) {
                this.materials.push(child.material);
            }
        }
    });

    // Handle MML-specific setup if needed
    if (isMMLCharacter) {
        // Any MML-specific character setup can go here
        console.log('MML character loaded');
    }
}