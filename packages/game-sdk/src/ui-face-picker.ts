// `@partybox/game-sdk/ui/face-picker` — its own subpath (audit #23) so the component lands in the
// chunk of the game that uses it, never in the app's entry.
export { FacePicker } from './pack/face-picker/FacePicker';
export type { FaceOption, FacePickerProps } from './pack/face-picker/FacePicker';
