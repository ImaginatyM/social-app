import React from 'react'

import {DISCOVER_FEED_URI} from '#/lib/constants'
import {type FeedDescriptor} from '#/state/queries/post-feed'
import {type FeedSourceInfo} from '#/state/queries/feed'
import {useFeedLayout, type FeedLayout} from '#/state/feedLayout'
import {useSelectedFeed, useSetSelectedFeed} from '#/state/shell/selected-feed'
import {type RenderTabBarFnProps} from '#/view/com/pager/Pager'
import {ChevronBottom_Stroke2_Corner0_Rounded as ChevronDownIcon} from '#/components/icons/Chevron'
import {HomeHeaderLayout} from './HomeHeaderLayout'

const MODE_OPTIONS: Array<{value: FeedLayout; label: string}> = [
  {value: 'gallery', label: 'Gallery'},
  {value: 'twitter', label: 'Feed'},
  {value: 'tiktok', label: 'Clips'},
]

type FeedOption = {
  uri: string
  label: string
  descriptor: FeedDescriptor
}

export function HomeHeader(
  props: RenderTabBarFnProps & {
    testID?: string
    onPressSelected: () => void
    feeds: FeedSourceInfo[]
  },
) {
  const {feeds, onSelect: onSelectProp, onPressSelected} = props
  const setSelectedFeed = useSetSelectedFeed()
  const selectedFeed = useSelectedFeed()
  const {
    layout,
    setLayout,
    activeFeedUri,
    setActiveFeedUri,
    hydrate,
  } = useFeedLayout()

  const feedOptions = React.useMemo<FeedOption[]>(() => {
    if (feeds.length === 0) {
      return [
        {
          uri: DISCOVER_FEED_URI,
          label: 'Discover',
          descriptor: `feedgen|${DISCOVER_FEED_URI}`,
        },
      ]
    }
    return feeds.map(feedInfo => ({
      uri: feedInfo.uri,
      label: feedInfo.displayName,
      descriptor: feedInfo.feedDescriptor as FeedDescriptor,
    }))
  }, [feeds])

  const [hydrated, setHydrated] = React.useState(false)
  React.useEffect(() => {
    hydrate()
    setHydrated(true)
  }, [hydrate])

  const appliedStoredFeedRef = React.useRef(false)
  React.useEffect(() => {
    if (!hydrated || appliedStoredFeedRef.current) {
      return
    }
    appliedStoredFeedRef.current = true
    if (!activeFeedUri) {
      return
    }
    const idx = feeds.findIndex(feedInfo => feedInfo.uri === activeFeedUri)
    if (idx >= 0 && props.selectedPage !== idx) {
      onSelectProp?.(idx)
    }
  }, [activeFeedUri, feeds, hydrated, onSelectProp, props.selectedPage])

  React.useEffect(() => {
    if (!hydrated) return
    const currentFeed = feeds[props.selectedPage]
    if (currentFeed) {
      if (currentFeed.uri !== activeFeedUri) {
        setActiveFeedUri(currentFeed.uri)
      }
      if (currentFeed.feedDescriptor !== selectedFeed) {
        setSelectedFeed(currentFeed.feedDescriptor as FeedDescriptor)
      }
    }
  }, [hydrated, feeds, props.selectedPage, activeFeedUri, setActiveFeedUri, setSelectedFeed, selectedFeed])

  const selectedFeedUri = React.useMemo(() => {
    if (activeFeedUri) {
      return activeFeedUri
    }
    const current = feeds[props.selectedPage]
    return current ? current.uri : feedOptions[0]?.uri ?? ''
  }, [activeFeedUri, feedOptions, feeds, props.selectedPage])

  const [isFeedMenuOpen, setFeedMenuOpen] = React.useState(false)
  const feedMenuRef = React.useRef<HTMLDivElement | null>(null)
  const feedMenuId = React.useId()

  React.useEffect(() => {
    if (!isFeedMenuOpen || typeof document === 'undefined') {
      return
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (!feedMenuRef.current || !target) {
        return
      }
      if (!feedMenuRef.current.contains(target)) {
        setFeedMenuOpen(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFeedMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFeedMenuOpen])

  const handleFeedSelect = React.useCallback(
    (uri: string) => {
      const optionIndex = feedOptions.findIndex(option => option.uri === uri)
      const nextIndex = optionIndex >= 0 ? optionIndex : 0
      const option = feedOptions[nextIndex]
      if (!option) {
        setActiveFeedUri(null)
        return
      }
      setActiveFeedUri(option.uri)
      setSelectedFeed(option.descriptor)
      onSelectProp?.(nextIndex)
      if (nextIndex === props.selectedPage) {
        onPressSelected()
      }
      setFeedMenuOpen(false)
    },
    [
      feedOptions,
      onSelectProp,
      onPressSelected,
      props.selectedPage,
      setFeedMenuOpen,
      setActiveFeedUri,
      setSelectedFeed,
    ],
  )

  const handleModeChange = React.useCallback(
    (next: FeedLayout) => {
      setFeedMenuOpen(false)
      if (layout === next) {
        onPressSelected()
        return
      }
      setLayout(next)
    },
    [layout, onPressSelected, setFeedMenuOpen, setLayout],
  )

  return (
    <HomeHeaderLayout tabBarAnchor={props.tabBarAnchor}>
      <div
        className="home-mode-bar"
        role="tablist"
        aria-label="Home feed layout">
        {MODE_OPTIONS.map(option => {
          const isActive = layout === option.value
          return (
            <div
              key={option.value}
              className="home-mode-bar__slot">
              <div
                className="home-mode-bar__control"
                ref={isActive ? feedMenuRef : undefined}>
                <button
                  type="button"
                  className={`home-mode-bar__button${
                    isActive ? ' is-active' : ''
                  }`}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => handleModeChange(option.value)}>
                  {option.label}
                </button>
                {isActive && (
                  <button
                    type="button"
                    className="home-mode-bar__chevron"
                    aria-label="Open feed menu"
                    aria-haspopup="menu"
                    aria-expanded={isFeedMenuOpen}
                    aria-controls={feedMenuId}
                    onClick={() => setFeedMenuOpen(open => !open)}>
                    <ChevronDownIcon size="xs" fill="currentColor" />
                  </button>
                )}
                {isActive && isFeedMenuOpen && (
                  <div
                    id={feedMenuId}
                    className="home-mode-bar__menu"
                    role="menu"
                    aria-label="Feed menu">
                    {feedOptions.map(option => {
                      const isSelected = option.uri === selectedFeedUri
                      return (
                        <button
                          key={option.uri}
                          type="button"
                          className="home-mode-bar__menu-item"
                          role="menuitemradio"
                          aria-checked={isSelected}
                          onClick={() => handleFeedSelect(option.uri)}>
                          <span className="home-mode-bar__menu-item-label">
                            {option.label}
                          </span>
                          {isSelected && (
                            <span
                              className="home-mode-bar__menu-item-check"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </HomeHeaderLayout>
  )
}
