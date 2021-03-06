import React from "react";
import PropTypes from "prop-types";
import throttle from "lodash/throttle";

import { smoothScrollTo, findActiveNode } from "helpers/dom";
import { SideNavProgressContext } from "components/SideNav/Provider";
import { useSubscription } from "helpers/useSubscription";

export const Context = React.createContext({
  isScrollingDown: false,
  stopTrackingElement: () => {},
  trackElement: () => {},
  onLinkClick: () => {},
  setIsNavClicked: () => {},
  subscribe: () => {},
});

const sortByPosition = (a, b) => {
  const aY = a.current.getBoundingClientRect().top;
  const bY = b.current.getBoundingClientRect().top;
  return aY - bY;
};
let lastScrollPosition = 0;

const routeMap = new Map();
const elementMap = new Map();

export const ScrollRouter = ({ children, initialActive = "" }) => {
  const { subscribe, emit } = useSubscription();
  const initialLoadCheck = React.useRef(false);
  const [activeNode, setActiveNode] = React.useState({
    ref: null,
    id: initialActive,
  });
  const [isNavClicked, setIsNavClicked] = React.useState(false);
  const trackedElementsRef = React.useRef([]);
  const isScrollingDown = React.useRef(false);

  // Navigation
  const onLinkClick = React.useCallback(
    function onLinkClick(route) {
      emit(route);
      window.history.pushState(null, null, route);
      smoothScrollTo(elementMap.get(route).current, { duration: 0 });
    },
    [emit],
  );

  // Scroll listener
  React.useEffect(() => {
    const handler = throttle(() => {
      // If we haven't scrolled at least 100 pixels, just bail.
      if (Math.abs(window.scrollY - lastScrollPosition) < 100) {
        return;
      }
      isScrollingDown.current = window.scrollY > lastScrollPosition;
      lastScrollPosition = window.scrollY;

      const newActiveNode = findActiveNode(
        trackedElementsRef.current,
        isNavClicked ? true : isScrollingDown.current,
      );

      if (isNavClicked) setIsNavClicked(!isNavClicked);

      // If we've found an active node and it's not the same one as we had
      // before, update the route.
      if (newActiveNode && newActiveNode !== activeNode) {
        setActiveNode(newActiveNode);
        const newUrl = `${routeMap.get(newActiveNode)}${
          window.location.search
        }`;
        emit(newUrl);
        window.history.replaceState(null, null, newUrl);
      }
    }, 60);

    window.addEventListener("scroll", handler);
    handler();

    return () => {
      window.removeEventListener("scroll", handler);
    };
  }, [activeNode, isNavClicked, emit]);

  // Tracked sections
  const trackElement = React.useCallback(
    (ref, route) => {
      routeMap.set(ref, route);
      elementMap.set(route, ref);
      trackedElementsRef.current.push(ref);
      trackedElementsRef.current.sort(sortByPosition);

      // We want to scroll to the element associated with the route _once_.
      if (!initialLoadCheck.current && window.location.pathname === route) {
        emit(route);
        initialLoadCheck.current = true;
        // Our navbar is 90px tall
        smoothScrollTo(ref.current, { duration: 0 });
      }
    },
    [emit],
  );
  const stopTrackingElement = React.useCallback((ref) => {
    const route = routeMap.get(ref);
    routeMap.delete(ref);
    elementMap.delete(route);
    trackedElementsRef.current = trackedElementsRef.current.filter(
      (x) => x !== ref,
    );
  }, []);

  const contextValue = React.useMemo(
    () => ({
      stopTrackingElement,
      trackElement,
      onLinkClick,
      isScrollingDown,
      setIsNavClicked,
      subscribe,
    }),
    [
      stopTrackingElement,
      trackElement,
      onLinkClick,
      isScrollingDown,
      setIsNavClicked,
      subscribe,
    ],
  );
  const sideNavContextValue = React.useMemo(
    () => ({
      // Make these no-op, cuz we're already tracking elements. This would be
      // used by TrackedContent, but we'll already have Route components reporting
      stopTrackingElement: () => {},
      trackElement: () => {},
      activeContent: {
        ref: activeNode,
        id: routeMap.get(activeNode),
      },
    }),
    [activeNode],
  );

  return (
    <Context.Provider value={contextValue}>
      <SideNavProgressContext.Provider value={sideNavContextValue}>
        {children}
      </SideNavProgressContext.Provider>
    </Context.Provider>
  );
};

ScrollRouter.propTypes = {
  children: PropTypes.node.isRequired,
  initialActive: PropTypes.string,
};
