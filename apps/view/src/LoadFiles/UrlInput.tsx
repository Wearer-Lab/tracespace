import React, {useEffect} from 'react'
import {Formik, Form, Field} from 'formik'

import {useLocation} from '../hooks'
import {Button, Icon} from '../ui'
import {select} from '../events'

const LABEL_STYLE = 'db pointer mb2'
const WRAPPER_STYLE = 'flex items-bottom h2'
const INPUT_STYLE =
  'w-100 mh2 bb bt-0 br-0 bl-0 b--near-black code f6 tc bg-transparent'
const BUTTON_STYLE = 'flex-none nr4 brand'

const INPUT_ID = 'load-files_url-input'

const parseUrlHash = (hash: string): URLSearchParams => {
  hash = hash.slice(1)

  return new URLSearchParams(hash)
}

const ObjToHash = (obj: Record<string, string>): string => {
  const qString = new URLSearchParams(obj).toString()

  return qString || ''
}

const defaultUrl = (loc: Location | null): {href: string; open: boolean} => {
  const hash = loc?.hash || ''
  const hashObj = parseUrlHash(hash)
  const model = hashObj.get('model') || ''
  const openModel = hashObj.get('openModel') !== 'false'

  try {
    return {
      href: new URL(decodeURIComponent(model)).href,
      open: Boolean(openModel),
    }
  } catch {
    return {
      href: loc ? `${loc.origin}${loc.pathname}arduino-uno.zip` : '',
      open: false,
    }
  }
}

export type UrlInputProps = {
  children?: React.ReactNode
  handleUrl: (url: string) => unknown
}

export default function UrlInput(props: UrlInputProps): JSX.Element {
  const {children, handleUrl} = props
  const location = useLocation()
  const url = defaultUrl(location)

  useEffect(() => {
    if (url.open) {
      try {
        handleUrl(url.href)
      } finally {
        const hash = ObjToHash({model: url.href, openModel: 'false'})
        window.location.hash = hash
      }
    }
  })

  return (
    <Formik
      initialValues={{url: url.href}}
      onSubmit={values => handleUrl(values.url)}
      enableReinitialize
    >
      {formProps => (
        <Form>
          <label htmlFor={INPUT_ID} className={LABEL_STYLE}>
            {children}
          </label>
          <div className={WRAPPER_STYLE}>
            <Field
              id={INPUT_ID}
              name="url"
              type="text"
              className={INPUT_STYLE}
              onClick={select}
            />
            <Button
              type="submit"
              className={BUTTON_STYLE}
              disabled={!formProps.values.url}
            >
              <Icon name="check" />
            </Button>
          </div>
        </Form>
      )}
    </Formik>
  )
}
