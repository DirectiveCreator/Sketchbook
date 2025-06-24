import { ISpawnPoint } from '../interfaces/ISpawnPoint';
import * as THREE from 'three';
import { World } from './World';
import { Character } from '../characters/Character';
import { LoadingManager } from '../core/LoadingManager';
import * as Utils from '../core/FunctionLibrary';

export class CharacterSpawnPoint implements ISpawnPoint
{
	private object: THREE.Object3D;

	constructor(object: THREE.Object3D)
	{
		this.object = object;
	}
	
	public spawn(loadingManager: LoadingManager, world: World): void
	{
		/**
		 * Spawn a character. If an `mmlUrl` is provided the character will
		 * replace its default visuals with the MML avatar once initialised.
		 *
		 * NOTE: The underlying Character class already supports an optional
		 * `mmlUrl` parameter, so we simply forward it.
		 */
		// Overload-compatible signature – the extra argument is optional
		// so existing call-sites (two arguments) remain valid.
		// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
		// @ts-ignore – interface may not yet include the optional argument.
		const _spawn = (mmlUrl?: string): void =>
		{
			loadingManager.loadGLTF('build/assets/boxman.glb', (model) =>
			{
				const player = new Character(model, mmlUrl);
			
				const worldPos = new THREE.Vector3();
				this.object.getWorldPosition(worldPos);
				player.setPosition(worldPos.x, worldPos.y, worldPos.z);
			
				const forward = Utils.getForward(this.object);
				player.setOrientation(forward, true);
			
				world.add(player);
				player.takeControl();
			});
		};

		// The actual invocation; third argument may be passed by callers.
		return _spawn(arguments[2] as string | undefined);
	}
}
