import {useMediaQuery} from 'react-responsive'

import {isNative} from '#/platform/detection'

/**
 * @deprecated use `useBreakpoints` from `#/alf` instead
 */
export function useWebMediaQueries() {
  const isDesktop = useMediaQuery({minWidth: 1024})
  const isTablet = useMediaQuery({minWidth: 768, maxWidth: 1024 - 1})
  const isMobile = useMediaQuery({maxWidth: 768 - 1})
  const isTabletOrMobile = isMobile || isTablet
  const isTabletOrDesktop = isDesktop || isTablet
  if (isNative) {
    return {
      isMobile: true,
      isTablet: false,
      isTabletOrMobile: true,
      isTabletOrDesktop: false,
      isDesktop: false,
    }
  }
  return {isMobile, isTablet, isTabletOrMobile, isTabletOrDesktop, isDesktop}
}
