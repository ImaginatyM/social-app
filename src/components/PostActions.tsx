import React from 'react'
import clsx from 'clsx'

import ActionButton from './ActionButton'
import {
  Heart2_Filled_Stroke2_Corner0_Rounded as HeartFilled,
  Heart2_Stroke2_Corner0_Rounded as HeartOutline,
} from '#/components/icons/Heart2'
import {Message_Stroke2_Corner0_Rounded as CommentIcon} from '#/components/icons/Message'
import {Bookmark, BookmarkFilled} from '#/components/icons/Bookmark'
import {ArrowShareRight_Stroke2_Corner2_Rounded as ShareIcon} from '#/components/icons/ArrowShareRight'

export type PostLayout = 'twitter' | 'gallery' | 'tiktok'

type Props = {
  layout: PostLayout
  onLike: () => void
  onComment: () => void
  onSave: () => void
  onShare: () => void
  liked: boolean
  saved: boolean
  counts?: {likes?: number; comments?: number}
}

export default function PostActions({
  layout,
  onLike,
  onComment,
  onSave,
  onShare,
  liked,
  saved,
  counts,
}: Props) {
  const LikeIcon = liked ? HeartFilled : HeartOutline
  const SaveIcon = saved ? BookmarkFilled : Bookmark

  return (
    <div className={clsx('post-actions', `actions-${layout}`)}>
      {layout === 'twitter' && (
        <div className="row">
          <ActionButton
            layout="row"
            variant="comment"
            label="Commenter"
            icon={CommentIcon}
            count={counts?.comments}
            iconSize="sm"
            onClick={onComment}
          />
          <ActionButton
            layout="row"
            variant="like"
            label="Aimer"
            icon={LikeIcon}
            count={counts?.likes}
            iconSize="sm"
            active={liked}
            onClick={onLike}
          />
          <ActionButton
            layout="row"
            variant="save"
            label="Enregistrer"
            icon={SaveIcon}
            iconSize="sm"
            active={saved}
            onClick={onSave}
          />
          <ActionButton
            layout="row"
            variant="share"
            label="Partager"
            icon={ShareIcon}
            iconSize="sm"
            onClick={onShare}
          />
        </div>
      )}

      {layout === 'gallery' && (
        <div className="row ig">
          <div className="left">
            <ActionButton
              layout="row"
              variant="like"
              label="Aimer"
              icon={LikeIcon}
              count={counts?.likes}
              iconSize="sm"
              active={liked}
              onClick={onLike}
            />
            <ActionButton
              layout="row"
              variant="comment"
              label="Commenter"
              icon={CommentIcon}
              iconSize="sm"
              onClick={onComment}
            />
            <ActionButton
              layout="row"
              variant="share"
              label="Partager"
              icon={ShareIcon}
              iconSize="sm"
              onClick={onShare}
            />
          </div>
          <div className="right">
            <ActionButton
              layout="row"
              variant="save"
              label="Enregistrer"
              icon={SaveIcon}
              iconSize="sm"
              active={saved}
              onClick={onSave}
            />
          </div>
        </div>
      )}

      {layout === 'tiktok' && (
        <div className="tt-rail">
          <ActionButton
            layout="column"
            variant="like"
            label="Aimer"
            icon={LikeIcon}
            count={counts?.likes}
            iconSize="lg"
            active={liked}
            onClick={onLike}
            className="tt-btn"
          />
          <ActionButton
            layout="column"
            variant="comment"
            label="Commenter"
            icon={CommentIcon}
            count={counts?.comments}
            iconSize="lg"
            onClick={onComment}
            className="tt-btn"
          />
          <ActionButton
            layout="column"
            variant="save"
            label="Enregistrer"
            icon={SaveIcon}
            iconSize="lg"
            active={saved}
            onClick={onSave}
            className="tt-btn"
          />
          <ActionButton
            layout="column"
            variant="share"
            label="Partager"
            icon={ShareIcon}
            iconSize="lg"
            onClick={onShare}
            className="tt-btn"
          />
        </div>
      )}
    </div>
  )
}
