import { Item, buildItemListFromJSON } from './item';
import { Monster } from './engine';

export class AssetRepository {
    public async loadAll(): Promise<{ monsterList: Monster[], itemList: Item[] }> {
        const monstersResponse = await fetch('./monsters.json');
        const monstersJson = await monstersResponse.json();

        const itemsResponse = await fetch('./items.json');
        const itemsJson = await itemsResponse.json();

        return {
            monsterList: monstersJson.monsterList,
            itemList: buildItemListFromJSON(itemsJson.itemList)
        };
    }
}
