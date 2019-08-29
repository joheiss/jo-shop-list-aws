import { Handler, Context, Callback, APIGatewayProxyEvent, AuthResponseContext } from 'aws-lambda';
import { ShoppingListService } from './service';

interface Response {
    statusCode: number;
    headers?: { [key: string]: any };
    body?: any;
}

const service = new ShoppingListService();

// CORS headers - needed for Lambda Proxy
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': true,
};

// GET list of shopping lists
export const getAll: Handler = async (event: any): Promise<Response> => {
    const userId = getUserId(event);
    const orgs = await service.getAll(userId);
    return { statusCode: 200, headers, body: JSON.stringify(orgs) };
};

// GET a single shopping List
export const getById: Handler = async (event: any): Promise<Response> => {
    const userId = getUserId(event);
    const id = event.pathParameters.id;
    try {
        const found = await service.getById(userId, id);
        return { statusCode: 200, headers, body: JSON.stringify(found) };
    } catch (e) {
        return { statusCode: 404, headers, body: JSON.stringify({ message: e.message }) };
    }
};

// POST a single shopping list
export const create: Handler = async (event: any): Promise<Response> => {
    const userId = getUserId(event);
    const input = JSON.parse(event.body);
    input.userId = userId;
    try {
        const created = await service.create(input);
        return { statusCode: 201, headers, body: JSON.stringify(created) };
    } catch (e) {
        return { statusCode: 400, headers, body: JSON.stringify({ message: e.message }) };
    }
};

// PUT a single shopping list
export const update: Handler = async (event: any): Promise<Response> => {
    const userId = getUserId(event);
    const id = event.pathParameters.id;
    const input = JSON.parse(event.body);
    input.userId = userId;
    input.id = id;
    try {
        const updated = await service.update(input);
        return { statusCode: 200, headers, body: JSON.stringify(updated) };
    } catch (e) {
        return { statusCode: 400, headers, body: JSON.stringify({ message: e.message }) };
    }
};

// DELETE a single shopping list
export const remove: Handler = async (event: any): Promise<Response> => {
    const userId = getUserId(event);
    const id = event.pathParameters.id;
    try {
        const deleted = await service.delete(userId, id);
        return { statusCode: 200, headers, body: JSON.stringify(deleted) };
    } catch (e) {
        return { statusCode: 400, headers, body: JSON.stringify({ message: e.message }) };
    }
};

// GET cognito user
const getUserId = (event: APIGatewayProxyEvent): string => {
    const authorizer = event.requestContext.authorizer;
    if (!authorizer) {
        throw new Error('not_authorized');
    }
    return authorizer.claims.sub;
};
