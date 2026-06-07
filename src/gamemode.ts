// gamemode.ts

import { CavernGame } from './engine';
import { Mission } from './mission';
import { Player } from './player';

export abstract class GameMode {
	protected game: CavernGame;

	constructor(inGame: CavernGame) {
		this.game = inGame;
	}

	public abstract handleKey(key: string);
}

export class TitleMode extends GameMode {
	public handleKey(key: string) {
        if (key === 'n') {
            this.game.setGameMode(new CharacterCreationMode(this.game));
            this.game.displayCharacterCreationScreen('');
        } else if (key === 'm') {
            this.game.setGameMode(new PlayingMode(this.game));
            this.game.currentMission = new Mission(this.game.player, this.game.monsterList, this.game.itemList); //ENVY

            this.game.drawGameScreen();
            this.game.drawStats(false);
        }
	}
}

export class CharacterCreationMode extends GameMode {
	private playerNameInput: string;
	private MAX_NAME_LENGTH: number = 80;

	constructor(inGame: CavernGame) {
		super(inGame);
		this.playerNameInput = '';
	}

	public handleKey(key: string) {
        // 1. If they hit Enter, save the name and start the mission!
        if (key === 'enter') {
            if (this.playerNameInput.trim().length === 0) {
                // Don't let them have a blank name
                this.playerNameInput = "Hero";
            }
            
            // Transfer the typed buffer directly to your state object
            this.game.player = new Player(this.playerNameInput);
            console.log(this.game.player);
            
            // Go back to Title screen
            this.game.setGameMode(new TitleMode(this.game));
            this.game.titlePage();
            return;
        }

        // 2. Handle Backspace to remove characters
        if (key === 'backspace') {
            this.playerNameInput = this.playerNameInput.slice(0, -1);

	        const dynamicPromptString = `> ${this.playerNameInput}_`;
            this.game.displayCharacterCreationScreen(dynamicPromptString); // Redraw screen to clear out deleted char
            return;
        }

        // 3. Catch actual readable characters (A-Z, numbers, spaces)
        // Checking key.length === 1 filters out actions like 'Shift' or 'ArrowUp'
        // TODO: implement max name length??
        if (key.length === 1) {
            this.playerNameInput += key;
            console.log("player name input now " + this.playerNameInput);
	        const dynamicPromptString = `> ${this.playerNameInput}_`;
            this.game.displayCharacterCreationScreen(dynamicPromptString); // Redraw with the new letter added
        } else {
            console.log("did not like " + key +   " " + this.playerNameInput + " " + this.MAX_NAME_LENGTH);
        }
	}
}

export class PlayingMode extends GameMode {
	public handleKey(key: string) {
        console.log("handlePlayerCommand " + key);

        switch(key) {
            // Movement keys mapping to your original layout
            case 'q': this.game.movePlayer(-1,  1); break;
            case 'w': this.game.movePlayer( 0,  1); break;
            case 'e': this.game.movePlayer( 1,  1); break;
            case 'a': this.game.movePlayer(-1,  0); break;
            case 'd': this.game.movePlayer( 1,  0); break;
            case 'z': this.game.movePlayer(-1, -1); break;
            case 'x': this.game.movePlayer( 0, -1); break;
            case 'c': this.game.movePlayer( 1, -1); break;
            
            // Action keys
            case 'b':
                this.game.doBow();
                break;
            case 's':
                 this.game.doSword();
                 break;
            case 'o':
                this.game.doOpenChest();
                break;
            case 'u': /* Use Item */; break;
            case 'h':
                this.game.displayHelp();
                break;
        }
        this.game.doMonsters();
        this.game.drawForestNearPlayer();
	}
}

export class MissionEndedMode extends GameMode {
	public handleKey(key: string) {
        if (key === 'enter') {
            this.game.setGameMode(new TitleMode(this.game));
            this.game.titlePage();
        }

        console.log(`game over ${key}`);
	}
}