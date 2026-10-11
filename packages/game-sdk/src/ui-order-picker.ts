// `@partybox/game-sdk/ui/order-picker` — tap-to-order (foundation §6, Hive Rank). A pack component
// gets its own subpath (FOUNDATION-AUDIT #23): the `ui` barrel lands in the app's entry chunk, so
// anything exported there reaches every phone at join; this lands only in its game's chunk.
export { MASH_MS, OrderPicker, swapOrder, toggleOrder } from './pack/order-picker/OrderPicker';
export type { OrderItem, OrderPickerProps } from './pack/order-picker/OrderPicker';
