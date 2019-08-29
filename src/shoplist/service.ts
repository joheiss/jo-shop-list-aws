import { ShoppingListDTO } from './shopping-list.dto';
import { DynamoDB } from 'aws-sdk';
import { v4 as uuid } from 'uuid';

export class ShoppingListService {
    private dynamoDb = new DynamoDB.DocumentClient();
    private readonly tableName = process.env.SHOPLIST_TABLE || '***UNKNOWN***';
    private readonly LIST_QUOTA = process.env.SHOPLIST_LIST_QUOTA || 50;
    private readonly ITEM_QUOTA = process.env.SHOPLIST_ITEM_QUOTA || 1000;
    private itemCount = -1;

    async getAll(userId: string): Promise<ShoppingListDTO[]> {
        const params: DynamoDB.DocumentClient.QueryInput = {
            TableName: this.tableName,
            KeyConditionExpression: 'userId = :userId',
            ExpressionAttributeValues: {
                ':userId': userId,
            },
        };
        return this.dynamoDb
            .query(params)
            .promise()
            .then(data => {
                this.itemCount = data.Items ? data.Items.length : 0;
                return data.Items ? data.Items : [];
            })
            .then(items =>
                items.map(item => {
                    delete item.userId;
                    return item as ShoppingListDTO;
                })
            );
    }

    async getById(userId: string | undefined, id: string): Promise<ShoppingListDTO> {
        if (!userId) {
            throw new Error(`user_id_is_missing: ${id}`);
        }
        const params: DynamoDB.DocumentClient.GetItemInput = {
            TableName: this.tableName,
            Key: { userId, id },
        };
        const found = await this.dynamoDb
            .get(params)
            .promise()
            .then(data => {
                data.Item && delete data.Item.userId;
                return data.Item as ShoppingListDTO;
            });
        if (!found) {
            throw new Error(`list_not_found: ${userId}/${id}`);
        }
        return Promise.resolve(found);
    }

    async create(input: ShoppingListDTO): Promise<ShoppingListDTO> {
        // check quotas
        await this.checkQuotas(input.userId);
        // generate an id
        input.id = uuid();
        // check if shopping list can be created
        await this.validateCreate(input);
        // insert into database
        const params: DynamoDB.DocumentClient.PutItemInput = {
            TableName: this.tableName,
            Item: input,
            ReturnValues: 'NONE',
        };
        return this.dynamoDb
            .put(params)
            .promise()
            .then(data => data.Attributes)
            .then(attributes => {
                delete input.userId;
                return input as ShoppingListDTO;
            });
    }

    async update(input: ShoppingListDTO): Promise<ShoppingListDTO> {
        // check if shopping list can be updated
        await this.validateUpdate(input);
        const { userId, id } = input;
        // update on database
        const params: DynamoDB.DocumentClient.PutItemInput = {
            TableName: this.tableName,
            Item: input,
            ReturnValues: 'NONE',
        };
        return this.dynamoDb
            .put(params)
            .promise()
            .then(data => data.Attributes)
            .then(attributes => {
                delete input.userId;
                return input as ShoppingListDTO;
            });
    }

    async delete(userId: string, id: string): Promise<ShoppingListDTO> {
        await this.validateDelete(userId, id);
        // delete on database
        const params: DynamoDB.DocumentClient.DeleteItemInput = {
            TableName: this.tableName,
            Key: { userId, id },
            ReturnValues: 'NONE',
        };
        return this.dynamoDb
            .delete(params)
            .promise()
            .then(data => data.Attributes)
            .then(attributes => ({ id } as ShoppingListDTO));
    }

    private buildExpressionAttributeValues(input: {
        [key: string]: any;
    }): DynamoDB.DocumentClient.ExpressionAttributeValueMap {
        let map: DynamoDB.DocumentClient.ExpressionAttributeValueMap = {};
        for (let prop in input) {
            if (prop !== 'userId' && prop !== 'id') {
                map[`:${prop}`] = input[prop];
            }
        }
        return map;
    }

    private buildUpdateExpression(input: { [key: string]: any }): string {
        let updateExpression: string = 'set ';
        for (let prop in input) {
            if (prop !== 'userId' && prop !== 'id') {
                updateExpression = updateExpression.concat(`${prop} = :${prop}, `);
            }
        }
        return updateExpression.substring(0, updateExpression.length - 2);
    }

    private async checkQuotas(userId?: string): Promise<void> {
        if (this.itemCount >= this.LIST_QUOTA) {
            throw new Error(`too_many_lists: ${this.itemCount}`);
        }
    }

    private async validate(input: ShoppingListDTO): Promise<void> {
        if (input.items && input.items.length > this.ITEM_QUOTA) {
            throw new Error(`too_many_items: ${input.items.length}`);
        }
        return Promise.resolve();
    }

    private async validateCreate(input: ShoppingListDTO): Promise<void> {
        const { userId, id, issuedAt, title, items } = input;
        if (!id) {
            throw new Error(`id_is_missing: ${id} `);
        }
        // check if shopping list already exists
        let found;
        try {
            found = await this.getById(userId, id);
        } catch (e) {}
        if (found) {
            throw new Error(`shoplist_already_exists: ${id}`);
        }
        // perform general checks
        await this.validate(input);
        return Promise.resolve();
    }

    private async validateDelete(userId: string, id: string): Promise<void> {
        const found = await this.getById(userId, id);
        return Promise.resolve();
    }

    private async validateUpdate(input: ShoppingListDTO): Promise<void> {
        const { userId, id, issuedAt, title, items } = input;
        if (!id) {
            throw new Error(`id_is_missing: ${id} `);
        }
        if (title !== undefined && title.length < 3) {
            throw new Error(`title_is_too_short: ${title} `);
        }
        // check if shopping list exists
        const found = await this.getById(userId, id);
        // perform general checks
        await this.validate(input);
        return Promise.resolve();
    }
}
