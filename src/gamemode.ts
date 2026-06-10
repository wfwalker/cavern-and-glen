// gamemode.ts

import { CavernGame } from './engine';
import { Mission } from './mission';
import { Player } from './player';

export abstract class GameMode {
	protected game: CavernGame;

	constructor(inGame: CavernGame) {
		this.game = inGame;
	}

	public abstract handleKey(key: string): void;
}

export class TitleMode extends GameMode {
	public handleKey(key: string) {
        switch (key) {
            case 'n':
                this.game.setGameMode(new CharacterCreationMode(this.game));
                this.game.displayCharacterCreationScreen('');
                break;
            case 'm':
                if (this.game.readyForMission()) {
                    this.game.setGameMode(new PlayingMode(this.game));
                    this.game.currentMission = new Mission(this.game.player, this.game.monsterList, this.game.itemList); //ENVY

                    this.game.drawGameScreen();
                    this.game.drawStats(false);
                }
                break;
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
        if (key === 'Enter') {
            if (this.playerNameInput.trim().length === 0) {
                // Don't let them have a blank name
                this.playerNameInput = "Hero";
            }
            
            // Transfer the typed buffer directly to your state object
            this.game.player = new Player(this.playerNameInput);
            console.log(this.game.player);
            
            // Go back to Title screen
            this.game.setGameMode(new TitleMode(this.game));
            this.game.drawTitlePage();
            return;
        }

        // 2. Handle Backspace to remove characters
        if (key === 'Backspace') {
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
                if (this.game.player.arrows <= 0) {
                    this.game.drawCommandWindowMessage("You don't have any arrows!");
                } else {
                    this.game.drawCommandWindowMessage("Bow direction?");
                    this.game.setGameMode(new BowMode(this.game));
                }
                break;
            case 's':
                this.game.drawCommandWindowMessage("Sword direction?");
                this.game.setGameMode(new SwordMode(this.game));
                break;
            case 'o':
                this.game.doOpenChest();
                break;
            case 'u':
                this.game.setGameMode(new UseItemMode(this.game));
                break;
            case 'C':
                if (this.game.playerInCastle()) {
                    this.game.setGameMode(new CastleMode(this.game));
                    this.game.drawCommandWindowMessage('Welcome to the Magic Castle');
                    this.game.drawCommandWindowMessage('a to buy an arrow, m to end your mission, q to return to game');
                } else {
                    this.game.drawCommandWindowMessage('Sorry, you are not in a castle');
                }
                break;
            case 'h':
                this.game.displayHelp();
                break;
        }
        this.game.doMonsters();
        this.game.drawForestNearPlayer();
	}
}

export class UseItemMode extends GameMode {
    public handleKey(key: string): void {
        const playerItems = this.game.player.items;
        const playerItemCount = playerItems.length;

        if (key.trim() !== '' && !isNaN(Number(key)) && isFinite(Number(key))) {
            const index = Number(key);
            if (index < playerItemCount) {
                this.game.doUseItem(playerItems[index]);
                this.game.setGameMode(new PlayingMode(this.game));
                this.game.drawItems();
                return;
            }
        }

        this.game.drawCommandWindowMessage("Please type a valid item index");
    }
}

export class SwordMode extends GameMode {
    public handleKey(key: string): void {
        switch (key) {
            // Movement keys mapping to your original layout
            case 'q': this.game.doSword(-1,  1); this.game.setGameMode(new PlayingMode(this.game)); break;
            case 'w': this.game.doSword( 0,  1); this.game.setGameMode(new PlayingMode(this.game)); break;
            case 'e': this.game.doSword( 1,  1); this.game.setGameMode(new PlayingMode(this.game)); break;
            case 'a': this.game.doSword(-1,  0); this.game.setGameMode(new PlayingMode(this.game)); break;
            case 'd': this.game.doSword( 1,  0); this.game.setGameMode(new PlayingMode(this.game)); break;
            case 'z': this.game.doSword(-1, -1); this.game.setGameMode(new PlayingMode(this.game)); break;
            case 'x': this.game.doSword( 0, -1); this.game.setGameMode(new PlayingMode(this.game)); break;
            case 'c': this.game.doSword( 1, -1); this.game.setGameMode(new PlayingMode(this.game)); break;
            default: this.game.drawCommandWindowMessage("Invalid direction key");
        }      
    }
}

export class BowMode extends GameMode {
    public handleKey(key: string): void {
        switch (key) {
            // Movement keys mapping to your original layout
            case 'q': this.game.doBow(-1,  1); this.game.setGameMode(new PlayingMode(this.game)); break;
            case 'w': this.game.doBow( 0,  1); this.game.setGameMode(new PlayingMode(this.game)); break;
            case 'e': this.game.doBow( 1,  1); this.game.setGameMode(new PlayingMode(this.game)); break;
            case 'a': this.game.doBow(-1,  0); this.game.setGameMode(new PlayingMode(this.game)); break;
            case 'd': this.game.doBow( 1,  0); this.game.setGameMode(new PlayingMode(this.game)); break;
            case 'z': this.game.doBow(-1, -1); this.game.setGameMode(new PlayingMode(this.game)); break;
            case 'x': this.game.doBow( 0, -1); this.game.setGameMode(new PlayingMode(this.game)); break;
            case 'c': this.game.doBow( 1, -1); this.game.setGameMode(new PlayingMode(this.game)); break;
            default: this.game.drawCommandWindowMessage("Invalid direction key");
        }      
    }
}


export class CastleMode extends GameMode {
    public handleKey(key: string): void {
        console.log(`handle Castle command ${key}`);
        switch(key) {
            case 'a':
                if (this.game.player.buyArrows(1)) {
                    this.game.drawCommandWindowMessage("You bought an arrow");
                    this.game.drawStats(false);
                }
                break;
            case 'm':
                if (this.game.currentMission.missionCompleted()) {
                    this.game.drawCommandWindowMessage("You have completed your mission, congratulations!");
                    this.game.setGameMode(new MissionEndedMode(this.game));
                }
                break;
            case 'q':
                this.game.drawCommandWindowMessage("Back to game");
                this.game.setGameMode(new PlayingMode(this.game));
        }
    }
}

export class MissionEndedMode extends GameMode {
	public handleKey(key: string) {
        if (key === 'Enter') {
            this.game.setGameMode(new TitleMode(this.game));
            this.game.drawTitlePage();
        }

        console.log(`game over ${key}`);
	}
}