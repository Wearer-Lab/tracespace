import React from 'react'
import {useAppState} from '../state'
import {useWindowListener} from '../hooks'

export default function ShowComment(): JSX.Element {
  const {commentToShow, hideComment} = useAppState()

  // detect click outside of comment box
  useWindowListener('click', event => {
    if (event.target instanceof HTMLElement) {
      if (!event.target.closest('.comment-box') && commentToShow) {
        hideComment()
      }
    }
  })

  if (!commentToShow) {
    return <span></span>
  }

  const {
    coordinates: [x, y],
    content,
  } = commentToShow

  return (
    <div
      className="comment-box"
      style={{left: `${x + 1}px`, top: `${y + 2}px`}}
    >
      <p>{content}</p>
    </div>
  )
}
