import { createContext, useContext } from 'react';

export const LayoutContext = createContext({ collapsed: false });
export const useLayout = () => useContext(LayoutContext);
