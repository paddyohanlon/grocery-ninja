import { ref } from "vue";
import { rid } from "@/rethinkid";
import type { PiniaPlugin } from "pinia";
import type { TableAPI } from "@rethinkid/rethinkid-js-sdk";

// TODO
// unsubscribe
// types

type Changes = {
  new_val: null | object;
  old_val: null | object;
};

export const useRethinkIdPiniaPlugin: PiniaPlugin = ({ store }) => {
  try {
    rid.sharing.listShared().then((sharedItems) => {
      for (const item of sharedItems) {
        const hostId = item.hostId;
        const tableName = item.permission?.tableName;
        const rowId = item.permission?.condition?.rowId;

        if (!hostId) continue;
        if (!tableName) continue;

        // Pass `item`
        const sharedItem = new SharedItem(store, tableName, hostId, rowId);
        sharedItem.sync();
      }
    });
  } catch (e) {
    console.log("Pinia plugin fetchSharedLists error", e);
  }
};

class SharedItem {
  private _sharedTableName: string;
  private _rowId: string;
  private _hostId: string;
  private _hostTable: TableAPI;
  private _store: any;

  constructor(store: any, tableName: string, hostId: string, rowId = "") {
    this._rowId = rowId;
    this._sharedTableName = `${tableName}Shared`;
    this._hostId = hostId;
    this._hostTable = rid.table(tableName, { userId: hostId });
    this._store = store;
  }

  sync() {
    this._addStoreProperty();
    this._addRowsToProperty();
    this._subscribe();
  }

  _addStoreProperty() {
    if (!this._store[this._sharedTableName]) {
      this._store[this._sharedTableName] = ref([]);

      // Add property to dev tools
      if (process.env.NODE_ENV === "development") {
        this._store._customProperties.add(this._sharedTableName);

        // Adding types would be useful, but not sure if possible.
      }
    }
  }

  _addRowsToProperty() {
    this._hostTable.read({ rowId: this._rowId }).then((rowOrRows: object | object[]) => {
      const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
      for (const row of rows) {
        if (!row) continue;

        if (this._store[this._sharedTableName].some((r: any) => r.id === row.id)) {
          this._updateRow(row);
        } else {
          this._addRow(row);
        }
      }
    });
  }

  _addHostToRow(row: any) {
    row._hostId = this._hostId;
  }

  _addRow(row: any) {
    this._addHostToRow(row);
    this._store[this._sharedTableName].push(row);
  }

  _updateRow(row: any) {
    this._store[this._sharedTableName] = this._store[this._sharedTableName].map((r: any) => {
      if (r.id === row.id) {
        this._addHostToRow(row);
        return row;
      }
      return r;
    });
  }

  _deleteRow(row: any) {
    this._store[this._sharedTableName] = this._store[this._sharedTableName].filter((r: any) => r.id !== row.id);
  }

  _subscribe() {
    this._hostTable.subscribe({ rowId: this._rowId }, (changes) => {
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
