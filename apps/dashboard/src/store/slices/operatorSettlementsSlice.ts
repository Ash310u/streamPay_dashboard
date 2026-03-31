import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../index";

type OperatorSettlementsState = {
  settlementDate: string;
};

const initialState: OperatorSettlementsState = {
  settlementDate: new Date().toISOString().slice(0, 10),
};

const operatorSettlementsSlice = createSlice({
  name: "operatorSettlements",
  initialState,
  reducers: {
    setOperatorSettlementDate(state, action: PayloadAction<string>) {
      state.settlementDate = action.payload;
    },
  },
});

export const { setOperatorSettlementDate } = operatorSettlementsSlice.actions;

export const operatorSettlementsReducer = operatorSettlementsSlice.reducer;

export const selectOperatorSettlements = (state: RootState) => state.operatorSettlements;
