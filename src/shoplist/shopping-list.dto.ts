export interface ShoppingListDTO {
    userId?: string;
    id?: string;
    issuedAt?: string;
    title?: string;
    items?: ShoppingItemDTO[];
}

export interface ShoppingItemDTO {
    id: number;
    description: string;
    quantity?: string;
    category?: string;
    isDone?: boolean;
}
