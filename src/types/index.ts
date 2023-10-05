export interface List {
  id: string;
  name: string;
  items: ListItem[];
  archived: boolean;
  ownerId: string;
  /**
   * A timestamp
   */
  lastUpdated: number;
}

/**
 * Use when creating a List, where an `id` is not required
 */
export type NewList = Omit<List, "id">;

export interface ListItem {
  id: string;
  name: string;
  price: number;
  vendor: string;
  quantity: number;
  notes: string;
  checked: boolean;
}

export type ReadDataConfig = {
  APICallClosure: () => Promise<any>;
  localItemName: string;
};

export type ReplaceDataConfig = {
  APICallClosure: () => Promise<any>;
  payload: any;
};
