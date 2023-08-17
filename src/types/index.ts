export interface List {
  id: string;
  name: string;
  items: ListItem[];
  archived: boolean;
  userIDsWithAccess: string[];
  needsSync?: boolean;
  _hostId?: string; // added by Pinia plugin to rows shared with me
}

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

export interface OrderTableDoc {
  id: string; // table name
  order: string[]; // doc IDs
}

export type ReadDataConfig = {
  APICallClosure: () => Promise<any>;
  localItemName: string;
};

export type ReplaceDataConfig = {
  APICallClosure: () => Promise<any>;
  payload: any;
};
