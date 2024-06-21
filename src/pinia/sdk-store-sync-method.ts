import type { Doc, SubscribeListener } from "@bzr/bazaar";

export function createSubscribeListener<T extends Doc>(storeProperty: Doc[]): SubscribeListener<T> {
  const onAdd = (doc: Doc) => {
    if (storeProperty.some((r: Doc) => r.id === doc.id)) return;
    storeProperty.push(doc);
  };

  const handleChange = (doc: Doc) => {
    storeProperty.forEach((r: Doc, index: number) => {
      if (r.id === doc.id) {
        storeProperty[index] = doc;
      }
    });
  };

  const onDelete = (doc: Doc) => {
    for (let i = storeProperty.length - 1; i >= 0; i--) {
      if (storeProperty[i].id === doc.id) {
        storeProperty.splice(i, 1);
      }
    }
  };

  const onInitial = (doc: Doc) => {
    if (storeProperty.some((r: any) => r.id === doc.id)) {
      handleChange(doc);
    } else {
      onAdd(doc);
    }
  };

  return {
    onAdd,
    onChange: (oldDoc: Doc, newDoc: Doc) => {
      handleChange(newDoc);
    },
    onDelete,
    onInitial,
  };
}
