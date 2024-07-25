import React, {useState, useEffect} from 'react'

import {useAppState, getBoard} from '../state'
import {usePrevious} from '../hooks'
import {Fade, Slide} from '../ui'
import ShowButton from './ShowButton'
import SavedCommentList from './SavedCommentList'

export default function CommentList(): JSX.Element {
  const {mode, loading, board, comments, dispatch} = useAppState()
  const [show, setShow] = useState(false)
  const [selected, setSelected] = useState(board ? board.id : null)
  const prevLoading = usePrevious(loading)

  useEffect(() => {
    if (prevLoading && !loading && board) {
      setShow(false)
      setSelected(board.id)
    }
  }, [prevLoading, loading, board])

  const modeComments = comments.filter(c => c.mode === mode)
  const haveComments = modeComments.length > 0
  const showList = haveComments && show

  return (
    <>
      <Fade in={haveComments}>
        <ShowButton show={showList} toggle={() => setShow(!show)} />
      </Fade>
      <Slide in={showList} from="right">
        <SavedCommentList
          selectedId={selected}
          comments={modeComments}
          onItemClick={(id: string) => {
            dispatch(getBoard(id))
            setSelected(id)
          }}
        />
      </Slide>
    </>
  )
}
