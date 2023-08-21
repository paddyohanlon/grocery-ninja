import { ref } from "vue";
// Pass `rid` as param
import { rid } from "@/rethinkid";
import type { PiniaPlugin } from "pinia";
import type { TableAPI } from "@rethinkid/rethinkid-js-sdk";

// Does not work after login because Pinia properties are already registered.
// A page refresh is needed, which rules out this approach

// TODO
// unsubscribe

type Changes = {
  new_val: null | object;
  old_val: null | object;
};

type ResourceOptions = {
  userId?: string;
  rowId?: string;
};

export const useRethinkIdPiniaPlugin = (storeId: string, tableNames: string[]): PiniaPlugin => {
  return ({ store }) => {
    if (store.$id !== storeId) return;

    const execute = () => {
      // Sync my resources
      try {
        for (const tableName of tableNames) {
          const resource = new Resource(store, tableName);
          resource.sync();
        }
      } catch (e) {
        console.log("Pinia plugin: Sync my resources error", e);
      }

      // Sync resources shared with me
      try {
        rid.sharing.listShared().then((sharedItems) => {
          for (const item of sharedItems) {
            const hostId = item.hostId;
            const tableName = item.permission?.tableName;
            const rowId = item.permission?.condition?.rowId;

            if (!hostId) continue;
            if (!tableName) continue;

            const sharedItem = new Resource(store, tableName, { userId: hostId, rowId });
            sharedItem.sync();
          }
        });
      } catch (e) {
        console.log("Pinia plugin: Sync resources shared with me error", e);
      }
    };

    // function pollExecute() {
    //   console.log("pollExecute");
    //   rid.tables
    //     .list()
    //     .then(() => {
    //       console.log("Plugin: Could list tables, we're connected. Execute!");
    //       execute();
    //     })
    //     .catch((e) => {
    //       console.log("Plugin: sync poll list tables error, re-try in a bit", e.message);
    //       setTimeout(() => {
    //         console.log("Plugin: retry");
    //         pollExecute();
    //       }, 300);
    //     });
    // }
    // pollExecute();

    execute();
  };
};

class Resource {
  private _tableName: string;
  private _rowId: string;
  private _userId: string;
  private _table: TableAPI;
  private _store: any;

  constructor(store: any, tableName: string, { userId = "", rowId = "" }: ResourceOptions = {}) {
    this._store = store;
    this._tableName = tableName;
    this._table = rid.table(tableName, { userId });
    this._userId = userId;
    this._rowId = rowId;
  }

  sync() {
    this._addStoreProperty();
    this._addRowsToProperty();
    this._subscribe();
  }

  private _addStoreProperty() {
    if (!this._store[this._tableName]) {
      this._store[this._tableName] = ref([]);

      // Add property to dev tools
      if (process.env.NODE_ENV === "development") {
        this._store._customProperties.add(this._tableName);
      }
    }
  }

  private _addRowsToProperty() {
    this._table.read({ rowId: this._rowId }).then((rowOrRows: object | object[]) => {
      const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
      for (const row of rows) {
        if (!row) continue;

        if (this._store[this._tableName].some((r: any) => r.id === row.id)) {
          this._updateRow(row);
        } else {
          this._addRow(row);
        }
      }
    });
  }

  private _addHostToRow(row: any) {
    row._hostId = this._userId;
  }

  private _addRow(row: any) {
    if (this._store[this._tableName].some((r: any) => r.id === row.id)) return;
    this._addHostToRow(row);
    this._store[this._tableName].push(row);
  }

  private _updateRow(row: any) {
    this._store[this._tableName] = this._store[this._tableName].map((r: any) => {
      if (r.id === row.id) {
        this._addHostToRow(row);
        return row;
      }
      return r;
    });
  }

  private _deleteRow(row: any) {
    this._store[this._tableName] = this._store[this._tableName].filter((r: any) => r.id !== row.id);
  }

  // maybe can add Pinia method that does subscribe
  // try just subscribe first, then do method
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
