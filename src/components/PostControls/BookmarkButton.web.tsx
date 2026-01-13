import React, {memo, useCallback, useEffect, useState} from 'react'
import {type Insets} from 'react-native'
import {type AppBskyFeedDefs} from '@atproto/api'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import SaveToCollectionSheet from '#/components/SaveToCollectionSheet'
import {useSavedCollections} from '#/state/savedCollections'
import {type Shadow} from '#/state/cache/post-shadow'
import {useRequireAuth} from '#/state/session'
import {useTheme} from '#/alf'
import {Bookmark, BookmarkFilled} from '#/components/icons/Bookmark'
import {PostControlButton, PostControlButtonIcon} from './PostControlButton'

export const BookmarkButton = memo(function BookmarkButton({
  post,
  big,
  logContext: _logContext,
  hitSlop,
}: {
  post: Shadow<AppBskyFeedDefs.PostView>
  big?: boolean
  logContext: 'FeedItem' | 'PostThreadItem' | 'Post' | 'ImmersiveVideo'
  hitSlop?: Insets
}): React.ReactNode {
  const t = useTheme()
  const {_} = useLingui()
  const requireAuth = useRequireAuth()
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  const load = useSavedCollections(state => state.load)
  const ready = useSavedCollections(state => state.ready)
  const isSavedSomewhere = useSavedCollections(
    useCallback(state => state.contains(post.uri).inAny, [post.uri]),
  )

  useEffect(() => {
    if (!ready) {
      void load()
    }
  }, [ready, load])

  const label = isSavedSomewhere
    ? _(
        msg({
          message: `Manage saved collections`,
          context: `Accessibility label for the save button when item already saved`,
        }),
      )
    : _(
        msg({
          message: `Save to collection`,
          context: `Accessibility label for the save button when item not yet saved`,
        }),
      )

  const onPress = () => {
    requireAuth(async () => {
      setIsSheetOpen(true)
    })
  }

  return (
    <>
      <PostControlButton
        testID="postBookmarkBtn"
        big={big}
        label={label}
        onPress={onPress}
        hitSlop={hitSlop}>
        <PostControlButtonIcon
          fill={isSavedSomewhere ? t.palette.primary_500 : undefined}
          icon={isSavedSomewhere ? BookmarkFilled : Bookmark}
        />
      </PostControlButton>
      {isSheetOpen && (
        <SaveToCollectionSheet
          atUri={post.uri}
          onClose={() => setIsSheetOpen(false)}
        />
      )}
    </>
  )
})
