import { defineStore } from 'pinia'
import type { List, NewList, ListItem, OrderTableDoc } from '@/types'
import { listsTable, orderTable, LISTS_TABLE_NAME } from '@/rethinkid'
import { v4 as uuidv4 } from 'uuid'

export const useListsStore = defineStore('lists', {
  state: () => ({
    lists: null as List[] | null,
    listsOrder: [] as string[], // list IDs
  }),
  actions: {
    async fetchLists(): Promise<void> {
      let lists = [] as List[]
      try {
        lists = (await listsTable.read()) as List[]
      } catch (e) {
        console.log('read lists error', e)
      }

      console.log('read lists', lists)

      if (lists.length === 0) {
        console.log('create default list')
        // Create default list
        await this.createList('Groceries')
        return
      }

      let listsOrderDoc = null
      try {
        listsOrderDoc = (await orderTable.read({ rowId: LISTS_TABLE_NAME })) as OrderTableDoc
      } catch (e) {
        console.log('error reading order', e)
      }

      if (!listsOrderDoc) {
        console.log('order null, return')
        return
      }

      this.listsOrder = listsOrderDoc.order

      const orderedLists = this.listsOrder.map((id) =>
        lists.find((list) => list.id === id),
      ) as List[]

      this.lists = orderedLists
    },
    getPrimaryListId(): string | null {
      if (!this.lists) return null

      const primaryList = this.lists.find((list) => list.isPrimary)

      if (!primaryList) return null

      return primaryList.id
    },
    async createList(name: string): Promise<string> {
      const newList: NewList = {
        name,
        items: [],
        archived: false,
        isPrimary: !this.lists || (this.lists && this.lists.length === 0),
      }

      const id = await listsTable.insert(newList)

      this.listsOrder.push(id)
      const orderDoc: OrderTableDoc = { id: LISTS_TABLE_NAME, order: this.listsOrder }
      await orderTable.update(orderDoc)

      const list: List = {
        id,
        ...newList,
      }

      if (!this.lists) this.lists = []

      this.lists.push(list)

      return id
    },
    async updateList(listId: string, updatedList: List): Promise<void> {
      if (!this.lists) return

      await listsTable.update(updatedList)

      this.lists = this.lists.map((list) => {
        if (list.id === updatedList.id) {
          return updatedList
        }
        return list
      })
    },
    deleteList({ id, isPrimary }: List): void {
      if (!this.lists) return

      listsTable.delete({ rowId: id })

      this.lists = this.lists.filter((list) => {
        return list.id !== id
      })

      listsTable.delete({ rowId: id })

      const index = this.listsOrder.indexOf(id)
      if (index > -1) {
        this.listsOrder.splice(index, 1)
      }
      const orderDoc: OrderTableDoc = { id: LISTS_TABLE_NAME, order: this.listsOrder }
      orderTable.update(orderDoc)

      console.log('isPrimary', isPrimary)

      // Set a new primary list
      if (isPrimary) {
        this.makeListPrimary(this.listsOrder[0])
      }
    },
    makeListPrimary(newPrimaryListId: string): void {
      if (!this.lists) return

      this.lists = this.lists.map((list) => {
        list.isPrimary = list.id === newPrimaryListId
        return list
      })

      for (const list of this.lists) {
        listsTable.update(list)
      }
    },
    addItem(listId: string, itemName: string): void {
      const list = this.getList(listId)

      if (!list) return

      const newItem: ListItem = {
        id: uuidv4(),
        name: itemName,
        price: 0,
        vendor: '',
        quantity: 0,
        notes: '',
        checked: false,
      }

      list.items.push(newItem)

      listsTable.update(list)
    },
    updateItem(listId: string, updatedItem: ListItem) {
      const list = this.getList(listId)

      if (!list) return

      list.items = list.items.map((item) => {
        if (item.id === updatedItem.id) {
          return updatedItem
        }
        return item
      })

      listsTable.update(list)
    },
    deleteItem(listId: string, itemId: string) {
      const list = this.getList(listId)

      if (!list) return

      list.items = list.items.filter((item) => item.id !== itemId)

      listsTable.replace(list)
    },
  },
  getters: {
    getList: (state): ((listId: string) => List | null) => {
      return (listId: string) => {
        if (!state.lists) return null

        const list = state.lists.find((list) => list.id === listId)

        if (!list) {
          console.log('List not found.')
          return null
        }

        return list
      }
    },
    getItem: (state): ((listId: string, itemId: string) => ListItem | null) => {
      return (listId: string, itemId: string) => {
        // @ts-ignore - getter does exist
        const list = state.getList(listId) as List | null

        if (!list) return null

        const item = list.items.find((item) => item.id === itemId)

        if (!item) {
          console.log('Item not found.')
          return null
        }

        return item
      }
    },
    getCheckedItems: (state): ((listId: string) => ListItem[]) => {
      return (listId: string) => {
        // @ts-ignore - getter does exist
        const list = state.getList(listId) as List | null

        if (!list) return []

        const items = list.items.filter((item) => item.checked)

        items.reverse()

        return items
      }
    },
    getUncheckedItems: (state): ((listId: string) => ListItem[]) => {
      return (listId: string) => {
        // @ts-ignore - getter does exist
        const list = state.getList(listId) as List | null

        if (!list) return []

        const items = list.items.filter((item) => !item.checked)

        items.reverse()

        return items
      }
    },
  },
})
