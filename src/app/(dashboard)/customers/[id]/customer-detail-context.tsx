"use client";

import { createContext, useContext } from "react";
import type {
  Customer,
  InternetProfile,
  NasRouter,
  ProfileGroup,
  Session,
} from "@/lib/types";

export interface CustomerDetailContextType {
  customerId: string;
  customer?: Customer | null;
  isLoading: boolean;
  isFetching: boolean;
  refetchCustomer: () => Promise<unknown>;
  profile?: InternetProfile | null;
  profileGroup?: ProfileGroup | null;
  routerNas?: NasRouter | null;
  activeSession?: Session | null;
  sessionTotalCount: number;
  invoiceTotalCount: number;
}

export const CustomerDetailContext =
  createContext<CustomerDetailContextType | null>(null);

export function useCustomerDetail() {
  const ctx = useContext(CustomerDetailContext);
  if (!ctx) {
    throw new Error(
      "useCustomerDetail must be used within CustomerDetailLayout",
    );
  }
  return ctx;
}
