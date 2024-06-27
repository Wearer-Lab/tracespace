import React from 'react'
import {useAppState} from '../state'
import {useElementListener, useWindowListener} from '../hooks'

type Props = {
  scaleRatio: number
}

export default function ShowComment({scaleRatio}: Props): JSX.Element {
  const {commentToShow, hideComment} = useAppState()

  // useWindowListener('click', () => {
  //   hideComment()
  // })

  useElementListener('.comment-box', 'blur', () => {
    hideComment()
  })

  if (!commentToShow) {
    return <span></span>
  }

  console.log(scaleRatio)
  const x = commentToShow.x * scaleRatio
  const y = commentToShow.y * scaleRatio
  const text = commentToShow.text

  return (
    <div className="comment-box" style={{left: `${x}px`, top: `${y}px`}}>
      <p>{text}</p>
    </div>
  )
}
