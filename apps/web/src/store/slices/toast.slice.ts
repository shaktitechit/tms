import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';

export type ToastTone = 'success' | 'error' | 'info';

export type ToastItem = {
  id: string;
  tone: ToastTone;
  message: string;
};

type ToastState = {
  items: ToastItem[];
};

const MAX_TOASTS = 4;

const toastSlice = createSlice({
  name: 'toast',
  initialState: { items: [] } as ToastState,
  reducers: {
    pushToast: {
      reducer(state, action: PayloadAction<ToastItem>) {
        state.items.push(action.payload);
        if (state.items.length > MAX_TOASTS) {
          state.items.splice(0, state.items.length - MAX_TOASTS);
        }
      },
      prepare(input: { tone: ToastTone; message: string }) {
        return { payload: { id: nanoid(), tone: input.tone, message: input.message } };
      },
    },
    dismissToast(state, action: PayloadAction<string>) {
      state.items = state.items.filter((item) => item.id !== action.payload);
    },
  },
});

export const { pushToast, dismissToast } = toastSlice.actions;
export const toastReducer = toastSlice.reducer;
export const selectToasts = (state: { toast: ToastState }) => state.toast.items;
