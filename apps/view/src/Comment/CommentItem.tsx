import React from 'react'
import cx from 'classnames'
import {Comment} from '../types'
import {ContextMenu} from 'primereact/contextmenu'
import {useAppState} from '../state'

export type CommentItemProps = {
  comment: Comment
}

// TODO(mc, 2018-12-26): dedupe this logic
// const DEFAULT_COLOR = 'rgba(00, 66, 00, 0.75)'

function formatDate(date: number): string {
  return new Date(date).toLocaleString()
}

export default function CommentItem({comment}: CommentItemProps): JSX.Element {
  const {showComment} = useAppState()

  return (
    <li
      className={cx('dib w-100 pb3 fr', {pointer: true})}
      onClick={() =>
        showComment({x: comment.x, y: comment.y, text: comment.text})
      }
      style={{userSelect: 'none'}}
    >
      <div className={cx('relative overflow-hidden br3 shadow')}>
        <div className="w-100 bg-white">
          <p
            className={cx('f6 lh-title mv0 py-1 truncate', {
              b: false,
            })}
          >
            Comment by <span className="b">{comment.author}</span>
            <br />
            On {formatDate(comment.addedAt)}
          </p>
        </div>
      </div>
    </li>
  )
}
