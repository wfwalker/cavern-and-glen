Typescript port of original CAVERN.PAS game "Cavern and Glen"

* Turbo Pascal version complete by Feb 1985, then version 1.64 in Octboer 1985
* Final Turbo Pascal revisions in January 1988 for compatibility with Turbo Pascal 4.0


Parity with 1985:
* [X] implement bow and arrow attacks
* [X] load data file for swords and magic items
* [ ] swords with different strengths, wear and breakage
* [X] classic monster movement
* [X] monster attacks and damage to player
* [X] castle -- buy arrows, exit when mission is done
* [ ] some way to load and save characters
* [ ] implement magic items -- split out the player item collection into three subfolders?
* [X] invert stats display (low points?)
* [X] make sword and bow into subclasses of GameMode along with Use Item mode
* [X] only show save character and new mission on title screen if character is not dead

Infrastructure:
* [ ] better unit tests
* [ ] more smaller files
* [ ] better separation of concerns
* [ ] replace switch statements on Sector type with Use an Object Lookup Map that holds functions

Fun extras:
* [ ] CSS for making 1980's beige monochrome monitor bezel
* [ ] old floppy disk sounds when game starts?
* [ ] write up a timeline of Swords and Sorcery on PLATO
* [ ] can we have one engine drive the 1980's IBM PC game and the orange on black PLATO-themed game?
* [ ] how to make mobile version?

For further reading:

* https://crpgadventures.blogspot.com/2019/07/game-31-swords-and-sorcery-1978.html
* https://www.youtube.com/watch?v=FaG3Qlesr-k
* https://crpgaddict.blogspot.com/2019/02/game-318-swords-and-sorcery-1978.html
* https://howtomakeanrpg.com/r/l/g/swords-and-sorcery.html
* https://www.retrogamestrove.com/game-7-swords-sorcery/
