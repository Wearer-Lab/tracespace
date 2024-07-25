import React, {useContext} from 'react'

import {Store, State, Dispatch} from './types'
import {Comment} from '../types'

export const INITIAL_STATE: State = {
  appPreferences: {},
  board: null,
  comments: [],
  savedBoards: [],
  mode: null,
  loading: false,
  updating: false,
  downloading: false,
  layerVisibility: {},
  error: null,
  commentToShow: null,
  resetZoom: false,
  setResetZoom: () => 0,
  showComment: () => 0,
  hideComment: () => 0,
}

export const StoreContext = React.createContext<Store>({
  getState: (data: Partial<State> = {}) => ({
    ...INITIAL_STATE,
    ...data,
  }),
  dispatch: a => a,
})

export const useAppState = (): State & {dispatch: Dispatch} => {
  const {getState, dispatch} = useContext(StoreContext)
  const state = getState()

  state.showComment = (commentToShow: Comment) => {
    state.resetZoom = true
    dispatch({type: 'COMMENT_SHOW', payload: commentToShow})
  }

  state.hideComment = () => {
    state.resetZoom = false
    dispatch({type: 'COMMENT_HIDE'})
  }

  return {
    ...getState(state),
    dispatch,
  }
}
