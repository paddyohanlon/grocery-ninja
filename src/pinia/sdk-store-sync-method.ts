import type { TableAPI } from "@rethinkid/rethinkid-js-sdk";

// TODO
// unsubscribe (could return the unsubscribe function from sync())

type Changes = {
  new_val: null | object;
  old_val: null | object;
};

type ResourceOptions = {
  userId?: string;
  rowId?: string;
};

export class Resource {
  private _storeProperty: any[];
  private _table: TableAPI;
  private _userId: string;
  private _rowId: string;

  constructor(storeProperty: any[], table: TableAPI, { userId = "", rowId = "" }: ResourceOptions = {}) {
    this._storeProperty = storeProperty;
    this._table = table;
    this._userId = userId;
    this._rowId = rowId;
  }

  async sync() {
    await this._addRowsToProperty();
    this._subscribe();
  }

  private async _addRowsToProperty() {
    const rowOrRows: object | object[] = await this._table.read({ rowId: this._rowId });
    const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
    for (const row of rows) {
      if (!row) continue;

      if (this._storeProperty.some((r: any) => r.id === row.id)) {
        this._updateRow(row);
      } else {
        this._addRow(row);
      }
    }
  }

  private _addHostToRow(row: any) {
    if (!this._userId) return;
    row._hostId = this._userId;
  }

  private _addRow(row: any) {
    if (this._storeProperty.some((r: any) => r.id === row.id)) return;
    this._addHostToRow(row);
    this._storeProperty.push(row);
  }

  private _updateRow(row: any) {
    this._storeProperty.forEach((r: any, index: number) => {
      if (r.id === row.id) {
        this._addHostToRow(row);
        this._storeProperty[index] = row;
      }
    });
  }

  private _deleteRow(row: any) {
    for (let i = this._storeProperty.length - 1; i >= 0; i--) {
      if (this._storeProperty[i].id === row.id) {
        this._storeProperty.splice(i, 1);
      }
    }
  }

  private _subscribe() {
    this._table.subscribe({ rowId: this._rowId }, (changes) => {
      const isAdded = (changes: Changes) => changes.new_val && changes.old_val === null;
      const isUpdated = (changes: Changes) => changes.new_val && changes.old_val;
      const isDeleted = (changes: Changes) => changes.new_val === null && changes.old_val;

      if (isAdded(changes)) {
        console.log("added", changes);
        this._addRow(changes.new_val);
      } else if (isUpdated(changes)) {
        console.log("updated", changes);
        this._updateRow(changes.new_val);
      } else if (isDeleted(changes)) {
        console.log("deleted", changes);
        this._deleteRow(changes.old_val);
      }
    });
  }
}
