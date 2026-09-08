// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Pager } from '@/components/shared/pager'
import { getPageWindow } from '@/lib/pagination/paginate'

function setup(total: number, page: number) {
  const onPageChange = vi.fn()
  const utils = render(
    <Pager
      window={getPageWindow(total, page)}
      total={total}
      onPageChange={onPageChange}
    />,
  )
  return { onPageChange, ...utils }
}

describe('pager', () => {
  it('tells the user which rows they are looking at', () => {
    setup(4189, 1)
    expect(screen.getByText(/1–50/)).toBeInTheDocument()
    expect(screen.getByText(/4,189/)).toBeInTheDocument()
    expect(screen.getByText('Page 1 of 84')).toBeInTheDocument()
  })

  it('hides itself entirely when everything fits on one page', () => {
    const { container } = setup(12, 1)
    expect(container).toBeEmptyDOMElement()
  })

  it('disables Previous on the first page and Next on the last', () => {
    setup(4189, 1)
    expect(screen.getByLabelText('Previous page')).toBeDisabled()
    expect(screen.getByLabelText('Next page')).toBeEnabled()
  })

  it('disables Next on the last page', () => {
    setup(4189, 84)
    expect(screen.getByLabelText('Next page')).toBeDisabled()
    expect(screen.getByLabelText('Previous page')).toBeEnabled()
  })

  it('asks for the next and previous page when clicked', () => {
    const { onPageChange } = setup(4189, 3)
    fireEvent.click(screen.getByLabelText('Next page'))
    expect(onPageChange).toHaveBeenCalledWith(4)
    fireEvent.click(screen.getByLabelText('Previous page'))
    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('reports a clamped page rather than an out-of-range one', () => {
    // Filters narrowed 4,189 results down to 3 while the user was on page 40.
    setup(3, 40)
    // One page now, so the controls disappear instead of showing "page 40".
    expect(screen.queryByLabelText('Next page')).toBeNull()
  })
})
