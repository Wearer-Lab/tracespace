import React from 'react'

import {stopPropagation} from '../events'
import {Comment} from '../types'
import CommentItem from './CommentItem'

const STYLE = 'absolute right-0 top-10 bottom-5 w-25 overflow-hidden z-1'
const WRAPPER_STYLE = 'w-100 mxh-100 ph3 overflow-y-auto scrollbar-white'
const LIST_STYLE = 'list mt1 mb0 pl0 near-black'

type Props = {
  selectedId: string | null
  comments: Array<Comment>
  onItemClick: (id: string) => void
}

export default function SavedCommentList({comments}: Props): JSX.Element {
  return (
    <div className={STYLE}>
      <div onWheel={stopPropagation} className={WRAPPER_STYLE}>
        <ul className={LIST_STYLE}>
          {comments.map((c, i) => (
            <span key={`${i}-${c.id}`}>
              <CommentItem comment={c} />
            </span>
          ))}
        </ul>
      </div>
    </div>
  )
}
