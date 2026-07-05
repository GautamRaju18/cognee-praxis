import { createContext, useContext } from "react";

/** App-level navigation actions, available to any component without prop-drilling. */
export interface NavActions {
  openDecision: (id: string) => void;
  openInGraph: (decisionId: string) => void;
  goToPage: (key: string) => void;
}

export const NavContext = createContext<NavActions | null>(null);

export function useNav(): NavActions {
  return (
    useContext(NavContext) ?? {
      openDecision: () => {},
      openInGraph: () => {},
      goToPage: () => {},
    }
  );
}
