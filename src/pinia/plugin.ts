import { ref } from "vue";
import { rid } from "@/rethinkid";
import type { PiniaPlugin } from "pinia";
import type { TableAPI } from "@rethinkid/rethinkid-js-sdk";

// TODO
// unsubscribe
// types

type ObjectWithOptionalId = { id?: string };

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
  private _hostTable: TableAPI;
  private _store: any;

  constructor(store: any, tableName: string, hostId: string, rowId = "") {
    this._rowId = rowId;
    this._sharedTableName = `${tableName}Shared`;
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

        // Update, else add
        if (this._store[this._sharedTableName].some((item: ObjectWithOptionalId) => item.id === row.id)) {
          this._store[this._sharedTableName] = this._store[this._sharedTableName].map((item: ObjectWithOptionalId) => {
            if (item.id === row.id) return row;
            return item;
          });
        } else {
          this._store[this._sharedTableName].push(row);
        }
      }
    });
  }

  _subscribe() {
    this._hostTable.subscribe({ rowId: this._rowId }, (changes) => {
      const isUpdated = (changes: Changes) => changes.new_val && changes.old_val;
      const isDeleted = (changes: Changes) => changes.new_val === null && changes.old_val;

      // TODO Added

      if (isUpdated(changes)) {
        console.log("updated", changes);
        const changedItem = changes.new_val as ObjectWithOptionalId;
        if (!changedItem.id) return;
        if (!this._store[this._sharedTableName]) return;
        this._store[this._sharedTableName] = this._store[this._sharedTableName].map((item: ObjectWithOptionalId) => {
          if (item.id === changedItem.id) return changedItem;
          return item;
        });
      }
      if (isDeleted(changes)) {
        console.log("deleted", changes);
        const changedItem = changes.old_val as ObjectWithOptionalId;
        if (!this._store[this._sharedTableName]) return;
        this._store[this._sharedTableName] = this._store[this._sharedTableName].filter(
          (item: ObjectWithOptionalId) => item.id !== changedItem.id,
        );
      }
    });
  }
}
