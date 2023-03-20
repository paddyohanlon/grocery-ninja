import { RethinkID } from '@mostlytyped/rethinkid-js-sdk'

console.log('app ID', import.meta.env.VITE_APP_ID)

export const rid = new RethinkID({
  appId: import.meta.env.VITE_APP_ID,
  loginRedirectUri: 'http://127.0.0.1:5173',
  oAuthUri: 'http://localhost:4444',
  dataApiUri: 'http://localhost:4000',
  // onLogin: () => {
  //   console.log('onLogin callback fired in config!')
  // },
  onApiConnectError: (rid, message) => {
    console.log('onApiConnectError callback fired! Message:', message)
  },
})

export const LISTS_TABLE_NAME = 'lists'
export const ORDER_TABLE_NAME = 'orderC'

export const listsTable = rid.table(LISTS_TABLE_NAME)
export const orderTable = rid.table(ORDER_TABLE_NAME, {
  onCreate: async () => {
    rid.table(ORDER_TABLE_NAME).insert({ id: LISTS_TABLE_NAME, order: [] })
  },
})
