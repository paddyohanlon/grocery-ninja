import type { CollectionAPI } from "@rethinkid/rethinkid-js-sdk";

// TODO
// unsubscribe (could return the unsubscribe function from sync())
// Make module
// Move to SDK, publish test and all that.

type Changes = {
  new_val: null | object;
  old_val: null | object;
};

type ResourceOptions = {
  docId?: string;
};

export async function mirror(storeProperty: any[], table: CollectionAPI, { docId = "" }: ResourceOptions = {}) {
  const resource = new Resource(storeProperty, table, { docId });
  resource.mirror();
}

class Resource {
  private _storeProperty: any[];
  private _collection: CollectionAPI;
  private _docId: string;

  constructor(storeProperty: any[], table: CollectionAPI, { docId = "" }: ResourceOptions = {}) {
    this._storeProperty = storeProperty;
    this._collection = table;
    this._docId = docId;
  }

  async mirror() {
    await this._addDocsToProperty();
    this._subscribe();
  }

  private async _addDocsToProperty() {
    interface Doc {
      id: string;
    }
    let docs: Doc[] = [];

    if (this._docId) {
      const doc = (await this._collection.getOne(this._docId)) as Doc;
      docs = [doc];
    } else {
      docs = await this._collection.getAll();
    }

    for (const doc of docs) {
      if (!doc) continue;

      if (this._storeProperty.some((r: any) => r.id === doc.id)) {
        this._updateDoc(doc);
      } else {
        this._addDoc(doc);
      }
    }
  }

  private _addDoc(doc: any) {
    if (this._storeProperty.some((r: any) => r.id === doc.id)) return;
    this._storeProperty.push(doc);
  }

  private _updateDoc(doc: any) {
    this._storeProperty.forEach((r: any, index: number) => {
      if (r.id === doc.id) {
        this._storeProperty[index] = doc;
      }
    });
  }

  private _deleteDoc(doc: any) {
    for (let i = this._storeProperty.length - 1; i >= 0; i--) {
      if (this._storeProperty[i].id === doc.id) {
        this._storeProperty.splice(i, 1);
      }
    }
  }

  private _subscribe() {
    const listener = (changes: Changes) => {
      const isAdded = (changes: Changes) => changes.new_val && changes.old_val === null;
      const isUpdated = (changes: Changes) => changes.new_val && changes.old_val;
      const isDeleted = (changes: Changes) => changes.new_val === null && changes.old_val;

      if (isAdded(changes)) {
        console.log("Mirror added", changes);
        this._addDoc(changes.new_val);
      } else if (isUpdated(changes)) {
        console.log("Mirror updated", changes);
        this._updateDoc(changes.new_val);
      } else if (isDeleted(changes)) {
        console.log("Mirror deleted", changes);
        this._deleteDoc(changes.old_val);
      }
    };

    if (this._docId) {
      this._collection.subscribeOne(this._docId, listener);
    } else {
      this._collection.subscribeAll({}, listener);
    }
  }
}
